import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [path, title] of [
  ['/', /Agent Capacity Ledger — plan agent limits/],
  ['/demo', /Demo — Agent Capacity Ledger/],
  ['/privacy', /Privacy — Agent Capacity Ledger/],
  ['/terms', /Terms — Agent Capacity Ledger/],
] as const) {
  test(`${path} has route metadata, landmarks, and one h1`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
  });
}

test('primary routes and source dialog have no serious accessibility findings', async ({ page }) => {
  for (const path of ['/', '/demo', '/ledger', '/privacy', '/terms']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  }
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Add a source' }).click();
  const dialogResults = await new AxeBuilder({ page }).analyze();
  expect(dialogResults.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('mobile demo fits 390 pixels and supports the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const resizedOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(resizedOverflow).toBeLessThanOrEqual(1);
});

test('bad CSV explains what to fix', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan\nOnly one row');
  await page.getByRole('button', { name: 'Import sources' }).click();
  await expect(page.getByRole('alert')).toContainText('The CSV needs these columns');
});

test('quoted CSV and impossible calendar dates have exact recovery behavior', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan,limit,used,daily_pace,resets_on,monthly_cost\n"Anthropic, Inc",Team,10,2,1,2026-02-30,9');
  await page.getByRole('button', { name: 'Import sources' }).click();
  await expect(page.getByRole('alert')).toHaveText('Row 2: Add a valid reset date.');
  await expect(page.getByRole('heading', { name: 'Anthropic, Inc' })).toHaveCount(0);
});

test('every mobile interactive target is at least 44 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  const targets = page.locator('button, a[href], input, select, textarea');
  const boxes = await targets.evaluateAll(elements => elements.filter(element => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }).map(element => {
    const box = element.getBoundingClientRect();
    return { label: (element.textContent || element.getAttribute('aria-label') || '').trim(), width: box.width, height: box.height };
  }));
  for (const target of boxes) {
    expect(target.width, `${target.label} is too narrow`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.label} is too short`).toBeGreaterThanOrEqual(44);
  }
});

test('source removal undo restores linked spend and fallback relationships', async ({ page }) => {
  await page.goto('/demo');
  const claude = page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Claude Code' }) });
  await claude.getByRole('button', { name: 'Remove Claude Code' }).click();
  await expect(page.getByText('Source and 1 linked spend entry removed.')).toBeVisible();
  await expect(page.getByText('Atlas migration')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { name: 'Claude Code' })).toBeVisible();
  await expect(page.getByText('Atlas migration')).toBeVisible();
  await expect(page.locator('.source-row').filter({ has: page.getByRole('heading', { name: 'Claude Code' }) }).getByLabel('Approved fallback')).toHaveValue('codex-team');
  await expect(page.locator('.spend-table [role="row"]')).toHaveCount(5);
});

test('source dialog traps focus, closes with Escape, and returns focus', async ({ page }) => {
  await page.goto('/demo');
  const trigger = page.getByRole('button', { name: 'Add a source' });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByLabel('Vendor')).toBeFocused();
  await page.getByRole('button', { name: 'Save source' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close source form' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Save source' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole('button', { name: 'Close source form' }).click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.locator('.dialog-backdrop').click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('invalid source and CSV relationships explain recovery', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByLabel('Vendor').fill('Invalid source');
  await page.getByLabel('Plan').fill('Team');
  await page.getByLabel('Session limit').fill('10');
  await page.getByLabel('Sessions used').fill('20');
  await page.getByRole('button', { name: 'Save source' }).click();
  await expect(page.getByRole('alert')).toHaveText('Sessions used cannot exceed the session limit. Fix the value and save again.');
  await expect(page.getByRole('heading', { name: 'Invalid source' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan,limit,used,daily_pace,resets_on,monthly_cost\nInvalid,Team,10,20,2,2099-01-01,40');
  await page.getByRole('button', { name: 'Import sources' }).click();
  await expect(page.getByRole('alert')).toHaveText('Row 2: Sessions used cannot exceed the session limit.');
});

test('unknown paths return HTTP 404 and assets use immutable caching', async ({ request }) => {
  const missing = await request.get('/does-not-exist-qa');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('Page not found');

  const landing = await request.get('/');
  const html = await landing.text();
  const assetPath = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
  expect(assetPath).toBeTruthy();
  const asset = await request.get(assetPath!);
  expect(asset.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});

test('primary routes load without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const path of ['/', '/demo', '/ledger', '/privacy', '/terms']) await page.goto(path);
  expect(errors).toEqual([]);
});
