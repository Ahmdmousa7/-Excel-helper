#!/usr/bin/env bash
#
# verify-local.sh — the complete pre-push gate, run on this machine.
#
# Order matters and follows the maintainer's policy: the AI review comes
# FIRST, because fixing what it finds changes the code that everything after
# it has to check. Running Playwright before the review just means running it
# twice.
#
#   1. ApexYard AI review     (local Claude CLI — never in CI)
#   2. TypeScript
#   3. ESLint
#   4. Vitest
#   5. Playwright
#   6. Dependency audit       (production deps)
#   7. Secret scan
#   8. Build
#   9. Bundle budget
#
# Every stage runs even if an earlier one fails, so one pass gives the whole
# picture rather than one error at a time. The exit code is non-zero if any
# stage failed.
#
# Usage:
#   npm run verify:local
#   npm run verify:local -- --skip-review     # gates only, review already done
#   npm run verify:local -- --skip-e2e        # fast loop; NOT valid before a push

set -uo pipefail

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

SKIP_REVIEW=0
SKIP_E2E=0
NOTHING_TO_PUSH=0
ALREADY_ATTESTED=0
REVIEW_QUALIFIED=""
# Declared here so the attestation self-check below can reference it under
# `set -u` even on the paths where the review stage never assigns it.
BASE=""
for a in "$@"; do
  case "$a" in
    --skip-review) SKIP_REVIEW=1 ;;
    --skip-e2e)    SKIP_E2E=1 ;;
  esac
done

RESULTS=()
FAILED=0

run_stage() {
  local label="$1"; shift
  printf '\n\033[1m=== %s ===\033[0m\n' "$label"
  if "$@"; then
    RESULTS+=("PASS|$label")
  else
    local rc=$?
    RESULTS+=("FAIL($rc)|$label")
    FAILED=1
  fi
}

skip_stage() {
  RESULTS+=("SKIP|$1")
  printf '\n\033[2m=== %s (skipped) ===\033[0m\n' "$1"
}

# ---------------------------------------------------------------------------
# 1. The AI review, first — its findings change what the rest of this checks.
# ---------------------------------------------------------------------------
if [ "$SKIP_REVIEW" -eq 1 ]; then
  skip_stage "1. ApexYard AI review"
