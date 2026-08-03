// collectors.mjs — turn raw tool output into deterministic bundle payloads.
//
// Each collector takes whatever a tool actually produced and returns a payload
// carrying only reproducible facts. Two rules govern all of them:
//
//   1. NEVER FABRICATE. If a tool did not run, the payload says
//      `available: false` with a reason. It does NOT report zero failures —
//      "0 failures" and "never ran" look identical in a summary table and mean
//      opposite things, and the second one silently reads as success.
//
//   2. DROP EVERYTHING THAT VARIES. Test reporters volunteer durations, start
//      times, worker ids, and absolute paths. All of it is discarded here, not
//      filtered later, so the artifact is reproducible by construction. The
//      determinism guard in evidence.mjs is the backstop, not the mechanism.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep, posix } from 'node:path';

/** Standard "this tool did not run" payload. */
export function unavailable(reason) {
  return { available: false, reason };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// review.json / findings.json
// ---------------------------------------------------------------------------

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

/**
 * Sort findings into a stable order: severity descending, then category, then
 * location, then the summary text. The model emits them in whatever order it
 * reasoned about them, which is not stable between runs over the same code.
 */
export function sortFindings(findings) {
  const rank = (s) => {
    const i = SEVERITY_ORDER.indexOf(String(s || '').toLowerCase());
    return i === -1 ? SEVERITY_ORDER.length : i;
  };
  return [...findings].sort((a, b) =>
    rank(a.severity) - rank(b.severity)
    || String(a.category || '').localeCompare(String(b.category || ''))
    || String(a.file || '').localeCompare(String(b.file || ''))
    || (Number(a.line || 0) - Number(b.line || 0))
    || String(a.summary || a.title || '').localeCompare(String(b.summary || b.title || '')),
  );
}

export function countBySeverity(findings) {
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  for (const f of findings) {
    const s = String(f.severity || '').toLowerCase();
    if (s in counts) counts[s] += 1;
  }
  return counts;
}

export function collectReview(reviewJson, { model, gate }) {
  if (!reviewJson) return unavailable('no review output at .apexyard/review/review.json');
  const findings = Array.isArray(reviewJson.findings) ? reviewJson.findings : [];
  return {
    available: true,
    gate,
    model,
    verdict: String(reviewJson.verdict || 'unknown').toLowerCase(),
    files_reviewed: Number(reviewJson.files_reviewed ?? 0),
    findings_total: findings.length,
    findings_by_severity: countBySeverity(findings),
    // The model's prose summary is kept: it is the one part a human reads
    // first, it is derived from the same reviewed content, and it carries no
    // credential or prompt text.
    summary: typeof reviewJson.summary === 'string' ? reviewJson.summary : null,
  };
}

export function collectFindings(reviewJson) {
  if (!reviewJson) return unavailable('no review output at .apexyard/review/review.json');
  const raw = Array.isArray(reviewJson.findings) ? reviewJson.findings : [];
  return {
    available: true,
    total: raw.length,
    by_severity: countBySeverity(raw),
    findings: sortFindings(raw).map((f) => ({
      category: f.category ?? null,
      file: f.file ?? null,
      // A line number is a property of the reviewed content, so it is stable.
      line: Number.isInteger(f.line) ? f.line : null,
      severity: String(f.severity || '').toLowerCase() || null,
      summary: f.summary ?? f.title ?? null,
      // `detail` and `suggested_fix` are the model's prose about code that is
      // already in the repository. No prompt text, no secrets.
      detail: typeof f.detail === 'string' ? f.detail : null,
      suggested_fix: typeof f.suggested_fix === 'string' ? f.suggested_fix : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// metrics.json sections
// ---------------------------------------------------------------------------

/** `tsc --noEmit` output. Deterministic: a count and the error codes. */
export function collectTypescript(text) {
  if (text === null) return unavailable('tsc output not captured; run npm run verify:local');
  const lines = text.split('\n').filter((l) => /error TS\d+/.test(l));
  const codes = {};
  for (const l of lines) {
    const m = l.match(/error (TS\d+)/);
    if (m) codes[m[1]] = (codes[m[1]] || 0) + 1;
  }
  return { available: true, errors: lines.length, error_codes: codes, passed: lines.length === 0 };
}

/** ESLint's JSON formatter. Per-rule counts, sorted; file paths made relative. */
export function collectEslint(json, root) {
  if (!json) return unavailable('eslint json output not captured; run npm run verify:local');
  let errors = 0;
  let warnings = 0;
  const rules = {};
  for (const file of json) {
    errors += file.errorCount ?? 0;
    warnings += file.warningCount ?? 0;
    for (const m of file.messages ?? []) {
      const id = m.ruleId ?? '(parse error)';
      rules[id] = rules[id] || { error: 0, warning: 0 };
      if (m.severity === 2) rules[id].error += 1; else rules[id].warning += 1;
    }
  }
  const worst = Object.entries(rules)
    .sort((a, b) =>
      (b[1].error + b[1].warning) - (a[1].error + a[1].warning) || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([rule, c]) => ({ rule, errors: c.error, warnings: c.warning }));
  return {
    available: true,
    errors,
    warnings,
    passed: errors === 0,
    files_with_findings: json.filter((f) => (f.errorCount ?? 0) + (f.warningCount ?? 0) > 0)
      .map((f) => toPosixRelative(f.filePath, root)).sort().length,
    top_rules: worst,
  };
}

/** Vitest's json reporter plus the v8 coverage summary. Counts and percentages
 *  only — every duration the reporter offers is discarded. */
export function collectVitest(runJson, coverageJson) {
  if (!runJson && !coverageJson) {
    return unavailable('vitest output not captured; run npm run verify:local');
  }
  const out = { available: true };
  if (runJson) {
    out.tests = {
      total: runJson.numTotalTests ?? null,
      passed: runJson.numPassedTests ?? null,
      failed: runJson.numFailedTests ?? null,
      skipped: (runJson.numPendingTests ?? 0) + (runJson.numTodoTests ?? 0),
      suites: runJson.numTotalTestSuites ?? null,
    };
    out.passed = (runJson.numFailedTests ?? 1) === 0;
  }
  if (coverageJson?.total) {
    const t = coverageJson.total;
    out.coverage = {
      branches_pct: t.branches?.pct ?? null,
      functions_pct: t.functions?.pct ?? null,
      lines_pct: t.lines?.pct ?? null,
      statements_pct: t.statements?.pct ?? null,
    };
  }
  return out;
}

/** Playwright's json reporter. Walks the suite tree for outcomes; keeps titles
 *  and statuses, discards durations, attachments, stdout, and worker ids. */
export function collectPlaywright(json) {
  if (!json) return unavailable('playwright json output not captured; run npm run e2e');
  let passed = 0; let failed = 0; let skipped = 0; let flaky = 0;
  const failures = [];

  const walk = (suite, trail) => {
    const here = suite.title ? [...trail, suite.title] : trail;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const status = test.status ?? test.results?.[test.results.length - 1]?.status;
        if (status === 'expected') passed += 1;
        else if (status === 'skipped') skipped += 1;
        else if (status === 'flaky') { flaky += 1; }
        else {
          failed += 1;
          failures.push([...here, spec.title].join(' > '));
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of json.suites ?? []) walk(suite, []);

  return {
    available: true,
    passed_count: passed,
    failed_count: failed,
    flaky_count: flaky,
    skipped_count: skipped,
    total: passed + failed + flaky + skipped,
    passed: failed === 0,
    failures: failures.sort(),
  };
}

/** The bundle budget checker's JSON mode. Sizes are content-derived, so stable
 *  for a given input. */
export function collectBundle(json) {
  if (!json) return unavailable('bundle report not captured; run npm run build');
  return { available: true, ...json };
}

// ---------------------------------------------------------------------------
// dependency-report.json
// ---------------------------------------------------------------------------

export function collectDependencies({ pkg, auditJson, licences }) {
  if (!pkg) return unavailable('package.json unreadable');

  const direct = (obj, kind) =>
    Object.entries(obj ?? {}).map(([name, range]) => ({
      name, range, kind, licence: licences?.[name] ?? null,
    }));

  const deps = [
    ...direct(pkg.dependencies, 'production'),
    ...direct(pkg.devDependencies, 'development'),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind));

  const out = {
    available: true,
    production_count: Object.keys(pkg.dependencies ?? {}).length,
    development_count: Object.keys(pkg.devDependencies ?? {}).length,
    direct: deps,
  };

  if (auditJson?.metadata?.vulnerabilities) {
    const v = auditJson.metadata.vulnerabilities;
    out.audit = {
      scope: 'production dependencies only (--omit=dev)',
      critical: v.critical ?? 0,
      high: v.high ?? 0,
      moderate: v.moderate ?? 0,
      low: v.low ?? 0,
      info: v.info ?? 0,
      total: v.total ?? 0,
      passed: (v.critical ?? 0) + (v.high ?? 0) === 0,
    };
    const advisories = Object.values(auditJson.vulnerabilities ?? {})
      .filter((a) => ['critical', 'high'].includes(a.severity))
      .map((a) => ({ name: a.name, severity: a.severity, range: a.range ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
    out.audit.blocking_advisories = advisories;
  } else {
    out.audit = unavailable('npm audit output not captured');
  }

  const licenceCounts = {};
  for (const d of deps) {
    const l = d.licence ?? 'unknown';
    licenceCounts[l] = (licenceCounts[l] || 0) + 1;
  }
  out.licences = licenceCounts;

  return out;
}

// ---------------------------------------------------------------------------
// accessibility-report.json
// ---------------------------------------------------------------------------

/** axe-core violations as emitted by the e2e accessibility suite. Grouped by
 *  rule and impact; node counts kept, selectors dropped (they are long, and the
 *  rule plus the page is what a human acts on). */
export function collectAccessibility(json) {
  if (!json) {
    return unavailable(
      'axe summary not captured; the accessibility e2e suite writes ' +
      'test-results/axe-summary.json when it runs',
    );
  }
  const byRule = {};
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  let total = 0;
  for (const entry of json.violations ?? []) {
    const id = entry.id ?? 'unknown';
    const nodes = Number(entry.nodes ?? entry.nodeCount ?? 1);
    byRule[id] = byRule[id] || { impact: entry.impact ?? null, nodes: 0, pages: [] };
    byRule[id].nodes += nodes;
    if (entry.page && !byRule[id].pages.includes(entry.page)) byRule[id].pages.push(entry.page);
    if (entry.impact && entry.impact in byImpact) byImpact[entry.impact] += nodes;
    total += nodes;
  }
  for (const r of Object.values(byRule)) r.pages.sort();

  // The gate is about rule CLASSES, not node counts: the e2e suite fails when a
  // violation comes from a rule outside KNOWN_A11Y_DEBT, and tolerates any
  // number of nodes from rules already on that list.
  //
  // An earlier version compared `violations_total` (nodes) against the
  // allow-list's *size* (rule classes) — 18 vs 7 — and reported `passed: false`
  // for a suite that passes. Two different units through one comparison. A
  // committed artifact that cries wolf is worse than one that says nothing,
  // because someone acts on it once and then stops believing any of it.
  const knownDebt = Array.isArray(json.known_debt_rules) ? [...json.known_debt_rules].sort() : null;
  const observedRules = Object.keys(byRule).sort();
  const unexpectedRules = knownDebt === null
    ? null
    : observedRules.filter((r) => !knownDebt.includes(r));

  return {
    available: true,
    standard: json.standard ?? 'WCAG 2.2 AA (axe-core)',
    pages_scanned: Array.isArray(json.pages) ? [...json.pages].sort() : null,
    violations_total: total,
    by_impact: byImpact,
    by_rule: Object.fromEntries(Object.entries(byRule).sort((a, b) => a[0].localeCompare(b[0]))),
    // Named for what it is: the allow-listed rule classes, and the ones observed
    // that are not on it. Both are rule classes, so the comparison is meaningful.
    known_debt_rules: knownDebt,
    unexpected_rules: unexpectedRules,
    passed: unexpectedRules === null ? null : unexpectedRules.length === 0,
  };
}

// ---------------------------------------------------------------------------
// architecture.json
// ---------------------------------------------------------------------------

// The layering this project holds itself to, from the ops fork's
// handbooks/architecture/frontend-boundaries.md:
//
//     components/ -> hooks/ -> services/ -> utils/
//
// Dependencies point one way. A higher layer may import a lower one; the
// reverse is a violation, because it makes the lower layer un-testable in
// isolation and drags UI concerns into pure logic.
const LAYER_RANK = { components: 3, hooks: 2, services: 1, utils: 0 };

const SOURCE_EXT = new Set(['.ts', '.tsx']);
const SKIP_DIR = new Set([
  'node_modules', '.git', 'dist', 'dist-e2e', 'coverage', 'test-results',
  'playwright-report', '.apexyard', 'app', 'applet',
]);

export function toPosixRelative(abs, root) {
  return relative(root, abs).split(sep).join(posix.sep);
}

function walkSources(dir, root, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.') && e.name !== '.githooks') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      walkSources(full, root, out);
    } else if (SOURCE_EXT.has(e.name.slice(e.name.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out;
}

function layerOf(relPath) {
  const top = relPath.split('/')[0];
  return top in LAYER_RANK ? top : null;
}

/**
 * Static architecture facts, computed from the repository rather than from a
 * tool's output — so this section is always available.
 *
 * The import scan is a regex, not a parser. That is a deliberate limit and it
 * is stated in the artifact: it sees static `import`/`export ... from` and
 * `import(...)`, and it will miss a path built at runtime. For layer-violation
 * detection that is the right trade — a parser would add a dependency and a
 * build step to catch cases that do not occur in this codebase.
 */
export function collectArchitecture(root, { locThreshold = 800 } = {}) {
  const files = walkSources(root, root);
  const byLayer = {};
  const oversized = [];
  const violations = [];
  const importRe = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

  let totalLoc = 0;

  for (const abs of files) {
    const rel = toPosixRelative(abs, root);
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const loc = text.split('\n').length;
    totalLoc += loc;

    // A file at the repo root has no directory. Grouping each one under its own
    // filename made `by_directory` list `App.tsx` and `firebase.ts` alongside
    // `components` as if they were peers.
    const parts = rel.split('/');
    const top = parts.length > 1 ? parts[0] : '(root)';
    const bucket = byLayer[top] || (byLayer[top] = { files: 0, loc: 0 });
    bucket.files += 1;
    bucket.loc += loc;

    if (loc > locThreshold) oversized.push({ file: rel, loc });

    const fromLayer = layerOf(rel);
    if (fromLayer === null) continue;

    for (const m of text.matchAll(importRe)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      const targetRel = toPosixRelative(resolve(dirname(abs), spec), root);
      const toLayer = layerOf(targetRel);
      if (toLayer === null) continue;
      if (LAYER_RANK[toLayer] > LAYER_RANK[fromLayer]) {
        violations.push({ from: rel, from_layer: fromLayer, to: targetRel, to_layer: toLayer });
      }
    }
  }

  // Files whose name differs only by a version suffix — the duplicate-
  // implementation smell that lets a fix land in the copy nobody routes to.
  const stems = {};
  for (const abs of files) {
    const rel = toPosixRelative(abs, root);
    const base = rel.replace(/\.(ts|tsx)$/, '');
    const stem = base.replace(/V\d+$/, '');
    if (stem !== base) (stems[stem] = stems[stem] || []).push(rel);
  }
  const duplicates = Object.entries(stems)
    .filter(([stem]) => files.some((f) => {
      const rel = toPosixRelative(f, root);
      return rel === `${stem}.tsx` || rel === `${stem}.ts`;
    }))
    .map(([stem, variants]) => ({ base: stem, variants: [...variants].sort() }))
    .sort((a, b) => a.base.localeCompare(b.base));

  const sortedLayers = Object.fromEntries(
    Object.entries(byLayer).sort((a, b) => a[0].localeCompare(b[0])),
  );

  return {
    available: true,
    method: 'regex import scan over .ts/.tsx; misses dynamically built paths',
    layering: {
      rule: 'components -> hooks -> services -> utils; a lower layer must not import a higher one',
      violations: violations
        .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
      violation_count: violations.length,
    },
    source_files: files.length,
    total_loc: totalLoc,
    by_directory: sortedLayers,
    oversized: {
      threshold_loc: locThreshold,
      count: oversized.length,
      files: oversized.sort((a, b) => b.loc - a.loc || a.file.localeCompare(b.file)),
    },
    probable_duplicates: duplicates,
  };
}

export { readJson, existsSync, statSync };
