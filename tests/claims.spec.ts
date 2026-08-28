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

test('@claim:csv-import imports RFC 4180 quoted vendor fields with their source readings', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan,limit,used,daily_pace,resets_on,monthly_cost\n"Anthropic, Inc",Team,80,20,3,2099-01-01,35');
  await page.getByRole('button', { name: 'Import sources' }).click();
  const source = page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Anthropic, Inc' }) });
  await expect(source).toContainText('60 of 80 sessions left');
  await expect(source).toContainText('$35/month');
});

test('@claim:project-spend records cost by project and updates attribution', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Record spend' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record project spend' });
  await dialog.getByLabel('Project', { exact: true }).fill('Launch review');
  await dialog.getByLabel('Cost in USD', { exact: true }).fill('100');
  await dialog.getByRole('button', { name: 'Save spend' }).click();
  await expect(page.getByText('Launch review')).toBeVisible();
  await expect(page.locator('.forecast-strip')).toContainText('96%');
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

test('@claim:data-boundary never requests or accepts prompts, code, keys, or passwords', async ({ page, request }) => {
  await page.goto('/ledger');
  const labels = (await page.locator('label').allTextContents()).join(' ').toLowerCase();
  expect(labels).not.toMatch(/prompt|source code|api key|password/);
  const workspace = `boundary-${Date.now()}`;
  const response = await request.put(`/api/ledger/${workspace}`, {
    headers: { 'x-forwarded-for': '198.51.100.31' },
    data: { data: { teamName: 'Boundary team', prompt: 'private prompt', sources: [], spend: [] } },
  });
  expect(response.status()).toBe(422);
  const stored = await request.get(`/api/ledger/${workspace}`, { headers: { 'x-forwarded-for': '198.51.100.31' } });
  expect((await stored.json()).data).toEqual({ teamName: 'My engineering team', sources: [], spend: [] });
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

test('@claim:license-daily-cache verifies an unchanged license no more than once a day', async ({ page }) => {
  let checks = 0;
  await page.route('https://api.sociobot.in/api/v1/products/agent-capacity-ledger/verify?license=daily_token', route => {
    checks += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true, reason: 'ok' }) });
  });
  await page.goto('/ledger?license=daily_token');
  await expect(page.getByRole('heading', { name: 'Team plan active' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Team plan active' })).toBeVisible();
  expect(checks).toBe(1);
});

test('@claim:source-cap keeps three sources free and permits a fourth with a valid team license', async ({ page }) => {
  await page.goto('/ledger');
  for (let index = 1; index <= 3; index += 1) {
    await page.getByRole('button', { name: 'Add a source' }).click();
    await page.getByLabel('Vendor').fill(`Free source ${index}`);
    await page.getByLabel('Plan', { exact: true }).fill('Team');
    await page.getByRole('button', { name: 'Save source' }).click();
    await expect(page.getByRole('heading', { name: `Free source ${index}` })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByLabel('Vendor').fill('Fourth source');
  await page.getByLabel('Plan', { exact: true }).fill('Team');
  await page.getByRole('button', { name: 'Save source' }).click();
  await expect(page.getByRole('alert')).toHaveText('The free ledger holds three sources. Add the team plan to add more.');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.evaluate(() => {
    localStorage.setItem('sb_license:agent-capacity-ledger', 'valid_cap_token');
    localStorage.setItem('sb_license_verdict:agent-capacity-ledger', JSON.stringify({ valid: true, checkedAt: Date.now() }));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Team plan active' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByLabel('Vendor').fill('Fourth source');
  await page.getByLabel('Plan', { exact: true }).fill('Team');
  await page.getByRole('button', { name: 'Save source' }).click();
  await expect(page.getByRole('heading', { name: 'Fourth source' })).toBeVisible();
});

test('@claim:policy-boundary has no model proxy or account-sharing workflow', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('The ledger does not proxy models, collect prompts, store vendor credentials, or encourage account sharing.')).toBeVisible();
  const proxy = await request.post('/api/proxy', {
    headers: { 'x-forwarded-for': '198.51.100.32' },
    data: { input: 'test' },
  });
  expect(proxy.status()).toBe(404);
  await page.goto('/ledger');
  expect(await page.locator('input[type="password"]').count()).toBe(0);
});

test('@claim:team-plan-availability keeps the $9 offer honest while checkout is unavailable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('$9 per team each month')).toBeVisible();
  await expect(page.getByText('The $9 team plan is not available to buy yet, so no checkout link is shown.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Buy the team plan/i })).toHaveCount(0);
});
