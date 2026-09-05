import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const base = 'https://agent-capacity-ledger.sociobot.in';
const runningBuild = '2e7b32ecb113b44e892417b035c968fc0704ac37';
const jsonHeaders = ip => ({ 'content-type': 'application/json', 'x-forwarded-for': ip });
const digest = value => createHash('sha256').update(value).digest('hex');
const workspace = `verify4-${Date.now()}`;
const isolatedWorkspace = `verify4-isolated-${Date.now()}`;
const source = {
  id: 'qa-source',
  vendor: 'Verification source',
  plan: 'Boundary plan',
  limit: 10,
  used: 10,
  dailyPace: 0,
  resetsOn: '2099-01-01',
  monthlyCost: 0,
  fallbackId: '',
  notes: 'Verification record',
};
const data = {
  teamName: 'Verification 4 isolated workspace',
  sources: [source],
  spend: [{ id: 'qa-spend', date: '2026-09-05', project: 'QA', sourceId: source.id, amount: 0 }],
};
const result = { checkedAt: new Date().toISOString(), base, runningBuild, workspace, isolatedWorkspace };

const health = await fetch(`${base}/health`);
result.health = { status: health.status, body: await health.json(), headers: Object.fromEntries(health.headers) };
assert.equal(result.health.status, 200);
assert.equal(result.health.body.status, 'ok');
assert.equal(result.health.body.build_sha, runningBuild);

const save = await fetch(`${base}/api/ledger/${workspace}`, {
  method: 'PUT',
  headers: jsonHeaders('198.51.100.201'),
  body: JSON.stringify({ data }),
});
result.save = { status: save.status, body: await save.json(), cacheControl: save.headers.get('cache-control') };
assert.equal(result.save.status, 200);
assert.equal(result.save.cacheControl, 'private, no-store');

const reads = await Promise.all(Array.from({ length: 120 }, (_, index) => fetch(`${base}/api/ledger/${workspace}?read=${index}`, {
  headers: { 'x-forwarded-for': `203.0.${Math.floor(index / 250)}.${index + 1}` },
})));
const readBodies = await Promise.all(reads.map(async response => ({ status: response.status, cacheControl: response.headers.get('cache-control'), body: await response.json() })));
result.persistenceBeforeRestart = {
  total: readBodies.length,
  exactMatches: readBodies.filter(item => JSON.stringify(item.body.data) === JSON.stringify(data)).length,
  statuses: Object.fromEntries([...new Set(readBodies.map(item => item.status))].map(status => [status, readBodies.filter(item => item.status === status).length])),
  allPrivateNoStore: readBodies.every(item => item.cacheControl === 'private, no-store'),
};
assert.equal(result.persistenceBeforeRestart.exactMatches, 120);
assert.equal(result.persistenceBeforeRestart.allPrivateNoStore, true);

const isolated = await fetch(`${base}/api/ledger/${isolatedWorkspace}`, { headers: { 'x-forwarded-for': '198.51.100.202' } });
const isolatedBody = await isolated.json();
result.workspaceIsolation = { status: isolated.status, data: isolatedBody.data, differsFromWrittenWorkspace: JSON.stringify(isolatedBody.data) !== JSON.stringify(data) };
assert.deepEqual(isolatedBody.data, { teamName: 'My engineering team', sources: [], spend: [] });

const invalidCases = [
  ['short-workspace', `${base}/api/ledger/no`, { method: 'PUT', headers: jsonHeaders('198.51.100.203'), body: JSON.stringify({ data }) }],
  ['used-over-limit', `${base}/api/ledger/verify4-invalid-used`, { method: 'PUT', headers: jsonHeaders('198.51.100.204'), body: JSON.stringify({ data: { ...data, sources: [{ ...source, used: 11 }] } }) }],
  ['negative-cost', `${base}/api/ledger/verify4-negative-cost`, { method: 'PUT', headers: jsonHeaders('198.51.100.205'), body: JSON.stringify({ data: { ...data, sources: [{ ...source, monthlyCost: -1 }] } }) }],
  ['impossible-date', `${base}/api/ledger/verify4-invalid-date`, { method: 'PUT', headers: jsonHeaders('198.51.100.206'), body: JSON.stringify({ data: { ...data, sources: [{ ...source, resetsOn: '2026-02-30' }] } }) }],
  ['sensitive-field', `${base}/api/ledger/verify4-sensitive`, { method: 'PUT', headers: jsonHeaders('198.51.100.207'), body: JSON.stringify({ data: { ...data, prompt: 'must reject' } }) }],
  ['malformed-json', `${base}/api/ledger/verify4-malformed`, { method: 'PUT', headers: jsonHeaders('198.51.100.208'), body: '{bad json' }],
];
result.invalid = {};
for (const [name, url, init] of invalidCases) {
  const response = await fetch(url, init);
  result.invalid[name] = { status: response.status, body: await response.text() };
  assert.ok(response.status >= 400 && response.status < 500);
}

const rateIp = `192.0.2.${Math.floor(Math.random() * 150) + 20}`;
const rateResponses = await Promise.all(Array.from({ length: 60 }, () => fetch(`${base}/api/ledger/verify4-rate`, { headers: { 'x-forwarded-for': rateIp } })));
result.rateLimit = {
  total: rateResponses.length,
  statuses: Object.fromEntries([...new Set(rateResponses.map(response => response.status))].map(status => [status, rateResponses.filter(response => response.status === status).length])),
  retryAfter: rateResponses.filter(response => response.status === 429).map(response => response.headers.get('retry-after')),
};
assert.ok(result.rateLimit.retryAfter.length > 0);
assert.ok(result.rateLimit.retryAfter.every(Boolean));

const healthBurst = await Promise.all(Array.from({ length: 100 }, () => fetch(`${base}/health`)));
result.healthAllowance = { total: healthBurst.length, ok: healthBurst.filter(response => response.status === 200).length };
assert.equal(result.healthAllowance.ok, 100);

const landing = await fetch(`${base}/`);
const html = await landing.text();
const jsPath = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
const cssPath = html.match(/\/assets\/index-[^"']+\.css/)?.[0];
assert.ok(jsPath && cssPath);
result.assets = {};
for (const [kind, path] of [['js', jsPath], ['css', cssPath]]) {
  const response = await fetch(`${base}${path}`);
  const live = Buffer.from(await response.arrayBuffer());
  const local = await readFile(`dist${path}`);
  result.assets[kind] = {
    path,
    status: response.status,
    bytes: live.length,
    cacheControl: response.headers.get('cache-control'),
    liveSha256: digest(live),
    localSha256: digest(local),
    matchesLocal: digest(live) === digest(local),
  };
  assert.equal(result.assets[kind].matchesLocal, true);
  assert.equal(result.assets[kind].cacheControl, 'public, max-age=31536000, immutable');
}

const missingPage = await fetch(`${base}/missing-verify-4`);
const missingApi = await fetch(`${base}/api/missing-verify-4`);
result.notFound = { page: missingPage.status, api: missingApi.status };
assert.equal(result.notFound.page, 404);
assert.equal(result.notFound.api, 404);

await writeFile('/work/.evidence/verify-4/live-backend-before-restart.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
