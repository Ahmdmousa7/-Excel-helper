#!/usr/bin/env node
//
// list-gemini-models.mjs — ask Google which models your key can actually use.
//
// WHY THIS EXISTS
// ---------------
// The app pins model ids as string literals. Google ships those as *preview*
// releases and retires them, and when one goes the failure is a 404 buried in a
// JSON blob at the moment a user clicks a button:
//
//   "This model models/gemini-3-pro-preview is no longer available."
//
// Guessing a replacement id and shipping it is how you get a second outage. This
// asks the API instead. The answer is authoritative and specific to YOUR key —
// availability differs by tier.
//
// The key is never printed, never written anywhere, and never leaves this
// process except in the request to Google.
//
// Usage:
//   node scripts/list-gemini-models.mjs YOUR_API_KEY
//   GEMINI_API_KEY=... node scripts/list-gemini-models.mjs
//
// Get the key from the app's API Key modal, or https://aistudio.google.com/app/apikey

import { readFile } from 'node:fs/promises';

const key = process.argv[2] || process.env.GEMINI_API_KEY;

if (!key) {
  process.stderr.write(
    'Usage: node scripts/list-gemini-models.mjs YOUR_API_KEY\n' +
    '   or: GEMINI_API_KEY=... node scripts/list-gemini-models.mjs\n',
  );
  process.exit(2);
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Redact anything that looks like the key, so no paste of this output leaks it. */
const safe = (s) => String(s).split(key).join('«KEY»');

try {
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}&pageSize=200`);
  const body = await res.text();

  if (!res.ok) {
    process.stderr.write(`HTTP ${res.status}\n${safe(body)}\n`);
    process.exit(1);
  }

  const { models = [] } = JSON.parse(body);

  // Only models that can answer a generateContent call are usable here; the list
  // also carries embedding and tuning-only entries.
  const usable = models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name).replace(/^models\//, ''))
    .sort();

  process.stdout.write(`${usable.length} model(s) support generateContent on this key:\n\n`);
  for (const name of usable) process.stdout.write(`  ${name}\n`);

  // The app's candidates, read from the service so this cannot drift from what
  // the app actually asks for — a checker that validates a stale list is worse
  // than none. Kept as a regex rather than an import so this stays a plain
  // dependency-free script.
  const source = await readFile(
    new URL('../services/geminiService.ts', import.meta.url),
    'utf8',
  );
  const block = /MODEL_CANDIDATES[^=]*=\s*\{([\s\S]*?)\n\};/.exec(source);
  const candidates = {};
  for (const [, tier, body] of (block?.[1] ?? '').matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
    candidates[tier] = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }

  process.stdout.write('\nWhat this app will try, in order:\n');
  let anyTierDead = false;
  for (const [tier, list] of Object.entries(candidates)) {
    const firstAlive = list.find((m) => usable.includes(m));
    process.stdout.write(`\n  ${tier}:\n`);
    for (const m of list) {
      const mark = !usable.includes(m) ? 'RETIRED ' : m === firstAlive ? 'USED -> ' : 'spare   ';
      process.stdout.write(`    ${mark}${m}\n`);
    }
    if (!firstAlive) {
      anyTierDead = true;
      process.stdout.write(`    !! no usable model for "${tier}" — this tier is broken\n`);
    }
  }

  if (anyTierDead) {
    process.stdout.write(
      '\nAt least one tier has no working model. Add an id from the list above to\n' +
      'MODEL_CANDIDATES in services/geminiService.ts.\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    '\nEvery tier resolves. Retired entries are skipped automatically at runtime;\n' +
    'removing them from MODEL_CANDIDATES just saves one wasted request per session.\n',
  );
} catch (err) {
  process.stderr.write(`Could not reach the Gemini API: ${safe(err?.message ?? err)}\n`);
  process.exit(1);
}
