# Technical Debt Register

Living document. Every item keeps its ID for life — closed items move to the bottom, they are never deleted, so a recurrence can be traced to its original entry.

**Severity:** Critical (exploitable / data loss now) · High (users hit it, or it blocks other work) · Medium (real, has a workaround) · Low (cost without user impact).

**Status:** `open` · `in-progress` · `blocked` · `accepted` (deliberate, with a stated reason) · `closed`.

## Open

| ID | Description | Sev | Risk | Effort | Owner | Status | Blocked by | Fix recommendation |
|---|---|:---:|---|:---:|---|---|---|---|
| **TD-023** | The Web Scraper routes user-supplied URLs through five **public, third-party CORS proxies**: `api.allorigins.win`, `corsproxy.io`, `cors-anywhere.herokuapp.com`, `thingproxy.freeboard.io`, `r.jina.ai`. | **High** | Every scraped URL and its full response passes through infrastructure nobody here controls, logs, or has an agreement with — a silent data-egress path. `cors-anywhere.herokuapp.com` is also dead (Heroku ended free dynos), so that path fails outright. Separately, this is why `connect-src` cannot be tightened: there is no finite host list when the user supplies the target. | M | — | `open` | — | Replace with one controlled proxy (Cloudflare Worker / Vercel function) that this project owns. Then `connect-src` becomes enumerable and the CSP can be tightened in the same change. |
| **TD-022** | `xlsx-js-style@1.2.0` is built on the vulnerable SheetJS 0.18.5 base. Kept because it is **write-only** — audited every call site: `utils`/`write`/`writeFile`, zero `read`. | Low | None on the current call sites. Becomes Critical the moment anyone calls `.read()` on it. | S | — | `accepted` | No maintained styled-write alternative on npm | **Guard rail needed:** add a lint rule or CI grep banning `XLSX_STYLE.read`. Revisit if styled *reading* is ever required. |
| **TD-002** | No dependency-audit gate. 25 vulnerabilities (4 critical, 7 high) accumulated unnoticed across 854 packages. | **Critical** | The next critical CVE also lands silently | S | — | `in-progress` | — | `npm audit` job failing on high+ for production deps; weekly scheduled scan |
| **TD-003** | Gemini API key is inlined into the browser bundle by `VITE_` prefix. | **High** | Public site → key is readable in devtools → billing drain | S (mitigate) / L (fix) | — | `open` | — | Now: referrer restriction + hard quota cap. Later: proxy endpoint |
| **TD-004** | Single 3,761 KB JS chunk (1,267 KB gzip). No code splitting, no size budget. | **High** | ~20s first paint on 3G; every visitor downloads all 30 tools to use one | M | — | `open` | — | `React.lazy` per tab + `manualChunks`; enforce a budget in CI |
| **TD-005** | Sidebar is a fixed `w-64` with no mobile collapse. 22 header controls unreachable below ~700px. | **High** | The app is unusable on a phone | M | — | `open` | — | Off-canvas drawer below `md` + hamburger. Ratchet: `KNOWN_MOBILE_OVERFLOW_BUDGET` 24 → 0 |
| **TD-006** | No Content-Security-Policy. Tailwind loads from a CDN `<script>`, which also forces `unsafe-eval`. | **High** | No defence-in-depth against injected script | M | — | `in-progress` | TD-007 | Move Tailwind into the build, then add a `<meta>` CSP |
| **TD-007** | Tailwind compiled in-browser from `cdn.tailwindcss.com`. Explicitly not for production. | **Medium** | Style flash, CDN as a hard dependency, blocks CSP | S | — | `open` | — | `npm i -D tailwindcss postcss autoprefixer`; move config to `tailwind.config.js` |
| **TD-008** | API-key modal is a keyboard trap: no `role="dialog"`, no Escape, no focus trap or restore. Auto-opens on first load. | **Medium** | First thing a keyboard user meets, and they cannot leave it | S | — | `open` | — | Add dialog semantics, Escape handler, focus management |
| **TD-009** | 70 form controls with no label association (`jsx-a11y/label-has-associated-control`). | **Medium** | Screen-reader users cannot tell what a field is for | M | — | `open` | — | Mechanical `htmlFor`/`id` pass, ~10 files at a time |
| **TD-010** | `VariableBalanceTab` (1,383 LOC) and `VariableBalanceTabV2` both in tree; only one routed. | **Medium** | Fixes land in the unrouted copy | S | — | `open` | Product decision on which is correct | Land the migration or delete V2 |
| **TD-011** | Three components over 1,000 LOC (1,383 / 1,369 / 1,057). | **Medium** | Unreviewable diffs; every change is high-risk | XL | — | `open` | — | Extract logic to `utils/`, split by tab section. Add a size gate at 800 LOC for *new* files only |
| **TD-012** | 290 `any` annotations. External data (`JSON.parse`, sheet parses, model responses) typed by assertion. | **Medium** | Runtime `undefined is not a function` in a data-processing app | L | — | `open` | — | Validate at the four boundaries first; leave interior `any` alone |
| **TD-013** | 27 `react-hooks/exhaustive-deps` warnings. | **Medium** | Stale closures — the hardest class of bug to reproduce | M | — | `open` | — | Triage individually; each is either a real bug or needs a documented disable |
| **TD-014** | 214 unused variables/imports. | **Low** | Noise; hides genuinely dead code | S | — | `open` | — | `npm run lint:fix` in one dedicated PR |
| **TD-015** | ~20 scratch scripts at repo root (`test-site*.js`, `output.txt`, …). | **Low** | Noise in every listing and diff | S | — | `open` | — | Delete; git history retains them |
| **TD-016** | `stream-browserify` declared as a runtime dependency, never imported. | **Low** | Dead weight in the dependency tree | S | — | `in-progress` | — | Remove from `package.json` |
| **TD-017** | Playwright is chromium-only; no visual regression, no offline/large-file/tablet coverage. | **Medium** | Engine-specific and layout regressions ship unseen | M | — | `open` | — | Page objects first, then nightly cross-browser + visual |
| **TD-018** | Components have zero unit tests; coverage scoped to `utils/**` only. | **Medium** | Component logic is only exercised end-to-end — slow, coarse feedback | L | — | `open` | — | Extract pure logic out of components, test the extraction |
| **TD-019** | GitHub Pages cannot set HTTP headers, so no `frame-ancestors`, HSTS, or `X-Frame-Options`. | **Medium** | Clickjacking cannot be prevented at the platform level | M | — | `accepted` | Platform limitation | Accepted while on Pages. Revisit if the app moves to a host that can set headers |
| **TD-020** | Devtool CVEs: `vitest` 2→4, `vite` 5→8, `@vitest/coverage-v8` — all major bumps. | **Medium** | Build-time only, but blocks a clean audit | M | — | `open` | — | Dedicated PR per major; verify build + full suite each |

