import { expect, test } from '@playwright/test';

test('@claim:capacity-forecast forecasts remaining useful sessions and warns before reset', async ({ page }) => {
  await page.goto('/demo');
  const source = page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Claude Code' }) });
  await expect(source.getByText('At risk')).toBeVisible();
  await expect(source.getByText(/17 of 120 sessions left/)).toBeVisible();
  await expect(source.getByText(/lasts about 2 days\. Estimate\./)).toBeVisible();
});

test('@claim:csv-export exports every demo source and spend entry as CSV', async ({ page }) => {
  await page.goto('/demo');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();
  expect(csv).toContain('"type","date","project","vendor"');
  expect(csv).toContain('"Claude Code","Max seat"');
  expect(csv).toContain('"Atlas migration"');
  expect(csv.trim().split('\n')).toHaveLength(8);
});

test('@claim:demo-isolation keeps demo changes out of the real workspace', async ({ page }) => {
  await page.goto('/demo');
  const used = page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Claude Code' }) }).getByLabel('Used sessions');
  await used.fill('110');
  await used.blur();
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page.getByRole('heading', { name: 'No sources to watch yet' })).toBeVisible();
});

test('@claim:prompt-privacy sends no demo data to another origin', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') external.push(request.url());
  });
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await downloadPromise;
  expect(external).toEqual([]);
});

test('@claim:server-persistence saves and loads a real workspace', async ({ request }) => {
  const id = `test-${Date.now()}`;
  const headers = { 'x-forwarded-for': '198.51.100.10' };
  const data = { teamName: 'Test team', sources: [], spend: [] };
  const saved = await request.put(`/api/ledger/${id}`, { headers, data: { data } });
  expect(saved.ok()).toBeTruthy();
  const loaded = await request.get(`/api/ledger/${id}`, { headers });
  expect(loaded.ok()).toBeTruthy();
  expect((await loaded.json()).data).toEqual(data);
});

test('@claim:workspace-sharing opens the same ledger from its private link', async ({ page, request }) => {
  const id = `shared-${Date.now()}`;
  const source = { id: 'shared-source', vendor: 'Shared Codex seat', plan: 'Team', limit: 100, used: 25, dailyPace: 4, resetsOn: '2099-01-01', monthlyCost: 50, fallbackId: '', notes: '' };
  const response = await request.put(`/api/ledger/${id}`, {
    headers: { 'x-forwarded-for': '198.51.100.22' },
    data: { data: { teamName: 'Shared team', sources: [source], spend: [] } },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto(`/ledger?workspace=${id}`);
  await expect(page.getByRole('heading', { name: 'Shared Codex seat' })).toBeVisible();
  await expect(page.getByText('Shared team · forecasts are estimates')).toBeVisible();
});

test('@claim:offline-queue keeps an open-page edit and saves it after reconnect', async ({ page, context, request }) => {
  await page.goto('/ledger');
  const workspace = await page.evaluate(() => localStorage.getItem('ledger:workspace'));
  expect(workspace).toBeTruthy();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByLabel('Vendor').fill('Offline source');
  await page.getByLabel('Plan').fill('Team');
  await page.getByRole('button', { name: 'Save source' }).click();
  await expect(page.getByRole('heading', { name: 'Offline source' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'queued on this device' })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: 'Ledger saved' })).toBeVisible();
  const loaded = await request.get(`/api/ledger/${workspace}`, { headers: { 'x-forwarded-for': '198.51.100.23' } });
  expect((await loaded.json()).data.sources[0].vendor).toBe('Offline source');
});

test('@claim:rate-limit returns 429 and Retry-After after the API allowance', async ({ request }) => {
  const headers = { 'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 200) + 1}` };
  const responses = await Promise.all(Array.from({ length: 60 }, () => request.get('/api/ledger/rate-limit-test', { headers })));
  const limited = responses.find(response => response.status() === 429);
  expect(limited).toBeDefined();
  expect(limited!.headers()['retry-after']).toBeTruthy();
});

test('@claim:paid-license stores and verifies a returned team license', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/agent-capacity-ledger/verify?license=test_token', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: true, reason: 'ok', expires_at: '2027-08-28T00:00:00Z' }),
  }));
  await page.goto('/ledger?license=test_token');
  await expect(page.getByRole('heading', { name: 'Team plan active' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb_license:agent-capacity-ledger'))).toBe('test_token');
  expect(new URL(page.url()).searchParams.has('license')).toBe(false);
});
