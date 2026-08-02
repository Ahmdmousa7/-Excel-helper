import { test, expect, TOOL } from './fixtures';
import {
  makeNotASpreadsheet,
  makeCorruptXlsx,
  makeEmptyFile,
  makeFakeImage,
  makeAwkwardCsv,
} from './helpers/makeFiles';

/**
 * Malformed and hostile input.
 *
 * Every case is something a real user does by accident — renaming a .txt to
 * .xlsx, uploading a half-downloaded file, picking the wrong file entirely.
 * The bar is the same throughout: the app may refuse the file, but it must not
 * crash, hang, or silently pretend it worked.
 */
test.describe('invalid files', () => {
  const CASES = [
    { label: 'plain text with an .xlsx extension', make: makeNotASpreadsheet },
    { label: 'a truncated/corrupt workbook', make: makeCorruptXlsx },
    { label: 'a zero-byte file', make: makeEmptyFile },
    { label: 'a PNG chosen by mistake', make: makeFakeImage },
  ];

  for (const { label, make } of CASES) {
    test(`survives ${label}`, async ({ app, dataTool, pageErrors }) => {
      await app.openTool(TOOL.removeBlanks);

      const file = make();
      await dataTool.upload(file.name, file.mimeType, file.buffer);
      await app.page.waitForTimeout(2000);

      // The error boundary is the line: refusing the file is fine, taking the
      // app down is not.
      await dataTool.expectStillUsable();

      // Parse failures logged to the console are expected and correct here —
      // they are the app reporting a bad file. Uncaught exceptions are not.
      const uncaught = pageErrors.all().filter((e) => e.startsWith('pageerror:'));
      expect(uncaught, `${label} caused an uncaught exception:\n${uncaught.join('\n')}`).toEqual([]);
    });
  }

  test('a bad file leaves the tool usable for a subsequent good one', async ({ app, dataTool }) => {
    await app.openTool(TOOL.removeBlanks);

    const bad = makeCorruptXlsx();
    await dataTool.upload(bad.name, bad.mimeType, bad.buffer);
    await app.page.waitForTimeout(1500);

    // The recovery path matters more than the rejection: a tool that has to be
    // reloaded after one bad file is barely better than one that crashes.
    const good = makeAwkwardCsv();
    await dataTool.upload(good.name, good.mimeType, good.buffer);
    await app.page.waitForTimeout(2000);

    await dataTool.expectStillUsable();
  });

  test('awkward but valid CSV content parses without crashing', async ({ app, dataTool, pageErrors }) => {
    // Embedded commas, escaped quotes, newlines inside cells, Arabic text,
    // and formula-injection shapes (=1+1, @SUM(...)). All legal CSV.
    await app.openTool(TOOL.removeBlanks);

    const file = makeAwkwardCsv();
    await dataTool.upload(file.name, file.mimeType, file.buffer);
    await app.page.waitForTimeout(2000);

    await dataTool.expectStillUsable();
    const uncaught = pageErrors.all().filter((e) => e.startsWith('pageerror:'));
    expect(uncaught, `awkward CSV threw:\n${uncaught.join('\n')}`).toEqual([]);
  });

  test('uploading several bad files in a row does not degrade the app', async ({ app, dataTool }) => {
    await app.openTool(TOOL.removeBlanks);

    for (const make of [makeCorruptXlsx, makeEmptyFile, makeNotASpreadsheet, makeFakeImage]) {
      const f = make();
      await dataTool.upload(f.name, f.mimeType, f.buffer);
      await app.page.waitForTimeout(700);
    }

    await dataTool.expectStillUsable();
  });
});
