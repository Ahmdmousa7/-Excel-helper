import { test, expect, TOOL, GROUP, APP_TITLE } from './fixtures';

test.describe('smoke', () => {
  test('the app boots past the static loading shell', async ({ app, page, pageErrors }) => {
    await expect(page).toHaveTitle(/Sale Onboarding Team/i);
    await expect(app.sidebar).toBeVisible();
    await expect(app.sidebar).toContainText(APP_TITLE);
    pageErrors.expectNone('console errors on boot');
  });

  test('the tool navigation renders its groups', async ({ app }) => {
    await expect(app.sidebar.getByText(GROUP.dashboard)).toBeVisible();
    await expect(app.sidebar.getByText(GROUP.newTools)).toBeVisible();
  });

  test('every hard-coded tool is reachable from the sidebar', async ({ app }) => {
    for (const name of Object.values(TOOL)) {
      await expect(app.tool(name), `"${name}" is missing from the sidebar`).toBeVisible();
    }
  });

  test('the shell has no horizontal overflow at desktop width', async ({ app }) => {
    expect(await app.horizontalOverflow(), 'the page scrolls sideways at 1280px').toBeLessThanOrEqual(1);
  });

  test('the app renders without a visible unhandled error boundary', async ({ app }) => {
    await expect(app.errorBoundary).toHaveCount(0);
  });
});
