import { test, expect, TOOL } from './fixtures';

/**
 * Keyboard reachability is the accessibility failure that ships silently: a
 * control works perfectly for a mouse user and is simply unreachable otherwise,
 * so nobody notices until someone who needs it tries.
 */
test.describe('keyboard navigation', () => {
  test('Tab moves focus into the app and never lands on the body', async ({ app, page }) => {
    await page.keyboard.press('Tab');
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? 'NONE');
    expect(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(tag);
    await app.expectHealthy();
  });

  test('the sidebar search is reachable and typeable by keyboard alone', async ({ app, page }) => {
    await app.search.focus();
    await expect(app.search).toBeFocused();
    await page.keyboard.type('Compare');
    await expect(app.search).toHaveValue('Compare');
  });

  test('a sidebar tool can be activated with Enter', async ({ app, page }) => {
    const tool = app.tool(TOOL.compareFiles);
    await tool.focus();
    await expect(tool).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(app.toolLoading).toHaveCount(0, { timeout: 20_000 });
    await app.expectHealthy();
  });

  test('a sidebar tool can be activated with Space', async ({ app, page }) => {
    const tool = app.tool(TOOL.mergeDatasets);
    await tool.focus();
    await page.keyboard.press('Space');
    await expect(app.toolLoading).toHaveCount(0, { timeout: 20_000 });
    await app.expectHealthy();
  });

  test('tabbing forward reaches many distinct controls without trapping', async ({ app, page }) => {
    await app.expectHealthy();

    const seen = new Set<string>();
    let repeats = 0;

    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return 'BODY';
        return `${el.tagName}:${(el.getAttribute('placeholder') ?? el.innerText ?? '').slice(0, 24)}:${el.className.slice(0, 24)}`;
      });
      if (seen.has(id)) repeats++;
      seen.add(id);
    }

    // A focus trap shows up as the same one or two elements cycling forever.
    expect(seen.size, 'Tab appears to be trapped — too few distinct focus targets').toBeGreaterThan(5);
    expect(repeats, 'Tab is cycling through a very small loop').toBeLessThan(35);
  });

  test('Shift+Tab moves focus backwards', async ({ app, page }) => {
    await app.expectHealthy();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const second = await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 120) ?? '');

    await page.keyboard.press('Shift+Tab');
    const back = await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 120) ?? '');

    expect(back).not.toBe(second);
  });

  test('the QR input is reachable and usable by keyboard', async ({ qr, page }) => {
    await qr.input.focus();
    await expect(qr.input).toBeFocused();

    // The URL template seeds the field, so clear it by keyboard before typing —
    // otherwise this asserts on the concatenation, not on what was typed.
    await qr.clearByKeyboard();
    await page.keyboard.type('keyboard-entered-content');

    await expect(qr.input).toHaveValue('keyboard-entered-content');
    await expect(qr.image).toBeVisible({ timeout: 15_000 });
  });

  test('focused controls have a visible focus indicator', async ({ app }) => {
    const tool = app.tool(TOOL.separator);
    await tool.focus();

    const hasIndicator = await tool.evaluate((el) => {
      const s = getComputedStyle(el);
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth || '0') > 0;
      const ring = s.boxShadow !== 'none' && s.boxShadow.trim() !== '';
      const border = parseFloat(s.borderWidth || '0') > 0;
      return outline || ring || border;
    });

    expect(
      hasIndicator,
      'the focused control shows no outline, ring, or border — keyboard users cannot see where they are',
    ).toBe(true);
  });
});
