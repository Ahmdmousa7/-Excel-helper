#!/usr/bin/env node
/**
 * Record every origin the app requests, grouped by resource type.
 *
 * A Content-Security-Policy written from guesswork breaks things silently:
 * a missing `connect-src` entry surfaces as a feature that just stops working,
 * with the explanation buried in the console. This builds the policy from
 * observed traffic instead.
 *
 * Run against the built preview:
 *   npm run build:e2e && npx vite preview --port 4173 &
 *   node scripts/observe-origins.mjs
 *
 * It is a development aid, not a CI gate — the app's outbound surface only
 * changes when a dependency does, and this is how you find out what changed.
 */

import { chromium } from '@playwright/test';

const URL = process.env.OBSERVE_URL ?? 'http://127.0.0.1:4173/-Excel-helper/';

const browser = await chromium.launch();
const page = await browser.newPage();

const byType = new Map();
const cspViolations = [];

page.on('request', (req) => {
  let origin;
  try {
    origin = new global.URL(req.url()).origin;
  } catch {
    origin = req.url().slice(0, 40); // data:, blob:
  }
  const type = req.resourceType();
  if (!byType.has(type)) byType.set(type, new Set());
  byType.get(type).add(origin.startsWith('http') ? origin : `${origin.split(':')[0]}:`);
});

page.on('console', (m) => {
  if (/Content Security Policy|CSP/i.test(m.text())) cspViolations.push(m.text());
});

await page.addInitScript(() => {
  localStorage.setItem('gemini_api_key', 'observe-placeholder');
  localStorage.setItem('groq_api_key', '');
});

await page.goto(URL, { waitUntil: 'networkidle' }).catch(() => {});

// Exercise the tools most likely to reach the network or spawn a worker.
for (const label of [/QR/i, /Compare Files/i, /Remove Blanks/i, /Separator/i]) {
  const btn = page.locator('aside').getByRole('button').filter({ hasText: label }).first();
  if (await btn.count()) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(1200);
  }
}

const textarea = page.locator('textarea').first();
if (await textarea.count()) {
  await textarea.fill('https://example.com/csp-probe').catch(() => {});
  await page.waitForTimeout(1500);
}

await browser.close();

console.log('\nObserved origins by resource type\n');
for (const [type, origins] of [...byType].sort()) {
  console.log(`  ${type}`);
  for (const o of [...origins].sort()) console.log(`      ${o}`);
}

if (cspViolations.length) {
  console.log('\nCSP violations reported by the page:\n');
  for (const v of [...new Set(cspViolations)]) console.log(`  ${v}`);
} else {
  console.log('\nNo CSP violations reported.');
}
