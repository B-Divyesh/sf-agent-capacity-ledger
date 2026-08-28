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

test('landing and demo have no serious accessibility findings', async ({ page }) => {
  for (const path of ['/', '/demo']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  }
});

test('mobile demo fits 390 pixels and supports the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('bad CSV explains what to fix', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Import usage CSV' }).click();
  await page.getByLabel('CSV rows').fill('vendor,plan\nOnly one row');
  await page.getByRole('button', { name: 'Import sources' }).click();
  await expect(page.getByRole('alert')).toContainText('The CSV needs these columns');
});

test('primary routes load without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const path of ['/', '/demo', '/ledger', '/privacy', '/terms']) await page.goto(path);
  expect(errors).toEqual([]);
});
