import { test, expect, TOOL, GROUP } from './fixtures';

test.describe('happy path', () => {
  test('generate a QR code end to end', async ({ qr, pageErrors }) => {
    const img = await qr.generate('https://example.com/onboarding');

    // A real, non-empty data URL rather than a broken tag.
    const src = await img.getAttribute('src');
    expect(src).toMatch(/^data:image\/png;base64,/);
    expect(src!.length).toBeGreaterThan(500);

    const box = await img.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(50);

    pageErrors.expectNone('console errors during QR generation');
  });

  test('changing the input regenerates the QR code', async ({ qr }) => {
    await qr.generate('ONE');
    const first = await qr.dataUrl();
    await qr.generate('TWO-DIFFERENT-CONTENT');
    expect(await qr.dataUrl()).not.toBe(first);
  });

  test('switching tools swaps the workspace and keeps the shell intact', async ({ app, page }) => {
    await app.openTool(TOOL.removeBlanks);
    await app.expectHealthy();
    const afterFirst = await page.locator('main, [role="main"], body').first().innerText();

    await app.openTool(TOOL.compareFiles);
    await app.expectHealthy();
    const afterSecond = await page.locator('main, [role="main"], body').first().innerText();

    expect(afterSecond).not.toBe(afterFirst);
  });

  test('the sidebar search filters the tool list', async ({ app }) => {
    await expect(app.search).toBeVisible();

    await app.searchFor('Compare');
    await expect(app.tool(TOOL.compareFiles)).toBeVisible();
    await expect(
      app.sidebar.getByRole('button', { name: TOOL.separator, exact: false }),
    ).toHaveCount(0);

    // Filtering must reach ACROSS groups, not just within the matching one.
    //
    // This used to be covered incidentally: the hidden tool was Magic Links,
    // which sat in a different group from Compare Files. Every tool in `TOOL`
    // now lives in the same group — they are the five with hard-coded English
    // names — so the cross-group property is asserted on the GROUP HEADINGS
    // instead, which are also hard-coded and so equally locale-safe. A group
    // with no matches is removed entirely (`filteredMenuGroups`).
    await expect(app.sidebar.getByText(GROUP.newTools)).toBeVisible();
    await expect(app.sidebar.getByText(GROUP.dashboard)).toHaveCount(0);

    await app.searchFor('');
    await expect(app.tool(TOOL.separator)).toBeVisible();
    await expect(app.sidebar.getByText(GROUP.dashboard)).toBeVisible();
  });

  test('a search with no matches leaves the shell usable', async ({ app }) => {
    await app.searchFor('zzzz-no-such-tool-zzzz');
    await app.expectHealthy();

    await app.searchFor('');
    await expect(app.tool(TOOL.removeBlanks)).toBeVisible();
  });
});
