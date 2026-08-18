#!/usr/bin/env node
//
// jwt-lifetime.mjs — report a JWT's lifetime WITHOUT disclosing the token.
//
// WHY THIS EXISTS
// ---------------
// TD-048 needs one fact: how long the deleted Magic Links tab's admin bearer
// token stayed valid. That fact is inside the token — a JWT carries `iat` and
// `exp` in its payload — so it can be read locally, with no network call and no
// need to send the credential anywhere.
//
// WHAT IT GUARANTEES
// ------------------
//   * NO NETWORK. There is no fetch, no import that can reach one. It does not
//     contact admin.platform.rewaatech.com or anything else. Verify by reading
//     it: the only imports are `node:readline` and `node:process`.
//   * IT PRINTS FOUR FIELDS AND NOTHING ELSE — issuedAt, expiresAt, lifetime,
//     expired. Not the token, not the signature, not the header, and no other
//     payload claim. Errors never quote the input either, so a malformed paste
//     cannot end up on screen or in a scrollback buffer.
//   * IT DOES NOT WRITE THE TOKEN ANYWHERE. No temp file, no log.
//
// USAGE — stdin is the safer of the two:
//
//   PowerShell:
//     Get-Clipboard | node scripts/jwt-lifetime.mjs
//   bash:
//     pbpaste | node scripts/jwt-lifetime.mjs        # macOS
//     node scripts/jwt-lifetime.mjs                   # then paste, then Ctrl-D
//
//   Environment variable, if that suits your shell better:
//     $env:JWT = '<token>'; node scripts/jwt-lifetime.mjs   # PowerShell
//     JWT='<token>' node scripts/jwt-lifetime.mjs           # bash
//
// STDIN IS PREFERRED because an environment variable lives in the process
// environment for the life of the shell, where other tooling can read it, and
// `$env:JWT = '...'` is recorded in PowerShell history. A pipe is neither
// stored nor recorded.
//
// The token is NOT accepted as a command-line argument, on purpose: argv lands
// in shell history and is visible in `ps` and Task Manager while the process
// runs. If you pass one it is refused without being echoed.

import { createInterface } from 'node:readline';
import process from 'node:process';

/** Everything this script is allowed to say about a failure. No input echoed. */
const REFUSALS = {
  argv:
    'Refusing a token passed as an argument: argv is recorded in shell history and\n' +
    'visible in `ps` / Task Manager. Pipe it on stdin instead, or set $JWT.',
  none:
    'No token supplied. Pipe one on stdin, or set the JWT environment variable.\n' +
    '  PowerShell:  Get-Clipboard | node scripts/jwt-lifetime.mjs\n' +
    '  bash:        node scripts/jwt-lifetime.mjs   (paste, then Ctrl-D)',
  shape: 'That is not a JWT: expected three dot-separated segments.',
  payload: 'The payload segment is not valid base64url-encoded JSON.',
  claims: 'The payload carries neither an `exp` nor an `iat` claim, so it says nothing about lifetime.',
};

function die(message) {
  process.stderr.write(message + '\n');
  process.exit(2);
}

/** Read the token from stdin if piped, else from $JWT. Never from argv. */
async function readToken() {
  // A token in argv is refused before anything else, so the mistake is caught
  // rather than silently accepted.
  if (process.argv.length > 2) die(REFUSALS.argv);

  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    let first = '';
    for await (const line of rl) {
      if (line.trim()) { first = line; break; }
    }
    rl.close();
    if (first.trim()) return first;
  }
  return process.env.JWT ?? '';
}

/** base64url → JSON object. Throws without including the input. */
function decodePayload(segment) {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  let text;
  try {
    text = Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    die(REFUSALS.payload);
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') die(REFUSALS.payload);
    return parsed;
  } catch {
    // Deliberately does not report what was found — that would disclose payload.
    die(REFUSALS.payload);
  }
}

const raw = (await readToken()).trim();
if (!raw) die(REFUSALS.none);

// Tolerate a leading "Bearer " and stray wrapping quotes, which is how these get
// copied out of devtools.
const token = raw.replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '').trim();
const parts = token.split('.');
if (parts.length !== 3) die(REFUSALS.shape);

const claims = decodePayload(parts[1]);

// Only these two are ever read. Nothing else in the payload is touched.
const iat = typeof claims.iat === 'number' ? claims.iat : null;
const exp = typeof claims.exp === 'number' ? claims.exp : null;
if (iat === null && exp === null) die(REFUSALS.claims);

const iso = (s) => new Date(s * 1000).toISOString();

const issuedAt = iat === null ? 'unknown (no iat claim)' : iso(iat);

const expiresAt =
  exp === null
    ? 'NEVER — no exp claim, so this token does not expire on its own'
    : iso(exp);

const lifetime =
  exp === null || iat === null
    ? 'unknown (needs both iat and exp)'
    : (() => {
        const secs = exp - iat;
        const h = Math.floor(secs / 3600);
        const m = Math.round((secs % 3600) / 60);
        const d = (secs / 86400).toFixed(2);
        return `${secs}s = ${h}h ${m}m (${d} days)`;
      })();

const expired =
  exp === null ? 'false — it has no expiry' : String(Date.now() > exp * 1000);

// The entire output. Four fields, nothing derived from any other claim.
process.stdout.write(
  `issuedAt:  ${issuedAt}\n` +
  `expiresAt: ${expiresAt}\n` +
  `lifetime:  ${lifetime}\n` +
  `expired:   ${expired}\n`,
);
