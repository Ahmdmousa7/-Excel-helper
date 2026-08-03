# ADR-0002 — Prove the local review covered this code, with a content-bound attestation

**Status:** Accepted
**Date:** 2026-08-03
**Deciders:** Maintainer (Ahmdmousa7)
**Follows:** [ADR-0001](ADR-0001-ai-review-runs-locally-not-in-ci.md), which moved the AI review out of CI and left TD-027 open — nothing verified the review happened.

> In the context of an AI code review that runs only on the maintainer's machine, facing a CI pipeline that could not tell a reviewed push from an unreviewed one, I decided to have the review emit a committed manifest binding each reviewed file to its git blob OID, verified by a CI job that holds no credentials, to make a stale or missing review a hard failure, accepting that this proves *coverage* rather than *execution* and cannot bind the maintainer who chooses to fabricate it.

## The honest framing, first

**This is an attestation, not a proof.** The distinction decides everything else, so it goes before the design.

No artifact a local machine produces can be unforgeable to the person operating that machine. Whoever can run the review can also write its output by hand. No signature changes that, because the signing key and the subject of the claim are held by the same party. Any scheme claiming otherwise on a single-maintainer repo is describing a feeling, not a control.

So the threat model is stated narrowly and the naming follows it. The file is `.apexyard/attestation`, the job is "Review attestation", and the CI summary says in as many words that it does not prove a model ran. Calling it `review-proof.json` would repeat the mistake this project already refused once — dressing an unenforced convention as a gate.

| | |
|---|---|
| **Defends against** | Forgetting. Amending a commit after reviewing. Rebasing onto new work. Adding one more file before pushing. Pushing a branch reviewed three commits ago. Every one silently invalidates a review, and every one is what actually happens. |
| **Does not defend against** | A maintainer who decides to fabricate an attestation. That is deliberate, visible in the diff, and out of reach of any local scheme. |

Requirement 6 asked for "difficult to fake **accidentally**". That word is doing real work, and it is the right bar.

## What was considered

| Option | How it would work | Why not / why yes |
|---|---|---|
| **Timestamp file** | Record when the review ran; CI checks it is recent. | Rejected. Proves nothing about *what* was reviewed — a review of different code an hour ago passes, and a review of exactly this code last week fails. It answers a question nobody asked. Also non-deterministic: the artifact changes on every run over identical input, so it can never be compared. |
| **Commit-SHA binding** | Attestation records the reviewed commit; CI checks it equals `github.sha`. | Rejected, and this is the closest call. Simple and tamper-evident, but it breaks on every history rewrite that changes no content: a squash merge rewrites every SHA, so the attestation would go stale at merge time on every single PR. A gate that fails routinely gets bypassed, and then it guards nothing. |
| **Blob-OID binding** (chosen) | Record `<oid> <path>` for every file in scope; CI recomputes from its own checkout. | Chosen. Expires on exactly the event that should expire it — a byte of reviewed code changing — and survives rebase, amend, and squash, which change SHAs but not content. Git already computes these hashes, so there is nothing novel to get wrong. |
| **Diff hash** | Hash the reviewed diff. | Rejected. Diffs are not deterministic across environments: context lines, rename-detection thresholds, and whitespace settings all change the bytes. A verifier reproducing a different diff would fail on a correct review. |
| **HMAC with a shared secret** | Sign the manifest with a key in GitHub Secrets. | Rejected on two counts. It puts a secret back in CI, which is the thing ADR-0001 exists to avoid; and it buys nothing, because the maintainer holds both ends. |
| **Sigstore / keyless OIDC** | Get a short-lived certificate from Fulcio, log to Rekor. | Rejected. Requires a cloud dependency and network egress from the maintainer's machine, both explicitly out of scope. It also proves *identity*, not that a review ran. |
| **SSH-signed manifest** (chosen, optional) | `ssh-keygen -Y sign` locally; `ssh-keygen -Y verify` in CI against a committed `allowed_signers`. | Chosen as a layer, not the foundation. Private key stays local, public key is committed, **no secret in GitHub**, no network. Adds provenance — *which registered key attested* — which is worth nothing today and becomes the load-bearing part the moment a second contributor appears. |

## The design

`.apexyard/attestation` is a small, human-readable, LF-only text file, committed alongside the code it describes:

