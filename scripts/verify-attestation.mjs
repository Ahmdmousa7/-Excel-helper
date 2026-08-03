#!/usr/bin/env node
//
// verify-attestation.mjs — check that the committed review attestation still
// describes the code in this checkout.
//
// Runs in GitHub Actions and holds no credentials. It calls no network, no
// model, and no service: everything it needs is git objects plus, optionally,
// ssh-keygen. That is the point — the review is local, and verification must
// work without any of the review's inputs.
//
// It fails when:
//   - the attestation is missing, malformed, or its digest does not match
//   - a file's content changed since it was attested (OID moved)
//   - an attested-as-deleted file is back
//   - a file changed in this range was never attested (coverage gap)
//   - the recorded review was weaker than the required gate, or not clean
//   - a signature exists but does not verify against the registered signers
//
// Usage:
//   node scripts/verify-attestation.mjs --base <ref> [--head <ref>]
//                                       [--require-gate high]
//                                       [--attestation <path>]

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import {
  parseAttestation, digestBody, uncoveredPaths, gateSatisfied,
  DELETED, SIG_NAMESPACE,
} from './lib/attestation.mjs';

const DEFAULT_ATTESTATION = '.apexyard/attestation';
const SIGNERS_FILE = '.apexyard/allowed_signers';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).replace(/\n$/, '');
}

/** For lookups that are expected to fail — an attested-as-deleted path has no
 *  blob at HEAD, and git's "does not exist" on stderr reads like an error when
 *  it is the correct answer. */
function gitOrNull(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .replace(/\n$/, '');
  } catch {
    return null;
  }
}

