import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

/**
 * The API-key dialog.
 *
 * Every other suite deliberately suppresses this modal — `AppShell.goto()`
 * seeds localStorage so it never opens, because it is a full-screen overlay
 * that swallows clicks. That made it the one piece of UI nothing tested, while
 * also being the first thing a first-time user sees. These tests open it on
 * purpose.
 */
test.describe('API key modal', () => {
  /** Load the app with NO stored key, so the modal auto-opens as it does for a new user. */
  async function openAsNewUser(page: import('@playwright/test').Page) {
    await page.addInitScript(() => {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('groq_api_key');
    });
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    return dialog;
  }

  test('it auto-opens for a user with no key, with dialog semantics', async ({ page }) => {
    const dialog = await openAsNewUser(page);

    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // An accessible name, so a screen reader announces what the dialog is for
    // rather than just "dialog".
    await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);
    const labelId = await dialog.getAttribute('aria-labelledby');
    await expect(page.locator(`#${labelId}`)).toBeVisible();
  });

  test('Escape closes it', async ({ page }) => {
    const dialog = await openAsNewUser(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // And the app underneath is usable, not left in a half-open state.
    await expect(page.locator('aside').first()).toBeVisible();
  });

  test('focus lands inside the dialog when it opens', async ({ page }) => {
    const dialog = await openAsNewUser(page);
    const focusInside = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(focusInside, 'focus is still outside the dialog — a screen reader user has no idea it opened').toBe(true);
  });

  test('Tab is trapped inside the dialog', async ({ page }) => {
    const dialog = await openAsNewUser(page);

    // Walk further than the dialog has controls. Without a trap, focus escapes
    // into the page behind the overlay — controls the user cannot see, under a
    // layer they cannot dismiss.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside, `focus escaped the dialog after ${i + 1} Tab presses`).toBe(true);
    }
  });

  test('Shift+Tab is also trapped', async ({ page }) => {
    const dialog = await openAsNewUser(page);
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Shift+Tab');
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside, `focus escaped backwards after ${i + 1} Shift+Tab presses`).toBe(true);
    }
  });

  test('focus returns to the opener when it closes', async ({ app, page }) => {
    // Open it deliberately from the sidebar, so there is a known opener.
    const opener = app.sidebar.getByRole('button', { name: /configure|key|مفتاح/i }).first();
    await opener.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Dropping the user at the top of the document means tabbing all the way
    // back to where they were.
    const returned = await opener.evaluate((el) => el === document.activeElement);
    expect(returned, 'focus was not restored to the control that opened the dialog').toBe(true);
  });

  test('the close button has an accessible name', async ({ page }) => {
    const dialog = await openAsNewUser(page);
    await expect(dialog.getByRole('button', { name: /close/i })).toBeVisible();
  });

  test('the dialog has no critical or serious axe violations', async ({ page }) => {
    await openAsNewUser(page);

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
      .analyze();

    // Scoped to critical/serious, minus colour-contrast: the dialog inherits
    // the app's palette, so that violation is app-wide debt tracked in
    // KNOWN_A11Y_DEBT (accessibility.spec.ts) rather than something this
    // dialog introduced. Re-reporting it here would mean two places to update
    // when it is fixed, and a red modal suite for a reason unrelated to modals.
    const blocking = results.violations.filter(
      (v) => ['critical', 'serious'].includes(v.impact ?? '') && v.id !== 'color-contrast',
    );
    expect(
      blocking,
      `critical/serious violations in the dialog:\n${blocking
        .map((v) => `  - ${v.id} (${v.impact}) x${v.nodes.length}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
