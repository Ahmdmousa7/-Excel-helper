import { test, expect } from '@playwright/test';
import { gotoApp, sidebar, collectPageErrors, GROUP, TOOL, APP_TITLE } from './fixtures';

test.describe('smoke', () => {
  test('the app boots past the static loading shell', async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoApp(page);

    await expect(page).toHaveTitle(/Sale Onboarding Team/i);
    await expect(sidebar(page)).toBeVisible();
    await expect(sidebar(page)).toContainText(APP_TITLE);
    expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('the tool navigation renders its groups', async ({ page }) => {
    await gotoApp(page);
    await expect(sidebar(page).getByText(GROUP.dashboard)).toBeVisible();
    await expect(sidebar(page).getByText(GROUP.newTools)).toBeVisible();
  });

  test('every hard-coded tool is reachable from the sidebar', async ({ page }) => {
    await gotoApp(page);
    for (const name of Object.values(TOOL)) {
      await expect(
        sidebar(page).getByRole('button', { name, exact: false }).first(),
        `"${name}" is missing from the sidebar`,
      ).toBeVisible();
    }
  });

  test('the shell has no horizontal overflow at desktop width', async ({ page }) => {
    await gotoApp(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the page scrolls sideways at 1280px').toBeLessThanOrEqual(1);
  });

  test('the app renders without a visible unhandled error boundary', async ({ page }) => {
    await gotoApp(page);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });
});
