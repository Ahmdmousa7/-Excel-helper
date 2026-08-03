# ADR-0003 — An engineering evidence bundle, anchored on the review attestation

**Status:** Accepted
**Date:** 2026-08-03
**Deciders:** Maintainer (Ahmdmousa7)
**Builds on:** [ADR-0001](ADR-0001-ai-review-runs-locally-not-in-ci.md) (the review is local, no credential in CI) and [ADR-0002](ADR-0002-review-attestation.md) (the blob-hash attestation). Neither is redesigned here.

> In the context of a review whose only output was a verdict, facing a CI job that could confirm *that* code was reviewed but nothing about the quality signals around it, I decided to emit a set of deterministic, machine-readable artifacts all bound to the attestation's digest as their shared id, verified by a credential-free CI job, to make the whole engineering picture reproducible and checkable, accepting that this remains an attestation and that the bundle costs one commit per reviewed push.

## What changed, and what did not

**Not redesigned.** `.apexyard/attestation` is byte-for-byte the same artifact as in ADR-0002: the canonical text manifest of `<blob oid> <path>` rows, digested with SHA-256, optionally signed with `ssh-keygen -Y sign`. It remains the single authoritative artifact. Squash merges, rebases, and amend commits still verify, because the binding is still to content and not to a commit SHA.

**Added.** Seven JSON artifacts and one markdown summary, all in `.apexyard/`, all carrying the attestation's digest as `attestation_id`.

```
.apexyard/
  attestation                    canonical signed manifest — AUTHORITATIVE, unchanged
  attestation.sig                optional SSH signature over the above
  allowed_signers                optional; when non-empty, a signature becomes mandatory
  attestation.json               machine-readable mirror; digest must equal the manifest's
  review.json                    verdict, model, gate, severity counts
  findings.json                  every finding, deterministically ordered
  metrics.json                   typescript · eslint · vitest · playwright · bundle
  architecture.json              layering, file size, duplication — computed, always available
  dependency-report.json         direct deps, licences, production audit
  accessibility-report.json      axe violations by rule and impact
  review-summary.md              the human-readable companion
  review/                        GITIGNORED — the full local report, quotes source lines
  raw/                           GITIGNORED — unnormalised tool output
```

## The attestation id is the digest

Requirement 4 asks every artifact to reference the same attestation id. The id **is** the attestation's SHA-256 digest — not a uuid, not a counter, not a timestamp.

That single choice does the staleness work for free. The digest covers the reviewed files' content, so the instant any reviewed byte changes, the digest changes, and every artifact still naming the old id is provably stale. There is nothing to expire, because freshness is not a function of time. A uuid would have needed a separate mechanism to answer "is this still current?"; a timestamp would have needed a policy decision about how old is too old, and would have been wrong in both directions — a review of *this* code last week is still valid, and a review of *different* code a minute ago is not.

## Determinism is enforced, not requested

Requirements 7 and 8. "Deterministic, no timestamps" is easy to state and easy to break by accident: Playwright's JSON reporter volunteers a `duration` on every test, Vitest offers `startTime`, npm audit embeds nothing but its own version. One of those leaking in makes the bundle differ on every run, which destroys the only property that makes it checkable.

So four mechanisms, in order of when they fire:

1. **Collectors discard by construction.** Each collector extracts only reproducible facts — counts, percentages, rule ids, content hashes — and never copies a reporter's object through. Durations are dropped at the source, not filtered downstream.
2. **`envelope()` refuses at build time.** Every artifact goes through it, and it runs the determinism guard before returning. A payload carrying `duration_ms` throws rather than being written.
3. **`canonicalJson()` pins the bytes.** Keys sorted recursively, two-space indent, LF, exactly one trailing newline. Object key order in JS is insertion order — an artifact of how the producer happened to build the object — so two runs computing identical facts would otherwise emit different bytes.
4. **`evidence.mjs --check` proves it.** Regenerates the whole bundle in memory and compares byte for byte with what is on disk. This runs in the local gate as stage 11, which is how determinism gets *demonstrated* rather than asserted.

