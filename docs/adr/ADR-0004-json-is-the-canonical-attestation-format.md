# ADR-0004 — JSON is the canonical attestation format, and the only one

**Status:** Accepted
**Date:** 2026-08-03
**Deciders:** Maintainer (Ahmdmousa7)
**Amends:** [ADR-0002](ADR-0002-review-attestation.md) — the serialisation only. The threat model, the blob-OID binding, the absence of a timestamp, and the list of what the attestation deliberately omits are all unchanged and still authoritative.
**Closes:** the open question recorded at the end of the previous session's handoff.

> In the context of an attestation that existed as a canonical text manifest plus a derived `attestation.json` mirror, facing a verification rule — *the mirror agrees with the manifest* — that existed only because the mirror existed, I decided to make the JSON artifact the attestation itself and delete the text form, to remove a whole class of drift between two files that had to say the same thing, accepting a one-time schema bump and the loss of a format that was pleasant to read in a terminal.

## The problem

ADR-0003 added `.apexyard/attestation.json` as a machine-readable mirror of `.apexyard/attestation`. Both were committed. The text form was authoritative because the SSH signature covered its bytes and ADR-0002 had said not to redesign it.

That left two files obliged to agree, so the verifier had to check that they did:

```
attestation.json records digest <x> but the manifest's is <y>
attestation.json lists a different file set than the manifest
attestation.json gate is "none", manifest says "high"
```

Three failure messages, roughly thirty lines of verifier, and a test case each — none of which protected the code. They protected the *mirror*, against a bug in the generator that wrote it. Delete the mirror and every one of them becomes unreachable.

The stated justification for keeping the text form authoritative was that the signature covered its bytes. On inspection that justification was protecting a capability with **no registered signer**: `.apexyard/allowed_signers` is empty, so nothing was signed, so the bytes being stable bought nothing today. The signature layer is still wanted — TD-028 — but it signs whatever file is canonical. It is not an argument for *which* file that is.

## What was considered

| Option | Why not / why yes |
|---|---|
| **Keep both** | Rejected. This is the status quo, and it is the thing being paid for: two artifacts, one derived, one verification rule whose only subject is their agreement. No reader of the bundle benefited from the duplication. |
| **Drop the mirror, keep the text manifest** | Coherent, and one artifact either way. Rejected because the requested shape was JSON, every other artifact in the bundle is canonical JSON, and the text form needed its own parser, its own serialiser, its own path-safety rules, and its own "is this LF" story — all duplicating machinery `lib/evidence.mjs` already had. |
| **Make the JSON canonical, delete the text form** (chosen) | Chosen. One artifact, one serialiser shared with the rest of the bundle, one fewer verification rule, and the shape that was asked for. |

## The design

`.apexyard/attestation.json`, canonical JSON, committed:

```json
{
  "attestation_id": "sha256:<64 hex>",
  "files": [
    { "oid": "<git blob oid>", "path": "scripts/evidence.mjs" },
    { "oid": "deleted", "path": "utils/old.ts" }
  ],
  "findings_by_severity": { "critical": 0, "high": 0, "info": 0, "low": 5, "medium": 1 },
  "gate": "high",
  "model": "claude-opus-5",
  "reviewed_at_commit": "<sha of the commit reviewed>",
  "schema": "apexyard.evidence.attestation/2",
  "scope": "origin/main...HEAD",
  "verdict": "COMMENT"
}
```

### The digest rule

```
attestation_id = sha256( canonicalJson( the artifact, with "attestation_id" removed ) )
```

One key removed, nothing else. That is the entire rule, and it is stated in one line because a verifier written in another language has to reimplement it exactly.

It replaces the text form's header/body split, where a `--` separator marked where the digested bytes began. Removing a single key does the same job — the file carries its own digest — without a second grammar to parse. `schema` stays inside the digest, so the version cannot be edited independently of the content it describes.

`canonicalJson` is the serialiser every other artifact in the bundle already uses: keys sorted recursively, two-space indent, LF, exactly one trailing newline. The attestation now has no private notion of canonical form.

### Why canonical form is verified separately

