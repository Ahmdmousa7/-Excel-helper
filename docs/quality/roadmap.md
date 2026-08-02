# Quality Roadmap

Derived from [`scorecard.md`](scorecard.md) and [`tech-debt-register.md`](tech-debt-register.md). Regenerate after each phase.

## Quick wins — under 2 hours each, do them first

| Item | TD | Hours | Why now |
|---|---|---:|---|
| Remove `stream-browserify` | TD-016 | 0.25 | Declared, never imported |
| Delete root scratch scripts | TD-015 | 0.5 | Noise in every diff review |
| `npm run lint:fix` (214 unused vars) | TD-014 | 1 | Mechanical; makes the remaining warnings readable |
| Referrer restriction + quota cap on the Gemini key | TD-003 | 1 | Console-only. Turns "billing drain" into "403" |
| Cache Playwright browsers in CI | — | 0.5 | ~3 min off every run |
| Dependency-audit gate | TD-002 | 2 | Stops the *next* critical CVE landing silently |

**~5.5 hours for the single largest risk reduction available.** None of it touches app logic.

## High ROI — best value per hour

| Item | TD | Hours | Return |
|---|---|---:|---|
| Code splitting + bundle budget | TD-004 | 12 | 3.76 MB → <800 KB. Biggest user-visible win in the project |
| `xlsx` → patched fork | TD-001 | 8 | Closes the only shipping exploitable CVE |
| Tailwind into the build, then CSP | TD-006/007 | 8 | Removes a CDN dependency and unlocks defence-in-depth |
| Mobile drawer | TD-005 | 12 | Makes the app usable on a phone at all |
| Playwright page objects | TD-017 | 8 | Every later test gets cheaper to write |

## 30 days — stop the bleeding

**Goal: no known-exploitable dependency, an enforced performance budget, readiness ≥ 7.5.**

| Week | Work | Exit criterion |
|---|---|---|
| 1 | All quick wins · audit gate · secret scanning · `xlsx` migration | `npm audit --production` clean at high+; secret scan in CI |
| 2 | Tailwind into build · CSP meta · code splitting · bundle budget | Initial chunk <1 MB and gated |
| 3 | Playwright page objects · offline, large-file, invalid-file, tablet suites | Suite count up, zero duplicated setup |
| 4 | ApexYard hardening (retry, annotations, schema validation, determinism) | Two runs on the same SHA agree on every Critical/High |

**Not in scope:** component refactors, the `any` cleanup, visual regression. All real, none of them urgent.

## 60 days — make it maintainable

**Goal: readiness ≥ 8.5.**

- Mobile drawer; drop `KNOWN_MOBILE_OVERFLOW_BUDGET` to 0 (TD-005)
- Modal dialog semantics; drop two entries from `KNOWN_A11Y_DEBT` (TD-008)
- The 70 label associations, ~10 files per PR (TD-009)
- Triage all 27 `exhaustive-deps` (TD-013)
- Boundary validation for the four untrusted inputs: file parse, `JSON.parse`, `localStorage`, model output (TD-012, partial)
- Devtool major bumps: `vite` 5→8, `vitest` 2→4 (TD-020)
- Nightly cross-browser + visual regression (TD-017)
- Engineering dashboard published from `findings.csv` trend data
- CONTRIBUTING, ARCHITECTURE, CHANGELOG

## 90 days — long-term investment

**Goal: readiness ≥ 9.5.**

- Split the three >1,000-LOC components; extract logic into testable `utils/` (TD-011)
- Component unit tests on the extracted logic; raise the coverage floor (TD-018)
- Resolve the `VariableBalanceTab` V1/V2 duplication (TD-010)
- Architecture gate: circular-dependency and layer-boundary checks in CI
- Serverless proxy for the Gemini key; remove it from the bundle (TD-003)
- Lighthouse CI with Core Web Vitals budgets
- Revisit TD-019 — if the app moves off Pages, add real security headers

## Sequencing constraints

Not everything can be parallelised:

```
TD-007 (Tailwind → build)  ──▶  TD-006 (CSP)
TD-002 (audit gate)        ──▶  TD-020 (devtool bumps)   [gate first, so the bump is measurable]
TD-017 (page objects)      ──▶  visual regression, cross-browser
TD-011 (split components)  ──▶  TD-018 (component tests)
TD-001 decision            ──▶  TD-001 implementation     [awaiting approval]
```

Doing CSP before Tailwind means writing a policy with `unsafe-eval` in it and then rewriting it. Doing component tests before the split means testing code that is about to move.

## What "done" means

Readiness ≥ 9.5 requires all of:

- `npm audit --production`: zero high or critical
- Initial JS chunk under 800 KB, enforced in CI
- Every mobile-overflow and accessibility ratchet at zero
- No component over 800 LOC without a documented exception
- Coverage floor ≥ 70% over `utils/` **and** `services/`
- Cross-browser and visual regression green on the nightly
- Zero open Critical or High entries in the debt register
