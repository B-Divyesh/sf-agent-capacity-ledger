import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const base = 'https://agent-capacity-ledger.sociobot.in';
const browser = await chromium.launch({ headless: true });
const report = { timestamp: new Date().toISOString(), base, routes: {}, flows: {}, errors: [] };

async function routeAudit(path) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  const response = await page.goto(base + path, { waitUntil: 'networkidle' });
  const semantics = await page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    h1: [...document.querySelectorAll('h1')].map(node => node.textContent?.trim()),
    main: document.querySelectorAll('main').length,
    header: document.querySelectorAll('header').length,
    nav: document.querySelectorAll('nav').length,
    footer: document.querySelectorAll('footer').length,
    imagesWithoutAlt: [...document.images].filter(image => !image.hasAttribute('alt')).length,
    skipTarget: document.querySelector('.skip-link')?.getAttribute('href') ?? null,
  }));
  const axe = await new AxeBuilder({ page }).analyze();
  const result = {
    status: response?.status(),
    ...semantics,
    seriousCritical: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')).map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    allAxeViolations: axe.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

for (const path of ['/', '/demo', '/ledger', '/privacy', '/terms']) report.routes[path] = await routeAudit(path);

{
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const requests = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url(), type: request.resourceType() }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), href: document.activeElement?.getAttribute('href'), outline: getComputedStyle(document.activeElement).outline }));
  let demoReached = false;
  const focusOrder = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim(), href: document.activeElement?.getAttribute('href') }));
    focusOrder.push(active);
    if (active.text === 'Try it with sample data') { await page.keyboard.press('Enter'); demoReached = true; break; }
  }
  await page.waitForLoadState('networkidle');
  const banner = await page.locator('.demo-banner').innerText();
  const sourcesBefore = await page.locator('.source-row').count();
  const spendRowsBefore = await page.locator('.spend-table [role="row"]').count();
  const reset = page.getByRole('button', { name: 'Reset demo' });
  await reset.click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString();
  const add = page.getByRole('button', { name: 'Add a source' });
  await add.focus();
  await page.keyboard.press('Enter');
  const initialDialogFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim());
  const dialogAxe = await new AxeBuilder({ page }).analyze();
  await page.getByRole('button', { name: 'Save source' }).focus();
  await page.keyboard.press('Tab');
  const wrapForward = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim());
  await page.keyboard.press('Shift+Tab');
  const wrapBackward = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim());
  await page.keyboard.press('Escape');
  const focusReturned = await page.evaluate(() => document.activeElement?.textContent?.trim());

  await add.click();
  await page.getByLabel('Vendor').fill('Boundary seat');
  await page.getByLabel('Plan', { exact: true }).fill('Team');
  await page.getByLabel('Session limit').fill('10');
  await page.getByLabel('Sessions used').fill('11');
  await page.getByRole('button', { name: 'Save source' }).click();
  const invalidAlert = await page.getByRole('alert').innerText();
  await page.getByLabel('Sessions used').fill('10');
  await page.getByLabel('Daily pace').fill('0');
  await page.getByLabel('Monthly cost').fill('0');
  await page.getByLabel('Reset date').fill('2099-12-31');
  await page.getByRole('button', { name: 'Save source' }).click();
  const boundarySaved = await page.getByRole('heading', { name: 'Boundary seat' }).isVisible();

  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan,limit,used,daily_pace,resets_on,monthly_cost\nImpossible date,Team,10,2,1,2026-02-30,20');
  await page.getByRole('button', { name: 'Import sources' }).click();
  const impossibleDateAccepted = await page.getByRole('heading', { name: 'Impossible date' }).isVisible().catch(() => false);
  if (await page.getByRole('button', { name: 'Close import form' }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Close import form' }).click();

  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan,limit,used,daily_pace,resets_on,monthly_cost\n"Anthropic, Inc",Team,10,2,1,2099-12-31,20');
  await page.getByRole('button', { name: 'Import sources' }).click();
  const quotedCsvAlert = await page.getByRole('alert').innerText().catch(() => 'none');
  const quotedCsvImported = await page.getByRole('heading', { name: 'Anthropic, Inc' }).isVisible().catch(() => false);

  await page.screenshot({ path: '.factory/qa-evidence/live/demo-desktop.png', fullPage: true });
  report.flows.desktopDemo = {
    firstFocus, focusOrder, demoReached, url: page.url(), banner, sourcesBefore, spendRowsBefore,
    exportLines: csv.trim().split('\n').length, initialDialogFocus, wrapForward, wrapBackward, focusReturned,
    dialogSeriousCritical: dialogAxe.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? '')).map(item => item.id),
    invalidAlert, boundarySaved, impossibleDateAccepted, quotedCsvAlert, quotedCsvImported,
    externalRequests: requests.filter(request => new URL(request.url).origin !== new URL(base).origin),
    consoleErrors, pageErrors,
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(base + '/demo', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Menu' }).click();
  const menuVisible = await page.getByRole('navigation', { name: 'Main navigation' }).isVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('a,button,input,select,textarea')].filter(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && (rect.width < 44 || rect.height < 44);
  }).map(element => { const rect = element.getBoundingClientRect(); return { tag: element.tagName, text: element.textContent?.trim() || element.getAttribute('aria-label'), width: rect.width, height: rect.height }; }));
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const overflow200 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: '.factory/qa-evidence/live/demo-mobile-200pct.png', fullPage: true });
  report.flows.mobile = { menuVisible, overflow, overflow200, smallTargets, consoleErrors, pageErrors };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base + '/demo', { waitUntil: 'networkidle' });
  const computed = await page.evaluate(() => {
    const source = document.querySelector('.source-row');
    const image = document.querySelector('.hero-art');
    return {
      rootScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      sourceAnimationDuration: source ? getComputedStyle(source).animationDuration : null,
      sourceTransitionDuration: source ? getComputedStyle(source).transitionDuration : null,
      imageAnimationDuration: image ? getComputedStyle(image).animationDuration : null,
    };
  });
  report.flows.reducedMotion = computed;
  await context.close();
}

{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const registrations = await page.evaluate(async () => 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0);
  report.flows.serviceWorkers = registrations;
  await context.close();
}

fs.writeFileSync('.factory/qa-evidence/live/live-browser-qa.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
