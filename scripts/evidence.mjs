#!/usr/bin/env node
//
// evidence.mjs — assemble the engineering evidence bundle.
//
// Reads the attestation written by attest-review.mjs, plus whatever raw tool
// output the local gate captured into .apexyard/raw/, and emits the bundle:
//
//   .apexyard/attestation            the signed canonical manifest (unchanged)
//   .apexyard/attestation.json       machine-readable mirror of the same digest
//   .apexyard/review.json            verdict, model, gate, counts
//   .apexyard/findings.json          the itemised findings, deterministically ordered
//   .apexyard/metrics.json           typescript, eslint, vitest, playwright, bundle
//   .apexyard/architecture.json      layering, size, duplication — computed here
//   .apexyard/dependency-report.json direct deps, licences, production audit
//   .apexyard/accessibility-report.json  axe violations by rule and impact
//   .apexyard/review-summary.md      the human-readable companion
//
// Every JSON artifact carries `attestation_id`, which IS the attestation's
// digest. That is what makes staleness detectable without a timestamp: change a
// reviewed byte, the digest changes, and every artifact still naming the old id
// is provably stale.
//
// Usage:
//   node scripts/evidence.mjs [--raw <dir>] [--out <dir>] [--check]
//
//   --check  regenerate into memory and compare with what is on disk, byte for
//            byte, without writing. This is how determinism is proven rather
//            than asserted.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAttestation } from './lib/attestation.mjs';
import {
  BUNDLE_DIR, SUMMARY_FILE, canonicalJson, envelope,
} from './lib/evidence.mjs';
import {
  collectReview, collectFindings, collectTypescript, collectEslint, collectVitest,
  collectPlaywright, collectBundle, collectDependencies, collectAccessibility,
  collectArchitecture, SEVERITY_ORDER,
} from './lib/collectors.mjs';

const ROOT = process.cwd();

const opt = { raw: join(BUNDLE_DIR, 'raw'), out: BUNDLE_DIR, check: false };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const need = (n) => {
    if (i + 1 >= args.length) { process.stderr.write(`${n} requires a value\n`); process.exit(2); }
    return args[i += 1];
  };
  switch (args[i]) {
    case '--raw':   opt.raw = need('--raw'); break;
    case '--out':   opt.out = need('--out'); break;
    case '--check': opt.check = true; break;
    default:
      process.stderr.write(`evidence: unknown option ${args[i]}\n`);
      process.exit(2);
  }
}

function fail(msg, code = 1) {
  process.stderr.write(`evidence: ${msg}\n`);
  process.exit(code);
}

