#!/usr/bin/env node
//
// attest-review.mjs — record that the ApexYard review ran, in a form CI can check.
//
// Called by scripts/review-local.sh after a review completes. Reads the
// review's own JSON output, resolves the git blob OID of every file that was
// in scope, and writes .apexyard/attestation — a small text manifest whose
// digest covers all of it.
//
// The manifest is committed. CI recomputes the OIDs from its own checkout and
// fails if any has moved, or if a changed file was never attested.
//
// It contains: paths, content hashes, the model id, the gate level, the
// verdict, and per-severity counts. It contains NO prompt text, NO finding
// descriptions, NO code excerpts, and NO credentials — see ADR-0002 § "What
// the attestation deliberately does not contain".
//
// Usage:
//   node scripts/attest-review.mjs --base <ref> [--review-json <path>]
//                                  [--gate <level>] [--model <id>]
//                                  [--out <path>] [--no-sign]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderAttestation, DELETED, SEVERITIES, SIG_NAMESPACE } from './lib/attestation.mjs';

const DEFAULT_OUT = '.apexyard/attestation';
const SIGNERS_FILE = '.apexyard/allowed_signers';

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).replace(/\n$/, '');
}

function fail(msg, code = 1) {
  process.stderr.write(`attest-review: ${msg}\n`);
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = {
  base: '',
  reviewJson: '.apexyard/review/review.json',
  gate: process.env.APEXYARD_FAIL_ON || 'high',
  model: process.env.APEXYARD_MODEL || 'claude-opus-5',
  out: DEFAULT_OUT,
  sign: true,
};
for (let i = 0; i < args.length; i += 1) {
  const need = (name) => {
    if (i + 1 >= args.length) fail(`${name} requires a value`, 2);
    return args[i += 1];
  };
  switch (args[i]) {
    case '--base':        opt.base = need('--base'); break;
    case '--review-json': opt.reviewJson = need('--review-json'); break;
    case '--gate':        opt.gate = need('--gate'); break;
    case '--model':       opt.model = need('--model'); break;
    case '--out':         opt.out = need('--out'); break;
    case '--no-sign':     opt.sign = false; break;
    default: fail(`unknown option ${args[i]}`, 2);
  }
}
if (!opt.base) fail('--base is required (the ref the review diffed against)', 2);

// ---------------------------------------------------------------------------
// Review result
// ---------------------------------------------------------------------------
if (!existsSync(opt.reviewJson)) {
  fail(`no review output at ${opt.reviewJson} — run the review before attesting`, 3);
}
let review;
try {
  review = JSON.parse(readFileSync(opt.reviewJson, 'utf8'));
} catch (err) {
  fail(`could not parse ${opt.reviewJson}: ${err.message}`, 3);
}
if (!Array.isArray(review.findings)) {
  fail(`${opt.reviewJson} has no findings array — refusing to attest an unrecognised result`, 3);
}

const findings = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
for (const f of review.findings) {
  const sev = String(f.severity || '').toLowerCase();
  if (!(sev in findings)) fail(`finding with unknown severity ${JSON.stringify(f.severity)}`, 3);
  findings[sev] += 1;
}
const verdict = String(review.verdict || 'unknown').toUpperCase();

// ---------------------------------------------------------------------------
// Scope: the same file set the review was given
// ---------------------------------------------------------------------------
// --diff-filter is deliberately omitted here so deletions appear. The review
// itself only reads ACMR files (a deleted file has no content to read), but
// the attestation must record deletions too — otherwise a push that only
// removes files would carry an attestation covering nothing, and the coverage
// check in CI would have nothing to compare against.
let base;
try {
  base = git(['rev-parse', '--verify', opt.base]);
} catch {
  fail(`cannot resolve --base ${opt.base}`, 3);
}
const head = git(['rev-parse', 'HEAD']);

const raw = git(['diff', '--name-status', '-z', `${base}...HEAD`]);
// -z output: STATUS \0 PATH \0 ... with renames as R100 \0 OLD \0 NEW \0
const tokens = raw.split('\0').filter((t) => t !== '');
const scopePaths = new Map(); // path -> status
for (let i = 0; i < tokens.length; ) {
  const status = tokens[i];
  if (/^[RC]/.test(status)) {
    const from = tokens[i + 1];
    const to = tokens[i + 2];
    scopePaths.set(from, 'D');   // the old path is gone
    scopePaths.set(to, 'M');     // the new path has content to verify
    i += 3;
  } else {
    scopePaths.set(tokens[i + 1], status);
    i += 2;
  }
}

// The attestation file and its signature are excluded from their own scope.
// Including them would be circular: writing the manifest changes the tree,
// which would change the manifest.
const EXCLUDED = new Set([opt.out, `${opt.out}.sig`, SIGNERS_FILE]);

const files = [];
for (const [path, status] of scopePaths) {
  if (EXCLUDED.has(path)) continue;
  if (status === 'D') {
    files.push({ path, oid: DELETED });
    continue;
  }
  let oid;
  try {
    oid = git(['rev-parse', `HEAD:${path}`]);
  } catch {
    // In the tree per the diff but not resolvable at HEAD — a submodule
    // gitlink, or a diff computed against an unexpected state. Refuse rather
    // than silently omit a file from the attested set.
    fail(`cannot resolve blob for ${path} at HEAD — refusing to attest a partial scope`, 3);
  }
  files.push({ path, oid });
}

if (files.length === 0) {
  fail('scope is empty after exclusions — nothing to attest', 3);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
const text = renderAttestation({
  scope: `${opt.base}...HEAD`,
  head,
  model: opt.model,
  gate: opt.gate,
  verdict,
  findings,
  files,
});

mkdirSync(dirname(opt.out), { recursive: true });
// Explicit LF. Node does not translate newlines, but being explicit here
// documents that the digest is defined over LF bytes.
writeFileSync(opt.out, text, { encoding: 'utf8' });
process.stdout.write(`attest-review: wrote ${opt.out} (${files.length} file(s), verdict ${verdict})\n`);

// ---------------------------------------------------------------------------
// Signature (optional, best-effort, never fatal)
// ---------------------------------------------------------------------------
// A signature adds provenance — *which* registered key attested — not proof
// that the model ran. On a single-maintainer repo it buys little, because the
// same person holds the key and would be the one forging. It matters the
// moment a second contributor appears, which is TD-027's revisit trigger, so
// it is built now and enabled when a key exists.
const sigPath = `${opt.out}.sig`;

function findSigningKey() {
  // An explicitly configured SSH signing key wins.
  try {
    const fmt = git(['config', '--get', 'gpg.format']);
    if (fmt === 'ssh') {
      const k = git(['config', '--get', 'user.signingkey']);
      if (k && existsSync(k)) return k;
    }
  } catch { /* not configured */ }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  for (const name of ['id_ed25519', 'id_ecdsa', 'id_rsa']) {
    const p = join(home, '.ssh', name);
    if (existsSync(p)) return p;
  }
  return null;
}

if (!opt.sign) {
  process.stdout.write('attest-review: signing skipped (--no-sign).\n');
} else {
  const key = findSigningKey();
  if (!key) {
    // Remove a signature left by an earlier run: a stale .sig over different
    // content is worse than none, because the verifier would reject it and
    // the reason would look like tampering rather than a missing key.
    if (existsSync(sigPath)) unlinkSync(sigPath);
    process.stdout.write(
      'attest-review: no SSH key found, so the attestation is unsigned.\n' +
      '  This is supported — the OID binding is what CI actually checks.\n' +
      '  To add provenance later:\n' +
      '    ssh-keygen -t ed25519 -C "review attestation"\n' +
      `    printf '%s %s\\n' "$(git config user.email)" "$(cat ~/.ssh/id_ed25519.pub)" >> ${SIGNERS_FILE}\n`,
    );
  } else {
    try {
      execFileSync('ssh-keygen', ['-Y', 'sign', '-f', key, '-n', SIG_NAMESPACE, opt.out], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      process.stdout.write(`attest-review: signed with ${key}\n`);
    } catch (err) {
      if (existsSync(sigPath)) unlinkSync(sigPath);
      const detail = (err.stderr || '').toString().trim();
      process.stdout.write(
        `attest-review: could not sign (${detail || err.message}).\n` +
        '  Continuing unsigned — the OID binding is unaffected.\n',
      );
    }
  }
}
