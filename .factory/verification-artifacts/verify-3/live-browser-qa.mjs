import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = 'https://agent-capacity-ledger.sociobot.in';
const out = '.factory/verification-artifacts/verify-3';
const browser = await chromium.launch({ headless: true });
const result = { base, checkedAt: new Date().toISOString(), desktop: {}, mobile: {}, accessibility: {}, errors: [] };

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url(), type: request.resourceType() }));
  page.on('console', message => { if (message.type() === 'error') result.errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => result.errors.push(`pageerror: ${error.message}`));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  result.desktop.firstRead = {
    title: await page.title(),
    h1: await page.locator('h1').allTextContents(),
    hero: await page.locator('.hero-copy').innerText(),
    viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth }))
  };
  assert.equal(result.desktop.firstRead.h1.length, 1);
  assert.match(result.desktop.firstRead.hero, /small engineering teams/i);
  assert.match(result.desktop.firstRead.hero, /Try it with sample data/i);
  await page.screenshot({ path: `${out}/live-first-read-desktop.png` });

  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await page.waitForURL('**/demo');
  assert.match(await page.getByRole('complementary', { name: 'Demo mode' }).innerText(), /Demo — sample data, nothing is saved/);
  const initialSources = await page.locator('.source-row').count();
  const initialSpendRows = await page.locator('.spend-table [role="row"]').count();
  assert.equal(initialSources, 3);
  assert.equal(initialSpendRows, 5);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();
  assert.equal(csv.trim().split('\n').length, 8);

  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan,limit,used,daily_pace,resets_on,monthly_cost\n"Quoted, Vendor",Team,10,10,0,2099-01-01,0');
  await page.getByRole('button', { name: 'Import sources' }).click();
  const imported = page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Quoted, Vendor' }) });
  await imported.waitFor();
  assert.match(await imported.innerText(), /0 of 10 sessions left/);
  assert.match(await imported.innerText(), /\$0\/month/);

  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByRole('textbox', { name: 'Vendor', exact: true }).fill('Recovery source');
  await page.getByLabel('Plan', { exact: true }).fill('Team');
  await page.getByLabel('Session limit').fill('10');
  await page.getByLabel('Sessions used').fill('11');
  await page.getByRole('button', { name: 'Save source' }).click();
  const invalidAlert = await page.getByRole('alert').innerText();
  assert.match(invalidAlert, /cannot exceed/);
  await page.getByLabel('Sessions used').fill('10');
  await page.getByRole('button', { name: 'Save source' }).click();
  await page.getByRole('heading', { name: 'Recovery source' }).waitFor();

  const claude = page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Claude Code' }) });
  await claude.getByRole('button', { name: 'Remove Claude Code' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('heading', { name: 'Claude Code' }).waitFor();

  const externalDemoRequests = requests.filter(entry => new URL(entry.url).origin !== base);
  result.desktop.demo = {
    initialSources,
    initialSpendRows,
    exportLines: csv.trim().split('\n').length,
    importedBoundary: await imported.innerText(),
    invalidAlert,
    externalRequests: externalDemoRequests,
    requestLog: requests.map(entry => `${entry.method} ${entry.url}`),
    serviceWorkers: await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)
  };
  assert.deepEqual(externalDemoRequests, []);
  assert.equal(result.desktop.demo.serviceWorkers, 0);

  for (const path of ['/', '/demo', '/ledger', '/privacy', '/terms']) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    result.accessibility[path] = axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    assert.equal(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).length, 0);
  }
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  const trigger = page.getByRole('button', { name: 'Add a source' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('id')), 'source-vendor');
  const dialogAxe = await new AxeBuilder({ page }).analyze();
  result.accessibility.dialog = dialogAxe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  assert.equal(dialogAxe.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).length, 0);
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
  result.desktop.keyboard = {
    dialogFocusReturned: true,
    focusOutline: await trigger.evaluate(el => getComputedStyle(el).outline)
  };
  await context.close();

  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(`${base}/demo`);
  result.accessibility.reducedMotion = await reducedPage.locator('.source-row').first().evaluate(el => ({
    animationDuration: getComputedStyle(el).animationDuration,
    transitionDuration: getComputedStyle(el).transitionDuration,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
  }));
  await reduced.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  mobilePage.on('console', message => { if (message.type() === 'error') result.errors.push(`mobile console: ${message.text()}`); });
  mobilePage.on('pageerror', error => result.errors.push(`mobile pageerror: ${error.message}`));
  await mobilePage.goto(`${base}/`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: `${out}/live-first-read-mobile.png` });
  const normalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await mobilePage.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const zoomOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await mobilePage.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await mobilePage.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  const targetSizes = await mobilePage.locator('button, a[href], input, select, textarea').evaluateAll(elements => elements.filter(el => {
    const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length;
  }).map(el => { const r = el.getBoundingClientRect(); return { label: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim(), width: r.width, height: r.height }; }));
  result.mobile = { normalOverflow, zoomOverflow, minimumTargetWidth: Math.min(...targetSizes.map(t => t.width)), minimumTargetHeight: Math.min(...targetSizes.map(t => t.height)), undersized: targetSizes.filter(t => t.width < 44 || t.height < 44) };
  assert.ok(normalOverflow <= 1);
  assert.ok(zoomOverflow <= 1);
  assert.deepEqual(result.mobile.undersized, []);
  await mobilePage.screenshot({ path: `${out}/live-demo-mobile.png`, fullPage: true });
  await mobile.close();

  assert.deepEqual(result.errors, []);
} finally {
  await browser.close();
  await writeFile(`${out}/live-browser-qa.json`, JSON.stringify(result, null, 2));
}