else
  # Review the range about to be PUSHED, not the working tree.
  #
  # Reviewing the working tree looks equivalent and is not: commit, then run
  # this before pushing, and the tree is clean — the review would have seen
  # zero files and reported PASS. The one control this whole setup rests on
  # would have been green having read nothing. Anchor on the upstream branch
  # (or origin/main when there is no upstream yet) so the scope is exactly
  # what the push will publish.
  #
  # A dirty tree is REPORTED, not refused.
  #
  # This was briefly a hard failure, on the reasoning that a PASS would cover
  # code nobody reviewed. That reasoning was wrong. The claim this script
  # makes is "safe to push", and uncommitted work is not being pushed — it is
  # outside the claim by definition. Worse, the refusal fired in the most
  # ordinary flow there is: the pre-push hook runs *after* committing, so a
  # single stray scratch file would block every push. A gate that blocks
  # routine work gets switched off, and then it guards nothing.
  #
  # So name precisely what is excluded, and continue.
  #
  # No `!!` filter: those lines only appear with --ignored, which is not
  # passed. Filtering for them suggested ignored files were a concern here.
  DIRTY=$(git status --porcelain --untracked-files=normal)
  if [ -n "$DIRTY" ]; then
    DIRTY_COUNT=$(printf '%s\n' "$DIRTY" | grep -c . || true)
    printf '\n\033[33mnote: %s uncommitted change(s) are NOT in this review —\033[0m\n' "$DIRTY_COUNT"
    printf '\033[33m      they are not being pushed. To review them: npm run review:local\033[0m\n'
  fi

  {
    BASE=${REVIEW_BASE:-$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo origin/main)}

    # An empty push range means there is nothing to push, which is not a
    # failed review — reporting FAIL(3) and "Do not push" there would be
    # nonsense advice about an action the maintainer is not taking.
    #
    # The emptiness test must NOT use --diff-filter=ACMR. That filter drops
    # deletions, so a commit that only removes files looks like an empty
    # range: the review gets skipped and the run prints a green all-clear for
    # a push that does change the repository. Test the unfiltered range here;
    # review-local.sh keeps ACMR for the file list it sends, correctly, since
    # a deleted file has no content to review.
    if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
      run_stage "1. ApexYard AI review (vs $BASE)" bash scripts/review-local.sh --base "$BASE"
    elif [ -z "$(git diff --name-only "$BASE"...HEAD)" ]; then
      skip_stage "1. ApexYard AI review (nothing to push vs $BASE)"
      NOTHING_TO_PUSH=1
    elif [ -z "$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD)" ]; then
      # Real changes, but every one is a deletion. There is nothing for the
      # reviewer to read, and that is a fact to state rather than a pass.
      printf '\n\033[33m=== 1. ApexYard AI review — deletions only ===\033[0m\n'
      git diff --name-only --diff-filter=D "$BASE"...HEAD | sed 's/^/  deleted: /'
      printf 'No file content to review. Confirm nothing still imports these.\n'
      RESULTS+=("SKIP|1. ApexYard AI review (deletions only)")
      REVIEW_QUALIFIED="the push is deletions only, so no code was AI-reviewed"
    elif node scripts/verify-evidence.mjs --base "$BASE" --require-gate high >/dev/null 2>&1; then
      # Already attested for exactly this content.
      #
      # Without this, the pre-push hook would re-review on every push — a
      # multi-minute model call to re-derive an answer already on disk, and it
      # would rewrite the attestation and leave the tree dirty every time. The
      # check is safe precisely because it is the same verification CI runs: it
      # only passes when every reviewed file still has the blob it was reviewed
      # at, and nothing uncovered changed.
      skip_stage "1. ApexYard AI review (already attested for this content)"
      # Do not regenerate the bundle either.
      #
      # The committed bundle is already correct for this content — that is what
      # the check above just proved, and why the review was skipped. Regenerating
      # would rebuild it from `.apexyard/review/`, which is gitignored and
      # therefore absent on a fresh clone: the collectors would return
      # `available: false` and a good bundle would be replaced by an emptier one.
      # Nothing would fail; the evidence would just quietly get worse.
      ALREADY_ATTESTED=1
    else
      run_stage "1. ApexYard AI review (vs $BASE)" bash scripts/review-local.sh --base "$BASE"
    fi
  }
fi

# Raw tool output lands here for the evidence collectors to normalise. It is
# gitignored: it is unnormalised, tool-specific, and full of durations and
# absolute paths. Only the normalised bundle is committed.
RAW=".apexyard/raw"
mkdir -p "$RAW"

# Each stage below both gates AND captures. Capturing separately would mean
# running every tool twice, and the second run could disagree with the first —
# so the evidence is a record of the run that actually gated, not a re-run.
typecheck_and_capture() {
  npm run typecheck --silent > "$RAW/typescript.txt" 2>&1
  local rc=$?
  [ "$rc" -eq 0 ] || cat "$RAW/typescript.txt"
  return "$rc"
}
lint_and_capture() {
  # -f json to a file, and a second human-readable pass only on failure. eslint
  # exits non-zero on errors; `|| true` on the json write would hide that, so
  # the exit code is taken from a `--quiet` run over the same tree.
  npx eslint . -f json -o "$RAW/eslint.json" >/dev/null 2>&1 || true
  npm run lint --silent
}
vitest_and_capture() {
  npx vitest run --coverage --reporter=json --outputFile="$RAW/vitest.json" 2>&1 \
    | tail -20
  return "${PIPESTATUS[0]}"
}
e2e_and_capture() {
  npx playwright test --reporter=json > "$RAW/playwright.json" 2>"$RAW/playwright.err"
  local rc=$?
  [ "$rc" -eq 0 ] || tail -30 "$RAW/playwright.err"
  return "$rc"
}
audit_and_capture() {
  npm audit --omit=dev --json > "$RAW/audit.json" 2>/dev/null || true
  npm audit --omit=dev --audit-level=high
}
budget_and_capture() {
  node scripts/check-bundle-budget.mjs --json > "$RAW/bundle.json" 2>/dev/null || true
  node scripts/check-bundle-budget.mjs
}

run_stage "2. TypeScript"        typecheck_and_capture
run_stage "3. ESLint"            lint_and_capture
# --coverage, matching CI. Without it the v8 coverage thresholds never run
# locally, so the gate would pass here and fail remotely on the one check the
# local run exists to pre-empt.
run_stage "4. Vitest + coverage"  vitest_and_capture

