import { test, expect } from '@playwright/test';
import { gotoApp, sidebar, openTool, openQrTool, generateQr, collectPageErrors, TOOL } from './fixtures';

test.describe('happy path', () => {
  test('generate a QR code end to end', async ({ page }) => {
    const errors = collectPageErrors(page);
    await gotoApp(page);
    await openQrTool(page);

    const img = await generateQr(page, 'https://example.com/onboarding');

    // Assert the image is a real, non-empty data URL rather than a broken tag.
    const src = await img.getAttribute('src');
    expect(src).toMatch(/^data:image\/png;base64,/);
    expect(src!.length).toBeGreaterThan(500);

    const box = await img.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(50);

    expect(errors, `console errors during QR generation:\n${errors.join('\n')}`).toEqual([]);
  });

  test('changing the input regenerates the QR code', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);

    const first = await (await generateQr(page, 'ONE')).getAttribute('src');
    const second = await (await generateQr(page, 'TWO-DIFFERENT-CONTENT')).getAttribute('src');

    expect(second).not.toBe(first);
  });

  test('switching tools swaps the workspace and keeps the shell intact', async ({ page }) => {
    await gotoApp(page);

    await openTool(page, TOOL.removeBlanks);
    await expect(sidebar(page)).toBeVisible();
    const afterFirst = await page.locator('main, [role="main"], body').first().innerText();

    await openTool(page, TOOL.compareFiles);
    await expect(sidebar(page)).toBeVisible();
    const afterSecond = await page.locator('main, [role="main"], body').first().innerText();

    expect(afterSecond).not.toBe(afterFirst);
  });

  test('the sidebar search filters the tool list', async ({ page }) => {
    await gotoApp(page);

    const search = sidebar(page).getByPlaceholder(/search apps|بحث/i);
    await expect(search).toBeVisible();

    await search.fill('Compare');
    await expect(
      sidebar(page).getByRole('button', { name: TOOL.compareFiles, exact: false }).first(),
    ).toBeVisible();
    await expect(
      sidebar(page).getByRole('button', { name: TOOL.magicLinks, exact: false }),
    ).toHaveCount(0);

    await search.fill('');
    await expect(
      sidebar(page).getByRole('button', { name: TOOL.magicLinks, exact: false }).first(),
    ).toBeVisible();
  });

  test('a search with no matches leaves the shell usable', async ({ page }) => {
    await gotoApp(page);
    const search = sidebar(page).getByPlaceholder(/search apps|بحث/i);

    await search.fill('zzzz-no-such-tool-zzzz');
    await expect(sidebar(page)).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);

    await search.fill('');
    await expect(
      sidebar(page).getByRole('button', { name: TOOL.removeBlanks, exact: false }).first(),
    ).toBeVisible();
  });
});
