#!/usr/bin/env node
//
// verify-evidence.mjs — the single verifier for the review evidence.
//
// Runs in GitHub Actions with no credentials, no network, and no model.
//
// THIS REPLACED A SECOND VERIFIER, AND THAT MATTERS
// -------------------------------------------------
// There used to be a `verify-attestation.mjs` alongside this, and CI ran both.
// They shared ~85% of their logic and disagreed on one detail: which paths are
// excluded from the coverage check. This file excludes the whole `.apexyard/`
// bundle; the other excluded only the manifest. Since `evidence.mjs` rewrites
// every artifact on each run, committing the bundle produced files the other
// verifier saw as "changed but never reviewed" — so the two gates had no fixed
// point and CI could never be green. An accretion of two near-identical
// checkers is not a redundancy, it is a place for them to disagree.
//
// The same reasoning retired rule 2's original form. It used to read "the JSON
// mirror agrees with the signed manifest" — a rule that existed only because
// there were two attestation artifacts to disagree. ADR-0004 made the JSON the
// attestation, and the rule collapsed into a self-check on one file.
//
// One verifier. One exclusion rule. The rules below are numbered to match
// docs/adr/ADR-0003 § "What CI verifies, and what it cannot".
//
//   1. ARTIFACTS EXIST         every required file is present
//   2. ATTESTATION IS INTACT   its recorded id is the digest of its own content,
//                              so no field was edited after it was generated
//   3. FILES MATCH REPO STATE  every recorded blob OID still resolves at HEAD,
//                              and nothing changed here that went unreviewed
//   4. NO ARTIFACT IS STALE    every artifact's attestation_id is this
//                              attestation's digest
//   5. REPRODUCIBLE            artifacts are canonical and free of
//                              timestamp-shaped content
//   6. SIGNED, IF SIGNERS EXIST
//
// What it does NOT establish, stated here because a verifier that overclaims is
// worse than none: that a model was invoked. The bundle is written by the same
// machine that could write it by hand. See ADR-0002 and ADR-0003.
//
// Usage:
//   node scripts/verify-evidence.mjs [--base <ref>] [--head <ref>]
//                                    [--require-gate high] [--dir .apexyard]

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseAttestation, attestationDigest, uncoveredPaths, gateSatisfied,
  ATTESTATION_FILE, DELETED, SIG_NAMESPACE,
} from './lib/attestation.mjs';
import {
  BUNDLE_DIR, REQUIRED_ARTIFACTS, SUMMARY_FILE, SIGNERS_FILE as SIGNERS_NAME,
  checkArtifact, missingArtifacts, isBundlePath,
} from './lib/evidence.mjs';

const opt = { base: '', head: 'HEAD', requireGate: 'high', dir: BUNDLE_DIR };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const need = (n) => {
    if (i + 1 >= args.length) { process.stderr.write(`${n} requires a value\n`); process.exit(2); }
    return args[i += 1];
  };
  switch (args[i]) {
    case '--base':         opt.base = need('--base'); break;
    case '--head':         opt.head = need('--head'); break;
    case '--require-gate': opt.requireGate = need('--require-gate'); break;
    case '--dir':          opt.dir = need('--dir'); break;
    default:
      process.stderr.write(`unknown option ${args[i]}\n`);
      process.exit(2);
  }
}

const SIGNERS_FILE = join(opt.dir, SIGNERS_NAME);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
// Declared before anything can report, with safe defaults.
//
// An earlier version called report() from the middle of the module while
// `headSha` and `present` were still in their temporal dead zone. `report` was
// hoisted, so the call resolved — and then threw ReferenceError instead of
// printing the failure it existed to print. Every early-exit path was broken in
// exactly the situation it was written for.
const problems = [];
const notes = [];
let present = [];
let headSha = '?';
let attestationId = '?';
let fields = null;
let changedCount = null;

function git(args_) {
  return execFileSync('git', args_, { encoding: 'utf8' }).replace(/\n$/, '');
}
/** For lookups expected to fail — an attested-as-deleted path has no blob at
 *  HEAD, and git's "does not exist" on stderr reads like an error when it is
 *  the correct answer. */