## Closed

| ID | Description | Closed | Fixed by |
|---|---|---|---|
| TD-C01 | `aiService.generateContent()` did not exist — "AI Analysis" threw on every click | 2026-08-02 | `674c769` |
| TD-C02 | `.gitignore` covered `.env` but not `.env.local`, where the README says to put the API key | 2026-08-02 | `95462c7` |
| TD-C03 | Two TypeScript errors; `tsc` had never gated anything | 2026-08-02 | `674c769` |
| TD-C04 | Four accessibility defects (unlabelled QR controls, unnamed copy button, `alt`-less previews) | 2026-08-02 | `674c769` |
| TD-C05 | `puppeteer` was a production dependency, pulling ~170 MB of Chromium into every install | 2026-08-02 | `95462c7` |
| TD-002 | No dependency-audit gate — 25 CVEs had accumulated unnoticed | 2026-08-02 | `b99fb68` |
| TD-014 | 214 unused variables and imports | 2026-08-02 | `7c9774a` |
| TD-015 | ~20 scratch scripts at the repo root | 2026-08-02 | `7c9774a` |
| TD-016 | `stream-browserify` declared but never imported (−32.7 KB gzip) | 2026-08-02 | `7c9774a` |
| TD-021 | Deploy ran on every push to main with no CI dependency — a red build could publish | 2026-08-02 | `160b856` |
| **TD-001** | `xlsx@0.18.5` prototype pollution, no npm fix, on the untrusted-parse path | 2026-08-02 | `@e965/xlsx@0.20.3` behind a Vite alias. Production audit went from 5 high/critical to **zero**. Guard rail added so `xlsx-js-style` can never become a parser (TD-022). |

## Rules for this register

1. **Nothing is closed without a commit SHA.** "Fixed in a later refactor" is not a close.
2. **`accepted` requires a written reason and a revisit trigger** (see TD-019).
3. **Every ratchet in the test suite maps to an entry here.** If the ratchet moves, the entry moves.
4. **New debt is added in the same PR that creates it.** Debt you chose is fine; debt you hid is not.
