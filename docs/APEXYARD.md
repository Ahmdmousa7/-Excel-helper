# ApexYard integration

This repo is reviewed by [ApexYard](https://github.com/me2resh/apexyard) before every push, running headlessly on the maintainer's machine. **It does not run in CI**, and no Anthropic credential exists in any GitHub-hosted context — see [Why the AI review is local-only](#why-the-ai-review-is-local-only) and [ADR-0001](adr/ADR-0001-ai-review-runs-locally-not-in-ci.md).

## How it fits together

There are two repos:

| Repo | Role |
|---|---|
| `Ahmdmousa7/-Excel-helper` (this one) | The project under review. Carries the CI workflow and the local review scripts. |
| `Ahmdmousa7/apexyard` | The **ops fork** — a fork of `me2resh/apexyard` that carries the handbooks, the review runner, and the registry. |

```
LOCAL, before every push          npm run verify:local
   │
   └─▶ review   ┌──────────────────────────────────────┐
                │ reads Ahmdmousa7/apexyard beside this│
                │ discovers the handbooks for the      │
                │   changed files                      │
                │ runs Rex headlessly over the diff    │
                │   via the logged-in Claude CLI       │
                │ exits 1 on High or Critical          │
                └──────────────────────────────────────┘
        then    typecheck · lint · vitest+coverage · playwright
                audit · secret scan · build · bundle budget

REMOTE, on push and pull_request  (runs no model, holds no key)
   │
   ├─▶ quality  lint · type-check · unit+coverage · build · bundle budget
   └─▶ e2e      Playwright
        │
        └─▶ CI  aggregates both into one required check

   (no AI-review job exists — see below)

   then, only after CI passes on main:
       deploy ─▶ Pages ─▶ poll the CDN ─▶ verify the live site
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

The gate is `--fail-on high`. Change it for a single local run with `npm run review:local -- --fail-on medium`, or persistently via the `APEXYARD_FAIL_ON` environment variable.

## Reports

Every run writes to `.apexyard/review/` in the working tree (gitignored):

| File | What |
|---|---|
| `review.md` | The full report — verdict, severity table, every finding with a suggested fix. |
| `summary.md` | The short version: verdict, counts, one line per finding. |
| `findings.csv` | Structured, for tracking counts across runs. |
| `review.json` | The raw structured result the severity gate reads. |
| `pr-comment.md` | A PR-comment-shaped rendering. Nothing posts it automatically now that the review is local — paste it if you want the review in the PR thread. |
| `prompt.md` | Exactly what was sent to the model (with `--dry-run`). This is how you debug a bad review. |

There is no CI artifact and no automatic PR comment: the review does not run in CI. See [Why the AI review is local-only](#why-the-ai-review-is-local-only).

## The CI gates

| Gate | Job | Blocks merge |
|---|---|:---:|
| ESLint **errors** | quality | Yes |
| ESLint warnings | quality | No — see [`eslint.config.js`](../eslint.config.js) for the split |
| TypeScript | quality | **Yes** |
| Unit tests + coverage thresholds | quality | Yes |
| Build | quality | Yes |
| Playwright | e2e | **Yes** |
| Bundle budget | quality | **Yes** |
| ApexYard High/Critical | **local, pre-push — no CI job** | No. Not enforced anywhere — see below |

**Branch protection is not enabled on `main` today** — verified via the API, not assumed. Everything above reports; nothing blocks. Enabling it means requiring **two** checks: the aggregate `CI` (which fronts the `quality` and `e2e` jobs, so those two need not be listed individually) **and** `Security`, which is a separate workflow carrying the dependency audit, the verified-secret scan, and the committed-env-file check. Requiring `CI` alone would leave every security gate advisory while looking protected.

## Why the AI review is local-only

**No Anthropic API key exists in GitHub Secrets, in any workflow, in any image, or in any committed file — and none should ever be added.**

An API key in GitHub Actions is a live, billable credential sitting inside a system that executes code from every pull request. Any workflow change that lands can read it. The blast radius of a leak is not one repository; it is the account. Against that, what CI buys by holding the key is the ability to *prove* a review ran — valuable on a team with many contributors and mutual distrust, much less so on a single-maintainer project where the same person writes the code and runs the review either way.

So the trade here is deliberate: the credential stays on one machine, and CI gives up the ability to enforce that the review happened.

**Be clear about what that costs.** CI cannot watch the review happen. What it *can* do is check the trail the review leaves — see [Review attestation](#review-attestation) below. The line worth holding onto: CI verifies that **a review covering this exact code was recorded**, not that **a model was invoked**. The second is not provable by the machine that would fake it.

What holds the line instead is the pre-push habit, made cheap enough to keep:

```bash
npm run verify:local
```

That runs the AI review **first** — because fixing its findings changes what every later gate sees — then TypeScript, ESLint, Vitest, Playwright, the dependency audit, the secret scan, the build, and the bundle budget. Every stage runs even when an earlier one fails, so one pass shows the whole picture.

Tracked honestly as **TD-027** in the [debt register](quality/tech-debt-register.md).

## Review attestation

The review writes `.apexyard/attestation` — a small committed text file recording, for every file it looked at, that file's **git blob hash**:

```
apexyard-review-attestation v1
digest sha256:83f9f57cef…
--
scope origin/main...HEAD
head d5d0f449977c…
model claude-opus-5
gate high
verdict APPROVED
findings critical=0 high=0 medium=1 low=4 info=0
files 13
cc8134c8c23ff7a0d8a8b00765c3f6aa71156ca3 .gitattributes
deleted .github/PR_BODY.md
…
```

The `Review attestation` CI job — which holds no credentials, calls no network, and runs no model — checks five things:

| Check | Catches |
|---|---|
| Digest matches the body | Any hand edit. Flipping `gate high` to `gate none` breaks it. |
| Every recorded hash still resolves at this commit | A reviewed file edited afterwards. **This is the load-bearing check.** |
| Every changed file appears in the attestation | A file added after the review and never looked at. |
| Zero findings at or above `high`, **and** the run's own gate was at least that strict | A review laundered through `--fail-on none` or `--fail-on critical`. |
| Signature valid — only when a key is registered | A manifest produced by an unregistered key. Currently unused; see TD-028. |

**Why blob hashes and not the commit SHA.** A squash merge rewrites every SHA while changing no content. Binding to the commit would make the attestation go stale at merge time on *every* PR, and a gate that fails routinely gets bypassed. Content hashes expire on exactly the right event — a byte of reviewed code changing — and survive rebase, amend, and squash. Both behaviours are pinned by tests.

**There is no timestamp**, deliberately. A timestamp would make the digest differ on every run over identical content, which destroys the only property that makes this checkable. Freshness comes from the hashes.

**What it does not contain:** no prompt text, no finding descriptions, no code excerpts, no credentials. Paths and content hashes are already public in a public repo; a severity count is not a disclosure. The full report stays in the gitignored `.apexyard/review/`.

Full reasoning, including the six alternatives rejected: [ADR-0002](adr/ADR-0002-review-attestation.md).

```bash
npm run test:attestation    # 22 end-to-end cases against real git repos
```

## Running the review on its own

```bash
git clone https://github.com/Ahmdmousa7/apexyard.git ../apexyard
npm run review:local                    # uncommitted work
npm run review:local -- --base main     # everything since main
npm run review:local -- --staged        # only what is staged
```

It authenticates through your logged-in Claude CLI. **Do not set `ANTHROPIC_API_KEY`** — `claude login` is enough, and it keeps the credential out of your shell history and environment.

Requires `jq` (`winget install jqlang.jq`) and the ops fork beside this repo, or `APEXYARD_OPS_ROOT` pointing at it.

To see the composed prompt without spending a call, invoke the underlying runner directly — `review:local` does not forward `--dry-run`:

```bash
../apexyard/bin/apexyard-review-ci.sh \
  --base origin/main --head HEAD --project-root . --dry-run \
  --out .apexyard/review && cat .apexyard/review/prompt.md
```

Exit codes matter here: `0` clean, `1` findings at or above the gate, **`3` the reviewer could not run**. Three is deliberately distinct so a crashed reviewer is never mistaken for a clean one.

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