if [ "$SKIP_E2E" -eq 1 ]; then
  skip_stage "5. Playwright"
else
  run_stage "5. Playwright"      e2e_and_capture
fi

# --omit=dev: a devDependency CVE cannot reach a user of a static site. Gating
# on it would make the audit permanently red for no user-facing risk, which is
# how audit gates get disabled. Devtool CVEs are tracked as TD-020 instead.
run_stage "6. Dependency audit"  audit_and_capture
run_stage "7. Secret scan"       bash scripts/scan-secrets.sh
run_stage "8. Build"             npm run build --silent
run_stage "9. Bundle budget"     budget_and_capture

# 10. Verify the attestation the review just wrote, using the same code CI will
#     run. Catching a mismatch here means the answer arrives in seconds rather
#     than after a push, a wait, and a red check.
#
#     Skipped when the review was skipped: there would be no attestation for
#     this range, and reporting that as a failure would be noise about a stage
#     that deliberately did not run.
if [ "$ALREADY_ATTESTED" -eq 1 ]; then
  skip_stage "10. Evidence bundle (committed bundle already verifies)"
  run_stage "11. Evidence self-check" \
    node scripts/verify-evidence.mjs --base "$BASE" --require-gate high
elif [ "$SKIP_REVIEW" -eq 1 ] || [ "$NOTHING_TO_PUSH" -eq 1 ] || [ -n "$REVIEW_QUALIFIED" ]; then
  skip_stage "10. Evidence bundle"
  skip_stage "11. Evidence self-check"
else
  # 10. Assemble the bundle from the attestation plus the raw output the stages
  #     above just captured. It runs after every gate so the recorded metrics
  #     describe the run that actually gated, not a re-run that might disagree.
  run_stage "10. Evidence bundle"     node scripts/evidence.mjs

  # 11. Verify it with the same code CI runs, then prove it reproduces. The
  #     --check pass regenerates in memory and compares byte for byte, which is
  #     how determinism gets demonstrated rather than asserted.
  run_stage "11. Evidence self-check" \
    sh -c 'node scripts/verify-evidence.mjs --base "$1" --require-gate high >/dev/null \
           && node scripts/evidence.mjs --check' _ "$BASE"
fi

# ---------------------------------------------------------------------------
printf '\n\033[1m=== local gate summary ===\033[0m\n'
for r in "${RESULTS[@]}"; do
  status="${r%%|*}"; label="${r#*|}"
  case "$status" in
    PASS) printf '  \033[32mPASS\033[0m  %s\n' "$label" ;;
    SKIP) printf '  \033[2mSKIP\033[0m  %s\n' "$label" ;;
    *)    printf '  \033[31m%s\033[0m  %s\n' "$status" "$label" ;;
  esac
done

if [ "$FAILED" -eq 1 ]; then
  printf '\n\033[31mLocal gates failed. Do not push.\033[0m\n'
  exit 1
fi

# Order matters: a skipped stage invalidates the run regardless of whether
# there is anything to push. Checking nothing-to-push first would return 0
# from `--skip-e2e` runs on an already-pushed HEAD.
if [ "$SKIP_REVIEW" -eq 1 ] || [ "$SKIP_E2E" -eq 1 ]; then
  # Exit non-zero. Printing "this is not a valid pre-push state" and then
  # returning success invites exactly the mistake the message warns about —
  # any `npm run verify:local -- --skip-e2e && git push` would sail through.
  printf '\n\033[33mStages were skipped, so this is NOT a valid pre-push state.\033[0m\n'
  printf '\033[33mRun the full gate before pushing: npm run verify:local\033[0m\n'
  exit 2
fi

if [ "$NOTHING_TO_PUSH" -eq 1 ]; then
  printf '\n\033[32mAll gates passed. Nothing to push — HEAD already matches upstream.\033[0m\n'
  exit 0
fi

if [ -n "$REVIEW_QUALIFIED" ]; then
  printf '\n\033[32mAll local gates passed — but %s.\033[0m\n' "$REVIEW_QUALIFIED"
  exit 0
fi

printf '\n\033[32mAll local gates passed. Safe to commit and push.\033[0m\n'
