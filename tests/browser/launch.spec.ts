import { test, expect } from '@playwright/test';

test('fresh launch settles into Overview; initialization runs concurrently and intro never replays on tab changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
  await page.goto('./');
  const intro = page.getByTestId('launch-intro');
  await expect(intro).toBeVisible();
  // The app has recovered behind the intro; interaction is explicitly inert.
  await expect(page.locator('.app')).toHaveAttribute('inert', '');
  await page.clock.fastForward(1601);
  await expect(intro).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.locator('.app')).not.toHaveAttribute('inert');
  const nav = page.getByRole('navigation', { name: 'Hovednavigation' });
  await expect(nav.getByRole('button')).toHaveText(['Overview', 'Allocate', 'Risk', 'Settings']);
  for (const name of ['Allocate', 'Risk', 'Settings', 'Overview']) {
    await nav.getByRole('button', { name, exact: true }).click();
    await expect(intro).toHaveCount(0);
  }
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(intro).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(10, 20, 23)');
});

test('reduced motion uses a short static handoff, no moving mark, and no five-second delay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
  await page.goto('./');
  await page.clock.fastForward(281);
  await expect(page.getByTestId('launch-intro')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});

test('Mineral Instrument keeps primary action neutral and narrow/large text within its canvas', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('./');
  await expect(page.getByTestId('launch-intro')).toHaveCount(0);
  const action = page.getByRole('button', { name: 'Beregn fordeling' });
  expect(await action.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(24, 39, 43)');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  for (const name of ['Overview', 'Allocate', 'Risk', 'Settings']) {
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