const problems = [];
const notes = [];
function problem(msg) { problems.push(msg); }
function note(msg) { notes.push(msg); }

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = {
  base: '',
  head: 'HEAD',
  requireGate: 'high',
  attestation: DEFAULT_ATTESTATION,
};
for (let i = 0; i < args.length; i += 1) {
  const need = (name) => {
    if (i + 1 >= args.length) { process.stderr.write(`${name} requires a value\n`); process.exit(2); }
    return args[i += 1];
  };
  switch (args[i]) {
    case '--base':         opt.base = need('--base'); break;
    case '--head':         opt.head = need('--head'); break;
    case '--require-gate': opt.requireGate = need('--require-gate'); break;
    case '--attestation':  opt.attestation = need('--attestation'); break;
    default:
      process.stderr.write(`unknown option ${args[i]}\n`);
      process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// 1. Load and check integrity
// ---------------------------------------------------------------------------
if (!existsSync(opt.attestation)) {
  process.stderr.write(
    `\nNo review attestation at ${opt.attestation}.\n\n` +
    'The ApexYard review runs locally (ADR-0001) and records what it saw so\n' +
    'this job can check it. Nothing was recorded for this push.\n\n' +
    'Run the gate and commit the result:\n' +
    '  npm run verify:local\n' +
    `  git add ${opt.attestation} && git commit --amend --no-edit\n`,
  );
  process.exit(1);
}

let parsed;
try {
  parsed = parseAttestation(readFileSync(opt.attestation, 'utf8'));
} catch (err) {
  process.stderr.write(`\nAttestation at ${opt.attestation} is malformed: ${err.message}\n`);
  process.exit(1);
}

const { digest, body, fields } = parsed;
if (digest !== digestBody(body)) {
  process.stderr.write(
    '\nAttestation digest does not match its body.\n' +
    'The file was edited after it was generated. Regenerate it rather than\n' +
    'hand-editing:  npm run verify:local\n',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Content binding — do the recorded OIDs still hold?
// ---------------------------------------------------------------------------
// This is the load-bearing check. Everything else is a guard around it.
const headSha = git(['rev-parse', opt.head]);

for (const { path, oid } of fields.files) {
  const actual = gitOrNull(['rev-parse', `${opt.head}:${path}`]);

  if (oid === DELETED) {
    if (actual !== null) {
      problem(`${path} was attested as deleted but exists at ${opt.head}`);
    }
    continue;
  }
  if (actual === null) {
    problem(`${path} was reviewed but is absent at ${opt.head} (attested ${oid.slice(0, 12)})`);
    continue;
  }
  if (actual !== oid) {
    problem(
      `${path} changed after it was reviewed\n` +
      `      reviewed: ${oid.slice(0, 12)}\n` +
      `      now:      ${actual.slice(0, 12)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Coverage — did anything change that was never reviewed?
// ---------------------------------------------------------------------------
// Without this, an attestation over one unchanged file would satisfy check 2
// while the rest of the push went unreviewed.
const attestedPaths = fields.files.map((f) => f.path);
const SELF = new Set([opt.attestation, `${opt.attestation}.sig`, SIGNERS_FILE]);

let changed = null;
if (opt.base) {
  let baseSha = null;
  try {
    baseSha = git(['rev-parse', '--verify', opt.base]);
  } catch {
    note(
      `could not resolve --base ${opt.base} in this checkout, so the coverage ` +
      'check was skipped. Content binding above still applied.',
    );
  }
  if (baseSha) {
    changed = git(['diff', '--name-only', '-z', `${baseSha}...${headSha}`])
      .split('\0').filter((p) => p !== '' && !SELF.has(p));
  }
} else {
  note('no --base given, so the coverage check was skipped. Content binding still applied.');
}

if (changed) {
  const gaps = uncoveredPaths(attestedPaths, changed);
  if (gaps.length > 0) {
    problem(
      `${gaps.length} file(s) changed in this range but were never reviewed:\n` +
      gaps.map((p) => `        ${p}`).join('\n'),
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Was the recorded review strict enough, and clean?
// ---------------------------------------------------------------------------
const gate = gateSatisfied(fields, opt.requireGate);
for (const r of gate.reasons) problem(r);

// ---------------------------------------------------------------------------
// 5. Signature, when signers are registered
// ---------------------------------------------------------------------------
// Required only if someone registered a key. An empty or absent signers file
// means this repo has not opted in, and demanding a signature would fail every
// build for a control nobody configured. When signers ARE registered, a
// missing or bad signature is a hard failure — otherwise registering a key
// would be decorative.
const sigPath = `${opt.attestation}.sig`;
let signers = '';
if (existsSync(SIGNERS_FILE)) {
  signers = readFileSync(SIGNERS_FILE, 'utf8')
    .split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).join('\n');
}

if (signers === '') {
  note(
    'no signers registered, so the attestation is accepted unsigned. ' +
    `Add a public key to ${SIGNERS_FILE} to require a signature.`,
  );
} else if (!existsSync(sigPath)) {
  problem(
    `signers are registered in ${SIGNERS_FILE} but ${sigPath} is missing — ` +
    'the attestation was produced without signing',
  );
} else {
  const identity = fields.signer || signers.split('\n')[0].split(/\s+/)[0];
  try {
    execFileSync(
      'ssh-keygen',
      ['-Y', 'verify', '-f', SIGNERS_FILE, '-I', identity, '-n', SIG_NAMESPACE, '-s', sigPath],
      { input: readFileSync(opt.attestation), stdio: ['pipe', 'pipe', 'pipe'] },
    );
    note(`signature verified for ${identity}`);
  } catch (err) {
    const detail = ((err.stderr || '') + (err.stdout || '')).toString().trim();
    problem(`signature did not verify for ${identity}: ${detail || err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const summary = [
  '| | |',
  '|---|---|',
  `| Reviewed scope | \`${fields.scope ?? '?'}\` |`,
  `| Reviewed at commit | \`${(fields.head ?? '?').slice(0, 12)}\` |`,
  `| Verifying commit | \`${headSha.slice(0, 12)}\` |`,
  `| Model | \`${fields.model ?? '?'}\` |`,
  `| Gate | \`${fields.gate ?? '?'}\` (required at least \`${opt.requireGate}\`) |`,
  `| Verdict | \`${fields.verdict ?? '?'}\` |`,
  `| Files attested | ${fields.files.length} |`,
  `| Files changed here | ${changed === null ? 'not computed' : changed.length} |`,
].join('\n');

const counts = fields.findings ?? {};
const findingsTable = [
  '',
  '| Severity | Count |',
  '|---|---:|',
  ...['critical', 'high', 'medium', 'low', 'info'].map((s) => `| ${s} | ${counts[s] ?? 0} |`),
].join('\n');

let out;
if (problems.length === 0) {
  out = [
    '## Review attestation verified',
    '',
    'The ApexYard review ran locally before this push, and every file it saw',
    'still has the exact content it reviewed.',
    '',
    summary,
    findingsTable,
    '',
    ...(notes.length ? ['', ...notes.map((n) => `- ${n}`)] : []),
    '',
    '**This verifies that a review covering this code was recorded — not that',
    'a model was truly invoked.** A local attestation cannot prove that to the',
    'machine that produced it. See `docs/adr/ADR-0002` for the threat model.',
  ].join('\n');
} else {
  out = [
    '## Review attestation FAILED',
    '',
    ...problems.map((p) => `- ${p}`),
    '',
    summary,
    ...(notes.length ? ['', ...notes.map((n) => `- ${n}`)] : []),
    '',
    'Fix by re-running the local gate so the attestation matches this code:',
    '',
    '```bash',
    'npm run verify:local',
    `git add ${opt.attestation}${existsSync(sigPath) ? ` ${sigPath}` : ''}`,
    'git commit -m "chore: refresh review attestation"',
    '```',
  ].join('\n');
}

process.stdout.write(out + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n');
}

if (problems.length > 0) {
  process.stderr.write(`\n::error title=Review attestation::${problems.length} problem(s) — see the job summary.\n`);
  process.exit(1);
}
