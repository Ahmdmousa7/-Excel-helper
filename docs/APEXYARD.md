# ApexYard integration

This repo is reviewed on every pull request by [ApexYard](https://github.com/me2resh/apexyard), running headlessly from CI.

## How it fits together

There are two repos:

| Repo | Role |
|---|---|
| `Ahmdmousa7/-Excel-helper` (this one) | The project under review. Carries the CI workflow. |
| `Ahmdmousa7/apexyard` | The **ops fork** — a fork of `me2resh/apexyard` that carries the handbooks, the review runner, and the registry. |

```
pull_request
   │
   ├─▶ quality   lint · type-check · unit tests · build
   ├─▶ e2e       Playwright (9 suites)
   └─▶ review    ┌────────────────────────────────────┐
                 │ checks out Ahmdmousa7/apexyard     │
                 │ discovers the handbooks for the    │
                 │   changed files                    │
                 │ runs Rex headlessly over the diff  │
                 │ posts a sticky PR comment          │
                 │ exits 1 on High or Critical        │
                 └────────────────────────────────────┘
```

### One thing worth understanding up front

ApexYard's code review is **not a linter**. It is a Claude Code sub-agent ("Rex") that reads your diff against a set of markdown standards. Upstream, it only runs interactively — a human types `/code-review <pr>` in a Claude Code session.

That could not be called from GitHub Actions, so the ops fork adds a bridge (`bin/apexyard-review-ci.sh`) that composes the same inputs into a headless `claude -p` call and emits machine-readable findings. See [`docs/ci-code-review.md`](https://github.com/Ahmdmousa7/apexyard/blob/main/docs/ci-code-review.md) in the ops fork.

The bridge deliberately does **not** write ApexYard's `*-rex.approved` merge-gate marker. A CI job is not a reviewer; writing that marker would let a pipeline approve its own PR.

## What gets reviewed

**Changed files only.** The reviewer never comments on code your PR did not touch.

Nine handbooks in the ops fork define the standards, loaded by path convention:

| Handbook | Loads | Enforcement |
|---|---|---|
| `architecture/security-baseline.md` | always | **blocking** |
| `architecture/frontend-boundaries.md` | always | **blocking** |
| `general/code-smells.md` | always | advisory |
| `general/technical-debt.md` | always | advisory |
| `general/dependency-risk.md` | always | advisory |
| `language/typescript/type-safety.md` | on `.ts`/`.tsx` | advisory |
| `language/typescript/react-correctness.md` | on `.ts`/`.tsx` | advisory |
| `language/typescript/frontend-performance.md` | on `.ts`/`.tsx` | advisory |
| `language/typescript/accessibility.md` | on `.ts`/`.tsx` | advisory |

**To change what the reviewer flags, edit a handbook — not the workflow.** Each one has a "What's NOT a violation" section that is as load-bearing as the rule itself: it is what stops the reviewer over-reporting until people tune it out.

## Severity and the CI gate

| Severity | Meaning | Blocks merge? |
|---|---|:---:|
| **Critical** | Exploitable now, or destroys/leaks user data | **Yes** |
| **High** | A defect users will hit, or a blocking-handbook violation | **Yes** |
| Medium | A real problem with a workaround or narrow trigger | No |
| Low | Worth fixing, no user impact | No |
| Info | An observation | No |

The gate is `--fail-on high`. Change it for a one-off run via **Actions → CI → Run workflow → ApexYard severity gate**.

## Reports

Every run produces:

| Where | What |
|---|---|
| **PR comment** | Sticky (updates in place, one per PR): verdict, gate result, severity table, collapsible findings with suggested fixes. |
| **Job summary** | The same tables on the Actions run page. |
| **Artifacts** (`apexyard-review`, 30 days) | `review.md` (full report), `review.json` (structured), `findings.csv` (trend tracking), `prompt.md` (exactly what was sent — this is how you debug a bad review). |

## The CI gates

| Gate | Job | Blocks merge |
|---|---|:---:|
| ESLint **errors** | quality | Yes |
| ESLint warnings | quality | No — see [`eslint.config.js`](../eslint.config.js) for the split |
| TypeScript | quality | **Yes** |
| Unit tests + coverage thresholds | quality | Yes |
| Build | quality | Yes |
| Playwright | e2e | **Yes** |
| ApexYard High/Critical | review | **Yes** |

Branch protection should require the single aggregate check named **`CI`**, not the three jobs individually.

## Setup

One secret is required:

**Settings → Secrets and variables → Actions → New repository secret**
- Name: `ANTHROPIC_API_KEY`
- Value: a key from [console.anthropic.com](https://console.anthropic.com)

Without it the review job **skips with a warning** rather than failing — that is also what happens on a pull request opened from a fork, since GitHub withholds secrets from fork PRs by design.

## Running the review locally

```bash
git clone https://github.com/Ahmdmousa7/apexyard.git ../apexyard
export ANTHROPIC_API_KEY=sk-ant-...

../apexyard/bin/apexyard-review-ci.sh \
  --base origin/main --head HEAD \
  --project-root . --fail-on high --out .apexyard/review

cat .apexyard/review/review.md
```

Add `--dry-run` to see the composed prompt without spending a call.

## Tests

| Suite | Command | Count |
|---|---|---|
| Unit (Vitest) | `npm run test` | 32 |
| E2E (Playwright) | `npm run e2e` | 59 across 9 suites |
| Everything CI runs | `npm run verify` | — |

The e2e suite covers smoke, happy path, accessibility, keyboard navigation, responsive layout, clipboard, download, error handling, and regression. See [`docs/TESTING.md`](TESTING.md).

## Keeping the ops fork current

`Ahmdmousa7/apexyard` tracks `me2resh/apexyard`. A scheduled workflow opens a sync PR every Monday; run it on demand from **Actions → Sync with upstream apexyard**. It opens a PR rather than pushing, because an upstream release can change how your PRs get reviewed and you should read that diff first.

## Glossary

| Term | Definition |
|------|------------|
| **Ops fork** | `Ahmdmousa7/apexyard` — the ApexYard fork holding the handbooks and the review runner. |
| **Handbook** | A markdown file defining a coding standard the reviewer applies. Advisory by default; `ENFORCEMENT: blocking` makes violations block. |
| **Rex** | ApexYard's code-reviewer agent persona. |
| **Sticky comment** | A PR comment carrying a marker so subsequent runs update it in place instead of adding a new one. |
| **Ratchet** | A test that records current debt and fails only if it grows — used for accessibility and mobile-overflow debt here. |
