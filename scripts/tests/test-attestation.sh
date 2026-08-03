#!/usr/bin/env bash
#
# test-attestation.sh — end-to-end tests for the review attestation.
#
# The vitest suite covers the pure logic (serialisation, digest, coverage rule,
# gate arithmetic). This covers what that cannot: the two CLIs talking to a real
# git repository. It builds a throwaway repo in a temp directory, generates an
# attestation, and then reproduces each way a real push goes stale.
#
# The cases that matter are 5 and 6 — a file edited after review, and a file
# added and never reviewed. Those are what actually happens, and they are the
# entire reason the attestation exists.
#
# Usage: bash scripts/tests/test-attestation.sh

set -uo pipefail

REPO_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL %s\n       %s\n' "$1" "${2:-}"; }

# Assert the verifier's exit code, and that its output mentions $3.
expect_verify() {
  local label="$1" want="$2" needle="${3:-}" out rc
  out=$(node "$REPO_ROOT/scripts/verify-attestation.mjs" --base base 2>&1); rc=$?
  if [ "$rc" -ne "$want" ]; then
    bad "$label" "expected exit $want, got $rc"
    return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qi -- "$needle"; then
    bad "$label" "output did not mention '$needle'"
    return
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
git config user.name  Tester
git config commit.gpgsign false

mkdir -p utils scripts/lib .apexyard/review
cp "$REPO_ROOT/scripts/attest-review.mjs"     scripts/
cp "$REPO_ROOT/scripts/verify-attestation.mjs" scripts/
cp "$REPO_ROOT/scripts/lib/attestation.mjs"    scripts/lib/

printf 'export const a = 1;\n' > utils/a.ts
printf 'export const b = 2;\n' > utils/b.ts
printf 'legacy\n'              > utils/old.ts
git add -A >/dev/null
git commit -q -m "base"
git branch -f base HEAD

# The change under review: edit a.ts, add c.ts, delete old.ts.
printf 'export const a = 11;\n' > utils/a.ts
printf 'export const c = 3;\n'  > utils/c.ts
rm utils/old.ts
git add -A >/dev/null
git commit -q -m "the change"

cat > .apexyard/review/review.json <<'JSON'
{"verdict":"approved","files_reviewed":3,
 "findings":[{"severity":"low"},{"severity":"medium"},{"severity":"info"}],
 "summary":"fine"}
JSON

printf '\n== generate ==\n'
if node scripts/attest-review.mjs --base base --gate high --no-sign >/dev/null 2>&1; then
  ok "attest-review exits 0 on a clean review"
else
  bad "attest-review exits 0 on a clean review" "non-zero exit"
fi

if [ -f .apexyard/attestation ]; then ok "writes .apexyard/attestation"
else bad "writes .apexyard/attestation" "file absent"; fi

if grep -q '^deleted utils/old.ts$' .apexyard/attestation; then
  ok "records a deleted file as deleted"
else
  bad "records a deleted file as deleted" "$(grep old.ts .apexyard/attestation || echo 'no entry')"
fi

if grep -q "^$(git rev-parse HEAD:utils/c.ts) utils/c.ts$" .apexyard/attestation; then
  ok "records the real blob oid of an added file"
else
  bad "records the real blob oid of an added file" "oid mismatch"
fi

if ! grep -q '\.apexyard/attestation' .apexyard/attestation; then
  ok "excludes itself from its own scope"
else
  bad "excludes itself from its own scope" "self-reference present"
fi

cp .apexyard/attestation "$WORK/att.good"

printf '\n== verify: the honest case ==\n'
expect_verify "a matching attestation verifies" 0 "verified"

printf '\n== verify: accidental staleness (the real threat model) ==\n'

# 5. A reviewed file edited afterwards. The amend-after-review case.
printf 'export const a = 999;\n' > utils/a.ts
git add utils/a.ts >/dev/null && git commit -q -m "edit after review"
expect_verify "an edit after the review fails" 1 "changed after it was reviewed"
git reset -q --hard HEAD~1

# 6. A new file nobody reviewed. Caught by coverage, not by content binding.
printf 'export const sneaky = 1;\n' > utils/sneaky.ts
git add utils/sneaky.ts >/dev/null && git commit -q -m "add unreviewed file"
expect_verify "an unreviewed added file fails" 1 "never reviewed"
git reset -q --hard HEAD~1

# 7. A deleted file comes back.
printf 'legacy\n' > utils/old.ts
git add utils/old.ts >/dev/null && git commit -q -m "resurrect"
expect_verify "a resurrected file fails" 1 "attested as deleted but exists"
git reset -q --hard HEAD~1

printf '\n== verify: it survives history rewriting that preserves content ==\n'

# The reason for binding to blob OIDs instead of commit SHAs. A squash or an
# amended message rewrites every SHA while changing no content; invalidating
# the review there would train people to bypass the gate on every merge.
git commit -q --amend -m "the change, reworded"
expect_verify "a message-only amend still verifies" 0 "verified"

SQUASHED=$(git rev-parse HEAD)
git checkout -q base
git merge -q --squash "$SQUASHED" >/dev/null 2>&1
git commit -q -m "squashed"
cp "$WORK/att.good" .apexyard/attestation
expect_verify "a squash merge still verifies" 0 "verified"
git checkout -q "$SQUASHED"
cp "$WORK/att.good" .apexyard/attestation

printf '\n== verify: tampering ==\n'

sed 's/^gate high$/gate none/' "$WORK/att.good" > .apexyard/attestation
expect_verify "a hand-weakened gate fails the digest" 1 "digest does not match"

sed 's/^verdict APPROVED$/verdict TOTALLY_FINE/' "$WORK/att.good" > .apexyard/attestation
expect_verify "any hand edit fails the digest" 1 "digest does not match"

# A digest recomputed over a weakened body — the informed forgery. Caught by
# the gate check rather than the digest, which is why both exist.
node --input-type=module -e '
import { renderAttestation, parseAttestation } from "./scripts/lib/attestation.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const { fields } = parseAttestation(readFileSync(process.argv[1], "utf8"));
writeFileSync(".apexyard/attestation", renderAttestation({
  scope: fields.scope, head: fields.head, model: fields.model,
  gate: "none", verdict: "APPROVED",
  findings: fields.findings, files: fields.files,
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

rm -f .apexyard/attestation
expect_verify "a missing attestation fails" 1 "No review attestation"

cp "$WORK/att.good" .apexyard/attestation

printf '\n== verify: signatures ==\n'
if command -v ssh-keygen >/dev/null 2>&1; then
  ssh-keygen -q -t ed25519 -N '' -C signer@example.com -f "$WORK/key" >/dev/null 2>&1
  printf 'signer@example.com %s\n' "$(cat "$WORK/key.pub")" > .apexyard/allowed_signers

  expect_verify "registering a signer makes a missing signature fatal" 1 "produced without signing"

  ssh-keygen -Y sign -q -f "$WORK/key" -n apexyard-review .apexyard/attestation >/dev/null 2>&1
  expect_verify "a valid signature verifies" 0 "signature verified"

  # A signature over different content must not validate. Re-render with one
  # field changed and keep the old signature: the digest is internally
  # consistent, so only the signature can catch it.
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
  expect_verify "a signature over different content is rejected" 1 "did not verify"

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