The digest is computed over a re-serialisation of the *parsed* object, so a file with reordered keys or a four-space indent would hash to the expected id while its bytes differed from the ones the digest is defined over. Two distinct byte strings would carry the same attestation id — and it is the bytes that get signed.

`isCanonical()` closes that, and it was already running against every artifact in the bundle. This is the one place where sharing the bundle's machinery paid for itself immediately rather than eventually.

### What replaced the mirror rule

Verifier rule 2 was *the JSON mirror agrees with the signed manifest*. It is now *the attestation's id is the digest of its own content*, which is the check the text form's `digest` line used to get. Same protection against a hand-edited field, one artifact instead of two.

### Two fields are gone, not renamed

- **`digest`** was equal to `attestation_id` in every mirror ever written. One of them was redundant. `attestation_id` survives because that is the name every other artifact in the bundle uses for the same value.
- **`file_count`** guarded against a truncated text manifest — a real risk in a line-oriented format, where a file cut short still parses. Truncated JSON does not parse, and the digest covers the array, so the field protected nothing and had to be kept in sync. Removed for the same reason as the mirror.

### Schema `/1` → `/2`

The shape barely moved: `/1`'s mirror carried these same keys. What changed is the **meaning of the digest** — it is now taken over this file rather than over a text manifest beside it. A verifier applying `/1` semantics to a `/2` artifact would recompute the wrong hash and report tampering, so the id has to move with it. `parseAttestation` refuses any schema it does not recognise rather than guessing.

## Consequences

- One attestation artifact. `.apexyard/attestation` is deleted; the signature path becomes `.apexyard/attestation.json.sig`.
- Verifier rule 2 no longer compares two files, so **the mirror cannot drift** — there is nothing to drift from.
- `evidence.mjs` no longer writes the attestation; `attest-review.mjs` owns it start to finish. That is why it is absent from `evidence.mjs`'s write set and from `--check`: rewriting it there would invalidate the signature over its bytes, and since its id is the digest of its own content, it could not be done idempotently anyway.
- The attestation is now in the same format as every other artifact, so anything that reads the bundle — `jq`, a future dashboard, a CI annotation — reads all of it one way.
- **Lost:** a format that was pleasant to read in a terminal without tools. `<oid> <path>` lines scanned better than a JSON array. Real, and the cost of a `jq` invocation is small next to a rule that had to be maintained forever.
- **Lost:** the ability for a verifier to check the digest without a JSON parser. Irrelevant here — both the generator and the verifier are Node scripts that already parse six other JSON artifacts.
- `.gitattributes` keeps the attestation pinned to LF and the `.sig` at `-text`. The `.sig` suffix means the signature is *not* caught by the `.apexyard/*.json` rule; that was verified with `git check-attr`, not assumed, because this file has a history of rules that looked applied and were not.

## Testing

| Suite | Covers | Count |
|---|---|---|
| `tests/unit/attestation.test.ts` | The one-key-removed digest rule directly, canonical output, schema refusal, tamper detection on every field, smuggled and removed file entries, parser refusals (including an omitted severity, which both consumers would otherwise read as zero), plus everything ADR-0002 already covered | 50 |
| `scripts/tests/test-attestation.sh` | Generation against real git repos, including that the output is canonical and that a reordered-but-digest-valid attestation is still rejected | 21 |
| `scripts/tests/test-evidence.sh` | The three cases that replaced the two mirror cases: an id over other content, a shortened file list, and a re-digested attestation with a weakened gate. Also asserts the retired text manifest is never written again | 34 |

The last of those is the one worth naming: nothing else in the suite would notice a stray writer recreating `.apexyard/attestation`, because the verifier ignores unknown files. Two attestations in the bundle is exactly the state this ADR removed, so its absence is asserted rather than assumed.

## Artifacts

- `scripts/lib/attestation.mjs` (+ `.d.mts`) — the pure logic; now imports `canonicalJson`/`digestOf` from `lib/evidence.mjs` rather than carrying its own serialiser
- `scripts/attest-review.mjs` — writes and signs `attestation.json`
- `scripts/verify-evidence.mjs` — rule 2 is now a self-check
- `docs/quality/tech-debt-register.md` — TD-027 (residual gap) and TD-028 (no registered signer) are both unchanged by this
