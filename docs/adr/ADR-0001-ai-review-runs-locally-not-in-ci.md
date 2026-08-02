# ADR-0001 — The AI code review runs locally, never in CI

**Status:** Accepted
**Date:** 2026-08-02
**Deciders:** Maintainer (Ahmdmousa7)

> **On the filename:** decisions in *this* repo are recorded as `docs/adr/ADR-NNNN`. ApexYard's `docs/agdr/AgDR-NNNN` convention applies to the ops fork, which governs the portfolio; a managed project keeps its own numbering so the two sequences never collide. Both are architecture decision records; only the sequence differs.

> In the context of gating merges on an AI code review, facing the need to hold a live Anthropic API key somewhere, I decided to run the review only on the maintainer's machine and remove it from GitHub Actions entirely, to keep the credential out of a system that executes third-party code, accepting that CI can no longer prove the review happened.

## Context

ApexYard's code review is a Claude-backed agent. To gate a pull request on it, something automated has to call the model, which means an Anthropic credential has to live wherever that call is made.

The original design put it in GitHub Actions as `ANTHROPIC_API_KEY`. That worked and was never exercised — the secret was never added, so the review job skipped on every run. During that window the maintainer set an explicit policy: Anthropic credentials must never be stored in GitHub Secrets, repository or organisation secrets, workflow files, Docker images, committed env files, or any cloud environment.

This ADR records why that policy is right rather than merely followed, because the trade it makes is real and worth being able to re-examine later.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **API key in GitHub Secrets** (original) | CI can gate on findings; the review is provably run on every PR; no reliance on maintainer discipline | A live billable credential inside a system that executes code from every PR. Any merged workflow change can exfiltrate it. Secrets are withheld from fork PRs anyway, so the gate has a hole precisely where untrusted contributions arrive. Blast radius is the account, not the repo. |
| **Local review, CI verifies everything else** (chosen) | The credential exists on exactly one machine. No CI surface to attack, no rotation story, no fork-PR hole. Every gate that does not need a model still runs remotely and still blocks. | CI cannot prove the review ran. Enforcement is habit, not machinery. A second contributor would each need their own local setup. |
| **Self-hosted runner holding the key** | Gate stays in CI; key never touches GitHub's infrastructure | Moves the credential rather than removing it, and adds a machine to secure and maintain. All of the original blast radius, plus a runner. Disproportionate for a single-maintainer static site. |
| **OIDC / short-lived credentials** | No standing secret | Anthropic does not offer an OIDC trust relationship with GitHub Actions. Not available. |

## Decision

**Local review; CI verifies everything else.**

The deciding argument is the asymmetry between what each side is protecting. The API key is a *standing capability* — it works for anyone who obtains it, for as long as it exists, and it bills. The AI review is *advisory judgment* — it finds issues a human should weigh, and it has no merge-blocking marker of its own by design (see the two-marker gate in the ops fork). Trading a standing capability's exposure for the enforceability of advisory judgment is a bad trade on a single-maintainer project.

The fork-PR hole makes the original design weaker than it looked: GitHub withholds secrets from fork pull requests, so the review would have skipped on exactly the contributions least likely to have been reviewed already.

## Consequences

- No Anthropic credential exists in any GitHub-hosted context for this project.
- `npm run verify:local` runs the AI review first, then TypeScript, ESLint, Vitest, Playwright, the dependency audit, the secret scan, the build, and the bundle budget. The review runs first because fixing its findings changes what every later gate sees.
- The review scope is the **push range**, not the working tree. Reviewing the working tree would report a clean pass whenever the maintainer committed before verifying.
- **There is no CI job for the AI review at all** — not even a passing no-op. A job named after a gate that passes without checking anything is worse than its absence: on the checks page it reads as coverage. The policy statement lives in the aggregate job's step summary, where it costs no runner and claims nothing.
- **The enforcement gap is real and is tracked as TD-027**, not hidden. If this project ever gains a second regular contributor, revisit — the calculus changes when the person reviewing is not always the person writing.
- `scripts/scan-secrets.sh` includes the `sk-ant-` pattern as a hard failure, so a committed Anthropic key fails the local gate rather than the policy resting on prose alone. CI runs its own scanner (TruffleHog, verified-only) — a different tool, not this script, so the two are mirrors rather than the same check twice.

## Artifacts

- `.github/workflows/ci.yml` — the review job removed; the policy stated in the aggregate summary
- `scripts/review-local.sh`, `scripts/verify-local.sh`, `scripts/scan-secrets.sh`
- `docs/APEXYARD.md` § "Why the AI review is local-only"
- `docs/quality/tech-debt-register.md` — TD-027
- Ops fork PR #2 — allows the bridge to authenticate through a logged-in CLI instead of demanding an env key
