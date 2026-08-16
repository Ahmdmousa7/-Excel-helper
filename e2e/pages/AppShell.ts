import { Page, Locator, expect } from '@playwright/test';

/**
 * The app shell: sidebar, tool navigation, search, and the global toggles.
 *
 * Every selector the suite depends on lives in a page object rather than in the
 * specs. When the DOM changes, one file changes — before this existed, a
 * `<aside>` becoming a `<nav>` would have meant editing nine spec files.
 */
export class AppShell {
  constructor(readonly page: Page) {}

  /**
   * Tool names hard-coded in English in App.tsx rather than routed through the
   * translation layer. Stable regardless of which language the app boots in,
   * which is why the suite anchors on these.
   */
  static readonly TOOL = {
    removeBlanks: 'Remove Blanks',
    compareFiles: 'Compare Files',
    deduplicator: 'Deduplicator (Pro)',
    mergeDatasets: 'Merge Datasets',
    separator: 'Separator',
    qrGenerator: 'QR Generator',
  } as const;

  static readonly GROUP = {
    dashboard: 'Dashboard',
    newTools: 'New Solid Data Tools',
  } as const;

  static readonly APP_TITLE = 'Mousa';

  // --- Locators -------------------------------------------------------------

  get sidebar(): Locator {
    return this.page.locator('aside').first();
  }

  get search(): Locator {
    return this.sidebar.getByPlaceholder(/search apps|بحث/i);
  }

  get errorBoundary(): Locator {
    return this.page.getByText(/something went wrong/i);
  }

  get loadingShell(): Locator {
    return this.page.getByText('Loading Workspace...');
  }

  /** The Suspense fallback shown while a lazy tool chunk downloads. */
  get toolLoading(): Locator {
    return this.page.getByText('Loading tool…');
  }

  tool(name: string): Locator {
    return this.sidebar.getByRole('button', { name, exact: false }).first();
  }

  // --- Actions --------------------------------------------------------------

  /**
   * Load the app and wait until it is genuinely interactive.
   *
   * Seeds localStorage first: App.tsx opens the API-key modal on first load when
   * no Gemini key is stored, and it is a full-screen `fixed inset-0` overlay
   * with no Escape handler that swallows every click. A test that skips this
   * fails with a confusing 15-second timeout on an unrelated element.
   */
  async goto(path = './'): Promise<void> {
    await this.page.addInitScript(() => {
      localStorage.setItem('gemini_api_key', 'e2e-placeholder-key');
      localStorage.setItem('groq_api_key', '');
    });
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.waitUntilReady();
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.sidebar).toBeVisible({ timeout: 30_000 });
    await expect(this.loadingShell).toHaveCount(0);
    await this.dismissModal();
  }

  /**
   * Close a modal overlay if one is open. Defensive — the seeded key should
   * prevent the API-key modal entirely, but a blocked click otherwise produces
   * a 15s timeout with a misleading message.
   */
  async dismissModal(): Promise<void> {
    const overlay = this.page.locator('div.fixed.inset-0').filter({ has: this.page.locator('div') });
    if ((await overlay.count()) === 0) return;
    if (!(await overlay.first().isVisible().catch(() => false))) return;
    await overlay.first().locator('button').first().click({ timeout: 3_000 }).catch(() => undefined);
    await expect(overlay.first()).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
  }

  /**
   * Open a tool and wait for its lazy chunk to finish loading.
   *
   * The wait matters since code splitting (TD-004): a click now starts a network
   * fetch, so asserting on tool content immediately after clicking races the
   * download. Waiting for the Suspense fallback to clear is the correct signal.
   */
  async openTool(name: string): Promise<void> {
    const item = this.tool(name);
    await expect(item).toBeVisible();
    await item.click();
    await expect(this.toolLoading).toHaveCount(0, { timeout: 20_000 });
  }

  /** Open a tool matched by pattern — for tools whose label is translated. */
  async openToolMatching(pattern: RegExp): Promise<void> {
    const item = this.sidebar.getByRole('button').filter({ hasText: pattern }).first();
    await expect(item).toBeVisible();
    await item.click();
    await expect(this.toolLoading).toHaveCount(0, { timeout: 20_000 });
  }

  async searchFor(query: string): Promise<void> {
    await this.search.fill(query);
  }

  async toggleLanguage(): Promise<void> {
    await this.sidebar.getByRole('button', { name: /English|العربية/ }).first().click();
  }

  // --- Assertions -----------------------------------------------------------

  async expectHealthy(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
    await expect(this.errorBoundary).toHaveCount(0);
  }

  /** Horizontal overflow in CSS pixels. >2 means the page pans sideways. */
  async horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
