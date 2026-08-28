import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'https://agent-capacity-ledger.sociobot.in';
const browser = await chromium.launch({ headless: true });
const result = { checkedAt: new Date().toISOString(), errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') result.errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => result.errors.push(`pageerror: ${error.message}`));
  await page.goto(`${base}/ledger`, { waitUntil: 'networkidle' });
  const workspace = await page.evaluate(() => localStorage.getItem('ledger:workspace'));
  assert.ok(workspace);

  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByRole('textbox', { name: 'Vendor', exact: true }).fill('Live normal source');
  await page.getByLabel('Plan', { exact: true }).fill('Team');
  await page.getByLabel('Session limit').fill('100');
  await page.getByLabel('Sessions used').fill('25');
  await page.getByLabel('Daily pace').fill('5');
  await page.getByLabel('Monthly cost in USD').fill('40');
  await page.getByRole('button', { name: 'Save source' }).click();
  await page.getByRole('status').filter({ hasText: 'Ledger saved.' }).waitFor();

  await page.getByRole('button', { name: 'Copy workspace link' }).click();
  await page.locator('.notice').filter({ hasText: /Private workspace link copied|Copy this private workspace link/ }).waitFor();
  const copied = await page.locator('.notice').innerText();
  assert.match(copied, /Private workspace link copied|Copy this private workspace link/);

  const shared = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sharedPage = await shared.newPage();
  await sharedPage.goto(`${base}/ledger?workspace=${workspace}`, { waitUntil: 'networkidle' });
  await sharedPage.getByRole('heading', { name: 'Live normal source' }).waitFor();
  result.sharedLink = { workspace, visibleInFreshContext: true, teamText: await sharedPage.locator('.app-heading p').last().innerText() };
  await shared.close();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByRole('textbox', { name: 'Vendor', exact: true }).fill('Live offline source');
  await page.getByLabel('Plan', { exact: true }).fill('Backup');
  await page.getByRole('button', { name: 'Save source' }).click();
  await page.getByRole('status').filter({ hasText: 'queued on this device' }).waitFor();
  await context.setOffline(false);
  await page.getByRole('status').filter({ hasText: 'Ledger saved.' }).waitFor({ timeout: 15000 });
  const api = await fetch(`${base}/api/ledger/${workspace}`, { headers: { 'x-forwarded-for': '198.51.100.171' } });
  assert.equal(api.status, 200);
  const body = await api.json();
  assert.ok(body.data.sources.some(source => source.vendor === 'Live offline source'));
  result.offlineQueue = { queuedMessageObserved: true, savedMessageObserved: true, sourcePresentInApi: true, sourceCount: body.data.sources.length };
  result.errors.push(...await page.evaluate(() => []));
  assert.deepEqual(result.errors, []);
  await context.close();
} finally {
  await browser.close();
  await writeFile('.factory/verification-artifacts/verify-3/live-workspace-qa.json', JSON.stringify(result, null, 2));
}
console.log(JSON.stringify(result, null, 2));
