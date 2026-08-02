# Integration review — 2026-08-02

Findings from standing up the ApexYard integration. This is the baseline the automated reviewer will work from; everything under "Fixed" is already in this branch, everything under "Open" is reported and left for you to schedule.

## Summary

| | Count |
|---|---:|
| Findings raised | 17 |
| **Fixed in this branch** | **9** |
| Open — recommended next | 8 |
| Live runtime crashes found | 1 |
| Pre-existing TypeScript errors found | 2 |

The two TypeScript errors mattered more than their count suggests: `npm run typecheck` had never been wired into anything, so `tsc` failures could not fail a build. One of them was hiding a real crash.

## Severity

| Severity | Fixed | Open | Total |
|---|---:|---:|---:|
| Critical | 0 | 0 | 0 |
| High | 2 | 3 | 5 |
| Medium | 5 | 4 | 9 |
| Low | 2 | 1 | 3 |

## By category

| Category | Critical | High | Medium | Low |
|---|---:|---:|---:|---:|
| Security | 0 | 1 | 1 | 0 |
| Correctness | 0 | 1 | 1 | 1 |
| Performance | 0 | 2 | 1 | 0 |
| Accessibility | 0 | 1 | 2 | 0 |
| Architecture | 0 | 0 | 2 | 0 |
| Dependency risk | 0 | 0 | 1 | 0 |
| Technical debt | 0 | 0 | 1 | 2 |

---

## Fixed in this branch

### 1. HIGH · Correctness — "AI Analysis" in Compare Files crashed on every click

`components/CompareTool.tsx:146` called `aiService.generateContent(...)`. That method exists on neither `IAiService` (`types/ai.types.ts`) nor `GeminiService`. Clicking the button threw `TypeError: aiService.generateContent is not a function`, which the surrounding `catch` swallowed into a log line — so the feature looked like it was failing for API reasons rather than being wired to nothing.

**Fix:** switched to `processGeneralFile({ text }, instruction)`, the provider-agnostic text-in/text-out entry point that is actually implemented, and split the prompt into data and instruction to match its signature.

### 2. HIGH · Security — `.gitignore` did not cover `.env.local`

The old pattern was `.env`. `README.md:18` instructs you to put `GEMINI_API_KEY` in `.env.local`, which that pattern does not match. One `git add -A` after a `npm run dev` and a live key is in the public history.

**Fix:** `.env.*` with a `!.env.example` carve-out. Added `.env.example` documenting which values are genuinely secret and which (the OAuth client ID) are public by design.

### 3. MEDIUM · Correctness — TypeScript error in `MergeTool.tsx`

`mergedData` is `any[][] | { sheets: … }`; line 594 read `.length` off the union. The export path at line ~236 already narrows with `Array.isArray` — the render path did not.

**Fix:** narrowed the same way, rather than trusting the `outputMode` flag to imply the shape.

### 4. MEDIUM · Accessibility — OCR preview images had no `alt`

`components/OcrTab.tsx:612`. **Fix:** `alt={`Preview of ${f.file.name}`}`.

### 5. MEDIUM · Accessibility — QR size and error-level controls had no label association

`<label>` without `htmlFor`, so axe reported `label` and `select-name` as **critical**. **Fix:** added `htmlFor`/`id` pairs.

### 6. MEDIUM · Accessibility — QR copy button had no accessible name

Icon-only `<button>`. Invisible to a screen reader. **Fix:** `aria-label` + `title`, and `aria-hidden` on the decorative icon.

### 7. MEDIUM · Dependency risk — `puppeteer` was a production dependency

Only the root `test-puppeteer*.js` scratch scripts use it, but as a `dependency` it pulled a ~170 MB Chromium download into every production install. **Fix:** moved to `devDependencies`.

### 8. LOW · Correctness — event object read across an `await`

`components/CompareTool.tsx` set `e.target.value = ''` after awaiting a file parse. **Fix:** capture the element before the await.

### 9. LOW · Technical debt — unnecessary regex escapes in `MergeTool.tsx:184`

`/[\[\]\*\\\/\?]/g`. Inside a character class only `]` and `\` need escaping. **Fix:** simplified to `/[[\]*\\/?]/g`, verified equivalent.

---

## Open — recommended next

### A. HIGH · Performance — one 3.76 MB JavaScript chunk

`dist/assets/index-*.js` is 3,761 KB (1,267 KB gzipped) and everything is in it: `xlsx`, `pdf-lib`, `jspdf`, `jszip`, `html2canvas`, `qrcode`, Firebase, and all ~30 tool components. A first-time visitor downloads and parses every tool to open one.

**Suggested fix.** `React.lazy` each tab in `App.tsx` and split the heavy libraries out:

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        xlsx:  ['xlsx', 'xlsx-js-style'],
        pdf:   ['pdf-lib', 'jspdf', 'jspdf-autotable'],
        media: ['jszip', 'qrcode'],
        firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
      },
    },
  },
},
```

