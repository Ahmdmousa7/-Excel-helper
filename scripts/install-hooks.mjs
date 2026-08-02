// install-hooks.mjs — point git at .githooks, run from npm's `prepare`.
//
// git deliberately will not run hooks out of a committed directory: a repo
// that could execute scripts on checkout would be an obvious attack. So
// core.hooksPath is per-clone local config, and something has to set it.
//
// This says what it did. The previous version was `git config ... || true`,
// which set the config silently on success and swallowed the error on
// failure — so the one outcome that matters, "the pre-push gate is not
// installed", was the one you could not see.

import { execFileSync } from 'node:child_process';

const HOOKS_DIR = '.githooks';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// A tarball install or a CI checkout may not be a git repo at all. That is
// not a failure — there is nothing to hook.
try {
  git(['rev-parse', '--git-dir']);
} catch {
  process.exit(0);
}

let current = '';
try {
  current = git(['config', '--get', 'core.hooksPath']);
} catch {
  // Unset. `git config --get` exits 1 when the key is absent.
}

if (current === HOOKS_DIR) process.exit(0);

if (current) {
  // Something else already owns the hooks. Overwriting another tool's
  // configuration silently would be worse than not installing.
  console.warn(
    `\n  core.hooksPath is already set to "${current}", so the pre-push gate` +
      `\n  was NOT installed. To use it instead:` +
      `\n    git config core.hooksPath ${HOOKS_DIR}\n`,
  );
  process.exit(0);
}

try {
  git(['config', 'core.hooksPath', HOOKS_DIR]);
  console.log(`  pre-push gate installed (core.hooksPath -> ${HOOKS_DIR}).`);
} catch (err) {
  console.warn(
    `\n  Could not set core.hooksPath, so the pre-push gate is NOT active.` +
      `\n  Run the local gate manually before pushing:  npm run verify:local` +
      `\n  Reason: ${err.message}\n`,
  );
  // Deliberately exit 0: a missing hook must not break `npm install`. The
  // warning is the point — the failure is visible rather than swallowed.
}
