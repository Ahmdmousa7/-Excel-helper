#!/usr/bin/env node
//
// verify-evidence.mjs — check the engineering evidence bundle.
//
// Runs in GitHub Actions with no credentials, no network, and no model. It is a
// superset of verify-attestation.mjs: it delegates the attestation checks to the
// same library, then adds the bundle rules.
//
// The five things it establishes (requirement 5):
//
//   1. ARTIFACTS EXIST         every required file is present
//   2. ATTESTATION MATCHES     the JSON mirror agrees with the signed manifest
//      REVIEWED FILES
//   3. REVIEWED FILES MATCH    every recorded blob OID still resolves at HEAD,
//      REPOSITORY STATE        and nothing changed here that went unreviewed
//   4. NO ARTIFACT IS STALE    every artifact's attestation_id is the current
//                              attestation's digest
//   5. NOTHING IS              artifacts are canonical and free of
//      NON-REPRODUCIBLE        timestamp-shaped content
//
// What it does NOT establish, stated here because a verifier that overclaims is
// worse than none: that a model was invoked. The bundle is written by the same
// machine that could write it by hand. See docs/adr/ADR-0002 and ADR-0003.
//
// Usage:
//   node scripts/verify-evidence.mjs [--base <ref>] [--head <ref>]
//                                    [--require-gate high] [--dir .apexyard]

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseAttestation, digestBody, uncoveredPaths, gateSatisfied, DELETED } from './lib/attestation.mjs';
import {
  BUNDLE_DIR, REQUIRED_ARTIFACTS, SUMMARY_FILE, checkArtifact, missingArtifacts,
} from './lib/evidence.mjs';

const problems = [];
const notes = [];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).replace(/\n$/, '');
}
function gitOrNull(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .replace(/\n$/, '');
  } catch {
    return null;
  }
}

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

const present = readdirSync(opt.dir).filter((f) => !f.startsWith('.'));
const missing = missingArtifacts(present);
for (const m of missing) problems.push(`required artifact ${m} is missing from ${opt.dir}/`);

// ---------------------------------------------------------------------------
// The attestation is the anchor for everything else
// ---------------------------------------------------------------------------
const attPath = join(opt.dir, 'attestation');
if (!existsSync(attPath)) {
  problems.push(`${attPath} is missing — the bundle has nothing to bind to`);
  report();
}

let att;
try {
  att = parseAttestation(readFileSync(attPath, 'utf8'));
} catch (err) {
  problems.push(`attestation is malformed: ${err.message}`);
  report();
}

const ID = att.digest;
const F = att.fields;

if (ID !== digestBody(att.body)) {
  problems.push(
    'attestation digest does not match its body — the manifest was edited after ' +
    'it was generated. Regenerate rather than hand-editing.',
  );
  report();
}

// ---------------------------------------------------------------------------
// RULE 3 — reviewed files still match repository state
// ---------------------------------------------------------------------------
// Unchanged from ADR-0002. This is the load-bearing check; the bundle rules are
// guards around it.
const headSha = git(['rev-parse', opt.head]);

