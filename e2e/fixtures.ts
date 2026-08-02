import { Page, Locator, expect } from '@playwright/test';

/**
 * Tool names that are hard-coded English in App.tsx rather than routed through
 * the translation layer. Using these keeps selectors stable regardless of which
 * language the app happens to boot in.
 */
export const TOOL = {
  removeBlanks: 'Remove Blanks',
  compareFiles: 'Compare Files',
  deduplicator: 'Deduplicator (Pro)',
  mergeDatasets: 'Merge Datasets',
  separator: 'Separator',
  magicLinks: 'Magic Links',
} as const;

/** Sidebar group headings, likewise hard-coded in App.tsx. */
export const GROUP = {
  dashboard: 'Dashboard',
  newTools: 'New Solid Data Tools',
} as const;

export const APP_TITLE = 'Mousa';

/** The sidebar, which is the app shell's most reliable "we booted" signal. */
export function sidebar(page: Page): Locator {
  return page.locator('aside').first();
}

/**
 * Load the app and wait until it is genuinely interactive.
 *
 * Two things make a naive `page.goto` insufficient:
 *
 *  1. `index.html` ships a static "Loading Workspace..." spinner that React
 *     replaces on mount, so a `load` event alone proves nothing — the
 *     assertion has to be on real app chrome.
 *  2. App.tsx opens the API-key modal on first load when no Gemini key is
 *     stored (App.tsx ~line 170). It is a full-screen `fixed inset-0` overlay
 *     that swallows every click, and it has no Escape handler and no
 *     backdrop-click dismissal — only an icon-only X button. Rather than
 *     hunting that button in every test, seed localStorage before any app
 *     script runs so the modal never opens.
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // A syntactically plausible placeholder. Nothing calls the API in these
    // tests; this only satisfies the "is a key configured?" check.
    localStorage.setItem('gemini_api_key', 'e2e-placeholder-key');
    localStorage.setItem('groq_api_key', '');
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(sidebar(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Loading Workspace...')).toHaveCount(0);
  await dismissModal(page);
}

/**
 * Close any modal overlay that happens to be open.
 *
 * Defensive: the seeded key should prevent the API-key modal entirely, but a
 * test that navigates somewhere modal-opening still needs an escape route, and
 * a blocked click produces a 15s timeout with a confusing message.
 */
export async function dismissModal(page: Page): Promise<void> {
  const overlay = page.locator('div.fixed.inset-0').filter({ has: page.locator('div') });
  if ((await overlay.count()) === 0) return;
  if (!(await overlay.first().isVisible().catch(() => false))) return;

  // The close control is the icon-only button in the modal header.
  const close = overlay.first().locator('button').first();
  await close.click({ timeout: 3_000 }).catch(() => undefined);
  await expect(overlay.first()).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
}

/** Click a sidebar tool by its visible name. */
export async function openTool(page: Page, name: string): Promise<void> {
  const item = sidebar(page).getByRole('button', { name, exact: false }).first();
  await expect(item).toBeVisible();
  await item.click();
}

/**
 * Open the QR Code tool. It is the best e2e target in the app: entirely
 * client-side (the `qrcode` package), no API key, no file upload, and it
 * exercises both a download and a clipboard write.
 *
 * Its sidebar label comes from the translation layer, so match on either
 * language rather than assuming English.
 */
export async function openQrTool(page: Page): Promise<void> {
  const item = sidebar(page)
    .getByRole('button')
    .filter({ hasText: /QR/i })
    .first();
  await expect(item).toBeVisible();
  await item.click();
}

/** Type text into the QR tool and wait for the generated image. */
export async function generateQr(page: Page, text: string): Promise<Locator> {
  const input = page.locator('textarea').first();
  await expect(input).toBeVisible();
  await input.fill(text);

  const img = page.locator('img[alt="QR Code"]');
  await expect(img).toBeVisible({ timeout: 15_000 });
  return img;
}

/**
 * Collect console errors and page exceptions for the lifetime of a test.
 *
 * Firebase is unreachable under the e2e bypass, so its connection noise is
 * filtered — anything else is a real regression signal.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  const IGNORE = [
    /firestore/i,
    /firebase/i,
    /net::ERR_/i,
    /Failed to load resource/i,
    /googleapis\.com/i,
    /accounts\.google\.com/i,
    /gsi\/client/i,
    /cdn\.tailwindcss\.com/i,
    /Content Security Policy/i,
  ];
  const keep = (t: string) => !IGNORE.some((re) => re.test(t));

  page.on('console', (msg) => {
    if (msg.type() === 'error' && keep(msg.text())) errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    if (keep(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}
