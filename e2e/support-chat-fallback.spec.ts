/**
 * Support Chat / Data Analyst: a model fallback reaches the user, and does not
 * leak back into the next prompt.
 *
 * This component was the gap in TD-041. `generateText` grew the `onNotice`
 * callback and every other caller was wired to it, but SupportChat passed
 * nothing — and the unit test covering the service was titled "…— Support Chat"
 * and stayed green throughout, which made it worse than no test at all. This one
 * drives the actual component.
 *
 * The second assertion is the subtler half. The notice is rendered as an
 * assistant message, and `historyContext` labels every assistant message
 * "Analyst:" when it builds the next turn's prompt — so without the `isNotice`
 * flag the model would be told it had said "Model X is unavailable; continuing
 * on Y", and answer the next question with that in its context. A notice that
 * changes the following answer is worse than no notice.
 */
import { test, expect } from './fixtures';

const RETIRED = JSON.stringify({
  error: { code: 404, message: 'This model is no longer available.', status: 'NOT_FOUND' },
});

const ANSWER_ONE = 'The first answer is 42.';
const ANSWER_TWO = 'The second answer is 43.';

test.describe('Support Chat — model fallback', () => {
  // `shell`, not `app`: the `app` fixture navigates during setup, which happens
  // before the test body registers its routes — so the first load would be
  // unrouted and immediately thrown away by a second navigation. `shell` hands
  // over the page without loading it.
  test('posts the fallback to the user and keeps it out of the next prompt', async ({ shell, page }) => {
    test.setTimeout(120_000);

    /** Every prompt the app sends, so the second one can be inspected. */
    const prompts: string[] = [];
    let answered = 0;

    await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
      const model = /models\/([^:?/]+)/.exec(route.request().url())?.[1] ?? '';

      // The tier's first candidate is gone; the next one answers. One hop, so
      // exactly one notice.
      if (model === 'gemini-3.6-flash') {
        return route.fulfill({ status: 404, contentType: 'application/json', body: RETIRED });
      }

      prompts.push(route.request().postData() ?? '');
      answered += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: answered === 1 ? ANSWER_ONE : ANSWER_TWO }] } }],
        }),
      });
    });

    await shell.goto();
    // The launcher is an icon-only button in the fixed corner container.
    await page.locator('div.fixed.bottom-6 > button').last().click();
    await page.getByRole('button', { name: 'Analyst', exact: true }).click();

    const input = page
      .locator('div.fixed.bottom-6 textarea, div.fixed.bottom-6 input[type="text"]')
      .last();

    await input.fill('How many rows?');
    await input.press('Enter');

    // The user is told, in the only channel this component has.
    await expect(page.getByText(/quality may differ/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(ANSWER_ONE)).toBeVisible({ timeout: 30_000 });

    // Ask again, so a second prompt is built from the transcript.
    await input.fill('And how many columns?');
    await input.press('Enter');
    await expect(page.getByText(ANSWER_TWO)).toBeVisible({ timeout: 30_000 });

    expect(prompts.length, 'the second question never reached the API').toBeGreaterThanOrEqual(2);
    const secondPrompt = prompts[prompts.length - 1];

    // The history is there — this is not passing because the prompt is empty.
    expect(secondPrompt).toContain('How many rows?');
    // …but the notice is not in it.
    expect(secondPrompt, 'the fallback notice leaked into the next prompt').not.toContain(
      'quality may differ',
    );
    expect(secondPrompt).not.toContain('Model changed');
  });

  test('an error message also stays out of the next prompt', async ({ shell, page }) => {
    /**
     * Same bug, different message, and this one predates the notice: the catch
     * block pushes `Error: …` as an assistant turn, so a rate limit ended up in
     * the model's context as "Analyst: Error: 429 quota exceeded" — a failure
     * report attributed to the model itself.
     */
    test.setTimeout(120_000);

    const prompts: string[] = [];
    let calls = 0;

    await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
      calls += 1;
      prompts.push(route.request().postData() ?? '');
      // Fail the FIRST question outright with something that is not a model
      // retirement, so it lands in the catch rather than the fallback walk.
      if (calls === 1) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 400, message: 'API key not valid' } }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: ANSWER_TWO }] } }] }),
      });
    });

    await shell.goto();
    await page.locator('div.fixed.bottom-6 > button').last().click();
    await page.getByRole('button', { name: 'Analyst', exact: true }).click();

    const input = page
      .locator('div.fixed.bottom-6 textarea, div.fixed.bottom-6 input[type="text"]')
      .last();

    await input.fill('First question');
    await input.press('Enter');
    await expect(page.getByText(/^Error:/)).toBeVisible({ timeout: 30_000 });

    await input.fill('Second question');
    await input.press('Enter');
    await expect(page.getByText(ANSWER_TWO)).toBeVisible({ timeout: 60_000 });

    const secondPrompt = prompts[prompts.length - 1];
    expect(secondPrompt).toContain('First question');
    expect(secondPrompt, 'the error message leaked into the next prompt').not.toContain('API key not valid');
  });
});
