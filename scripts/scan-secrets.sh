#!/usr/bin/env bash
#
# scan-secrets.sh — local secret scan, matching what CI enforces.
#
# CI runs TruffleHog with --results=verified. This is the local equivalent:
# it uses TruffleHog too when it is installed, and otherwise falls back to a
# pattern sweep over tracked files. The fallback is weaker — it cannot verify
# a credential is live, so it reports rather than gates on generic matches —
# but it catches the cases that actually happen: a key pasted into a source
# file, a committed env file, a token in a config.
#
# Hard failures (exit 1):
#   - a tracked .env file that is not .env.example
#   - a high-confidence provider key pattern in a tracked file
#
# The Anthropic-key pattern is in that list on purpose. This project's policy
# is that the key never leaves the maintainer's machine; a scan that would not
# notice it being committed is not enforcing that policy.

set -uo pipefail

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

FAIL=0

# ---------------------------------------------------------------------------
# 1. Committed env files
# ---------------------------------------------------------------------------
env_files=$(git ls-files | grep -E '^\.env($|\.)' | grep -v '\.env\.example$' || true)
if [ -n "$env_files" ]; then
  printf 'FAIL: env file(s) tracked in git:\n%s\n' "$env_files" >&2
  FAIL=1
else
  printf 'ok  no env files tracked\n'
fi

# ---------------------------------------------------------------------------
# 1b. The local review report must never be tracked
# ---------------------------------------------------------------------------
# `.apexyard/review/prompt.md` is the full prompt sent to the model, and
# `review.md` quotes source lines. The normalised bundle is committed on
# purpose; these two are not.
#
# This check exists because the gitignore entry silently failed once: the
# pattern carried a trailing `# comment`, which gitignore does not support, so
# it matched nothing and `git add -A` staged the prompt. A pattern that quietly
# stops matching is exactly the failure a scan should catch.
leaked=$(git ls-files | grep -E '^\.apexyard/(review|raw)/' || true)
if [ -n "$leaked" ]; then
  printf 'FAIL: local review internals are tracked in git:\n' >&2
  printf '%s\n' "$leaked" | sed 's/^/        /' >&2
  printf '      Untrack them:  git rm -r --cached .apexyard/review .apexyard/raw\n' >&2
  FAIL=1
else
  printf 'ok  the local review report and raw output are untracked\n'
fi

# ---------------------------------------------------------------------------
# 2. Provider key patterns in tracked files
# ---------------------------------------------------------------------------
# Anchored, provider-specific prefixes only. Generic words like "token" or
# "secret" are excluded deliberately — they match test fixtures and variable
# names constantly, and a scanner people learn to ignore protects nothing.
patterns=(
  'sk-ant-[A-Za-z0-9_-]{20,}'          # Anthropic
  'AIza[0-9A-Za-z_-]{35}'              # Google API (Gemini). No exemptions — see the note below.
  'AKIA[0-9A-Z]{16}'                   # AWS access key
  'ghp_[A-Za-z0-9]{36}'                # GitHub PAT
  'github_pat_[A-Za-z0-9_]{40,}'       # GitHub fine-grained PAT
  'sk-[A-Za-z0-9]{48}'                 # OpenAI
  'xox[baprs]-[A-Za-z0-9-]{10,}'       # Slack
  '-----BEGIN [A-Z ]*PRIVATE KEY-----' # private keys
)

# `AIza…` is treated as a secret with NO exemptions.
#
# There used to be one. It mattered because `AIza…` covers two very different
# things: a Gemini/Google Cloud API key, which is secret and whose commit is an
# incident; and a Firebase *Web* API key, which is not — Google ships it in the
# client bundle of every Firebase web app, it identifies the project rather than
# authorising anything, and access is governed by Security Rules.
#
# ADR-0005 deleted Firebase, so no Firebase-shaped config exists for that
# exemption to apply to and it was dead code. Removed rather than kept "just in
# case", and the effect if Firebase ever returns is deliberate: the scan will
# FAIL on the new config's `apiKey` line. That is the outcome we want. TD-026 is
# the reason — the project outlived the code once already, silently, and a
# scanner that waves through a returning config would let it happen again
# without anyone deciding to.
#
# If you do reintroduce Firebase and that failure is wrong for your case, the
# exemption to restore is: exempt an AIza match only when the MATCHED LINE is
# the `apiKey` field AND the file contains `authDomain` or `firebaseapp.com`.
# Per line, not per file — exempting the whole file would silently downgrade a
# Gemini key pasted into the same JSON, which is plausible since both are
# Google keys.