```
apexyard-review-attestation v1
digest sha256:<64 hex>
--
scope origin/main...HEAD
head <sha of the commit reviewed>
model claude-opus-5
gate high
verdict APPROVED
findings critical=0 high=0 medium=1 low=4 info=0
files 13
<blob oid> <path>
deleted   <path that the review saw removed>
...
```

The digest covers everything after `--`. CI runs five checks:

1. **Integrity.** Recompute the digest. Catches any hand edit — flipping `gate high` to `gate none` breaks it.
2. **Content binding.** Every recorded OID must still resolve to that path at the verifying commit; every `deleted` path must still be absent. **This is the load-bearing check**; the rest are guards around it.
3. **Coverage.** Every file changed in CI's range must appear in the attestation. The rule is deliberately **subset, not equality**: the attestation may cover more than CI sees (the local run diffs against `origin/main` while a PR job may look at a narrower range), but never less. Without this, an attestation over one unchanged file would satisfy check 2 while the rest of the push went unreviewed.
4. **Gate strength and cleanliness.** Zero findings at or above `high`, *and* the local run's own threshold must have been at least as strict as `high`. Both, because either alone has a hole: `--fail-on critical` exits 0 on a pile of High findings, so the counts check catches the numbers and the strictness check catches the misconfiguration that produced them.
5. **Signature**, when and only when a key is registered in `.apexyard/allowed_signers`. An empty or absent signers file means the repo has not opted in, and demanding a signature would fail every build for a control nobody configured. Once a key *is* registered, a missing or bad signature is fatal — otherwise registering one would be decorative.

### There is deliberately no timestamp

Requirement 8 asked for hashes or signed metadata over timestamps, and the reason is worth recording: a timestamp would make the digest differ on every run over identical content, destroying the one property that makes this verifiable at all. Freshness comes from the OIDs — they stop matching the moment the code changes, which is the actual question. `head` is recorded for human audit and is not gated on.

### What the attestation deliberately does not contain

Requirement 3. It carries paths, content hashes, the model id, the gate, the verdict, and per-severity **counts**. It carries no prompt text, no finding descriptions, no code excerpts, no credentials, and no environment detail. Paths and content hashes are already public in a public repository, and a count is not a disclosure. The full report stays in `.apexyard/review/`, which is gitignored.

## Consequences

- A push whose code changed after the review **fails CI**, with the specific file and both OIDs named.
- A push that adds a file the review never saw **fails CI**, listing every gap.
- A squash merge or a reworded amend **still passes**, because content did not change. This was the reason to reject commit-SHA binding, and it is covered by a test.
- The attestation must be committed. `scripts/review-local.sh` writes it automatically after a review, and the pre-push hook re-verifies it with the same code CI runs — so a mismatch surfaces in seconds rather than after a push and a red check.
- It is written on a **failing** review too, recording the real counts, and CI then rejects it. An absent artifact is ambiguous; a present one that says `high=2` is not. It is never written when the reviewer could not run (exit 3) — an attestation is the one thing that must never be produced speculatively.
- **The residual gap is unchanged and stays open as TD-027.** CI now verifies that a review covering this code was recorded. It does not verify a model was invoked. Anyone reading the CI summary is told so.
- Cost: one extra commit or amend per reviewed push, and `.apexyard/attestation` churns on every review. Accepted — it is 20 lines of readable text and the diff is legible.

## Testing

| Suite | Covers | Count |
|---|---|---|
| `tests/unit/attestation.test.ts` | Serialisation determinism, bytewise path ordering, digest tamper-detection, the subset rule, gate arithmetic, input validation | 38 |
| `scripts/tests/test-attestation.sh` | Both CLIs against real git repos: edit-after-review, unreviewed-added-file, resurrected-deletion, message-only amend, squash merge, forged-but-internally-consistent manifests, signature verification | 22 |

The two cases the whole thing exists for — a file edited after review, and a file added and never reviewed — are asserted end to end, as is the pair that justifies OID binding over SHA binding.

## Artifacts

- `scripts/lib/attestation.mjs` (+ `.d.mts`) — the pure logic
- `scripts/attest-review.mjs` — generator, called by `review-local.sh`
- `scripts/verify-attestation.mjs` — verifier, run by CI and by the pre-push hook
- `.github/workflows/ci.yml` — the `attestation` job, part of the required `CI` check
- `docs/quality/tech-debt-register.md` — TD-027 (residual gap), TD-028 (single-maintainer signing)
