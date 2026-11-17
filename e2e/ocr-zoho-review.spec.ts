/**
 * Opened from Zoho (`#zoho-bridge`): the files arrive by postMessage, the
 * extraction starts by itself as a Restaurant Menu, a second reading
 * double-checks the prices, and the Rewaa workbook goes back to the task by
 * itself once the review has nothing open.
 *
 * The model is intercepted: the streamed call is the extraction, the plain
 * `generateContent` call is the second reading (name + price only).
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const item = (name: string, price: number) => ({
  Category: 'Hot Drinks | المشروبات الساخنة', 'Product Name': name, Description: '', 'Retail Price': price,
  Type: 'Simple', 'Enable stock management': 'no', 'Product SKU': '',
});
/** The example from the design: Latte read as 16 (it is 18), Tea not extracted. */
const EXTRACTION = [item('Arabic Coffee | قهوة عربية', 12), item('Latte | لاتيه', 16), item('Cappuccino | كابتشينو', 17)];
const SECOND_READ = [
  { name: 'قهوة عربية', price: 12 }, { name: 'لاتيه', price: 18 }, { name: 'كابتشينو', price: 17 }, { name: 'شاي', price: 8 },
];

const candidate = (text: string) => ({ candidates: [{ index: 0, finishReason: 'STOP', content: { role: 'model', parts: [{ text }] } }] });

async function interceptModel(page: Page, second: unknown): Promise<{ prompts: string[] }> {
  const seen = { prompts: [] as string[] };
  await page.route(/[gG]enerateContent/, async (route) => {
    const url = route.request().url();
    seen.prompts.push(route.request().postData() ?? '');
    if (url.includes('streamGenerateContent')) {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: `data: ${JSON.stringify(candidate(JSON.stringify(EXTRACTION)))}\r\n\r\n` });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(candidate(JSON.stringify(second))) });
    }
  });
  return seen;
}

/** Plays the userscript: sends the task's file, records what comes back. */
async function openFromZoho(app: { goto(path?: string): Promise<void> }, page: Page) {
  await app.goto('./#zoho-bridge');
  await page.evaluate((png) => {
    const w = window as unknown as { __results: unknown[] };
    w.__results = [];
    let loaded = false;
    const send = () => window.postMessage({ type: 'rewaa-ocr-load', taskId: '4412', taskName: '21990', files: [{ name: 'menu.png', mime: 'image/png', base64: png }] }, location.origin);
    window.addEventListener('message', (e) => {
      const d = e.data as { type?: string };
      if (d && d.type === 'rewaa-ocr-result') w.__results.push(d);
      if (d && d.type === 'rewaa-ocr-loaded') loaded = true;
      if (d && d.type === 'rewaa-ocr-ready') send();
    });
    // Like the userscript: the OCR tab may still be loading, so offer the files until it says "loaded".
    const t = setInterval(() => { if (loaded) clearInterval(t); else send(); }, 500);
    send();
  }, PNG);
}
const results = (page: Page) => page.evaluate(() => (window as unknown as { __results: { fileName: string; rows: number }[] }).__results);

test.describe('OCR from Zoho — auto start, price double-check, auto send', () => {
  test('a disagreement holds the send; fixing it sends by itself', async ({ shell: app, page }) => {
    test.setTimeout(90_000);
    const seen = await interceptModel(page, SECOND_READ);
    let downloads = 0;
    page.on('download', () => { downloads++; });
    await openFromZoho(app, page);

    // Started by itself (no click on Start Extraction), as a Restaurant Menu.
    const review = page.getByTestId('ocr-review');
    await expect(review).toBeVisible({ timeout: 60_000 });
    expect(seen.prompts).toHaveLength(2);
    expect(seen.prompts[0]).toContain('Extract menu items');
    expect(seen.prompts[1]).toContain('list every price printed');

    // Latte: the two readings disagree; Tea: only the second reading saw it.
    await expect(page.getByTestId('ocr-review-item')).toHaveCount(1);
    await expect(page.getByTestId('ocr-review-item')).toContainText('Latte');
    await expect(page.getByTestId('ocr-review-missing')).toContainText('شاي');
    await expect(page.getByTestId('ocr-send-zoho')).toContainText(/Send anyway \(2 to review\)/);
    expect(await results(page)).toEqual([]); // held

    await page.getByRole('button', { name: 'Use 18' }).click();
    await page.getByTestId('ocr-review-missing').getByRole('button', { name: 'Add' }).click();

    await expect(review).toContainText('all 4 rows passed');
    await expect.poll(() => results(page)).toHaveLength(1);
    const [sent] = await results(page);
    expect(sent.rows).toBe(4);
    expect(sent.fileName).toMatch(/^OCR-Rewaa-menu-\d{8}-\d{6}\.xlsx$/);
    expect(downloads).toBe(0); // it goes to Zoho, not to Downloads
  });

  test('a clean review sends by itself, with no click at all', async ({ shell: app, page }) => {
    test.setTimeout(90_000);
    await interceptModel(page, SECOND_READ.slice(0, 3).map((x, i) => (i === 1 ? { ...x, price: 16 } : x)));
    await openFromZoho(app, page);
    await expect.poll(() => results(page), { timeout: 60_000 }).toHaveLength(1);
    await expect(page.getByTestId('ocr-review')).toContainText('all 3 rows passed');
    await page.getByRole('button', { name: /Show Logs/i }).click();
    await expect(page.getByText('Review clean — sent to Zoho automatically.')).toBeVisible();
  });
});
