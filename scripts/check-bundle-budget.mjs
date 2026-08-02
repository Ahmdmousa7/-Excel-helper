#!/usr/bin/env node
/**
 * Bundle size budget gate.
 *
 * Budgets are declared in `bundle-budget.json` and enforced against `dist/`
 * after a build. Two things this does that a naive size check does not:
 *
 *  1. It gates on GZIPPED size, because that is what users actually download.
 *     Raw byte counts over-report by ~3x and make the budget feel arbitrary.
 *  2. It carries a `current` value alongside each `budget`, so the report
 *     shows the trend, not just pass/fail. A change that adds 300 KB while
 *     staying under budget is still worth seeing in the PR.
 *
 * Exit 0 = within budget · 1 = exceeded · 2 = usage/config error.
 *
 *   node scripts/check-bundle-budget.mjs [--dist dist] [--budget bundle-budget.json]
 *   node scripts/check-bundle-budget.mjs --update    # rewrite `current` values
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const DIST = opt('dist', 'dist');
const BUDGET_FILE = opt('budget', 'bundle-budget.json');
const UPDATE = args.includes('--update');

if (!existsSync(DIST)) {
  console.error(`bundle-budget: '${DIST}' does not exist — run the build first.`);
  process.exit(2);
}
if (!existsSync(BUDGET_FILE)) {
  console.error(`bundle-budget: '${BUDGET_FILE}' not found.`);
  process.exit(2);
}

const config = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));

/** Every file under dir, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(DIST).map((path) => {
  const raw = readFileSync(path);
  return {
    path,
    name: basename(path),
    ext: extname(path).toLowerCase(),
    bytes: statSync(path).size,
    gzip: gzipSync(raw, { level: 9 }).length,
  };
});

const kb = (n) => n / 1024;
const fmt = (n) => `${kb(n).toFixed(1)} KB`;

/** Sum gzipped bytes for files matching a set of extensions. */
const sumBy = (exts) =>
  files.filter((f) => exts.includes(f.ext)).reduce((a, f) => a + f.gzip, 0);

/**
 * The largest single JS file. This is the metric that matters most for a SPA:
 * a total that is split across ten cacheable chunks is fine, a total that is
 * one blocking chunk is not.
 */
const jsFiles = files.filter((f) => f.ext === '.js').sort((a, b) => b.gzip - a.gzip);
const largestJs = jsFiles[0]?.gzip ?? 0;

const measured = {
  'largest-js-chunk': largestJs,
  'total-js': sumBy(['.js']),
  'total-css': sumBy(['.css']),
  'total-images': sumBy(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']),
  'total-assets': files.reduce((a, f) => a + f.gzip, 0),
};

if (UPDATE) {
  for (const [key, value] of Object.entries(measured)) {
    if (config.budgets[key]) config.budgets[key].current = Math.round(kb(value) * 10) / 10;
  }
  writeFileSync(BUDGET_FILE, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`bundle-budget: updated 'current' values in ${BUDGET_FILE}`);
  process.exit(0);
}

const rows = [];
let failed = 0;

for (const [key, spec] of Object.entries(config.budgets)) {
  const actualKb = kb(measured[key] ?? 0);
  const budgetKb = spec.budget;
  const prevKb = spec.current ?? null;
  const over = actualKb > budgetKb;
  if (over) failed++;

  let delta = '—';
  if (prevKb !== null) {
    const d = actualKb - prevKb;
    // Ignore sub-0.1 KB noise so the report does not cry wolf on rounding.
    delta = Math.abs(d) < 0.1 ? '±0' : `${d > 0 ? '+' : ''}${d.toFixed(1)} KB`;
  }

  rows.push({
    key,
    label: spec.label ?? key,
    actual: actualKb,
    budget: budgetKb,
    delta,
    over,
    pct: budgetKb > 0 ? Math.round((actualKb / budgetKb) * 100) : 0,
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const lines = [];
lines.push('## Bundle budget');
lines.push('');
lines.push('| Metric | Gzipped | Budget | Used | Δ since last | |');
lines.push('|---|---:|---:|---:|---:|:---:|');
for (const r of rows) {
  lines.push(
    `| ${r.label} | ${r.actual.toFixed(1)} KB | ${r.budget} KB | ${r.pct}% | ${r.delta} | ${r.over ? 'OVER' : 'ok'} |`,
  );
}
lines.push('');
lines.push('<details><summary>Largest files</summary>');
lines.push('');
lines.push('| File | Raw | Gzipped |');
lines.push('|---|---:|---:|');
for (const f of files.sort((a, b) => b.gzip - a.gzip).slice(0, 12)) {
  lines.push(`| \`${f.name}\` | ${fmt(f.bytes)} | ${fmt(f.gzip)} |`);
}
lines.push('');
lines.push('</details>');

const report = lines.join('\n');
console.log(report);

if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`, { flag: 'a' });
}

if (failed > 0) {
  console.error('');
  for (const r of rows.filter((x) => x.over)) {
    const excess = (r.actual - r.budget).toFixed(1);
    console.error(
      `::error title=Bundle budget::${r.label} is ${r.actual.toFixed(1)} KB gzipped, ` +
        `${excess} KB over the ${r.budget} KB budget.`,
    );
  }
  console.error(
    `\nbundle-budget: ${failed} budget(s) exceeded. ` +
      `Raise the budget in ${BUDGET_FILE} only with a reason — the point is to notice growth, not to permit it.`,
  );
  process.exit(1);
}

console.error(`\nbundle-budget: all ${rows.length} budgets within limits.`);
process.exit(0);
