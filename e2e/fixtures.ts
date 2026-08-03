import { test as base, expect, Page } from '@playwright/test';
import { AppShell } from './pages/AppShell';
import { QrToolPage } from './pages/QrToolPage';
import { DataToolPage } from './pages/DataToolPage';

export { expect };
export { AppShell } from './pages/AppShell';
export { QrToolPage } from './pages/QrToolPage';
export { DataToolPage } from './pages/DataToolPage';

/** Convenience re-exports so specs do not reach through the class. */
export const TOOL = AppShell.TOOL;
export const GROUP = AppShell.GROUP;
export const APP_TITLE = AppShell.APP_TITLE;

/**
 * Console noise the app neither causes nor can fix.
 *
 * Kept deliberately short. Two entries were REMOVED when the things they
 * described stopped being third-party noise: `cdn.tailwindcss.com` (TD-007
 * deleted the CDN, so a message naming it means it came back) and
 * `Content Security Policy` (TD-006 added one, so a violation is a finding).
 * Every entry here is a small hole in the suite's vision — add one only when
 * the message is genuinely outside this codebase's control.
 */
const EXTERNAL_NOISE: RegExp[] = [
  // `/firestore/i` and `/firebase/i` were REMOVED here for the same reason as
  // the two entries named above: ADR-0005 deleted Firebase, so a console message
  // mentioning it is no longer noise this codebase cannot control — it means
  // Firebase came back, which is a finding.
  /net::ERR_/i,
  /Failed to load resource/i,
  /googleapis\.com/i,
  /accounts\.google\.com/i,
  /gsi\/client/i,
];

export type PageErrors = {
  /** Console errors and uncaught exceptions, external noise filtered out. */
  all(): string[];
  /** Fails the calling test if anything was recorded. */
  expectNone(context?: string): void;
};

function watchErrors(page: Page): PageErrors {
  const errors: string[] = [];
  const keep = (t: string) => !EXTERNAL_NOISE.some((re) => re.test(t));

  page.on('console', (m) => {
    if (m.type() === 'error' && keep(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => {
    if (keep(e.message)) errors.push(`pageerror: ${e.message}`);
  });

  return {
    all: () => [...errors],
    expectNone: (context = 'unexpected console errors') =>
      expect(errors, `${context}:\n${errors.join('\n')}`).toEqual([]),
  };
}

type Fixtures = {
  /** The app shell, already loaded and interactive. */
  app: AppShell;
  /** The app shell WITHOUT navigating — for tests that control their own load. */
  shell: AppShell;
  /** The QR tool, already open. */
  qr: QrToolPage;
  /** Spreadsheet-tool helper. Does not open a tool; call `open(TOOL.x)`. */
  dataTool: DataToolPage;
  /** Console/exception recorder, attached before the page navigates. */
  pageErrors: PageErrors;
};

export const test = base.extend<Fixtures>({
  // Attached first so it is listening before any navigation happens.
  pageErrors: async ({ page }, use) => {
    await use(watchErrors(page));
  },

  shell: async ({ page }, use) => {
    await use(new AppShell(page));
  },

  app: async ({ shell }, use) => {
    await shell.goto();
    await use(shell);
  },

  qr: async ({ page, app }, use) => {
    const qr = new QrToolPage(page, app);
    await qr.open();
    await use(qr);
  },

  dataTool: async ({ page, app }, use) => {
    await use(new DataToolPage(page, app));
  },
});
