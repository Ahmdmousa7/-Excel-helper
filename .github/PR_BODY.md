## Summary

- **Every PR now gets an automated code review that can actually block a merge.** ApexYard's review is a Claude Code sub-agent that only ran interactively, so it could never gate CI. The ops fork (`Ahmdmousa7/apexyard`) now carries a headless bridge; this PR wires it in with a hard gate on High and Critical findings, reviewing changed files only.
- **Fixed a live crash.** `CompareTool`'s "AI Analysis" button called `aiService.generateContent()`, which exists on neither `IAiService` nor `GeminiService` — every click threw, and the surrounding `catch` swallowed it into a log line so it read as an API problem. Switched to `processGeneralFile()`, which is actually implemented.
- **Closed a secret-leak path.** `.gitignore` covered `.env` but not `.env.local`, which is exactly where `README.md` tells you to put `GEMINI_API_KEY`. One `git add -A` after a dev run and a live key was in the public history.
- **Wired `tsc` into CI for the first time and fixed the 2 errors it had been hiding**, one of which was the crash above. `npm run typecheck` had never gated anything.
- **91 new tests** — 32 Vitest (78% lines over `utils/**`) and 59 Playwright across nine suites: smoke, happy path, accessibility, keyboard, responsive, clipboard, download, error handling, regression.
- **Fixed four accessibility defects** found by axe-core in the new suite, two of which it rates Critical: unlabelled QR controls, an icon-only copy button with no accessible name, and OCR previews with no `alt`.

## Testing

```bash
npm ci
npm run verify   # lint → typecheck → unit → build
npm run e2e      # 59 Playwright tests
```

All green locally. The e2e suite builds with `VITE_E2E_AUTH_BYPASS` and serves the **built** bundle, not the dev server — which is what catches base-path and bundling breakage before it reaches Pages.

**Before merging:** add `ANTHROPIC_API_KEY` under Settings → Secrets and variables → Actions, or the review job will skip with a warning.

## Notes for the reviewer

**The auth bypass cannot reach production.** The app is gated behind Google sign-in, which Playwright cannot complete in CI, so `AuthWrapper` honours a build-time flag. It is double-gated: `import.meta.env.MODE !== 'production'` means Vite statically eliminates the branch from `npm run build`, and `VITE_E2E_AUTH_BYPASS` is set only by `npm run build:e2e`. Both are build-time constants, not runtime flags. Verify it yourself — `npm run build && grep -r VITE_E2E_AUTH_BYPASS dist/` returns nothing.

**Two suites are ratchets, not audits.** Accessibility and mobile-overflow record existing debt and fail only if it grows. Failing on all pre-existing violations would produce a permanently red check that everyone learns to bypass, which is worse than no check. The a11y suite has a meta-test that fails if its allow-list grows, so padding it to go green forces a conversation.

**ESLint errors block; warnings do not.** Turning the recommended presets on wholesale produced 44 errors and 617 warnings on existing code. Correctness rules (hooks, unhandled promises, keyboard accessibility) are errors; stylistic ones are warnings, with `npm run lint:fix` left for a dedicated cleanup PR rather than mixing a codebase-wide reformat into this one.

**8 findings are reported but not fixed** — see [`docs/reports/integration-review-2026-08-02.md`](docs/reports/integration-review-2026-08-02.md). The two worth scheduling first: the single 3.76 MB JS chunk (the report includes the `manualChunks` config), and the fixed-width sidebar that makes the app unusable below ~768px.

## Glossary

| Term | Definition |
|------|------------|
| **Ops fork** | `Ahmdmousa7/apexyard` — the ApexYard fork holding the review standards and the CI runner. Separate repo so the standards can change without touching this one. |
| **Handbook** | A markdown file defining one coding standard the reviewer applies. Advisory by default; `ENFORCEMENT: blocking` makes violations block a merge. |
| **Rex** | ApexYard's code-reviewer agent persona. |
| **Ratchet** | A gate that records current debt and fails only when it grows, rather than demanding it all be paid at once. |
| **Tree-shaking** | Build-time dead-code elimination. What removes the e2e auth bypass from the production bundle. |
| **Sticky comment** | A PR comment carrying a hidden marker so later runs update it in place instead of adding a new one. |