Biggest single win available, and it is mostly mechanical.

### B. HIGH · Accessibility / responsive — the app is not usable on a phone

The sidebar is a fixed `w-64` (256 px) with no responsive collapse, so at 375 px it consumes 68% of the screen and pushes 22 header controls off the right edge. The page does not scroll sideways, so those controls are simply unreachable.

Pinned by the `KNOWN_MOBILE_OVERFLOW_BUDGET` ratchet in `e2e/responsive.spec.ts` — it cannot get worse without failing CI.

**Suggested fix.** Make the sidebar an off-canvas drawer below `md`: `className="... w-64 max-md:fixed max-md:z-40 max-md:-translate-x-full ..."` with a hamburger toggle in `AppHeader`. Then lower the budget to 0.

### C. HIGH · Security — the Gemini key ships in the browser bundle

Architectural, not a bug: `VITE_GEMINI_API_KEY` is inlined at build time and readable by anyone who opens devtools on the public Pages site.

**Suggested mitigations,** cheapest first: set an HTTP-referrer restriction and a hard quota cap on the key in Google Cloud; keep the existing "bring your own key" modal as the primary path so most traffic uses the visitor's key, not yours; longer term, put a small proxy (Cloudflare Worker / Vercel function) in front and hold the key server-side.

### D. MEDIUM · Accessibility — the API-key modal is a keyboard trap

`components/ApiKeyModal.tsx` renders a `fixed inset-0` overlay with no `role="dialog"`, no `aria-modal`, no Escape handler, no backdrop dismissal, and no focus trap or restore. It auto-opens on first load, so it is the first thing a keyboard user meets. This is also why the e2e fixtures have to seed `localStorage` to get past it.

**Suggested fix.** Add `role="dialog" aria-modal="true"`, an Escape key handler, focus-on-open and focus-restore-on-close, and a labelled close button.

### E. MEDIUM · Architecture — two live Variable Balance implementations

`VariableBalanceTab.tsx` (78 KB) and `VariableBalanceTabV2.tsx` (36 KB) both exist. Only one is routed today (a regression test pins that), but the unrouted one still receives edits, so fixes land in the wrong file.

**Suggested fix.** Land the V2 migration or delete it. Either is fine; leaving both is not.

### F. MEDIUM · Performance — Tailwind loaded from a CDN `<script>`

`index.html:19` loads `cdn.tailwindcss.com`, which compiles CSS in the browser on every page load and is explicitly not for production. It also blocks a strict CSP and breaks styling entirely when the CDN is unreachable.

**Suggested fix.** Move Tailwind into the build (`npm i -D tailwindcss postcss autoprefixer`, move the inline `tailwind.config` into `tailwind.config.js`).

### G. MEDIUM · Technical debt — 617 lint warnings

Mostly `no-explicit-any` (~500) and `react-hooks/exhaustive-deps`. Currently warnings by design so the gate is about correctness. The `exhaustive-deps` ones are the interesting subset — each is a potential stale-closure bug.

**Suggested fix.** Triage `exhaustive-deps` first; `npm run lint:fix` clears ~36 mechanical ones in a dedicated cleanup PR.

### H. LOW · Technical debt — ~20 scratch scripts at the repo root

`test-site*.js`, `test-puppeteer*.js`, `test-jina*.js`, `output.txt`, `replace_export.cjs`, `check_hidden.cjs`. Excluded from lint; still noise in every directory listing and every diff review.

**Suggested fix.** Delete, or move to `scripts/scratch/`. Git history keeps them either way.

---

## What the automated reviewer will do with this

Every finding class above maps to a handbook in the ops fork, so the reviewer catches the same category on future PRs without anyone re-explaining it:

| Finding | Handbook |
|---|---|
| A, F | `language/typescript/frontend-performance.md` |
| B, D, and 4–6 | `language/typescript/accessibility.md` |
| C, and 2 | `architecture/security-baseline.md` (blocking) |
| E | `architecture/frontend-boundaries.md` (blocking) |
| G, H, and 9 | `general/technical-debt.md` |
| 7 | `general/dependency-risk.md` |
| 1, 3, 8 | `language/typescript/type-safety.md`, `react-correctness.md` |

## Glossary

| Term | Definition |
|------|------------|
| **Ratchet** | A test that records current debt and fails only if it grows. |
| **Blocking handbook** | One marked `ENFORCEMENT: blocking`; violations set the verdict to request-changes. |
| **Tree-shaking** | Dead-code elimination at build time — what removes the e2e auth bypass from the production bundle. |
