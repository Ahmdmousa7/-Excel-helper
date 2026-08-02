# Engineering Quality Scorecard

**Baseline: 2026-08-02.** Re-measure after each phase; keep the history table at the bottom.

Scores are evidence-based — every one traces to a command in "How each score is measured".

## Overall

| | Current | Target | Gap |
|---|:---:|:---:|:---:|
| **Production readiness** | **5.4** | **9.5** | **4.1** |

Weighted by blast radius: Security ×2, Build ×1.5, Architecture ×1.5, everything else ×1.

## By subsystem

| Subsystem | Current | Target | Gap | Effort | Priority | Hours | Expected impact |
|---|:---:|:---:|:---:|:---:|:---:|---:|---|
| Dependency governance | 3 | 9 | 6 | M | **P0** | 12 | Closes 11 critical/high CVEs; blocks the next one from landing silently |
| Build pipeline | 3 | 9 | 6 | M | **P0** | 16 | 3.76 MB → <800 KB initial; first paint on 3G goes from ~20s to ~4s |
| Security | 4 | 9 | 5 | L | **P0** | 24 | Removes the one shipping RCE-adjacent CVE; adds CSP, secret scanning |
| Architecture | 4 | 8 | 4 | XL | P2 | 60 | Makes 1,383-line components reviewable; kills the duplicate-fix class of bug |
| Vitest | 5 | 8 | 3 | L | P1 | 24 | Coverage over logic that currently only e2e touches; faster feedback |
| ESLint | 6 | 9 | 3 | M | P1 | 14 | 27 `exhaustive-deps` are live stale-closure bugs; 70 a11y warnings are real defects |
| TypeScript | 6 | 9 | 3 | L | P2 | 20 | 290 `any` are unchecked runtime assumptions in a file-parsing app |
| Reports | 6 | 9 | 3 | S | P1 | 8 | Trend visibility; makes regressions arguable with data |
| ApexYard integration | 7 | 9 | 2 | M | P1 | 12 | Determinism, retry, annotations — turns a good gate into a trusted one |
| GitHub Actions | 7 | 9 | 2 | M | **P0** | 16 | Adds 12 missing gates; caches browsers (~3 min/run) |
| Playwright | 7 | 9 | 2 | M | P1 | 20 | Page objects, offline/large-file/tablet/visual, cross-browser nightly |
| Documentation | 7 | 9 | 2 | S | P2 | 8 | CONTRIBUTING, ARCHITECTURE, CHANGELOG, troubleshooting |

**Effort key:** S ≤ 8h · M 8–20h · L 20–40h · XL > 40h. Hours are one engineer, including review and rollout.

**Total to target: ~234 hours (~6 engineer-weeks).** P0 alone is ~68 hours and moves overall readiness from 5.4 to roughly 7.6 — the steepest part of the curve.

## Why these targets, not 10

A 10 would mean zero `any`, zero lint warnings, and full component test coverage on a 21.6k-LOC app built by one person. That is not a good use of the next six weeks. 9 means: no known-exploitable dependency, an enforced performance budget, no unreviewed merge, and every regression class covered by a gate. Past that, the marginal hour is better spent on product.

## How each score is measured

| Subsystem | Command | Scoring |
|---|---|---|
| Dependency governance | `npm audit --json` | 10 − (critical×2 + high) capped at 0; ×0.5 for no audit gate |
| Build pipeline | `npm run build` | Initial chunk: <500 KB=10, <1 MB=8, <2 MB=5, ≥3 MB=3 |
| Security | audit + CSP presence + secret scanning + shipped-secret review | Rubric in `docs/quality/security-review.md` |
| Architecture | `wc -l` per component; circular-dep scan | >1000 LOC files, unenforced layering, duplicate impls |
| Vitest | `npm run test:coverage` | Coverage × breadth of what is in scope |
| ESLint | `npx eslint . -f json` | Errors ×3 + warnings-that-are-defects |
| TypeScript | `grep -c ': any'` + strict flags enabled | |
| Playwright | suite count × risk-area coverage × browser matrix | |

## History

| Date | Overall | Notes |
|---|:---:|---|
| 2026-08-02 | 5.4 | Baseline. Gates installed and working; what they gate is not yet healthy. |
