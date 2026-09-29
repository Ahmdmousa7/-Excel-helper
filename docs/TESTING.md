# Testing

| Layer | Tool | Count | Command |
|---|---|---:|---|
| Unit | Vitest | 670 | `npm run test` |
| E2E | Playwright | 130 | `npm run e2e` |

`npm run verify` runs lint → typecheck → unit → build, i.e. everything the `quality` CI job runs.

## Unit tests

`tests/unit/**`, scoped to the pure-logic modules in `utils/`. Coverage thresholds are enforced (`vitest.config.ts`): 60% lines/functions/statements, 50% branches, measured over `utils/**` only. Pointing coverage at the whole tree would report ~2% and make the number meaningless.

Current: **78% lines, 88% branches, 75% functions.**

Components are not unit-tested. They do I/O directly and would each need a DOM plus a Firebase mock; the e2e suite covers them more cheaply and more honestly. If a component gets extracted into a pure helper, test the helper.

## E2E tests

`e2e/**` — **22 spec files, 130 tests** (verified 2026-09-29; one is a network test that is skipped unless `E2E_NETWORK=1`). The first nine below were the original risk areas; the rest were added as specific defects were fixed, and each one exists because something broke.

| Suite | What it pins |
|---|---|
| `smoke` | The app boots past the static loading shell; every tool is reachable. |
| `happy-path` | Generate a QR code end to end; switch tools; filter the sidebar. |
| `accessibility` | axe-core WCAG 2.1 AA scan, as a ratchet (see below). |
| `keyboard` | Tab reach, Enter/Space activation, no focus trap, visible focus ring. |
| `responsive` | No horizontal overflow at 375/768/1280/1920; 24px tap targets. |
| `clipboard` | The QR copy button calls the clipboard API and survives a rejection. |
| `download` | The QR download is a real PNG — asserted on the file's magic bytes. |
| `error-handling` | Empty input, 8,000-char payload, no file loaded, total network failure, rapid tool switching. |
| `regression` | Pages base path, no 404s, no duplicate routed tools, no leaked object URLs. |
| `modal` | The API-key dialog: dialog semantics, Escape, focus trap and restore, axe scan. |
| `invalid-files` | A non-spreadsheet with an .xlsx extension, a corrupt ZIP, awkward CSV punctuation. |
| `large-files` | 40,000-row workbooks — correctness and that the shell survives. |
| `offline` | Going offline mid-session, recovery, and an uncached lazy chunk failing visibly rather than blank. |
| `smart-lookup` | **The exported file matches the on-screen preview cell for cell** (TD-043), first-match on duplicate keys, and that a returned date keeps its format (TD-045). |
| `composite-quantity-rules` | Quantity must be > 0: zero and negative flagged in both languages, with the right cell reference. |
| `support-chat-fallback` | A model fallback reaches the user, and neither notices nor errors leak into the next prompt. |
| `ocr-text-input` | Spreadsheet and Word input to OCR Extraction through the whole pipeline, with the model call intercepted: the file's content reaches the model as text inside the tab's prompt, and the answer reaches the downloaded export. Legacy `.doc` is refused. |
| `ai-tools` | TD-051, with every Gemini call intercepted. **Web Scraper**: a Yalla QR Codes menu is read from its own menu data (fixture `tests/fixtures/yalla-kelah.json`) — items with sizes reach the model as `VARIANT` lines with their real prices, the `branch` header is sent, Jina is not needed, and an unreachable menu API falls back to the page text with a warning. Also on the real page content of `kelah.yallaqrcodes.com/branch/1/` (fixture `tests/fixtures/kelah-menu.jina.md`): the page is requested fresh (`X-No-Cache`, since Jina's cached copy was an empty shell), the menu reaches the prompt and the answer reaches the download; no-quota and overloaded failures become one readable sentence in English and Arabic after one request per candidate; the tab's own errors are not rewritten. **Translator:** a no-quota failure is one readable sentence in the log and in the `PARTIAL_` workbook. One test fetches the **live site** through Jina and runs only with `E2E_NETWORK=1 npx playwright test e2e/ai-tools.spec.ts` — kept out of the gate so it never depends on a third-party site. |
| `ocr-rewaa-export` | OCR into the **real Rewaa templates** with the live run's data shape (model intercepted): variant columns that first appear after a simple row are mapped into Mapped Variable (`Option 1`, `Option 1 Value`, `Variant Name`); a price range is ONE row at Price `0` with `Price range: X to Y` in the Description; the live run's split Long pair is merged back; `00123` stays distinct from `123`; nothing downloads before Export. Also: a no-quota provider failure is one readable sentence in English and in Arabic, with no raw JSON, after one request per candidate model. |
| `csv-arabic` | TD-050: a BOM-less Arabic CSV uploaded through the shared reader and through Files Validation's own reader keeps its Arabic in the downloaded file. Reverting either reader fails exactly its own test. |
| `files-validation` | Duplicate rules and the per-error / per-fix sheets through a real upload → validate → download, in both the single-file and chunked-ZIP paths. The module's first browser coverage. |
| `exporter-date-format` | **A reproduction, not a guard** (TD-049): a dated column exported through Remove Blanks keeps its value but loses its number format. Uses `test.fail()`, so it passes while the defect exists and **fails when someone fixes it**. |

### There is no auth bypass any more

This section used to describe a double-gated `VITE_E2E_AUTH_BYPASS` flag in `components/AuthWrapper.tsx`, which let Playwright past a Google sign-in gate it could not complete. **ADR-0005 removed the gate**, so the flag, the wrapper, and the env var are all gone. Nothing in the tree reads `VITE_E2E_AUTH_BYPASS`.

Playwright still serves the **built** bundle rather than the dev server, so the suite exercises the real production output — which is what catches base-path and bundling breakage before it reaches GitHub Pages.

`build:e2e` and its separate `--outDir dist-e2e` are kept, and the separate directory is still load-bearing: `vite preview` serves a directory live from disk, so any build into the directory being served swaps the bundle mid-run. That once produced a near-total failure (100 of the 101 tests at the time) that looked exactly like an app regression.

### Ratchets, not audits

Two suites record existing debt and fail only when it **grows**. This is deliberate: failing on all pre-existing violations produces a permanently red check that everyone learns to bypass, which is worse than no check.

| Ratchet | Where | Current |
|---|---|---|
| Accessibility | `KNOWN_A11Y_DEBT` in `e2e/accessibility.spec.ts` | 7 allow-listed rule IDs |
| Mobile overflow | `KNOWN_MOBILE_OVERFLOW_BUDGET` in `e2e/responsive.spec.ts` | 24 (measured 22) |

**Lower these as the debt is paid. Never raise one to turn a red build green** — the a11y suite has a meta-test that fails if the allow-list grows, precisely to force that conversation.

## Writing a new e2e test

Use the helpers in `e2e/fixtures.ts` rather than raw `page.goto`. `gotoApp()` seeds `localStorage` so the API-key modal never opens — it is a full-screen overlay with no Escape handler that silently swallows every click, and a test that skips this fails with a confusing 15-second timeout.

Prefer, in order:
1. The hard-coded English tool names in `TOOL` — stable regardless of app language.
2. Roles and accessible names (`getByRole`).
3. Stable attributes such as `img[alt="QR Code"]`.

Avoid CSS class selectors; the app is Tailwind-styled and its classes change with any restyle.

## Debugging a failure

```bash
npm run e2e -- --headed          # watch it run
npm run e2e -- --debug           # step through
npm run e2e -- -g "download"     # one suite
npm run e2e:report               # open the last HTML report
```

CI uploads `playwright-report/` and `test-results/` (traces, screenshots, video on failure) as artifacts for 14 days.
