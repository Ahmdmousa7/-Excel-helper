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

  // What the app pins today, checked against that list.
  const PINNED = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
  process.stdout.write('\nModels this app currently requests:\n');
  for (const p of PINNED) {
    process.stdout.write(`  ${usable.includes(p) ? 'OK      ' : 'MISSING '}${p}\n`);
  }

  const missing = PINNED.filter((p) => !usable.includes(p));
  if (missing.length > 0) {
    process.stdout.write(
      `\n${missing.length} pinned model(s) are unavailable — every feature using them returns 404.\n` +
      'Update GEMINI_FLASH / GEMINI_PRO in services/geminiService.ts to ids from the list above.\n',
    );
    process.exit(1);
  }

  process.stdout.write('\nAll pinned models are available.\n');
} catch (err) {
  process.stderr.write(`Could not reach the Gemini API: ${safe(err?.message ?? err)}\n`);
  process.exit(1);
}