function readJsonOrNull(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
function readTextOrNull(path) {
  if (!existsSync(path)) return null;
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

/**
 * Merge the per-worker axe shards.
 *
 * The accessibility suite writes `axe-summary.<workerIndex>.json` because
 * Playwright's `afterAll` runs once per worker and `fullyParallel` spreads the
 * scans across them. A single shared file meant the last worker to finish
 * overwrote the rest, so the artifact silently reported one worker's subset.
 *
 * Merging is a union of violations and pages. `known_debt_rules` is the same
 * allow-list in every shard, so the first one wins. Everything is sorted,
 * because the artifact has to reproduce byte for byte and worker completion
 * order does not.
 */
function readAxeShards(dir) {
  if (!existsSync(dir)) return null;

  // No try/catch around readdirSync.
  //
  // It had one, and the bare `catch` swallowed a ReferenceError from a missing
  // import — so this function returned null and the accessibility artifact
  // reported `available: false` on every run. The bug was invisible precisely
  // because the failure path looked like the legitimate "no shards yet" answer.
  //
  // The directory's existence is already checked above; anything thrown past
  // that point is a programming error and should crash loudly.
  const names = readdirSync(dir).filter((f) => /^axe-summary\.\d+\.json$/.test(f)).sort();
  if (names.length === 0) return null;

  const merged = { standard: null, knownDebt: null, pages: new Set(), violations: [] };
  for (const name of names) {
    const shard = readJsonOrNull(join(dir, name));
    if (!shard) continue;
    merged.standard ??= shard.standard ?? null;
    if (merged.knownDebt === null && Array.isArray(shard.known_debt_rules)) {
      merged.knownDebt = shard.known_debt_rules;
    }
    for (const p of shard.pages ?? []) merged.pages.add(p);
    for (const v of shard.violations ?? []) merged.violations.push(v);
  }
  return {
    standard: merged.standard ?? undefined,
    known_debt_rules: merged.knownDebt ?? undefined,
    pages: [...merged.pages].sort(),
    violations: merged.violations.sort(
      (a, b) => String(a.id).localeCompare(String(b.id))
        || String(a.page).localeCompare(String(b.page)),
    ),
  };
}

// ---------------------------------------------------------------------------
// The attestation is the anchor. Without it there is nothing to bind to.
// ---------------------------------------------------------------------------
const attestationPath = join(opt.out, 'attestation');
if (!existsSync(attestationPath)) {
  fail(
    `no attestation at ${attestationPath}.\n` +
    '  The bundle hangs off the attestation\'s digest, so the review has to run\n' +
    '  first:  npm run review:local',
    3,
  );
}

let att;
try {
  att = parseAttestation(readFileSync(attestationPath, 'utf8'));
} catch (err) {
  fail(`attestation is malformed: ${err.message}`, 3);
}
const ID = att.digest;
const F = att.fields;

// ---------------------------------------------------------------------------
// Raw inputs
// ---------------------------------------------------------------------------
const reviewJson = readJsonOrNull(join(opt.out, 'review', 'review.json'));

const raw = {
  typescript: readTextOrNull(join(opt.raw, 'typescript.txt')),
  eslint: readJsonOrNull(join(opt.raw, 'eslint.json')),
  vitest: readJsonOrNull(join(opt.raw, 'vitest.json')),
  coverage: readJsonOrNull(join(ROOT, 'coverage', 'coverage-summary.json')),
  playwright: readJsonOrNull(join(opt.raw, 'playwright.json')),
  bundle: readJsonOrNull(join(opt.raw, 'bundle.json')),
  audit: readJsonOrNull(join(opt.raw, 'audit.json')),
  axe: readAxeShards(join(ROOT, 'test-results')) ?? readJsonOrNull(join(opt.raw, 'axe.json')),
};

const pkg = readJsonOrNull(join(ROOT, 'package.json'));

// Licences of direct dependencies, read from the installed tree. Absent when
// node_modules is not present, which is a legitimate state (a fresh clone), so
// it degrades to null per dependency rather than failing the bundle.
function directLicences(p) {
  if (!p) return {};
  const names = [
    ...Object.keys(p.dependencies ?? {}),
    ...Object.keys(p.devDependencies ?? {}),
  ];
  const out = {};
  for (const name of names) {
    const meta = readJsonOrNull(join(ROOT, 'node_modules', ...name.split('/'), 'package.json'));
    if (!meta) continue;
    const l = meta.license ?? meta.licenses;
    out[name] = typeof l === 'string' ? l
      : Array.isArray(l) ? l.map((x) => x.type ?? x).sort().join(' OR ')
      : l?.type ?? null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------
const attestationMirror = envelope('attestation.json', ID, {
  // A mirror, not a second source of truth. `.apexyard/attestation` remains the
  // canonical, signed, digest-bearing artifact — ADR-0002 said not to redesign
  // it, and a JSON rewrite would have changed the bytes the signature covers.
  // The verifier proves the two agree, so drift is impossible rather than
  // merely discouraged.
  authoritative_source: 'attestation',
  note: 'Mirror of the canonical text manifest. The digest below is computed over that manifest, not over this file.',
  digest: att.digest,
  scope: F.scope ?? null,
  reviewed_at_commit: F.head ?? null,
  model: F.model ?? null,
  gate: F.gate ?? null,
  verdict: F.verdict ?? null,
  findings_by_severity: Object.fromEntries(
    SEVERITY_ORDER.map((s) => [s, F.findings?.[s] ?? 0]),
  ),
  files: F.files.map(({ path, oid }) => ({ path, oid })),
  file_count: F.files.length,
});

const review = envelope('review.json', ID,
  collectReview(reviewJson, { model: F.model ?? null, gate: F.gate ?? null }));

const findings = envelope('findings.json', ID, collectFindings(reviewJson));

const metrics = envelope('metrics.json', ID, {
  typescript: collectTypescript(raw.typescript),
  eslint: collectEslint(raw.eslint, ROOT),
  vitest: collectVitest(raw.vitest, raw.coverage),
  playwright: collectPlaywright(raw.playwright),
  bundle: collectBundle(raw.bundle),
});

const architecture = envelope('architecture.json', ID, collectArchitecture(ROOT));

const dependencies = envelope('dependency-report.json', ID, collectDependencies({
  pkg, auditJson: raw.audit, licences: directLicences(pkg),
}));

const accessibility = envelope('accessibility-report.json', ID,
  collectAccessibility(raw.axe));

// ---------------------------------------------------------------------------
// review-summary.md
// ---------------------------------------------------------------------------
function yesNo(v) {
  if (v === true) return 'pass';
  if (v === false) return '**FAIL**';
  return 'not run';
}
function section(m) {
  return m.available === false ? `not captured — ${m.reason}` : null;
}

function renderSummary() {
  const L = [];
  L.push('# Engineering evidence');
  L.push('');
  L.push(
    'Generated by `npm run evidence` from the local review and the local quality',
    'gate. Every artifact in this directory carries the same `attestation_id`,',
    'which is the digest of the review attestation — so an artifact generated for',
    'a different state of the code is detectable without any notion of time.',
  );
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| Attestation id | \`${ID}\` |`);
  L.push(`| Reviewed scope | \`${F.scope ?? '?'}\` |`);
  L.push(`| Reviewed at commit | \`${(F.head ?? '?').slice(0, 12)}\` |`);
  L.push(`| Model | \`${F.model ?? '?'}\` |`);
  L.push(`| Gate | \`${F.gate ?? '?'}\` |`);
  L.push(`| Verdict | **${F.verdict ?? '?'}** |`);
  L.push(`| Files reviewed | ${F.files.length} |`);
  L.push('');

  L.push('## What this is, and what it is not');
  L.push('');
  L.push(
    'This bundle is an **attestation**, not cryptographic proof. It shows that a',
    'review covering exactly this code was recorded, and that the recorded quality',
    'signals belong to the same state of the code. It cannot show that a model was',
    'invoked: the machine that writes these files is the machine that could write',
    'them by hand. See `docs/adr/ADR-0002` and `ADR-0003`.',
  );
  L.push('');

  L.push('## Review');
  L.push('');
  const rNote = section(review);
  if (rNote) {
    L.push(rNote);
  } else {
    L.push('| Severity | Count |');
    L.push('|---|---:|');
    for (const s of SEVERITY_ORDER) {
      L.push(`| ${s} | ${review.findings_by_severity[s]} |`);
    }
    if (review.summary) { L.push(''); L.push(review.summary); }
  }
  L.push('');

  L.push('## Quality gates');
  L.push('');
  L.push('| Gate | Result | Detail |');
  L.push('|---|---|---|');
  const m = metrics;
  L.push(`| TypeScript | ${yesNo(m.typescript.passed ?? null)} | ${
    m.typescript.available === false ? m.typescript.reason : `${m.typescript.errors} error(s)`} |`);
  L.push(`| ESLint | ${yesNo(m.eslint.passed ?? null)} | ${
    m.eslint.available === false ? m.eslint.reason
      : `${m.eslint.errors} error(s), ${m.eslint.warnings} warning(s)`} |`);
  L.push(`| Vitest | ${yesNo(m.vitest.passed ?? null)} | ${
    m.vitest.available === false ? m.vitest.reason
      : `${m.vitest.tests?.passed ?? '?'}/${m.vitest.tests?.total ?? '?'} passed${
        m.vitest.coverage ? `, lines ${m.vitest.coverage.lines_pct}%` : ''}`} |`);
  L.push(`| Playwright | ${yesNo(m.playwright.passed ?? null)} | ${
    m.playwright.available === false ? m.playwright.reason
      : `${m.playwright.passed_count}/${m.playwright.total} passed`} |`);
  L.push(`| Bundle budget | ${yesNo(m.bundle.passed ?? null)} | ${
    m.bundle.available === false ? m.bundle.reason
      : `${m.bundle.budgets_ok ?? '?'} budget(s) within limits`} |`);
  L.push(`| Production audit | ${yesNo(dependencies.audit?.passed ?? null)} | ${
    dependencies.audit?.available === false ? dependencies.audit.reason
      : `${dependencies.audit?.critical ?? '?'} critical, ${dependencies.audit?.high ?? '?'} high`} |`);
  L.push(`| Accessibility | ${yesNo(accessibility.passed ?? null)} | ${
    accessibility.available === false ? accessibility.reason
      : `${accessibility.violations_total} violation node(s)`} |`);
  L.push('');
  L.push(
    'A gate reading **not run** is not a gate that passed. Nothing in this bundle',
    'reports zero failures for a tool that never executed.',
  );
  L.push('');

  L.push('## Architecture');
  L.push('');
  L.push(`- ${architecture.source_files} source files, ${architecture.total_loc} lines`);
  L.push(`- Layering violations: **${architecture.layering.violation_count}**`);
  L.push(`- Files over ${architecture.oversized.threshold_loc} lines: **${architecture.oversized.count}**`);
  L.push(`- Probable duplicate implementations: **${architecture.probable_duplicates.length}**`);
  if (architecture.oversized.count > 0) {
    L.push('');
    L.push('<details><summary>Largest files</summary>');
    L.push('');
    L.push('| File | Lines |');
    L.push('|---|---:|');
    for (const f of architecture.oversized.files.slice(0, 10)) {
      L.push(`| \`${f.file}\` | ${f.loc} |`);
    }
    L.push('');
    L.push('</details>');
  }
  L.push('');

  L.push('## Dependencies');
  L.push('');
  L.push(`- ${dependencies.production_count} production, ${dependencies.development_count} development`);
  const lic = Object.entries(dependencies.licences ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k} (${v})`).join(', ');
  if (lic) L.push(`- Licences: ${lic}`);
  L.push('');

  L.push('## Artifacts');
  L.push('');
  L.push('| File | Contents |');
  L.push('|---|---|');
  L.push('| `attestation` | The canonical, signed, blob-hash manifest. Authoritative. |');
  L.push('| `attestation.json` | Machine-readable mirror of the same digest. |');
  L.push('| `review.json` | Verdict, model, gate, severity counts. |');
  L.push('| `findings.json` | Every finding, ordered deterministically. |');
  L.push('| `metrics.json` | TypeScript, ESLint, Vitest, Playwright, bundle. |');
  L.push('| `architecture.json` | Layering, file size, duplication. |');
  L.push('| `dependency-report.json` | Direct dependencies, licences, production audit. |');
  L.push('| `accessibility-report.json` | axe violations by rule and impact. |');
  L.push('');
  L.push('Verify with `node scripts/verify-evidence.mjs --base origin/main`.');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Write, or check
// ---------------------------------------------------------------------------
const files = new Map([
  ['attestation.json', canonicalJson(attestationMirror)],
  ['review.json', canonicalJson(review)],
  ['findings.json', canonicalJson(findings)],
  ['metrics.json', canonicalJson(metrics)],
  ['architecture.json', canonicalJson(architecture)],
  ['dependency-report.json', canonicalJson(dependencies)],
  ['accessibility-report.json', canonicalJson(accessibility)],
  [SUMMARY_FILE, renderSummary()],
]);

if (opt.check) {
  // Proving determinism rather than claiming it: regenerate and compare bytes.
  const diffs = [];
  for (const [name, want] of files) {
    const path = join(opt.out, name);
    if (!existsSync(path)) { diffs.push(`${name} is missing`); continue; }
    const have = readFileSync(path, 'utf8');
    if (have !== want) {
      diffs.push(`${name} differs from a fresh generation (${have.length} vs ${want.length} bytes)`);
    }
  }
  if (diffs.length > 0) {
    process.stderr.write(
      'evidence --check: the bundle on disk is not what regenerating produces:\n' +
      diffs.map((d) => `  - ${d}\n`).join('') +
      '\n  Either an artifact was hand-edited, or a collector is not deterministic.\n' +
      '  Regenerate with: npm run evidence\n',
    );
    process.exit(1);
  }
  process.stdout.write(`evidence --check: all ${files.size} artifacts reproduce byte for byte.\n`);
  process.exit(0);
}

mkdirSync(opt.out, { recursive: true });
for (const [name, text] of files) writeFileSync(join(opt.out, name), text, 'utf8');

const notRun = [];
for (const [k, v] of Object.entries(metrics)) {
  if (v && typeof v === 'object' && v.available === false) notRun.push(k);
}
if (accessibility.available === false) notRun.push('accessibility');
if (dependencies.audit?.available === false) notRun.push('audit');

process.stdout.write(
  `evidence: wrote ${files.size} artifacts to ${opt.out}/ (attestation_id ${ID.slice(0, 19)}…)\n`,
);
if (notRun.length > 0) {
  process.stdout.write(
    `  not captured: ${notRun.join(', ')} — recorded as available:false, not as passing.\n`,
  );
}
