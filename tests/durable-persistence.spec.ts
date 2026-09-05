import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const binary = resolve(root, 'target/debug/agent-capacity-ledger');

async function unusedPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not reserve a test port.'));
      server.close(error => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function startServer(port: number, dataDir: string): Promise<ChildProcess> {
  const server = spawn(binary, [], {
    cwd: root,
    env: { PATH: process.env.PATH ?? '', PORT: String(port), DATA_DIR: dataDir },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Test server exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return server;
    } catch { /* wait for the listener */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 50));
  }
  server.kill('SIGTERM');
  throw new Error('Test server did not become healthy.');
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null) return;
  const exited = new Promise<void>(resolveExit => server.once('exit', () => resolveExit()));
  server.kill('SIGTERM');
  await Promise.race([exited, new Promise<void>(resolveDelay => setTimeout(resolveDelay, 2_000))]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

test('@claim:server-persistence saves a ledger, reads it back, and keeps it after a server restart', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'agent-capacity-ledger-durable-'));
  const port = await unusedPort();
  const workspace = `restart-${Date.now()}`;
  const body = { data: { teamName: 'Restart proof team', sources: [], spend: [] } };
  let first: ChildProcess | undefined;
  let restarted: ChildProcess | undefined;

  try {
    first = await startServer(port, dataDir);
    const saved = await fetch(`http://127.0.0.1:${port}/api/ledger/${workspace}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.61' },
      body: JSON.stringify(body),
    });
    expect(saved.status).toBe(200);
    const immediate = await fetch(`http://127.0.0.1:${port}/api/ledger/${workspace}`, { headers: { 'x-forwarded-for': '198.51.100.61' } });
    expect((await immediate.json()).data).toEqual(body.data);

    await stopServer(first);
    first = undefined;
    restarted = await startServer(port, dataDir);
    const afterRestart = await fetch(`http://127.0.0.1:${port}/api/ledger/${workspace}`, { headers: { 'x-forwarded-for': '198.51.100.61' } });
    expect(afterRestart.status).toBe(200);
    expect((await afterRestart.json()).data).toEqual(body.data);
  } finally {
    if (first) await stopServer(first);
    if (restarted) await stopServer(restarted);
    await rm(dataDir, { recursive: true, force: true });
  }
});
