# Architecture review — the quality platform

**Date:** 2026-08-03
**Scope:** everything added to this repo and to `Ahmdmousa7/apexyard` over the last two days.
**Method:** reviewed as if written by someone else, with no obligation to defend it.

---

## The finding that matters most

```
Quality apparatus added ........................  4,585 lines
Application components it measures ............. 19,181 lines, 0 unit tests
Unit tests for the apparatus ...................    642 lines
Unit tests for the application's own logic .....    276 lines
```

**The measuring instrument is now better engineered than the thing it measures.**

Three components in this app are over 1,000 lines each (1,384 / 1,370 / 1,058) and have no unit tests. `VariableBalanceTab.tsx` — the largest — has a duplicate `V2` sitting beside it, and only one of the two is routed. The evidence bundle *detects both facts automatically* and reports them as TD-010 and TD-011. It has been correctly reporting them for a day, and neither has moved.

That is the honest state: a rigorous system for describing a poorly-tested application. Every verdict below is secondary to it.

**The next work should be tests for `utils/` extraction from those three components — not another gate.** Not because the platform is wrong, but because it is now the well-built part.

---

## Verdicts

| Subsystem | Verdict | One-line reason |
|---|---|---|
| ApexYard ops fork + 9 handbooks | **KEEP** | The handbooks are what make the review project-specific rather than generic advice. |
| Review bridge (`apexyard-review-ci.sh`) | **KEEP** | The only way to run the review unattended. Load-bearing. |
| Composite GitHub Action in the ops fork | **REMOVE (from our path)** | Dead for this project since the review went local. |
| Attestation (manifest + blob-OID binding) | **KEEP** | Small, heavily tested, solves a real failure that actually happens. |
| `attestation.json` mirror | **SIMPLIFY** | Exists for format preference; costs a whole cross-check rule. |
| Second verifier (`verify-attestation.mjs`) | **REMOVED — done today** | Duplicated 85% of the other and disagreed on one rule. |
| Evidence bundle (7 artifacts) | **KEEP, with a review date** | Requested scope, works — but nothing consumes it programmatically yet. |
| `.d.mts` declarations (352 lines) | **KEEP** | Tested the alternative; it fails. Cost is bounded by test coverage. |
| `verify-local.sh` (11 stages) | **SIMPLIFY** | Its 5-branch scope selection is the least-tested, highest-risk code here. |
| `scan-secrets.sh` | **KEEP (borderline)** | Only unique value is the `sk-ant-` policy check and the report-leak check. |
| `install-hooks.mjs` | **KEEP** | 4 real edge cases; mostly comment by volume. |
| `.githooks/pre-push` | **KEEP** | Removes the forgetting failure mode, which is the one that happens. |
| CI (`ci.yml`, `security.yml`, `deploy.yml`) | **KEEP** | Simplified today by deleting a duplicate step. |
| Debt register | **KEEP** | The single most useful document produced. |
| Scorecard (numeric 1–10 scores) | **SIMPLIFY** | The numbers are mine, unfalsifiable, and now duplicated by real metrics. |
| Roadmap (30/60/90) | **SIMPLIFY** | Speculative planning for a project with one maintainer and no deadline. |
| ADRs 0001–0003 | **KEEP** | Highest expected value in two years. Nothing else explains *why*. |

---

## Acted on today

### REMOVED: the second verifier

`verify-attestation.mjs` (294 lines) is deleted. `verify-evidence.mjs` absorbed its one unique check (SSH signature verification) and is now the only verifier.

This was not tidiness. The AI review found the consequence and rated it **High**:

> the two steps disagree and **the gate has no fixed point**

The two verifiers excluded different paths from the coverage check. `verify-evidence` excluded the whole `.apexyard/` bundle; `verify-attestation` excluded only the manifest. Since `evidence.mjs` rewrites every artifact on each run, **committing the bundle produced files the other verifier saw as changed-but-unreviewed — so CI could never be green.** CI ran both, so every attestation check also ran twice.

