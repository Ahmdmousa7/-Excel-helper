#!/usr/bin/env bash
#
# test-evidence.sh — end-to-end tests for the evidence bundle verifier.
#
# The vitest suite covers the pure rules. This drives `evidence.mjs` and
# `verify-evidence.mjs` against real git repositories and real files on disk, so
# every verification rule has a regression test that exercises the actual
# failure a maintainer would hit.
#
# One case per rule, named after the rule:
#
#   artifacts exist            a deleted artifact fails
#   attestation matches        a mirror with a different digest or file set fails
#   files match repo state     an edit after review fails; an unreviewed add fails
#   no artifact is stale       an artifact bound to a different attestation fails
#   reproducible              a hand-edited or reformatted artifact fails
#   internally consistent      review.json and findings.json must agree
#
# Usage: bash scripts/tests/test-evidence.sh

set -uo pipefail

REPO_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
PASS=0; FAIL=0

ok()  { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  FAIL %s\n       %s\n' "$1" "${2:-}"; }

# Assert the verifier's exit code, and that its output mentions $3.
expect() {
  local label="$1" want="$2" needle="${3:-}" out rc
  out=$(node "$REPO_ROOT/scripts/verify-evidence.mjs" --base base 2>&1); rc=$?
  if [ "$rc" -ne "$want" ]; then bad "$label" "expected exit $want, got $rc"; return; fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qi -- "$needle"; then
    bad "$label" "output did not mention '$needle'"; return
  fi
  ok "$label"
}

# Rewrite one artifact through node, so edits stay valid JSON where intended.
patch_artifact() {
  node --input-type=module -e "$2" ".apexyard/$1"
}

WORK=$(mktemp -d 2>/dev/null || mktemp -d -t evidence)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK" || exit 1

# ---------------------------------------------------------------------------
# A throwaway repo with a reviewed change and a full bundle
# ---------------------------------------------------------------------------
git init -q .
git config user.email t@example.com
git config user.name Tester
git config commit.gpgsign false

mkdir -p utils components scripts/lib .apexyard/review
for f in attest-review.mjs verify-evidence.mjs evidence.mjs; do
  cp "$REPO_ROOT/scripts/$f" scripts/
done
cp "$REPO_ROOT/scripts/lib/attestation.mjs" "$REPO_ROOT/scripts/lib/evidence.mjs" \
   "$REPO_ROOT/scripts/lib/collectors.mjs" scripts/lib/
printf '{"name":"fixture","version":"1.0.0","dependencies":{},"devDependencies":{}}\n' > package.json

printf 'export const a = 1;\n' > utils/a.ts
git add -A >/dev/null && git commit -q -m base && git branch -f base HEAD

printf 'export const a = 2;\n' > utils/a.ts
printf 'export const B = () => null;\n' > components/B.tsx
git add -A >/dev/null && git commit -q -m "the change"

cat > .apexyard/review/review.json <<'JSON'
{"verdict":"approved","files_reviewed":2,
 "findings":[{"severity":"low","category":"code-smell","file":"utils/a.ts","line":1,
              "summary":"nit","detail":"d","suggested_fix":"f"},
             {"severity":"medium","category":"technical-debt","file":"components/B.tsx",
              "line":1,"summary":"td"}],
 "summary":"looks fine"}
JSON

node scripts/attest-review.mjs --base base --gate high --no-sign >/dev/null 2>&1
node scripts/evidence.mjs >/dev/null 2>&1

printf '\n== the bundle generates ==\n'
for f in attestation attestation.json review.json findings.json metrics.json \
         architecture.json dependency-report.json accessibility-report.json review-summary.md; do
  if [ -f ".apexyard/$f" ]; then ok "writes $f"; else bad "writes $f" "absent"; fi
done

ID=$(node -e "console.log(require('./.apexyard/review.json').attestation_id)")
if node -e "
const fs=require('fs');
const id=require('./.apexyard/review.json').attestation_id;
const names=['attestation.json','findings.json','metrics.json','architecture.json','dependency-report.json','accessibility-report.json'];
for (const n of names) {
  const a=JSON.parse(fs.readFileSync('.apexyard/'+n,'utf8'));
  if (a.attestation_id !== id) { console.error(n+' differs'); process.exit(1); }
}
"; then ok "every artifact carries the same attestation_id"
else bad "every artifact carries the same attestation_id" "ids differ"; fi

if node -e "
const t=require('fs').readFileSync('.apexyard/attestation','utf8');
const d=t.split('\n').find(l=>l.startsWith('digest ')).slice(7);
const id=require('./.apexyard/review.json').attestation_id;
process.exit(d===id?0:1);
"; then ok "the attestation_id IS the manifest digest"
else bad "the attestation_id IS the manifest digest" "mismatch"; fi

cp -r .apexyard "$WORK/bundle.good"

printf '\n== rule: reproducible ==\n'
if node scripts/evidence.mjs --check >/dev/null 2>&1; then
  ok "--check confirms the bundle reproduces byte for byte"
else
  bad "--check confirms the bundle reproduces byte for byte" "regeneration differed"
fi

# Regenerating over identical inputs must produce identical bytes.
before=$(node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('.apexyard/architecture.json')).digest('hex'))")
node scripts/evidence.mjs >/dev/null 2>&1
after=$(node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('.apexyard/architecture.json')).digest('hex'))")
if [ "$before" = "$after" ]; then ok "a second generation is byte-identical"
else bad "a second generation is byte-identical" "digest changed"; fi

