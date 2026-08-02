import { Page, Locator, expect, Download } from '@playwright/test';
import { AppShell } from './AppShell';

/**
 * The QR Code tool.
 *
 * The suite leans on this tool more than any other because it is the only one
 * that is fully self-contained: no API key, no file upload, no network. It
 * exercises a download and a clipboard write, which makes it the natural target
 * for both of those suites.
 */
export class QrToolPage {
  constructor(
    readonly page: Page,
    private readonly shell: AppShell,
  ) {}

  get input(): Locator {
    return this.page.locator('textarea').first();
  }

  get image(): Locator {
    return this.page.locator('img[alt="QR Code"]');
  }

  get downloadButton(): Locator {
    return this.page.getByRole('button', { name: /download|تحميل/i }).first();
  }

  get copyButton(): Locator {
    return this.page.getByRole('button', { name: /copy qr code/i });
  }

  get sizeInput(): Locator {
    return this.page.locator('#qr-size');
  }

  get errorLevelSelect(): Locator {
    return this.page.locator('#qr-error-level');
  }

  async open(): Promise<void> {
    await this.shell.openToolMatching(/QR/i);
    await expect(this.input).toBeVisible();
  }

  /** Replace the input contents and wait for the regenerated image. */
  async generate(text: string): Promise<Locator> {
    await expect(this.input).toBeVisible();
    await this.input.fill(text);
    await expect(this.image).toBeVisible({ timeout: 15_000 });
    return this.image;
  }

  /** Clear by keyboard rather than fill(''), for the keyboard-path tests. */
  async clearByKeyboard(): Promise<void> {
    await this.input.focus();
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.press('Delete');
  }

  async dataUrl(): Promise<string | null> {
    return this.image.getAttribute('src');
  }

  async download(): Promise<Download> {
    const pending = this.page.waitForEvent('download', { timeout: 20_000 });
    await this.downloadButton.click();
    return pending;
  }
}
