#!/usr/bin/env bash
#
# review-local.sh — run the ApexYard AI code review on THIS machine.
#
# Policy: Anthropic credentials never leave the maintainer's machine. They are
# not in GitHub Secrets, not in Actions, not in a Docker image, not in any
# committed env file. The AI review therefore runs here, before a push, and CI
# verifies everything that does not need a model.
#
# That split is deliberate and it has a cost worth naming: CI cannot prove the
# review happened. Nothing in the pipeline enforces it. This script exists to
# make the honest path the easy one — one command, same inputs the CI action
# would have used, same severity gate.
#
# Usage:
#   npm run review:local              # review uncommitted work against HEAD
#   npm run review:local -- --staged  # review only what is staged
#   npm run review:local -- --base main
#
# Exit codes mirror the bridge:
#   0  clean, or only findings below the gate
#   1  findings at or above --fail-on   (default: high)
#   3  the reviewer could not run       (never read this as "clean")

set -euo pipefail

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
OPS_ROOT=${APEXYARD_OPS_ROOT:-"$(CDPATH='' cd -- "$PROJECT_ROOT/.." && pwd)/apexyard"}
FAIL_ON=${APEXYARD_FAIL_ON:-high}
MODEL=${APEXYARD_MODEL:-claude-opus-5}
BASE=""
MODE="working"

# `set -u` turns a missing option argument into an unbound-variable abort with
# no useful message, so check arity before reading $2.
need_arg() {
  [ $# -ge 2 ] || { printf 'review-local: %s requires a value\n' "$1" >&2; exit 2; }
}

while [ $# -gt 0 ]; do
  case "$1" in
    --staged)     MODE="staged"; shift ;;
    --base)       need_arg "$@"; BASE="$2"; MODE="range"; shift 2 ;;
    --fail-on)    need_arg "$@"; FAIL_ON="$2"; shift 2 ;;
    --ops-root)   need_arg "$@"; OPS_ROOT="$2"; shift 2 ;;
    # Print only the contiguous comment header, so the range can never drift
    # onto code the way a hardcoded line number did.
    -h|--help)    sed -n '2,/^[^#]/p' "$0" | sed -e '/^[^#]/d' -e 's/^# \{0,1\}//'; exit 0 ;;
    *)            printf 'review-local: unknown option %s\n' "$1" >&2; exit 2 ;;
  esac
done

RUNNER="$OPS_ROOT/bin/apexyard-review-ci.sh"
if [ ! -x "$RUNNER" ] && [ ! -f "$RUNNER" ]; then
  printf 'review-local: ApexYard ops fork not found at %s\n' "$OPS_ROOT" >&2
  printf '  Clone it next to this repo, or set APEXYARD_OPS_ROOT.\n' >&2
  printf '    git clone https://github.com/Ahmdmousa7/apexyard\n' >&2
  exit 3
fi

# jq is a hard dependency of the bridge: it parses the model's JSON and drives
# the severity gate. Without it the bridge exits 3 with a less obvious message,
# so say it plainly here instead.
command -v jq >/dev/null 2>&1 || {
  printf 'review-local: jq is not on PATH — the review cannot parse its result.\n' >&2
  printf '  winget install jqlang.jq\n' >&2
  exit 3
}

cd "$PROJECT_ROOT"

# Derive the slug from the origin remote rather than hardcoding it — the
# report links break silently on a fork or a rename otherwise. Only used for
# link generation in the report, so an empty value is harmless.
# `|| true` matters: under `set -e`, a failing command substitution in an
# assignment aborts the script. Without it, a clone with no `origin` remote
# would kill the review over a value used only for report hyperlinks.
REPO_SLUG=${APEXYARD_REPO_SLUG:-$(
  git remote get-url origin 2>/dev/null \
    | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##' || true
)}

CHANGED=$(mktemp)
trap 'rm -f "$CHANGED"' EXIT

case "$MODE" in
  staged)  git diff --name-only --diff-filter=ACMR --cached > "$CHANGED" ;;
  range)
    # An unknown --base makes git exit 128 with "unknown revision", which
    # would propagate out of this script and break the documented 0/1/3
    # contract. Resolve it first and report it as an environment error.
    git rev-parse --verify --quiet "$BASE" >/dev/null \
      || { printf 'review-local: cannot resolve --base %s\n' "$BASE" >&2
           printf '  Fetch it first, or pass a ref that exists locally.\n' >&2
           exit 3; }
    git diff --name-only --diff-filter=ACMR "$BASE"...HEAD > "$CHANGED" ;;
  working) { git diff --name-only --diff-filter=ACMR HEAD
             git ls-files --others --exclude-standard; } | sort -u > "$CHANGED" ;;