Two near-identical checkers are not redundancy. They are a place for the two to disagree.

Also fixed while consolidating — three more real bugs the review caught in code I had written that morning:

| Bug | Consequence |
|---|---|
| `report()` called during the module's temporal dead zone | Every early-exit path threw `ReferenceError` instead of printing the failure it existed to print. |
| `import('node:fs').then(...)` racing `process.exit()` | The GitHub job summary was never written — a reporting feature that silently did nothing in the only environment it was for. |
| A bundle with `review.json: available:false` passed | "The review never ran" satisfied every other rule. The same *absence-reads-as-success* failure the collectors were built to prevent, one layer up. |

### REMOVED: duplicated test cases

`test-attestation.sh` and `test-evidence.sh` both tested edit-after-review, unreviewed-add, and amend. After the verifiers merged, those were the same verifier tested twice with different fixtures. The suites are now split by **subject** — generation in one, verification in the other — with the rule written at the top of each file so cases stop drifting back.

**Net: 882 → 669 lines. 47 end-to-end cases still pass; nothing lost.**

### FIXED: a deprecation

`baseUrl` is deprecated in TS 6 and removed in 7. Dropped; `paths` has resolved relative to `tsconfig.json` since TS 4.x, which is what was wanted anyway.

---

## Where I would still change things

### `attestation.json` — SIMPLIFY

It is a derived duplicate of `.apexyard/attestation` that exists because the requested layout named a `.json` file. It required a whole verification rule (*mirror agrees with manifest*) that exists **only because the mirror exists** — complexity generating complexity.

The honest position: keeping the text manifest authoritative was justified by the SSH signature covering its bytes. But **no signer is registered**, so that argument currently protects an unused capability.

Two coherent options:

1. **Drop the mirror.** One artifact, one format, one rule fewer. Costs the requested JSON shape.
2. **Make `attestation.json` the only form** and sign it instead. One artifact, JSON as requested.

Both are better than what exists. I did not pick one because "keep the current blob-hash based attestation, do not redesign it" was an explicit instruction, and the format is arguably part of what that protects. **This is a decision for the maintainer, not for me to make quietly.**

### `verify-local.sh` — SIMPLIFY

271 lines of bash. The review-scope selection alone has five branches (unresolvable base / nothing to push / deletions only / already attested / run), each added because the review found a real hole in the previous version.

Every branch is justified. **None is tested.** That is the wrong distribution of effort: 114 unit tests cover pure functions, and zero cover the orchestrator that decides whether the review runs at all — which is where a bug means *the review silently does not happen*.

Recommendation: extract the decision into a small function with a test, or move the orchestration to Node where it can be tested. Not urgent, but it is the highest-risk untested code in the system.

### Scorecard — SIMPLIFY

`docs/quality/scorecard.md` assigns 1–10 scores to twelve subsystems and computes a weighted "production readiness" figure that has moved 5.4 → 8.7. **Every one of those numbers is mine.** There is no rubric another person would apply the same way, no second assessor, and the trend is therefore self-graded.

Meanwhile `metrics.json` now records real, reproducible numbers for the same subsystems. The scorecard's *narrative* sections ("what moved it", the phase tables) are genuinely useful history. The scores are theatre.

Recommendation: keep the history and the prose, drop the numbers — or state plainly that they are one person's estimate.

### Roadmap — SIMPLIFY

30/60/90-day plans for a single-maintainer project with no external deadline. The debt register already carries priority, effort, and a fix recommendation per item, which is the same information without the false precision of dates. Recommendation: fold into the register.

### The ops fork's composite Action — REMOVE from our path

`.github/actions/apexyard-review/action.yml` runs the review in CI with an API key. This project's policy forbids that, so it is dead code *here*. It stays in the fork because the fork is a general framework and another adopter may accept that trade — but the fork's `CLAUDE.md` still describes CI review as the primary path, which is now wrong for its only registered project. Worth a doc correction upstream.

---

## The seven questions, where the answer is not obvious

