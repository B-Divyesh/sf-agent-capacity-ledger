import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const base = 'https://agent-capacity-ledger.sociobot.in';
const candidate = '14a5c3575fac020d80bd8548f37d976ec7db8ed8';
const output = { base, checkedAt: new Date().toISOString(), candidate };
const digest = value => createHash('sha256').update(value).digest('hex');
const jsonHeaders = ip => ({ 'content-type': 'application/json', 'x-forwarded-for': ip });
const source = { id: 'source-1', vendor: 'Capacity QA', plan: 'Boundary', limit: 10, used: 10, dailyPace: 0, resetsOn: '2099-01-01', monthlyCost: 0, fallbackId: '', notes: 'Fresh verification record' };
const data = { teamName: `QA durable ${Date.now()}`, sources: [source], spend: [{ id: 'spend-1', date: '2026-08-28', project: 'Verification', sourceId: 'source-1', amount: 0 }] };
const workspace = `verify3-${Date.now()}`;

const health = await fetch(`${base}/health`);
const healthBody = await health.json();
assert.equal(health.status, 200);
assert.equal(healthBody.build_sha, candidate);
output.health = { status: health.status, body: healthBody, headers: Object.fromEntries(health.headers) };

const saved = await fetch(`${base}/api/ledger/${workspace}`, { method: 'PUT', headers: jsonHeaders('198.51.100.101'), body: JSON.stringify({ data }) });
assert.equal(saved.status, 200);
output.saved = { workspace, status: saved.status, body: await saved.json() };

const persistenceReads = await Promise.all(Array.from({ length: 120 }, (_, index) => fetch(`${base}/api/ledger/${workspace}?read=${index}`, { headers: { 'x-forwarded-for': `203.0.${Math.floor(index / 250)}.${(index % 250) + 1}` } })));
const persistenceBodies = await Promise.all(persistenceReads.map(async response => ({ status: response.status, body: await response.json() })));
output.persistence = {
  total: persistenceBodies.length,
  statusCounts: Object.fromEntries([...new Set(persistenceBodies.map(item => item.status))].map(status => [status, persistenceBodies.filter(item => item.status === status).length])),
  exactMatches: persistenceBodies.filter(item => JSON.stringify(item.body.data) === JSON.stringify(data)).length
};
assert.equal(output.persistence.exactMatches, 120);

const healthBurst = await Promise.all(Array.from({ length: 100 }, () => fetch(`${base}/health`)));
output.healthConcurrency = { total: healthBurst.length, ok: healthBurst.filter(response => response.status === 200).length };
assert.equal(output.healthConcurrency.ok, 100);

const concurrentWrites = await Promise.all(Array.from({ length: 30 }, (_, index) => {
  const concurrentData = { ...data, teamName: `Concurrent workspace ${index}` };
  return fetch(`${base}/api/ledger/verify3-concurrent-${Date.now()}-${index}`, { method: 'PUT', headers: jsonHeaders(`198.18.0.${index + 1}`), body: JSON.stringify({ data: concurrentData }) });
}));
output.concurrentWrites = { total: concurrentWrites.length, ok: concurrentWrites.filter(response => response.status === 200).length, statuses: concurrentWrites.map(response => response.status) };
assert.equal(output.concurrentWrites.ok, 30);

const invalidCases = [
  ['bad-workspace', `${base}/api/ledger/no`, { method: 'PUT', headers: jsonHeaders('198.51.100.110'), body: JSON.stringify({ data }) }],
  ['used-over-limit', `${base}/api/ledger/verify3-invalid-used`, { method: 'PUT', headers: jsonHeaders('198.51.100.111'), body: JSON.stringify({ data: { ...data, sources: [{ ...source, used: 11 }] } }) }],
  ['negative-cost', `${base}/api/ledger/verify3-negative-cost`, { method: 'PUT', headers: jsonHeaders('198.51.100.112'), body: JSON.stringify({ data: { ...data, sources: [{ ...source, monthlyCost: -1 }] } }) }],
  ['impossible-date', `${base}/api/ledger/verify3-invalid-date`, { method: 'PUT', headers: jsonHeaders('198.51.100.113'), body: JSON.stringify({ data: { ...data, sources: [{ ...source, resetsOn: '2026-02-30' }] } }) }],
  ['sensitive-extra-field', `${base}/api/ledger/verify3-sensitive`, { method: 'PUT', headers: jsonHeaders('198.51.100.114'), body: JSON.stringify({ data: { ...data, prompt: 'must reject' } }) }],
  ['malformed-json', `${base}/api/ledger/verify3-malformed`, { method: 'PUT', headers: jsonHeaders('198.51.100.115'), body: '{not json' }]
];
output.invalid = {};
for (const [name, url, init] of invalidCases) {
  const response = await fetch(url, init);
  output.invalid[name] = { status: response.status, body: await response.text() };
  assert.ok(response.status >= 400 && response.status < 500);
}

const rateIp = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
const limitedResponses = await Promise.all(Array.from({ length: 60 }, () => fetch(`${base}/api/ledger/verify3-rate`, { headers: { 'x-forwarded-for': rateIp } })));
output.productRateLimit = {
  total: 60,
  statusCounts: Object.fromEntries([...new Set(limitedResponses.map(r => r.status))].map(status => [status, limitedResponses.filter(r => r.status === status).length])),
  retryAfter: limitedResponses.filter(r => r.status === 429).map(r => r.headers.get('retry-after'))
};
assert.ok(output.productRateLimit.retryAfter.length > 0);
assert.ok(output.productRateLimit.retryAfter.every(Boolean));

const token = `verify3_invalid_${Date.now()}`;
const unlockResponses = await Promise.all(Array.from({ length: 80 }, () => fetch(`https://api.sociobot.in/api/v1/products/agent-capacity-ledger/verify?license=${token}`)));
output.unlockRateLimit = {
  total: 80,
  statusCounts: Object.fromEntries([...new Set(unlockResponses.map(r => r.status))].map(status => [status, unlockResponses.filter(r => r.status === status).length])),
  retryAfter: unlockResponses.filter(r => r.status === 429).map(r => r.headers.get('retry-after')),
  cors: unlockResponses.find(r => r.status === 200)?.headers.get('access-control-allow-origin') ?? null,
  cacheControl: unlockResponses.find(r => r.status === 200)?.headers.get('cache-control') ?? null
};
assert.ok(output.unlockRateLimit.retryAfter.length > 0);
assert.ok(output.unlockRateLimit.retryAfter.every(Boolean));

const landing = await fetch(`${base}/`);
const html = await landing.text();
const jsPath = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
const cssPath = html.match(/\/assets\/index-[^"']+\.css/)?.[0];
assert.ok(jsPath && cssPath);
output.responses = { landing: { status: landing.status, headers: Object.fromEntries(landing.headers) }, assets: {} };
for (const [kind, path, localPath] of [['js', jsPath, `dist${jsPath}`], ['css', cssPath, `dist${cssPath}`]]) {
  const response = await fetch(`${base}${path}`);
  const live = Buffer.from(await response.arrayBuffer());
  const local = await readFile(localPath);
  output.responses.assets[kind] = { path, status: response.status, bytes: live.length, cacheControl: response.headers.get('cache-control'), liveSha256: digest(live), localSha256: digest(local), matches: digest(live) === digest(local) };
  assert.equal(output.responses.assets[kind].matches, true);
  assert.equal(output.responses.assets[kind].cacheControl, 'public, max-age=31536000, immutable');
}

await writeFile('.factory/verification-artifacts/verify-3/live-backend-qa.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
