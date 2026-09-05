import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = 'https://agent-capacity-ledger.sociobot.in';
const out = '/work/.evidence/verify-4';
const result = {
  checkedAt: new Date().toISOString(),
  base,
  desktop: {},
  mobile: {},
  routes: {},
  accessibility: {},
  privacy: {},
  errors: [],
};
const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await desktop.newPage();
  const requests = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  page.on('console', message => {
    if (message.type() === 'error') result.errors.push(`desktop console: ${message.text()}`);
  });
  page.on('pageerror', error => result.errors.push(`desktop pageerror: ${error.message}`));

  const landing = await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const h1 = page.getByRole('heading', { level: 1 });
  const audience = page.getByText('For small engineering teams juggling coding subscriptions, project spend, and approved backup tools.');
  const sampleAction = page.getByRole('link', { name: 'Try it with sample data' });
  const actionBox = await sampleAction.boundingBox();
  assert.equal(landing.status(), 200);
  assert.equal(await h1.innerText(), 'Plan agent capacity before limits stop work');
  assert.equal(await audience.isVisible(), true);
  assert.ok(actionBox && actionBox.y >= 0 && actionBox.y + actionBox.height <= 720);
  result.desktop.firstRead = {
    title: await page.title(),
    h1: await h1.innerText(),
    audience: await audience.innerText(),
    firstAction: await sampleAction.innerText(),
    actionBox,
    scrollY: await page.evaluate(() => scrollY),
  };
  await page.screenshot({ path: `${out}/first-read-desktop.png` });

  requests.length = 0;
  await sampleAction.click();
  await page.waitForURL('**/demo');
  const banner = page.getByRole('complementary', { name: 'Demo mode' });
  assert.match(await banner.innerText(), /Demo — sample data, nothing is saved/);
  assert.equal(await page.locator('.source-row').count(), 3);
  assert.equal(await page.locator('.spend-table [role="row"]').count(), 5);
  const sampleNames = await page.locator('.source-row h3').allTextContents();
  const sampleSummary = await page.locator('.forecast-strip').innerText();

  const claude = page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Claude Code' }) });
  await claude.getByLabel('Used sessions').fill('120');
  await claude.getByLabel('Used sessions').blur();
  assert.match(await claude.innerText(), /No sessions remain before reset\. Estimate\./);
  assert.match(await claude.innerText(), /at risk/i);
  assert.doesNotMatch(await claude.innerText(), /∞/);

  await page.getByRole('button', { name: 'Record spend' }).click();
  const spendDialog = page.getByRole('dialog', { name: 'Record project spend' });
  await spendDialog.getByLabel('Project', { exact: true }).fill('QA sample project');
  await spendDialog.getByLabel('Cost in USD', { exact: true }).fill('42');
  await spendDialog.getByRole('button', { name: 'Save spend' }).click();
  await page.getByText('QA sample project').waitFor();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  assert.equal(await banner.isVisible(), true);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  assert.equal(await page.locator('.source-row').count(), 3);
  assert.equal(await page.locator('.spend-table [role="row"]').count(), 5);
  assert.equal(await page.getByText('QA sample project').count(), 0);
  assert.match(await claude.innerText(), /17 of 120 sessions left/);

  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan,limit,used,daily_pace,resets_on,monthly_cost\n"Quoted, Vendor",Team,10,10,0,2099-01-01,0');
  await page.getByRole('button', { name: 'Import sources' }).click();
  const boundary = page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Quoted, Vendor' }) });
  assert.match(await boundary.innerText(), /0 of 10 sessions left/);
  assert.match(await boundary.innerText(), /at risk/i);

  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByLabel('Vendor', { exact: true }).fill('Invalid boundary');
  await page.getByLabel('Plan', { exact: true }).fill('Team');
  await page.getByLabel('Session limit').fill('10');
  await page.getByLabel('Sessions used').fill('11');
  await page.getByRole('button', { name: 'Save source' }).click();
  const recovery = await page.getByRole('alert').innerText();
  assert.match(recovery, /cannot exceed/);
  await page.getByLabel('Sessions used').fill('10');
  await page.getByRole('button', { name: 'Save source' }).click();
  await page.getByRole('heading', { name: 'Invalid boundary' }).waitFor();

  const trigger = page.getByRole('button', { name: 'Add a source' });
  await trigger.focus();
  await trigger.press('Enter');
  assert.equal(await page.getByLabel('Vendor', { exact: true }).evaluate(element => document.activeElement === element), true);
  await page.getByRole('button', { name: 'Save source' }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: 'Close source form' }).evaluate(element => document.activeElement === element), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('button', { name: 'Save source' }).evaluate(element => document.activeElement === element), true);
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
  const focusOutline = await trigger.evaluate(element => getComputedStyle(element).outline);

  const demoRequests = [...requests];
  const externalDemoRequests = demoRequests.filter(request => new URL(request.url).origin !== base);
  const demoApiWrites = demoRequests.filter(request => new URL(request.url).pathname.startsWith('/api/') && request.method !== 'GET');
  assert.deepEqual(externalDemoRequests, []);
  assert.deepEqual(demoApiWrites, []);

  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole('link', { name: 'Start for real' }).click();
  await page.waitForURL('**/ledger');
  await page.getByRole('heading', { name: 'No paid sources yet' }).waitFor();
  assert.equal(await page.locator('.source-row').count(), 0);
  result.desktop.demo = {
    sampleNames,
    sampleSummary,
    sourceCount: 3,
    spendEntries: 4,
    banner: 'Demo — sample data, nothing is saved',
    resetRestoredSample: true,
    zeroCapacity: 'At risk',
    invalidRecovery: recovery,
    startForRealEmpty: true,
  };
  result.desktop.keyboard = { focusTrap: true, escapeReturnsFocus: true, focusOutline };
  result.privacy = {
    externalDemoRequests,
    demoApiWrites,
    serviceWorkerRegistrations: await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
  };

  const routeTitles = {
    '/': 'Agent Capacity Ledger — plan agent limits',
    '/demo': 'Demo — Agent Capacity Ledger',
    '/ledger': 'Ledger — Agent Capacity Ledger',
    '/privacy': 'Privacy — Agent Capacity Ledger',
    '/terms': 'Terms — Agent Capacity Ledger',
  };
  for (const [path, expectedTitle] of Object.entries(routeTitles)) {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    const structure = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      main: document.querySelectorAll('main').length,
      h1: document.querySelectorAll('h1').length,
      header: document.querySelectorAll('header').length,
      nav: document.querySelectorAll('nav').length,
      footer: document.querySelectorAll('footer').length,
      missingAlt: [...document.images].filter(image => !image.hasAttribute('alt')).length,
      skipLink: Boolean(document.querySelector('a[href="#main"]')),
    }));
    assert.equal(response.status(), 200);
    assert.equal(await page.title(), expectedTitle);
    assert.equal(structure.lang, 'en');
    assert.equal(structure.main, 1);
    assert.equal(structure.h1, 1);
    assert.equal(structure.header, 1);
    assert.ok(structure.nav >= 1);
    assert.equal(structure.footer, 1);
    assert.equal(structure.missingAlt, 0);
    assert.equal(structure.skipLink, true);
    assert.equal(axe.violations.length, 0);
    result.routes[path] = { status: response.status(), title: await page.title(), structure };
    result.accessibility[path] = { violations: [] };
  }

  await page.goto(`${base}/`);
  await page.locator('header').getByRole('link', { name: 'Privacy' }).click();
  assert.equal(await page.title(), 'Privacy — Agent Capacity Ledger');
  await page.goBack();
  assert.equal(await page.title(), 'Agent Capacity Ledger — plan agent limits');
  result.routes.history = { backRestoredLanding: true };

  assert.deepEqual(result.errors, []);
  const missing = await page.goto(`${base}/does-not-exist-verify-4`, { waitUntil: 'networkidle' });
  assert.equal(missing.status(), 404);
  assert.equal(await page.title(), 'Page not found — Agent Capacity Ledger');
  assert.equal(await page.locator('main').count(), 1);
  assert.equal(await page.locator('h1').count(), 1);
  assert.match(await page.getByRole('heading', { level: 1 }).innerText(), /Page not found/);
  assert.ok(await page.getByRole('link', { name: 'Return to the ledger' }).count());
  const expected404Console = result.errors.splice(0);
  result.routes['404'] = { status: 404, title: await page.title(), h1: await page.getByRole('heading', { level: 1 }).innerText(), recoveryLink: true, expected404Console };
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  mobilePage.on('console', message => {
    if (message.type() === 'error') result.errors.push(`mobile console: ${message.text()}`);
  });
  mobilePage.on('pageerror', error => result.errors.push(`mobile pageerror: ${error.message}`));
  await mobilePage.goto(`${base}/`, { waitUntil: 'networkidle' });
  const mobileAction = mobilePage.getByRole('link', { name: 'Try it with sample data' });
  const mobileActionBox = await mobileAction.boundingBox();
  assert.ok(mobileActionBox && mobileActionBox.y >= 0 && mobileActionBox.y + mobileActionBox.height <= 844);
  assert.equal(await mobilePage.getByRole('heading', { level: 1 }).innerText(), 'Plan agent capacity before limits stop work');
  assert.equal(await mobilePage.getByText('For small engineering teams juggling coding subscriptions, project spend, and approved backup tools.').isVisible(), true);
  const normalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await mobilePage.screenshot({ path: `${out}/first-read-phone.png` });
  await mobileAction.click();
  await mobilePage.waitForURL('**/demo');
  const targetSizes = await mobilePage.locator('button, a[href], input, select, textarea').evaluateAll(elements => elements.filter(element => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }).map(element => {
    const box = element.getBoundingClientRect();
    return { label: (element.textContent || element.getAttribute('aria-label') || element.getAttribute('name') || '').trim(), width: box.width, height: box.height };
  }));
  const undersized = targetSizes.filter(target => target.width < 44 || target.height < 44);
  assert.deepEqual(undersized, []);
  await mobilePage.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const zoomOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(normalOverflow <= 1 && zoomOverflow <= 1);
  result.mobile = {
    firstActionBeforeScroll: true,
    normalOverflow,
    zoomOverflow,
    minimumWidth: Math.min(...targetSizes.map(target => target.width)),
    minimumHeight: Math.min(...targetSizes.map(target => target.height)),
    undersized,
  };
  await mobile.close();

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  const motion = await reducedPage.locator('.source-row').first().evaluate(element => ({
    animationDuration: getComputedStyle(element).animationDuration,
    transitionDuration: getComputedStyle(element).transitionDuration,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  assert.equal(motion.scrollBehavior, 'auto');
  result.accessibility.reducedMotion = motion;
  await reduced.close();

  assert.deepEqual(result.errors, []);
} finally {
  await browser.close();
  await writeFile(`${out}/live-browser.json`, JSON.stringify(result, null, 2));
}

console.log(JSON.stringify(result, null, 2));
