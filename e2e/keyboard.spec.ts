import { test, expect } from '@playwright/test';
import { gotoApp, sidebar, openQrTool } from './fixtures';

/**
 * Keyboard reachability is the accessibility failure that ships silently: a
 * control works perfectly for a mouse user and is simply unreachable otherwise,
 * so nobody notices until someone who needs it tries.
 */
test.describe('keyboard navigation', () => {
  test('Tab moves focus into the app and never lands on the body', async ({ page }) => {
    await gotoApp(page);
    await page.keyboard.press('Tab');

    const tag = await page.evaluate(() => document.activeElement?.tagName ?? 'NONE');
    expect(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(tag);
  });

  test('the sidebar search is reachable and typeable by keyboard alone', async ({ page }) => {
    await gotoApp(page);

    const search = sidebar(page).getByPlaceholder(/search apps|بحث/i);
    await search.focus();
    await expect(search).toBeFocused();

    await page.keyboard.type('Compare');
    await expect(search).toHaveValue('Compare');
  });

  test('a sidebar tool can be activated with Enter', async ({ page }) => {
    await gotoApp(page);

    const tool = sidebar(page)
      .getByRole('button', { name: 'Compare Files', exact: false })
      .first();
    await tool.focus();
    await expect(tool).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(sidebar(page)).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  test('a sidebar tool can be activated with Space', async ({ page }) => {
    await gotoApp(page);

    const tool = sidebar(page)
      .getByRole('button', { name: 'Merge Datasets', exact: false })
      .first();
    await tool.focus();
    await page.keyboard.press('Space');

    await expect(sidebar(page)).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  test('tabbing forward reaches many distinct controls without trapping', async ({ page }) => {
    await gotoApp(page);

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

  test('Shift+Tab moves focus backwards', async ({ page }) => {
    await gotoApp(page);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const second = await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 120) ?? '');

    await page.keyboard.press('Shift+Tab');
    const back = await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 120) ?? '');

    expect(back).not.toBe(second);
  });

  test('the QR input is reachable and usable by keyboard', async ({ page }) => {
    await gotoApp(page);
    await openQrTool(page);

    const input = page.locator('textarea').first();
    await input.focus();
    await expect(input).toBeFocused();

    // The URL template seeds the field, so clear it by keyboard before typing —
    // otherwise this asserts on the concatenation, not on what was typed.
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');
    await page.keyboard.type('keyboard-entered-content');
    await expect(input).toHaveValue('keyboard-entered-content');
    await expect(page.locator('img[alt="QR Code"]')).toBeVisible({ timeout: 15_000 });
  });

  test('focused controls have a visible focus indicator', async ({ page }) => {
    await gotoApp(page);

    const tool = sidebar(page)
      .getByRole('button', { name: 'Separator', exact: false })
      .first();
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