function gitOrNull(args_) {
  try {
    return execFileSync('git', args_, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .replace(/\n$/, '');
  } catch {
    return null;
  }
}
function loadArtifact(name) {
  const p = join(opt.dir, name);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

// ---------------------------------------------------------------------------
// RULE 1 — the artifacts exist
// ---------------------------------------------------------------------------
if (!existsSync(opt.dir)) {
  process.stderr.write(
    `\nNo evidence bundle at ${opt.dir}/.\n\n` +
    'The AI review runs locally (ADR-0001) and writes an evidence bundle so\n' +
    'this job can check it. Nothing was recorded for this push.\n\n' +
    '  npm run verify:local\n' +
    `  git add ${opt.dir} && git commit -m "chore: refresh evidence bundle"\n`,
  );
  process.exit(1);
}

present = readdirSync(opt.dir).filter((f) => !f.startsWith('.'));
for (const m of missingArtifacts(present)) {
  problems.push(`required artifact ${m} is missing from ${opt.dir}/`);
}

const attPath = join(opt.dir, ATTESTATION_FILE);
if (!existsSync(attPath)) {
  problems.push(`${attPath} is missing — the bundle has nothing to bind to`);
  report();
}

let att;
try {
  // The read stays inside the try: an unreadable file should reach report()
  // like any other bad attestation, not exit on an uncaught stack trace.
  att = parseAttestation(readFileSync(attPath, 'utf8'));
} catch (err) {
  problems.push(`attestation is malformed: ${err.message}`);
  report();
}

attestationId = att.digest;
fields = att.fields;

// ---------------------------------------------------------------------------
// RULE 2 — the attestation is internally intact
// ---------------------------------------------------------------------------
// `attestation_id` is the sha256 of this artifact's canonical JSON with that one
// key removed, so recomputing it catches any edit to any other field. Flipping
// `"gate": "high"` to `"none"` to make a failing review look clean fails here.
//
// Fatal, not collected: every rule below reads these fields, and reporting a
// dozen consequences of one edited file buries the cause.
if (attestationId !== attestationDigest(att.artifact)) {
  problems.push(
    'the attestation\'s id does not match a fresh digest of its content — it was ' +
    'edited after it was generated. Regenerate rather than hand-editing.',
  );
  report();
}

// ---------------------------------------------------------------------------
// RULE 3 — reviewed files still match repository state
// ---------------------------------------------------------------------------
// The load-bearing check. Everything else is a guard around it.
headSha = git(['rev-parse', opt.head]);

for (const { path, oid } of fields.files) {
  const actual = gitOrNull(['rev-parse', `${opt.head}:${path}`]);
  if (oid === DELETED) {
    if (actual !== null) problems.push(`${path} was attested as deleted but exists at ${opt.head}`);
    continue;
  }
  if (actual === null) {
    problems.push(`${path} was reviewed but is absent at ${opt.head} (attested ${oid.slice(0, 12)})`);
    continue;
  }
  if (actual !== oid) {
    problems.push(
      `${path} changed after it was reviewed\n` +
      `      reviewed: ${oid.slice(0, 12)}\n` +
      `      now:      ${actual.slice(0, 12)}`,
    );
  }
}

// Coverage: nothing may change in this range that the review never saw.
//
// The entire bundle directory is excluded, via the SAME function the generator
// uses. Keeping two copies of this rule is what produced the no-fixed-point
// defect: see isBundlePath().
if (opt.base) {
  const baseSha = gitOrNull(['rev-parse', '--verify', opt.base]);
  if (baseSha === null) {
    notes.push(
      `could not resolve --base ${opt.base} in this checkout, so the coverage ` +
      'check was skipped. Content binding still applied.',
    );
  } else {
    const changed = git(['diff', '--name-only', '-z', `${baseSha}...${headSha}`])
      .split('\0')
      .filter((p) => p !== '' && !isBundlePath(p, opt.dir));
    changedCount = changed.length;
    const gaps = uncoveredPaths(fields.files.map((f) => f.path), changed);
    if (gaps.length > 0) {
      problems.push(
        `${gaps.length} file(s) changed in this range but were never reviewed:\n` +
        gaps.map((p) => `        ${p}`).join('\n'),
      );
    }
  }
} else {
  notes.push('no --base given, so the coverage check was skipped. Content binding still applied.');
}

// The recorded review must have been strict enough, and clean.
for (const r of gateSatisfied(fields, opt.requireGate).reasons) problems.push(r);

// ---------------------------------------------------------------------------
// RULES 4 and 5 — bound to THIS attestation, canonical, reproducible
// ---------------------------------------------------------------------------
// attestation.json is in this loop too, and its canonical-form check is not
// redundant with rule 2. Rule 2 digests the *parsed* object, so a non-canonical
// file — reordered keys, four-space indent — would still produce the expected
// id while its bytes differ from the ones the digest is defined over. That would
// let two distinct byte strings carry the same attestation id, and it is the
// bytes that get signed. isCanonical() is what makes the mapping one-to-one.
for (const name of REQUIRED_ARTIFACTS) {
  const p = join(opt.dir, name);
  if (!existsSync(p)) continue;   // already reported by rule 1
  for (const msg of checkArtifact(name, readFileSync(p, 'utf8'), attestationId)) problems.push(msg);
}

// ---------------------------------------------------------------------------
// Cross-artifact consistency
// ---------------------------------------------------------------------------
const review = loadArtifact('review.json');
const findings = loadArtifact('findings.json');

// A bundle whose review.json says the review never ran is not a verified
// bundle. Without this, `available: false` sailed through every other rule —
// the artifacts were present, canonical, and correctly bound to an attestation
// that recorded no findings, so nothing objected. That is the same
// "absence reads as success" failure the collectors were built to avoid, one
// layer up.
if (!review) {
  problems.push('review.json could not be read');
} else if (review.available !== true) {
  problems.push(
    `review.json reports the review did not run (${review.reason ?? 'no reason given'}) — ` +
    'an unrun review is not a passing one',
  );
}
if (findings && findings.available !== true) {
  problems.push(
    `findings.json reports no findings data (${findings.reason ?? 'no reason given'})`,
  );
}

// review.json and findings.json come from one review, so their counts must
// agree. The staleness rule catches a *different* attestation; this catches a
// partial regeneration under the same one.
if (review?.available && findings?.available) {
  if (review.findings_total !== findings.total) {
    problems.push(
      `review.json reports ${review.findings_total} findings but findings.json has ` +
      `${findings.total} — one was regenerated without the other`,
    );
  }
  for (const [sev, n] of Object.entries(review.findings_by_severity ?? {})) {
    const other = findings.by_severity?.[sev];
    if (other !== undefined && other !== n) {
      problems.push(`severity "${sev}": review.json says ${n}, findings.json says ${other}`);
    }
  }
}

// The signed manifest is authoritative over any artifact derived from it. This
// is what stops a hand-edited review.json from reporting a clean review the
// manifest contradicts.
if (review?.available && fields.findings) {
  for (const [sev, n] of Object.entries(fields.findings)) {
    const got = review.findings_by_severity?.[sev];
    if (got !== undefined && got !== n) {
      problems.push(`severity "${sev}": the attestation records ${n} but review.json says ${got}`);
    }
  }
}

// ---------------------------------------------------------------------------
// RULE 6 — signature, when signers are registered
// ---------------------------------------------------------------------------
// Required only if someone registered a key. An empty or absent signers file
// means this repo has not opted in, and demanding a signature would fail every
// build for a control nobody configured. Once signers ARE registered, a missing
// or bad signature is fatal — otherwise registering a key would be decorative.
const sigPath = `${attPath}.sig`;
const signers = existsSync(SIGNERS_FILE)
  ? readFileSync(SIGNERS_FILE, 'utf8')
    .split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#')).join('\n')
  : '';

if (signers === '') {
  notes.push(
    'no signers registered, so the attestation is accepted unsigned. Add a ' +
    `public key to ${SIGNERS_FILE} to require a signature.`,
  );
} else if (!existsSync(sigPath)) {
  problems.push(
    `signers are registered in ${SIGNERS_FILE} but ${sigPath} is missing — the ` +
    'attestation was produced without signing',
  );
} else {
  const identity = signers.split('\n')[0].split(/\s+/)[0];
  try {
    execFileSync(
      'ssh-keygen',
      ['-Y', 'verify', '-f', SIGNERS_FILE, '-I', identity, '-n', SIG_NAMESPACE, '-s', sigPath],
      { input: readFileSync(attPath), stdio: ['pipe', 'pipe', 'pipe'] },
    );
    notes.push(`signature verified for ${identity}`);
  } catch (err) {
    const detail = ((err.stderr || '') + (err.stdout || '')).toString().trim();
    problems.push(`signature did not verify for ${identity}: ${detail || err.message}`);
  }
}

report();

// ---------------------------------------------------------------------------
function report() {
  const m = loadArtifact('metrics.json');
  const deps = loadArtifact('dependency-report.json');
  const gateRow = (label, section, detail) => {
    if (!section) return `| ${label} | not present | |`;
    if (section.available === false) return `| ${label} | **not run** | ${section.reason} |`;
    const p = section.passed;
    return `| ${label} | ${p === true ? 'pass' : p === false ? '**FAIL**' : 'recorded'} | ${detail(section)} |`;
  };

  const head = [
    '| | |',
    '|---|---|',
    `| Attestation id | \`${attestationId}\` |`,
    `| Reviewed scope | \`${fields?.scope ?? '?'}\` |`,
    `| Reviewed at commit | \`${(fields?.head ?? '?').slice(0, 12)}\` |`,
    `| Verifying commit | \`${headSha.slice(0, 12)}\` |`,
    `| Gate | \`${fields?.gate ?? '?'}\` (required at least \`${opt.requireGate}\`) |`,
    `| Verdict | \`${fields?.verdict ?? '?'}\` |`,
    `| Files attested | ${fields?.files.length ?? '?'} |`,
    `| Files changed here | ${changedCount === null ? 'not computed' : changedCount} |`,
    `| Artifacts present | ${present.filter((f) => REQUIRED_ARTIFACTS.includes(f) || f === SUMMARY_FILE).length}/${REQUIRED_ARTIFACTS.length + 1} |`,
  ].join('\n');

  const gates = m ? [
    '',
    '| Recorded gate | Result | Detail |',
    '|---|---|---|',
    gateRow('TypeScript', m.typescript, (s) => `${s.errors} error(s)`),
    gateRow('ESLint', m.eslint, (s) => `${s.errors} error(s), ${s.warnings} warning(s)`),
    gateRow('Vitest', m.vitest, (s) => `${s.tests?.passed ?? '?'}/${s.tests?.total ?? '?'} passed`),
    gateRow('Playwright', m.playwright, (s) => `${s.passed_count}/${s.total} passed`),
    gateRow('Bundle budget', m.bundle, (s) => `${s.budgets_ok ?? '?'}/${s.budgets_total ?? '?'} within budget`),
    gateRow('Production audit', deps?.audit, (s) => `${s.critical ?? '?'} critical, ${s.high ?? '?'} high`),
    '',
    'A gate reading **not run** did not pass — it was never executed.',
  ].join('\n') : '';

  const ok = problems.length === 0;
  const out = ok
    ? [
      '## Evidence bundle verified',
      '',
      'A review covering exactly this code was recorded, and every artifact in the',
      'bundle belongs to that same reviewed state.',
      '',
      head,
      gates,
      ...(notes.length ? ['', ...notes.map((n) => `- ${n}`)] : []),
      '',
      '**This does not prove a model was invoked.** The bundle is produced by the',
      'same machine that could produce it by hand; a local attestation cannot',
      'settle that question. See `docs/adr/ADR-0002` and `ADR-0003`.',
    ].join('\n')
    : [
      '## Evidence bundle FAILED',
      '',
      ...problems.map((p) => `- ${p}`),
      '',
      head,
      ...(notes.length ? ['', ...notes.map((n) => `- ${n}`)] : []),
      '',
      'Regenerate so the bundle matches this code:',
      '',
      '```bash',
      'npm run verify:local',
      `git add ${opt.dir}`,
      'git commit -m "chore: refresh evidence bundle"',
      '```',
    ].join('\n');

  process.stdout.write(`${out}\n`);

  // Synchronous, and imported statically at the top.
  //
  // This used to be `import('node:fs').then(...)` followed immediately by
  // process.exit(). The exit won the race every time, so the job summary was
  // never written — a reporting feature that silently did nothing in the one
  // environment it existed for.
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`);
  }

  if (!ok) {
    process.stderr.write(
      `\n::error title=Evidence bundle::${problems.length} problem(s) — see the job summary.\n`,
    );
    process.exit(1);
  }
  process.exit(0);
}
