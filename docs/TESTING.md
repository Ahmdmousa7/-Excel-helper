# Testing

| Layer | Tool | Count | Command |
|---|---|---:|---|
| Unit | Vitest | 32 | `npm run test` |
| E2E | Playwright | 59 | `npm run e2e` |

`npm run verify` runs lint → typecheck → unit → build, i.e. everything the `quality` CI job runs.

## Unit tests

`tests/unit/**`, scoped to the pure-logic modules in `utils/`. Coverage thresholds are enforced (`vitest.config.ts`): 60% lines/functions/statements, 50% branches, measured over `utils/**` only. Pointing coverage at the whole tree would report ~2% and make the number meaningless.

Current: **78% lines, 88% branches, 75% functions.**

Components are not unit-tested. They do I/O directly and would each need a DOM plus a Firebase mock; the e2e suite covers them more cheaply and more honestly. If a component gets extracted into a pure helper, test the helper.

## E2E tests

`e2e/**`, nine suites matching the nine risk areas:

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

### The auth bypass

The app is gated behind Google sign-in, which Playwright cannot complete in CI. `components/AuthWrapper.tsx` therefore honours a build-time bypass, double-gated so it cannot exist in production:

1. `import.meta.env.MODE !== 'production'` — `npm run build` uses production mode, so Vite tree-shakes the branch out entirely.
2. `VITE_E2E_AUTH_BYPASS === 'true'` — set only by `npm run build:e2e` and the Playwright web server.

Both are build-time constants, so this is not a runtime flag anyone can flip. Verify it yourself:

```bash
npm run build && grep -r VITE_E2E_AUTH_BYPASS dist/   # no matches
```

Playwright builds with the bypass and serves the **built** bundle rather than the dev server, so the suite exercises the real production output — which is what catches base-path and bundling breakage before it reaches GitHub Pages.

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