for (const { path, oid } of F.files) {
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

// Coverage: nothing may change in this range that the review never saw. The
// whole bundle directory is excluded — it is generated *from* the review, so
// requiring it to be reviewed would be circular.
const SELF_PREFIX = `${opt.dir}/`;
let changed = null;
if (opt.base) {
  const baseSha = gitOrNull(['rev-parse', '--verify', opt.base]);
  if (baseSha === null) {
    notes.push(
      `could not resolve --base ${opt.base} in this checkout, so the coverage ` +
      'check was skipped. Content binding still applied.',
    );
  } else {
    changed = git(['diff', '--name-only', '-z', `${baseSha}...${headSha}`])
      .split('\0')
      .filter((p) => p !== '' && !p.startsWith(SELF_PREFIX) && p !== opt.dir);
    const gaps = uncoveredPaths(F.files.map((f) => f.path), changed);
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
for (const r of gateSatisfied(F, opt.requireGate).reasons) problems.push(r);

// ---------------------------------------------------------------------------
// RULES 4 and 5 — every artifact is bound to THIS attestation, canonical, and
// free of non-reproducible content
// ---------------------------------------------------------------------------
for (const name of REQUIRED_ARTIFACTS) {
  const p = join(opt.dir, name);
  if (!existsSync(p)) continue;   // already reported by rule 1
  for (const msg of checkArtifact(name, readFileSync(p, 'utf8'), ID)) problems.push(msg);
}

// ---------------------------------------------------------------------------
// RULE 2 — the JSON mirror agrees with the signed manifest
// ---------------------------------------------------------------------------
// `.apexyard/attestation` is authoritative (ADR-0002 kept it unchanged, and the
// SSH signature covers its bytes). attestation.json is a convenience mirror, so
// the two are checked against each other rather than trusted to stay in step.
const mirrorPath = join(opt.dir, 'attestation.json');
if (existsSync(mirrorPath)) {
  let mirror = null;
  try {
    mirror = JSON.parse(readFileSync(mirrorPath, 'utf8'));
  } catch {
    // checkArtifact already reported the parse failure.
  }
  if (mirror) {
    if (mirror.digest !== ID) {
      problems.push(
        `attestation.json records digest ${mirror.digest} but the manifest's is ${ID}`,
      );
    }
    const manifestFiles = F.files.map((f) => `${f.oid} ${f.path}`).sort().join('\n');
    const mirrorFiles = (mirror.files ?? []).map((f) => `${f.oid} ${f.path}`).sort().join('\n');
    if (manifestFiles !== mirrorFiles) {
      problems.push(
        'attestation.json lists a different file set than the manifest — the ' +
        'mirror is out of step with its source. Regenerate: npm run evidence',
      );
    }
    for (const [k, v] of Object.entries({
      gate: F.gate, model: F.model, verdict: F.verdict, scope: F.scope,
    })) {
      const got = k === 'scope' ? mirror.scope : mirror[k];
      if (v !== undefined && got !== v) {
        problems.push(`attestation.json ${k} is ${JSON.stringify(got)}, manifest says ${JSON.stringify(v)}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cross-artifact consistency
// ---------------------------------------------------------------------------
// review.json and findings.json are derived from one review, so their counts
// must agree. A mismatch means one was regenerated and the other was not — the
// staleness rule catches a *different* attestation, this catches a partial
// regeneration under the same one.
function loadArtifact(name) {
  const p = join(opt.dir, name);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}
const review = loadArtifact('review.json');
const findings = loadArtifact('findings.json');

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

// The attestation's own counts must agree with the artifacts derived from the
// same review. This is what stops a hand-edited artifact from reporting a clean
// review that the signed manifest contradicts.
if (review?.available && F.findings) {
  for (const [sev, n] of Object.entries(F.findings)) {
    const got = review.findings_by_severity?.[sev];
    if (got !== undefined && got !== n) {
      problems.push(
        `severity "${sev}": the attestation records ${n} but review.json says ${got}`,
      );
    }
  }
}

report();

// ---------------------------------------------------------------------------
function report() {
  const m = loadArtifact('metrics.json');
  const gateRow = (label, section, detail) => {
    if (!section) return `| ${label} | not present | |`;
    if (section.available === false) return `| ${label} | **not run** | ${section.reason} |`;
    const p = section.passed;
    return `| ${label} | ${p === true ? 'pass' : p === false ? '**FAIL**' : 'recorded'} | ${detail(section)} |`;
  };

  const head = [
    '| | |',
    '|---|---|',
    `| Attestation id | \`${ID ?? '?'}\` |`,
    `| Reviewed scope | \`${F?.scope ?? '?'}\` |`,
    `| Reviewed at commit | \`${(F?.head ?? '?').slice(0, 12)}\` |`,
    `| Verifying commit | \`${(typeof headSha === 'string' ? headSha : '?').slice(0, 12)}\` |`,
    `| Gate | \`${F?.gate ?? '?'}\` (required at least \`${opt.requireGate}\`) |`,
    `| Verdict | \`${F?.verdict ?? '?'}\` |`,
    `| Files attested | ${F?.files.length ?? '?'} |`,
    `| Files changed here | ${changed === null ? 'not computed' : changed.length} |`,
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
  if (process.env.GITHUB_STEP_SUMMARY) {
    // Appended, not written: the aggregate job adds to the same summary.
    import('node:fs').then(({ appendFileSync }) => {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`);
    });
  }
  if (!ok) {
    process.stderr.write(
      `\n::error title=Evidence bundle::${problems.length} problem(s) — see the job summary.\n`,
    );
    process.exit(1);
  }
  process.exit(0);
}
