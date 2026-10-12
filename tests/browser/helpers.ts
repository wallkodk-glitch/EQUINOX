import { expect, type Page } from '@playwright/test';

/** Visibility alone does not prove that an input behind LaunchIntro can focus. */
export async function waitForInteractive(page: Page) {
  await expect(page.locator('.app')).toBeVisible();
  await expect(page.locator('.app')).not.toHaveAttribute('inert');
  await expect(page.getByTestId('launch-intro')).toHaveCount(0);
}
