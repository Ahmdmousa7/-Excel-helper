// evidence.mjs — canonical serialisation and integrity rules for the
// engineering evidence bundle.
//
// The bundle extends the review attestation from ADR-0002 rather than replacing
// it. `.apexyard/attestation` stays exactly as it was: the signed, canonical,
// blob-hash manifest, and the only artifact whose digest is authoritative.
// Everything here hangs off that digest.
//
// THE ATTESTATION ID
// ------------------
// Every artifact carries `attestation_id`, and that id IS the attestation's
// digest — not a random uuid, not a counter, not a timestamp. That choice does
// the staleness work for free: the digest covers the reviewed files' content,
// so the moment any reviewed byte changes, the attestation's digest changes and
// every artifact still pointing at the old id is provably stale. There is
// nothing to expire, because freshness is not a function of time.
//
// DETERMINISM IS ENFORCED, NOT REQUESTED
// --------------------------------------
// "Deterministic, no timestamps" is easy to state and easy to violate by
// accident — one `duration_ms` from a test reporter and the bundle differs on
// every run. So it is checked mechanically: `assertDeterministic` rejects
// timestamp-shaped keys and values, and `isCanonical` proves a file was written
// in canonical form. Both run in CI. A rule nothing checks is a comment.

import { createHash } from 'node:crypto';

export const BUNDLE_DIR = '.apexyard';

/** The artifacts the bundle must contain. CI fails if any is missing. */
export const REQUIRED_ARTIFACTS = [
  'attestation.json',
  'review.json',
  'findings.json',
  'metrics.json',
  'architecture.json',
  'dependency-report.json',
  'accessibility-report.json',
];

/** The human-readable companion. Checked for existence, not for content. */
export const SUMMARY_FILE = 'review-summary.md';

/** Schema ids. Bumped when a shape changes incompatibly, so a verifier reading
 *  an older bundle says so instead of silently misreading it. */
export const SCHEMAS = {
  'attestation.json': 'apexyard.evidence.attestation/1',
  'review.json': 'apexyard.evidence.review/1',
  'findings.json': 'apexyard.evidence.findings/1',
  'metrics.json': 'apexyard.evidence.metrics/1',
  'architecture.json': 'apexyard.evidence.architecture/1',
  'dependency-report.json': 'apexyard.evidence.dependencies/1',
  'accessibility-report.json': 'apexyard.evidence.accessibility/1',
};

// ---------------------------------------------------------------------------
// Canonical JSON
// ---------------------------------------------------------------------------

/**
 * Recursively sort object keys.
 *
 * Object key order in JS is insertion order, which is an artifact of how the
 * producer happened to build the object. Two runs computing identical facts
 * would otherwise emit different bytes, and the whole bundle rests on byte
 * equality being meaningful.
 *
 * Arrays keep their order — it is data. Producers sort arrays themselves where
 * the order carries no meaning.
 */
export function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value === null || typeof value !== 'object') return value;
  const out = {};
  for (const k of Object.keys(value).sort()) out[k] = sortKeysDeep(value[k]);
  return out;
}