### Does it solve a real problem?

Yes, for the attestation, and the evidence is concrete: in two days of use, the system caught a live crash (`aiService.generateContent` didn't exist), 5 high/critical CVEs, an uncommittable-attestation bug that would have made CI permanently red, a staged review prompt, 12,720 ESLint errors from a misconfigured ignore, and a 100-of-101 Playwright failure whose signature was indistinguishable from an app regression.

Ambiguous for the **evidence bundle**. It is correct, deterministic, and tested — and nothing reads it except the summary and the verifier. It is write-only. That is fine for a week; it is how documentation rots over a year.

### Is there a simpler solution?

For the attestation: no. It is a text file of `<hash> <path>` rows using hashes git already computes.

For the bundle: yes — `review.json` plus the summary would carry 80% of the value. The other five artifacts are requested scope, and I have flagged the rot risk rather than quietly cutting them.

### Is it over-engineered?

The **verifier was** — two of them. Fixed.

The **test suites are not**: they caught a severity/gate-rank conflation I would otherwise have shipped, and every bug in the table above.

The **scorecard is** — a weighted composite of twelve self-assigned scores is more precision than the inputs support.

### What is the maintenance cost?

| Component | Cost | Failure mode if neglected |
|---|---|---|
| Attestation | Low | Tests fail loudly. |
| Evidence collectors | **Medium** | A tool changes its JSON shape, the collector silently reports `available:false`, and nobody notices the section went blank. |
| `.d.mts` declarations | Medium | Drift from the implementation — but bounded, because the unit tests exercise every export against the real code. |
| `verify-local.sh` | **Medium-high** | Untested bash with five branches. |
| Handbooks | Low | They go stale and the review cites rules nobody follows. |
| ADRs | Near zero | They describe decisions, which do not rot. |

### One maintainer?

Most of this is **worth less** than it looks. The attestation guards against my own forgetting, which is real. But the signature proves I signed my own claim; the two-marker merge gate has one person on both sides; the evidence bundle has no second reader. The honest value at n=1 is *catching your own mistakes*, and it has genuinely done that.

The over-engineering risk is concentrated here: ceremony built for a team, running for one person.

### Ten maintainers?

Most of it becomes **worth more**, and some of it becomes load-bearing:

- Signing (TD-028) stops being decorative — it proves *which* contributor attested.
- The staleness rule matters far more: ten people rebasing means far more stale-review opportunities.
- `available:false` matters more: nobody can check whether someone else ran the tools.
- The scorecard gets worse, not better — self-assessment does not survive contact with a team.

The system is designed for roughly 3–10 maintainers and is being run by one. That is a defensible bet if the project grows and a real cost if it does not.

### Would I design it this way today?

**Yes, for:** blob-OID binding over commit SHAs (squash merges would have broken a SHA binding on every PR); the `available:false` union; naming it an attestation instead of a proof; the local-only credential policy.

**No, for:** building the verifier twice; the `attestation.json` mirror; 4,585 lines of apparatus before writing a single component test.

**The last one is the real lesson.** Each step was individually justified, and each was requested. But the cumulative result is that the best-engineered code in this repository is the code that measures the rest.

---

## Recommended order of work

1. **Extract pure logic from the three 1,000+ line components into `utils/` and test it.** This is the only item that improves the *product*.
2. Decide the `attestation.json` question — drop the mirror, or make it the only form.
3. Delete `VariableBalanceTabV2.tsx` or route it (TD-010). The bundle has been reporting it for a day.
4. Test `verify-local.sh`'s scope selection.
5. Strip the scorecard's numbers; fold the roadmap into the register.
6. **Add nothing new to the platform until 1–3 are done.**

---

## What this review did not change, and why

I did not remove the evidence bundle, the handbooks, the ADRs, or any test suite. Each was explicitly requested, each works, and each is honest about its limits. "Simplify" does not mean "delete things that were asked for" — it means remove what duplicates, misleads, or costs more than it returns. Three things met that bar today, and they are gone.
