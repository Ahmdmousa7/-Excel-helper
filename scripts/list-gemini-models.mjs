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
// The key is never printed by this script — `safe()` redacts it from every line
// of output, so the result is safe to paste into a chat or an issue.
//
// It is NOT safe from your shell, though. A key passed as an argument lands in
// `.bash_history` / `ConsoleHost_history.txt` and is visible in `ps` and Task
// Manager for the life of the process. The environment-variable form avoids
// both, so it is listed first:
//
//   PowerShell:
//     $env:GEMINI_API_KEY = "AIza..."
//     node scripts/list-gemini-models.mjs
//
//   bash:
//     GEMINI_API_KEY=AIza... node scripts/list-gemini-models.mjs
//
//   Argument form, convenient and less private:
//     node scripts/list-gemini-models.mjs AIza...
//
// Get the key from the app's API Key modal, or https://aistudio.google.com/app/apikey

import { readFile } from 'node:fs/promises';

const key = process.argv[2] || process.env.GEMINI_API_KEY;

if (!key) {
  process.stderr.write(
    'Give the script a Gemini API key.\n\n' +
    '  Preferred — keeps the key out of shell history:\n' +
    '    PowerShell:  $env:GEMINI_API_KEY = "AIza..."; node scripts/list-gemini-models.mjs\n' +
    '    bash:        GEMINI_API_KEY=AIza... node scripts/list-gemini-models.mjs\n\n' +
    '  Also works, but the key is recorded in your shell history:\n' +
    '    node scripts/list-gemini-models.mjs AIza...\n',
  );
  process.exit(2);
}

if (process.argv[2]) {
  process.stderr.write(
    'note: the key was passed as an argument, so your shell has recorded it.\n' +
    '      Use $env:GEMINI_API_KEY / GEMINI_API_KEY=... to avoid that.\n\n',
  );
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

  // Fail loudly if the parse came up empty.
  //
  // Without this, a reformat or a rename makes `candidates` `{}`, the loop below
  // never runs, and the script prints "Every tier resolves" and exits 0 — a false
  // all-clear from the exact tool `modelUnavailableError` tells users to trust.
  const tiers = Object.keys(candidates);
  if (tiers.length === 0 || tiers.some((t) => candidates[t].length === 0)) {
    process.stderr.write(
      'Could not read MODEL_CANDIDATES out of services/geminiService.ts.\n' +
      'The shape it expects is `tier: [ \'id\', ... ]` with single quotes.\n' +
      'Refusing to report on a list this script could not parse.\n',
    );
    process.exit(2);
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