# Scan tracked files PLUS untracked-but-not-ignored ones. Tracked-only would
# miss the case this check most needs to catch: a key pasted into a new file
# that has not been `git add`-ed yet. It is not committed, so it is not a leak
# yet — which is exactly when catching it is still cheap.
# This file is NOT excluded from its own sweep.
#
# It used to be, on the assumption that a file containing the patterns must
# match them. Checked, and that is false: every pattern's literal text has a
# `[` immediately after the prefix (`sk-ant-[A-Za-z0-9_-]{20,}`), and `[` is
# not in the character class, so none of them match themselves. The exclusion
# bought nothing and created a real blind spot — a key pasted into the
# scanner would have been the one place the scanner never looked.
list_scan_targets() {
  { git ls-files -z
    git ls-files -z --others --exclude-standard
  } | sort -zu
}

hits=""
for p in "${patterns[@]}"; do
  # -H forces the filename prefix. Without it, xargs batching that happens to
  # pass a single file makes grep omit the prefix, and the report would name a
  # line number where a path belongs.
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    # Accumulate with a real newline, not a literal `\n`. The latter would
    # need `printf '%b'` to render, and %b also expands any backslash escape
    # that happens to appear inside the matched source line — mangling the
    # very evidence this report exists to show.
    #
    # Every match is a hit. The Firebase-web-key exemption that used to sit here
    # went with Firebase itself — see the note above the patterns.
    hits="${hits}${line}
"
  # -r on xargs: with an empty file list, xargs would otherwise run grep with
  # no file arguments, and grep would block reading stdin — hanging the scan.
  #
  # Skipping the pattern-list lines themselves, now that the file is in scope.
  done <<EOF
$(list_scan_targets | xargs -0 -r grep -IHnE "$p" 2>/dev/null || true)
EOF
done

if [ -n "$hits" ]; then
  printf 'FAIL: provider credential pattern(s) found (tracked and untracked files):\n' >&2
  printf '%s' "$hits" >&2
  FAIL=1
else
  printf 'ok  no provider key patterns (tracked or untracked)\n'
fi

# ---------------------------------------------------------------------------
# 3. TruffleHog, when available — same verified-only setting as CI
# ---------------------------------------------------------------------------
if command -v trufflehog >/dev/null 2>&1; then
  # Percent-encode spaces: this checkout lives under "D:\Rewaa agent tool\",
  # and a raw space makes the file:// URI unparseable.
  TH_URI="file://$(printf '%s' "$PROJECT_ROOT" | sed 's/ /%20/g')"
  th_out=$(trufflehog git "$TH_URI" --results=verified --fail --no-update 2>&1)
  th_rc=$?
  printf '%s\n' "$th_out" | tail -20
  # TruffleHog reserves 183 for "found something"; anything else is the tool
  # failing. Reporting a crashed scanner as "found a verified secret" sends
  # you hunting for a credential that was never there — which is exactly the
  # confusion the CI `--fail` duplication caused earlier in this project.
  case "$th_rc" in
    0)   printf 'ok  trufflehog found no verified secrets\n' ;;
    183) printf 'FAIL: trufflehog found a verified secret\n' >&2; FAIL=1 ;;
    *)   printf 'FAIL: trufflehog exited %s — it did not complete a scan.\n' "$th_rc" >&2
         printf '      This is NOT a clean result.\n' >&2
         FAIL=1 ;;
  esac
else
  printf 'note  trufflehog not installed — pattern sweep only.\n'
  printf '      CI runs the verified scan on every push, so this is a\n'
  printf '      weaker local mirror, not a gap in coverage.\n'
fi

exit "$FAIL"
