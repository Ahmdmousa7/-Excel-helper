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
#   attestation is intact      an edited field, or an id over other content, fails
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
for f in attestation.json review.json findings.json metrics.json \
         architecture.json dependency-report.json accessibility-report.json review-summary.md; do
  if [ -f ".apexyard/$f" ]; then ok "writes $f"; else bad "writes $f" "absent"; fi
done

# The retired text manifest must not come back. A stray writer would leave two
# attestations in the bundle again, which is the whole thing ADR-0004 removed —
# and nothing else in the suite would notice, because the verifier ignores it.
if [ -e .apexyard/attestation ]; then
  bad "does not write the retired text manifest" ".apexyard/attestation exists"
else
  ok "does not write the retired text manifest"
fi

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

# The id every artifact carries is the attestation's own digest, recomputed here
# from the attestation's content rather than read out of it — so this proves the
# derivation, not just that two fields happen to hold the same string.
if node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { attestationDigest } from './scripts/lib/attestation.mjs';
const att = JSON.parse(readFileSync('.apexyard/attestation.json', 'utf8'));
const id = JSON.parse(readFileSync('.apexyard/review.json', 'utf8')).attestation_id;
process.exit(attestationDigest(att) === id ? 0 : 1);
"; then ok "the attestation_id IS the digest of the attestation's content"
else bad "the attestation_id IS the digest of the attestation's content" "mismatch"; fi

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

printf '\n== rule: the attestation is intact ==\n'
# These three cases replaced two that checked a JSON mirror against a separate
# text manifest. There is one attestation now (ADR-0004), so what is left to
# check is that it agrees with ITSELF: its id is the digest of its own content.
patch_artifact attestation.json '
import { readFileSync, writeFileSync } from "node:fs";
const p = process.argv[1];
const a = JSON.parse(readFileSync(p, "utf8"));
a.attestation_id = "sha256:" + "c".repeat(64);
writeFileSync(p, JSON.stringify(Object.fromEntries(Object.entries(a).sort()), null, 2) + "\n");
'
expect "an id that is not the digest of the content fails" 1 "fresh digest of its content"
cp "$WORK/bundle.good/attestation.json" .apexyard/

# Dropping a file from the attested set is how an unreviewed change would be
# hidden from the coverage check. The digest is what catches it.
patch_artifact attestation.json '
import { readFileSync, writeFileSync } from "node:fs";
const p = process.argv[1];
const a = JSON.parse(readFileSync(p, "utf8"));
a.files = a.files.slice(0, 1);
writeFileSync(p, JSON.stringify(Object.fromEntries(Object.entries(a).sort()), null, 2) + "\n");
'
expect "a shortened file list fails" 1 "fresh digest of its content"
cp "$WORK/bundle.good/attestation.json" .apexyard/

# The informed forgery: recompute the id so it IS internally consistent, then let
# the gate arithmetic catch what the digest cannot. Both rules are load-bearing.
patch_artifact attestation.json '
import { readFileSync, writeFileSync } from "node:fs";
import { attestationDigest } from "./scripts/lib/attestation.mjs";
import { canonicalJson } from "./scripts/lib/evidence.mjs";
const p = process.argv[1];
const a = JSON.parse(readFileSync(p, "utf8"));
a.gate = "none";
delete a.attestation_id;
writeFileSync(p, canonicalJson({ ...a, attestation_id: attestationDigest(a) }));
'
expect "a re-digested but weakened gate still fails" 1 "weaker than the required high"
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
# no bundle path is inside the attested set and (b) verification still passes. If
# a future change reintroduces a local exclusion list in either script, this fails.
node scripts/attest-review.mjs --base base --gate high --no-sign >/dev/null 2>&1
node scripts/evidence.mjs >/dev/null 2>&1

bundle_paths=$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const a = JSON.parse(readFileSync(".apexyard/attestation.json", "utf8"));
  process.stdout.write(a.files.map((f) => f.path).filter((p) => p.startsWith(".apexyard/")).join(" "));
')
if [ -n "$bundle_paths" ]; then
  bad "the generator excludes the bundle from the attested scope" "$bundle_paths"
else
  ok "the generator excludes the bundle from the attested scope"
fi

expect "re-attesting with the bundle committed still verifies (a fixed point exists)" 0 "verified"

# And the fixed point is stable: a further round changes nothing.
node scripts/attest-review.mjs --base base --gate high --no-sign >/dev/null 2>&1
node scripts/evidence.mjs >/dev/null 2>&1
expect "the fixed point is stable across a second round" 0 "verified"

printf '\n== rule: the bundle is not fed into the review ==\n'
# The THIRD place the bundle-exclusion rule applies, after the attested scope
# and the coverage check. Reviewing the bundle is a loop that cannot converge:
# a round that finds a High writes an attestation recording that failure, the
# next round reads the committed attestation and reports "this records a failing
# review" as a High of its own. That happened for two consecutive rounds.
#
# review-local.sh does the filtering with a literal grep rather than shelling
# into node, so this exercises the expression on a fixture instead of trusting it.
FILTER_DIR=.apexyard
printf '%s\n' \
  'components/App.tsx' \
  '.apexyard' \
  '.apexyard/attestation.json' \
  '.apexyard/review.json' \
  '.apexyard-old/attestation.json' \
  'scripts/evidence.mjs' > "$WORK/paths.txt"
kept=$(grep -v -e "^${FILTER_DIR}\$" -e "^${FILTER_DIR}/" "$WORK/paths.txt" | tr '\n' ' ')
expected='components/App.tsx .apexyard-old/attestation.json scripts/evidence.mjs '
if [ "$kept" = "$expected" ]; then
  ok "the review's input filter drops the bundle and keeps everything else"
else
  bad "the review's input filter drops the bundle and keeps everything else" "got: $kept"
fi

if grep -q 'grep -v -e "\^\${BUNDLE_DIR}\\\$" -e "\^\${BUNDLE_DIR}/"' "$REPO_ROOT/scripts/review-local.sh"; then
  ok "review-local.sh still applies that filter"
else
  bad "review-local.sh still applies that filter" "the filter was removed or rewritten"
fi

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