function assertSerialisable(value, path = '$') {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${path}: ${value} is not representable in JSON`);
  }
  if (typeof value === 'undefined') {
    throw new Error(`${path}: undefined would be dropped silently; use null`);
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new Error(`${path}: ${typeof value} is not serialisable`);
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertSerialisable(v, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) assertSerialisable(v, `${path}.${k}`);
  }
}

/**
 * Serialise to the one form this project considers canonical: sorted keys,
 * two-space indent, LF, exactly one trailing newline.
 *
 * The trailing newline and the indent are pinned so that a reformat by an
 * editor or a stray `prettier` run shows up as a verification failure rather
 * than silently changing the bytes a reviewer compared.
 */
export function canonicalJson(value) {
  assertSerialisable(value);
  return JSON.stringify(sortKeysDeep(value), null, 2).replace(/\r\n/g, '\n') + '\n';
}

/** True when `text` is exactly what `canonicalJson` would produce for its own
 *  parsed value. Catches a hand edit, a reformat, or a producer that bypassed
 *  `canonicalJson`. */
export function isCanonical(text) {
  try {
    return canonicalJson(JSON.parse(text)) === text;
  } catch {
    return false;
  }
}

export function digestOf(text) {
  return 'sha256:' + createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

// ---------------------------------------------------------------------------
// Determinism guard
// ---------------------------------------------------------------------------

// Keys whose values vary run to run even when nothing changed. `duration` and
// `ms` are on the list for the same reason as `timestamp`: a test reporter
// hands them over without being asked, and one is enough to make the bundle
// differ on every run.
const FORBIDDEN_KEY = new RegExp(
  '^(.*_)?(' + [
    'time', 'times', 'timestamp', 'timestamps', 'date', 'datetime',
    'generated', 'generated_at', 'created_at', 'updated_at', 'ran_at',
    'started_at', 'finished_at', 'start_time', 'end_time',
    'duration', 'durations', 'duration_ms', 'elapsed', 'elapsed_ms', 'ms',
    'uptime', 'pid', 'hostname', 'cwd', 'tmpdir', 'random', 'seed', 'nonce',
  ].join('|') + ')$',
  'i',
);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;

/**
 * Collect everything that would make the bundle non-reproducible.
 *
 * Two routes to the same failure: a key that is inherently time-like, and a
 * date-shaped value under an innocuous key (`"version": "2026-08-03"`). The
 * second is only flagged for strings that actually parse as a date, so a semver
 * or a content hash is never caught by it.
 *
 * Returns every offending path rather than throwing on the first, so a producer
 * fixes them all in one pass.
 */
export function findNonDeterministic(value, path = '$', out = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findNonDeterministic(v, `${path}[${i}]`, out));
    return out;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(k)) out.push(`${path}.${k} (time-varying key "${k}")`);
      findNonDeterministic(v, `${path}.${k}`, out);
    }
    return out;
  }
  if (typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))) {
    out.push(`${path} (date-shaped value ${JSON.stringify(value)})`);
  }
  return out;
}

export function assertDeterministic(value, label = 'artifact') {
  const bad = findNonDeterministic(value);
  if (bad.length > 0) {
    throw new Error(
      `${label} contains non-reproducible content:\n` + bad.map((b) => `  - ${b}`).join('\n'),
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * Wrap a payload in the standard envelope.
 *
 * `schema` lets a future verifier refuse a shape it does not understand.
 * `attestation_id` is what binds this artifact to one specific reviewed state —
 * requirement 4, and the entire staleness mechanism.
 */
export function envelope(name, attestationId, payload) {
  const schema = SCHEMAS[name];
  if (!schema) throw new Error(`no schema registered for artifact ${name}`);
  if (typeof attestationId !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(attestationId)) {
    throw new Error(`attestation_id must be a sha256 digest, got ${JSON.stringify(attestationId)}`);
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload must be an object');
  }
  if ('schema' in payload || 'attestation_id' in payload) {
    throw new Error('payload must not set schema or attestation_id itself');
  }
  const artifact = { schema, attestation_id: attestationId, ...payload };
  assertDeterministic(artifact, name);
  return artifact;
}

// ---------------------------------------------------------------------------
// Verification rules
// ---------------------------------------------------------------------------

/**
 * Check one artifact in isolation, plus its binding to the current attestation.
 *
 * Every failure mode gets a distinct, quotable reason. A verifier that says only
 * "invalid" sends whoever reads it into the source to find out why.
 */
export function checkArtifact(name, text, expectedAttestationId) {
  const problems = [];

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return [`${name} is not valid JSON: ${err.message}`];
  }

  if (!isCanonical(text)) {
    problems.push(
      `${name} is not in canonical form (sorted keys, 2-space indent, single ` +
      'trailing newline). Regenerate it rather than editing it by hand.',
    );
  }

  const wantSchema = SCHEMAS[name];
  if (wantSchema && parsed.schema !== wantSchema) {
    problems.push(
      `${name} declares schema ${JSON.stringify(parsed.schema)}, expected ` +
      `${JSON.stringify(wantSchema)}`,
    );
  }

  if (typeof parsed.attestation_id !== 'string') {
    problems.push(`${name} has no attestation_id`);
  } else if (parsed.attestation_id !== expectedAttestationId) {
    // The staleness rule. Requirement 5, and the reason the id is the digest.
    problems.push(
      `${name} is STALE — generated for a different reviewed state\n` +
      `      artifact:    ${parsed.attestation_id}\n` +
      `      attestation: ${expectedAttestationId}`,
    );
  }

  const nd = findNonDeterministic(parsed);
  if (nd.length > 0) {
    problems.push(
      `${name} contains non-reproducible content: ${nd.slice(0, 3).join(', ')}` +
      (nd.length > 3 ? ` (+${nd.length - 3} more)` : ''),
    );
  }

  return problems;
}

/** Required artifacts absent from a set of present filenames, summary included. */
export function missingArtifacts(present) {
  const have = new Set(present);
  const missing = REQUIRED_ARTIFACTS.filter((a) => !have.has(a));
  if (!have.has(SUMMARY_FILE)) missing.push(SUMMARY_FILE);
  return missing;
}