esac

# Drop the evidence bundle from the review's input.
#
# The bundle is generated FROM the review, and reviewing it creates a loop that
# cannot converge: any round that finds a High writes an attestation recording
# that failure, the next round reads the committed attestation, correctly
# reports "this bundle records a failing review" as a High of its own, and the
# gate is red forever. Observed exactly that for two rounds.
#
# It is also just not code. There is nothing for a reviewer to say about a
# canonical JSON file of counts and content hashes that a schema check does not
# already say better.
#
# Third place this same rule applies — the others are the attested scope and the
# coverage check, both via isBundlePath(). Kept as a literal here rather than
# shelling into node for one grep; the test below pins them together.
BUNDLE_DIR=${APEXYARD_BUNDLE_DIR:-.apexyard}
grep -v -e "^${BUNDLE_DIR}\$" -e "^${BUNDLE_DIR}/" "$CHANGED" > "$CHANGED.filtered" || true
mv "$CHANGED.filtered" "$CHANGED"

COUNT=$(grep -c . < "$CHANGED" || true)
if [ "$COUNT" -eq 0 ]; then
  # Exit 3, not 0. "I looked at nothing" is not "I found nothing wrong", and
  # the caller cannot tell them apart from an exit code alone. Exit 3 already
  # means "the reviewer could not run", which is exactly the situation.
  printf 'review-local: no files in scope (%s) — this is NOT a completed review.\n' "$MODE" >&2
  if [ "$MODE" = "working" ]; then
    printf '  The working tree is clean. To review what you are about to push:\n' >&2
    printf '    npm run review:local -- --base origin/main\n' >&2
  fi
  exit 3
fi

printf 'review-local: %s changed file(s), gate=%s, ops=%s\n' "$COUNT" "$FAIL_ON" "$OPS_ROOT"

set +e
bash "$RUNNER" \
  --changed-files "$CHANGED" \
  --project-root  "$PROJECT_ROOT" \
  --ops-root      "$OPS_ROOT" \
  --repo          "$REPO_SLUG" \
  --out           "$PROJECT_ROOT/.apexyard/review" \
  --fail-on       "$FAIL_ON" \
  --model         "$MODEL"
RC=$?
set -e

# ---------------------------------------------------------------------------
# Record what was reviewed, so CI can check it
# ---------------------------------------------------------------------------
# Only in range mode. The attestation binds to git blob OIDs at HEAD, and in
# `working` or `staged` mode the reviewed content is not committed yet — there
# would be no OID for CI to compare against.
#
# Written on exit 0 AND exit 1 (findings at or above the gate), because the
# attestation reports what the review found; CI decides whether that is
# acceptable. NOT written on exit 3 — a reviewer that could not run has
# nothing to attest, and an attestation is the one thing that must never be
# produced speculatively.
if [ "$MODE" = "range" ] && { [ "$RC" -eq 0 ] || [ "$RC" -eq 1 ]; }; then
  if ! node "$PROJECT_ROOT/scripts/attest-review.mjs" \
        --base "$BASE" --gate "$FAIL_ON" --model "$MODEL" \
        --review-json "$PROJECT_ROOT/.apexyard/review/review.json"; then
    printf '\nreview-local: the review ran but the attestation could not be written.\n' >&2
    printf '  CI will reject the push without one. Treating as a failure.\n' >&2
    exit 3
  fi
fi

case "$RC" in
  0) printf '\nreview-local: clean at the %s gate.\n' "$FAIL_ON" ;;
  1) printf '\nreview-local: findings at or above %s — see .apexyard/review/review.md\n' "$FAIL_ON" >&2 ;;
  3) printf '\nreview-local: the reviewer could not run. This is NOT a clean review.\n' >&2 ;;
  # Anything else is a code the documented 0/1/3 contract does not cover — a
  # signal, or a bug in the runner. Say so and normalise to 3, so a caller
  # reading only the contract can never mistake an unknown state for clean.
  *) printf '\nreview-local: runner exited %s, which is outside the documented\n' "$RC" >&2
     printf '  0/1/3 contract. Treating as "could not run".\n' >&2
     RC=3 ;;
esac
exit "$RC"
