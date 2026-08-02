import { Page, Locator, expect } from '@playwright/test';
import { AppShell } from './AppShell';

/**
 * Shared surface of the spreadsheet tools — the ones that take a file and
 * operate on its rows.
 *
 * They differ in what they do with the data but agree on how it gets in: a
 * hidden `<input type="file">` behind an upload affordance. Driving that from
 * one place keeps the file-handling suites (large files, invalid files) from
 * re-deriving it per tool.
 */
export class DataToolPage {
  constructor(
    readonly page: Page,
    private readonly shell: AppShell,
  ) {}

  /**
   * The first file input on the page.
   *
   * These are `className="hidden"` behind a styled label, so `setInputFiles`
   * is the right lever — clicking the label opens a native dialog Playwright
   * cannot drive.
   */
  get fileInput(): Locator {
    return this.page.locator('input[type="file"]').first();
  }

  get anyFileInput(): Locator {
    return this.page.locator('input[type="file"]');
  }

  async open(toolName: string): Promise<void> {
    await this.shell.openTool(toolName);
  }

  /**
   * Upload an in-memory buffer as a file.
   *
   * Buffers rather than fixture files on purpose: a 40,000-row spreadsheet
   * committed to the repo would dominate the diff and every clone, and the
   * interesting property is the row count, not the bytes.
   */
  async upload(name: string, mimeType: string, buffer: Buffer): Promise<void> {
    await this.fileInput.setInputFiles({ name, mimeType, buffer });
  }

  /** Whether the app surfaced any error affordance to the user. */
  async hasVisibleError(): Promise<boolean> {
    const patterns = [
      /error/i,
      /failed/i,
      /invalid/i,
      /could not/i,
      /unable to/i,
      /unsupported/i,
      /خطأ/,
    ];
    for (const p of patterns) {
      if (await this.page.getByText(p).first().isVisible().catch(() => false)) return true;
    }
    return false;
  }

  /** Open the log drawer, where the tools report parse failures. */
  async openLogs(): Promise<void> {
    const toggle = this.page
      .getByRole('button')
      .filter({ hasText: /log/i })
      .first();
    if (await toggle.count()) await toggle.click().catch(() => undefined);
  }

  async expectStillUsable(): Promise<void> {
    await expect(this.shell.sidebar).toBeVisible();
    await expect(this.shell.errorBoundary).toHaveCount(0);
  }
}