The guard rejects two distinct shapes: time-like **keys** (`timestamp`, `duration`, `elapsed_ms`, `pid`, `hostname`, `seed`, …) and date-shaped **values** under innocuous keys (`"version": "2026-08-03"`). It deliberately does not flag a semver, a content hash, or a path — a guard that fires on `0.20.3` would be turned off within a day.

## Never fabricate a pass

The most important integrity property in the bundle, and it is not about tampering.

**"0 failures" and "never ran" look identical in a summary table and mean opposite things.** A collector that returns zeros for a tool that did not execute produces a green report for an unverified codebase — a worse outcome than no report at all, because it is believed.

So every collector returns a union: either `{available: false, reason: "..."}` or a payload with `available: true`. There is no third option, no default-to-zero, and the `Unavailable` branch carries **no `passed` field at all** — so nothing downstream can read it as a pass. `review-summary.md` renders those sections as **not run**, with the reason, and says in as many words that a gate reading *not run* is not a gate that passed. The TypeScript declarations make the union explicit, which forces every call site — including the tests — to establish that a tool ran before reading its numbers.

## What CI verifies, and what it cannot

`scripts/verify-evidence.mjs` runs in Actions with no credentials, no network, and no model. Requirement 5, in the order the script applies it:

| # | Rule | Catches |
|---|---|---|
| 1 | **Artifacts exist** | A bundle missing `metrics.json`, or the summary. |
| 2 | **Attestation matches the mirror** | `attestation.json` disagreeing with the signed manifest on digest, file set, gate, model, or verdict. |
| 3 | **Reviewed files match repository state** | Every recorded blob OID must still resolve at HEAD; every `deleted` path must still be absent; nothing changed in this range that the review never saw. **The load-bearing check.** |
| 4 | **No artifact is stale** | Any artifact whose `attestation_id` is not this attestation's digest. |
| 5 | **Nothing is non-reproducible** | A hand-edited, reformatted, or non-canonical artifact; timestamp-shaped content. |
| — | **Internally consistent** | `review.json` and `findings.json` disagreeing on counts (a partial regeneration under one id), or either contradicting the signed manifest. |

The gate strength check from ADR-0002 still applies: zero findings at or above `high`, *and* the local run's own threshold must have been at least that strict.

**What it does not establish, stated plainly because a verifier that overclaims is worse than none:** that a model was invoked. The bundle is written by the same machine that could write it by hand. Every artifact is an attestation, in exactly the sense ADR-0002 defined — it defends against forgetting, not against deliberate fabrication. The CI summary says so; so does `review-summary.md`; so does this ADR. Requirement 2 asked for that framing to be kept, and it is kept in the code, the artifacts, and the reports rather than only here.

`evidence.mjs --check` deliberately does **not** run in CI. Regenerating there would need the raw tool output the local gate captured, which is gitignored. The reproduce-byte-for-byte proof belongs where its inputs exist; CI checks the committed bundle's integrity and binding instead.

## Decisions worth recording

**`attestation.json` is a mirror, not a second source of truth.** The bundle layout asked for JSON, and ADR-0002 said not to redesign the attestation — whose bytes an SSH signature covers. Rewriting it as JSON would have changed those bytes. So the text manifest stays authoritative and `attestation.json` mirrors it, with the verifier proving the two agree on digest, file set, gate, model, and verdict. Drift is impossible rather than merely discouraged.

**The bundle is excluded from its own attested scope.** The artifacts are generated *from* the review, so requiring them to be reviewed would be circular. The verifier skips the whole `.apexyard/` prefix in the coverage check, and there is a regression test asserting that committing the bundle does not trip it. The residual exposure is that a file under `.apexyard/` is never AI-reviewed — acceptable, because it is generated evidence data rather than executable code.

**Per-tool artifacts are sections of `metrics.json`, not separate files.** An earlier sketch listed `vitest.json`, `eslint.json`, `typescript.json`, `playwright.json`, and `bundle-analysis.json` individually. They live inside `metrics.json` instead, because the roll-up and the detail would otherwise hold the same numbers in two places and drift under partial regeneration — exactly the failure the review/findings consistency check exists to catch. Splitting them out later is mechanical if the shape becomes inconvenient.

