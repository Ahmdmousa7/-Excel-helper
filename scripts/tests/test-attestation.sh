#!/usr/bin/env bash
#
# test-attestation.sh — tests for GENERATING the attestation.
#
# The split between this file and test-evidence.sh is by subject, and it is
# worth stating so cases stop drifting between them:
#
#   here                what attest-review.mjs writes, and the manifest's own
#                       properties: blob OIDs, deletions, self-exclusion,
#                       tamper-evidence of the digest, SSH signing, refusals.
#
#   test-evidence.sh    what verify-evidence.mjs accepts and rejects: artifact
#                       presence, staleness, coverage, cross-consistency, and
#                       repository-state binding.
#
# Verification cases used to be duplicated here. After the two verifiers were
# collapsed into one, those duplicates were testing the same verifier twice with
# a different fixture, so they live in one place now.
#
# Usage: bash scripts/tests/test-attestation.sh

set -uo pipefail

REPO_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
PASS=0; FAIL=0

ok()  { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL %s\n       %s\n' "$1" "${2:-}"; }

# The verifier needs a complete bundle, so regenerate it alongside whatever the
# case under test changed.
verify() {
  node "$REPO_ROOT/scripts/evidence.mjs" >/dev/null 2>&1
  node "$REPO_ROOT/scripts/verify-evidence.mjs" --base base 2>&1
}
expect_verify() {
  local label="$1" want="$2" needle="${3:-}" out rc
  out=$(verify); rc=$?
  if [ "$rc" -ne "$want" ]; then bad "$label" "expected exit $want, got $rc"; return; fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qi -- "$needle"; then
    bad "$label" "output did not mention '$needle'"; return
  fi
  ok "$label"
}
# For cases where the manifest itself is corrupt, regenerating would overwrite
# the corruption — so verify without regenerating.
expect_verify_raw() {
  local label="$1" want="$2" needle="${3:-}" out rc
  out=$(node "$REPO_ROOT/scripts/verify-evidence.mjs" --base base 2>&1); rc=$?
  if [ "$rc" -ne "$want" ]; then bad "$label" "expected exit $want, got $rc"; return; fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qi -- "$needle"; then
    bad "$label" "output did not mention '$needle'"; return
  fi
  ok "$label"
}

WORK=$(mktemp -d 2>/dev/null || mktemp -d -t attest)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK" || exit 1

# ---------------------------------------------------------------------------
# A throwaway repo with one reviewed commit
# ---------------------------------------------------------------------------
git init -q .
git config user.email t@example.com
git config user.name Tester
git config commit.gpgsign false

mkdir -p utils scripts/lib .apexyard/review
for f in attest-review.mjs verify-evidence.mjs evidence.mjs; do
  cp "$REPO_ROOT/scripts/$f" scripts/
done
cp "$REPO_ROOT/scripts/lib/attestation.mjs" "$REPO_ROOT/scripts/lib/evidence.mjs" \
   "$REPO_ROOT/scripts/lib/collectors.mjs" scripts/lib/
printf '{"name":"fixture","version":"1.0.0","dependencies":{},"devDependencies":{}}\n' > package.json

printf 'export const a = 1;\n' > utils/a.ts
printf 'export const b = 2;\n' > utils/b.ts
printf 'legacy\n'              > utils/old.ts
git add -A >/dev/null && git commit -q -m base && git branch -f base HEAD

# The change under review: edit a.ts, add c.ts, delete old.ts.
printf 'export const a = 11;\n' > utils/a.ts
printf 'export const c = 3;\n'  > utils/c.ts
rm utils/old.ts
git add -A >/dev/null && git commit -q -m "the change"

cat > .apexyard/review/review.json <<'JSON'
{"verdict":"approved","files_reviewed":3,
 "findings":[{"severity":"low"},{"severity":"medium"},{"severity":"info"}],
 "summary":"fine"}
JSON

printf '\n== generation ==\n'
if node scripts/attest-review.mjs --base base --gate high --no-sign >/dev/null 2>&1; then
  ok "attest-review exits 0 on a clean review"
else
  bad "attest-review exits 0 on a clean review" "non-zero exit"
fi

[ -f .apexyard/attestation ] && ok "writes .apexyard/attestation" \
  || bad "writes .apexyard/attestation" "file absent"

grep -q '^deleted utils/old.ts$' .apexyard/attestation \
  && ok "records a deleted file as deleted" \
  || bad "records a deleted file as deleted" "$(grep old.ts .apexyard/attestation || echo none)"

grep -q "^$(git rev-parse HEAD:utils/c.ts) utils/c.ts$" .apexyard/attestation \
  && ok "records the real blob oid of an added file" \
  || bad "records the real blob oid of an added file" "oid mismatch"

grep -q '\.apexyard/attestation' .apexyard/attestation \
  && bad "excludes itself from its own scope" "self-reference present" \
  || ok "excludes itself from its own scope"

# Unreviewed files must never appear: the manifest is the review's own record of
# what it read, not a listing of the tree.
grep -q 'utils/b.ts' .apexyard/attestation \
  && bad "records only files in scope" "unchanged utils/b.ts was recorded" \
  || ok "records only files in scope"

node scripts/evidence.mjs >/dev/null 2>&1
cp .apexyard/attestation "$WORK/att.good"
cp -r .apexyard "$WORK/bundle.good"

printf '\n== the manifest is tamper-evident ==\n'
sed 's/^gate high$/gate none/' "$WORK/att.good" > .apexyard/attestation
expect_verify_raw "a hand-weakened gate breaks the digest" 1 "digest does not match"

sed 's/^verdict APPROVED$/verdict TOTALLY_FINE/' "$WORK/att.good" > .apexyard/attestation
expect_verify_raw "any hand edit breaks the digest" 1 "digest does not match"

rm -f .apexyard/attestation
expect_verify_raw "a missing manifest fails" 1 "nothing to bind to"
cp "$WORK/att.good" .apexyard/attestation

# A digest recomputed over a weakened body — the informed forgery. The digest is
# internally consistent, so only the gate check catches it. Both exist for this.
node --input-type=module -e '
import { renderAttestation, parseAttestation } from "./scripts/lib/attestation.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const { fields } = parseAttestation(readFileSync(process.argv[1], "utf8"));
writeFileSync(".apexyard/attestation", renderAttestation({
  scope: fields.scope, head: fields.head, model: fields.model,
  gate: "none", verdict: "APPROVED", findings: fields.findings, files: fields.files,
}));
' "$WORK/att.good"
expect_verify "a resigned-but-weakened gate is still rejected" 1 "weaker than the required high"

node --input-type=module -e '
import { renderAttestation, parseAttestation } from "./scripts/lib/attestation.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const { fields } = parseAttestation(readFileSync(process.argv[1], "utf8"));
writeFileSync(".apexyard/attestation", renderAttestation({
  scope: fields.scope, head: fields.head, model: fields.model,
  gate: "high", verdict: "APPROVED",
  findings: { ...fields.findings, high: 2 }, files: fields.files,
}));
' "$WORK/att.good"
expect_verify "a valid digest over unresolved High findings is rejected" 1 "unresolved high"

cp "$WORK/att.good" .apexyard/attestation
node scripts/evidence.mjs >/dev/null 2>&1

printf '\n== content binding survives history rewriting ==\n'
# The reason for binding to blob OIDs rather than commit SHAs. A squash rewrites
# every SHA while changing no content; invalidating the review there would train
# people to bypass the gate on every merge.
SQUASHED=$(git rev-parse HEAD)
git checkout -q base
git merge -q --squash "$SQUASHED" >/dev/null 2>&1
git commit -q -m squashed
rm -rf .apexyard && cp -r "$WORK/bundle.good" .apexyard
expect_verify_raw "a squash merge still verifies" 0 "verified"
git checkout -q "$SQUASHED"
rm -rf .apexyard && cp -r "$WORK/bundle.good" .apexyard

printf '\n== a resurrected deletion is caught ==\n'
printf 'legacy\n' > utils/old.ts
git add utils/old.ts >/dev/null && git commit -q -m resurrect
expect_verify_raw "a resurrected file fails" 1 "attested as deleted but exists"
git reset -q --hard HEAD~1

printf '\n== signatures ==\n'
if command -v ssh-keygen >/dev/null 2>&1; then
  ssh-keygen -q -t ed25519 -N '' -C signer@example.com -f "$WORK/key" >/dev/null 2>&1
  printf 'signer@example.com %s\n' "$(cat "$WORK/key.pub")" > .apexyard/allowed_signers

  expect_verify_raw "registering a signer makes a missing signature fatal" 1 "produced without signing"

  ssh-keygen -Y sign -q -f "$WORK/key" -n apexyard-review .apexyard/attestation >/dev/null 2>&1
  expect_verify_raw "a valid signature verifies" 0 "signature verified"

  # A signature over different content must not validate.
  cp .apexyard/attestation.sig "$WORK/sig.other"
  node --input-type=module -e '
  import { renderAttestation, parseAttestation } from "./scripts/lib/attestation.mjs";
  import { readFileSync, writeFileSync } from "node:fs";
  const { fields } = parseAttestation(readFileSync(process.argv[1], "utf8"));
  writeFileSync(".apexyard/attestation", renderAttestation({
    scope: fields.scope, head: fields.head, model: "some-other-model",
    gate: "high", verdict: "APPROVED", findings: fields.findings, files: fields.files,
  }));
  ' "$WORK/att.good"
  cp "$WORK/sig.other" .apexyard/attestation.sig
  node scripts/evidence.mjs >/dev/null 2>&1
  expect_verify_raw "a signature over different content is rejected" 1 "did not verify"

  rm -f .apexyard/allowed_signers .apexyard/attestation.sig
  cp "$WORK/att.good" .apexyard/attestation
  expect_verify "with no signers registered, unsigned is accepted" 0 "no signers registered"
else
  printf '  skip signature cases (ssh-keygen not on PATH)\n'
fi

printf '\n== refusals ==\n'
rm -f .apexyard/review/review.json
if node scripts/attest-review.mjs --base base --no-sign >/dev/null 2>&1; then
  bad "refuses to attest with no review output" "exited 0"
else
  ok "refuses to attest with no review output"
fi

printf '{"verdict":"approved"}\n' > .apexyard/review/review.json
if node scripts/attest-review.mjs --base base --no-sign >/dev/null 2>&1; then
  bad "refuses to attest an unrecognised review result" "exited 0"
else
  ok "refuses to attest an unrecognised review result"
fi

printf '\n== results ==\n'
printf '  %s passed, %s failed\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