if ! grep -qiE '"[a-z_]*(timestamp|duration|generated_at|elapsed)[a-z_]*"' .apexyard/*.json; then
  ok "no artifact contains a timestamp-shaped key"
else
  bad "no artifact contains a timestamp-shaped key" "$(grep -oiE '"[a-z_]*(timestamp|duration|generated_at)[a-z_]*"' .apexyard/*.json | head -3)"
fi

printf '\n== rule: the honest case verifies ==\n'
expect "a complete, fresh bundle verifies" 0 "verified"

printf '\n== rule: artifacts exist ==\n'
rm .apexyard/metrics.json
expect "a missing artifact fails" 1 "metrics.json is missing"
cp "$WORK/bundle.good/metrics.json" .apexyard/

rm .apexyard/review-summary.md
expect "a missing human-readable summary fails" 1 "review-summary.md is missing"
cp "$WORK/bundle.good/review-summary.md" .apexyard/

printf '\n== rule: no artifact is stale ==\n'
patch_artifact metrics.json '
import { readFileSync, writeFileSync } from "node:fs";
const p = process.argv[1];
const a = JSON.parse(readFileSync(p, "utf8"));
a.attestation_id = "sha256:" + "b".repeat(64);
writeFileSync(p, JSON.stringify(Object.fromEntries(Object.entries(a).sort()), null, 2) + "\n");
'
expect "an artifact bound to a different attestation is STALE" 1 "is STALE"
cp "$WORK/bundle.good/metrics.json" .apexyard/

printf '\n== rule: reproducible (tamper) ==\n'
# Reformatting alone is enough: canonical form is part of the contract.
node -e "
const fs=require('fs');
const a=JSON.parse(fs.readFileSync('.apexyard/architecture.json','utf8'));
fs.writeFileSync('.apexyard/architecture.json', JSON.stringify(a,null,4)+'\n');
"
expect "a reformatted artifact fails the canonical check" 1 "canonical form"
cp "$WORK/bundle.good/architecture.json" .apexyard/

printf '\n== rule: attestation matches reviewed files ==\n'
patch_artifact attestation.json '
import { readFileSync, writeFileSync } from "node:fs";
const p = process.argv[1];
const a = JSON.parse(readFileSync(p, "utf8"));
a.digest = "sha256:" + "c".repeat(64);
writeFileSync(p, JSON.stringify(Object.fromEntries(Object.entries(a).sort()), null, 2) + "\n");
'
expect "a mirror whose digest disagrees with the manifest fails" 1 "records digest"
cp "$WORK/bundle.good/attestation.json" .apexyard/

patch_artifact attestation.json '
import { readFileSync, writeFileSync } from "node:fs";
const p = process.argv[1];
const a = JSON.parse(readFileSync(p, "utf8"));
a.files = a.files.slice(0, 1);
a.file_count = 1;
writeFileSync(p, JSON.stringify(Object.fromEntries(Object.entries(a).sort()), null, 2) + "\n");
'
expect "a mirror listing a different file set fails" 1 "different file set"
cp "$WORK/bundle.good/attestation.json" .apexyard/

printf '\n== rule: internally consistent ==\n'
patch_artifact review.json '
import { readFileSync, writeFileSync } from "node:fs";
const p = process.argv[1];
const a = JSON.parse(readFileSync(p, "utf8"));
a.findings_total = 99;
writeFileSync(p, JSON.stringify(Object.fromEntries(Object.entries(a).sort()), null, 2) + "\n");
'
expect "review.json and findings.json disagreeing on totals fails" 1 "one was regenerated without the other"
cp "$WORK/bundle.good/review.json" .apexyard/

# Laundering the counts in review.json while the signed manifest says otherwise.
patch_artifact review.json '
import { readFileSync, writeFileSync } from "node:fs";
const p = process.argv[1];
const a = JSON.parse(readFileSync(p, "utf8"));
a.findings_by_severity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
a.findings_total = 0;
writeFileSync(p, JSON.stringify(Object.fromEntries(Object.entries(a).sort()), null, 2) + "\n");
'
expect "counts contradicting the signed manifest fails" 1 "the attestation records"
cp "$WORK/bundle.good/review.json" .apexyard/

printf '\n== rule: reviewed files match repository state ==\n'
printf 'export const a = 999;\n' > utils/a.ts
git add utils/a.ts >/dev/null && git commit -q -m "edit after review"
expect "an edit after the review fails" 1 "changed after it was reviewed"
git reset -q --hard HEAD~1

printf 'export const sneaky = 1;\n' > utils/sneaky.ts
git add utils/sneaky.ts >/dev/null && git commit -q -m "add unreviewed file"
expect "an unreviewed added file fails" 1 "never reviewed"
git reset -q --hard HEAD~1

printf '\n== rule: the bundle is never self-attested ==\n'
# The bundle is generated FROM the review, so requiring it to be reviewed would
# be circular. Committing it must not itself trip the coverage check.
git add .apexyard >/dev/null 2>&1
git -c user.email=t@t -c user.name=t commit -q -m "commit the bundle"
expect "committing the bundle does not trip the coverage check" 0 "verified"

# THE FIXED POINT. This is the case that was missing, and its absence cost two
# High findings across two review rounds.
#
# The old test above only proved the VERIFIER ignored the bundle in its coverage
# check. It said nothing about whether the GENERATOR recorded the bundle's own
# artifacts in the attested scope — and it did, so their OIDs were stale the
# instant `evidence.mjs` rewrote them (which it does on every run, because their
# attestation_id tracks the digest). Coverage looked fine; content binding could
# never pass. There was no state of the repository in which CI was green.
#
# So: with the bundle committed, re-attest and re-generate, and assert that (a)
# no bundle path is inside the manifest and (b) verification still passes. If a
# future change reintroduces a local exclusion list in either script, this fails.
node scripts/attest-review.mjs --base base --gate high --no-sign >/dev/null 2>&1
node scripts/evidence.mjs >/dev/null 2>&1

if grep -qE ' \.apexyard/' .apexyard/attestation; then
  bad "the generator excludes the bundle from the attested scope" \
      "$(grep -E ' \.apexyard/' .apexyard/attestation | head -3 | tr '\n' ' ')"
else
  ok "the generator excludes the bundle from the attested scope"
fi

expect "re-attesting with the bundle committed still verifies (a fixed point exists)" 0 "verified"

# And the fixed point is stable: a further round changes nothing.
node scripts/attest-review.mjs --base base --gate high --no-sign >/dev/null 2>&1
node scripts/evidence.mjs >/dev/null 2>&1
expect "the fixed point is stable across a second round" 0 "verified"

printf '\n== rule: history rewriting that preserves content ==\n'
git commit -q --amend -m "commit the bundle, reworded"
expect "a message-only amend still verifies" 0 "verified"

printf '\n== not-run is never reported as passing ==\n'
if node -e "
const m=require('./.apexyard/metrics.json');
const notRun=Object.entries(m).filter(([k,v])=>v&&typeof v==='object'&&v.available===false);
if(notRun.length===0){console.error('expected some sections to be unavailable in the fixture');process.exit(1);}
for(const [k,v] of notRun){
  if('passed' in v){console.error(k+' reports passed while unavailable');process.exit(1);}
  if(typeof v.reason!=='string'||!v.reason){console.error(k+' has no reason');process.exit(1);}
}
"; then ok "unavailable sections carry a reason and never a passed flag"
else bad "unavailable sections carry a reason and never a passed flag" "see above"; fi

printf '\n== results ==\n'
printf '  %s passed, %s failed\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