**`security.json` is not a separate artifact either.** The dependency audit is in `dependency-report.json`, where its scope (`--omit=dev`) is stated next to the dependency list it applies to. The secret scan is a local gate stage with a pass/fail outcome and nothing meaningful to serialise; recording "no secrets found" as an artifact would invite reading it as a stronger claim than a pattern sweep supports.

**`architecture.json` is computed, not collected.** It reads the repository directly, so it is the one section that is always `available: true` — no tool has to have run. The import scan is a regex rather than a parser, which is a real limit and is stated in the artifact's own `method` field: it sees static `import`/`from` and dynamic `import(...)`, and will miss a path built at runtime. A parser would add a dependency and a build step to catch cases this codebase does not contain.

## Consequences

- **The bundle is committed.** `.gitignore` previously ignored all of `.apexyard/`, which made the attestation uncommittable and would have failed the CI gate on every push. The review caught that as a High finding before it shipped. Only `review/` and `raw/` stay ignored.
- **`.gitattributes` pins `.apexyard/*` to LF.** The digests and the signature are defined over LF bytes, so a CRLF checkout would break verification on a machine that did nothing wrong. `attestation.sig` is marked `-text` so git never touches it.
- The local gate grew to eleven stages: the nine quality gates now also **capture** raw output as they run, then stage 10 assembles the bundle and stage 11 verifies it and proves it reproduces. Capturing during the gating run rather than re-running each tool means the evidence describes the run that actually gated.
- Cost: one commit or amend per reviewed push, and the bundle churns on every review. `architecture.json` is the largest artifact at a few KB.
- The accessibility suite now writes `test-results/axe-summary.json` in an `afterAll` hook — rule ids, impacts, node counts, page labels. No selectors and no HTML, which would have put fragments of the rendered DOM into a committed artifact.

## Testing

Requirement 14: every new verification rule has a regression test.

| Suite | Covers | Count |
|---|---|---|
| `tests/unit/attestation.test.ts` | ADR-0002 rules: digest determinism, bytewise path ordering, tamper detection, the subset rule, gate arithmetic | 38 |
| `tests/unit/evidence.test.ts` | Canonical JSON (sorting, indent, LF, trailing newline, reformat rejection), the determinism guard (13 key shapes, date-shaped values, semver/hash false-positive avoidance), the envelope (schema registry, id format, field collisions), all six artifact rules, presence checks, and every collector — including that each returns `available:false` with a reason and no `passed` field | 44 |
| `scripts/tests/test-attestation.sh` | Both attestation CLIs against real git repos: edit-after-review, unreviewed add, resurrected deletion, amend, squash, forged-but-consistent manifests, signature verification | 22 |
| `scripts/tests/test-evidence.sh` | The bundle end to end: generation, shared-id propagation, `--check` reproducibility, byte-identical regeneration, missing artifact, stale artifact, reformatted artifact, mirror digest mismatch, mirror file-set mismatch, review/findings disagreement, counts contradicting the manifest, edit-after-review, unreviewed add, self-attestation exclusion, amend | 28 |

**132 tests.** The two cases the whole system exists for — code edited after review, and code added and never reviewed — are asserted at both layers.

## Artifacts

- `scripts/lib/evidence.mjs` (+ `.d.mts`) — canonical JSON, envelope, determinism guard, verification rules
- `scripts/lib/collectors.mjs` (+ `.d.mts`) — one collector per source, all `Unavailable`-returning
- `scripts/evidence.mjs` — generator and `--check` reproducibility prover
- `scripts/verify-evidence.mjs` — the CI verifier
- `scripts/check-bundle-budget.mjs` — gained `--json`
- `e2e/accessibility.spec.ts` — writes `test-results/axe-summary.json`
- `.github/workflows/ci.yml` — the `Evidence bundle` job, part of the required `CI` check
- `docs/quality/tech-debt-register.md` — TD-027 (residual gap), TD-028 (signing), TD-029 (the e2e build collision this work surfaced)
