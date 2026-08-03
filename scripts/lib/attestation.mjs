// attestation.mjs — the pure logic behind the review attestation.
//
// WHAT THIS IS, AND WHAT IT IS NOT
// --------------------------------
// This produces an *attestation*, not a proof. The distinction is the whole
// design, so it is stated first: nothing a local machine can generate is
// unforgeable to the person operating that machine. Whoever can run the
// review can also write its output by hand. There is no cryptography that
// changes this, because the secret and the subject are held by the same party.
//
// So the threat model is deliberately narrow:
//
//   DEFENDS AGAINST  forgetting. Amending a commit after reviewing, adding a
//                    file at the last minute, rebasing onto new work, pushing
//                    a branch you reviewed an hour and three commits ago.
//                    Every one of those silently invalidates a review, and
//                    every one is what actually happens in practice.
//
//   DOES NOT DEFEND  a maintainer who decides to fabricate an attestation.
//   AGAINST          That is a deliberate act, visible in the diff, and out of
//                    reach of any local scheme.
//
// Calling the artifact a "proof" would repeat the mistake this project already
// refused once — dressing an unenforced convention as a control. It is named
// an attestation everywhere, including in the file it writes.
//
// HOW THE BINDING WORKS
// ---------------------
// The attestation records, for every file in the review's scope, that file's
// **git blob OID** — the hash git already computes over its content. CI
// recomputes those OIDs from its own checkout and compares.
//
// Binding to content rather than to a commit SHA is the key choice:
//
//   - Change one byte of a reviewed file    -> new OID    -> attestation stale
//   - Add an unreviewed file                -> not listed -> coverage failure
//   - Delete a reviewed file                -> recorded, absence verified
//   - Rebase, amend a message, squash-merge -> same OIDs   -> still valid
//
// A commit-SHA binding would have failed that last row, which matters: a
// squash merge rewrites every SHA while changing no content, and invalidating
// the review there would train people to bypass the gate on every merge.
//
// ONE ARTIFACT, IN CANONICAL JSON
// -------------------------------
// The attestation is `.apexyard/attestation.json` and nothing else. It used to
// be a line-oriented text manifest with a JSON mirror beside it, which cost a
// verification rule — *mirror agrees with manifest* — that existed only because
// the mirror existed. Two files that must agree is a place for them to disagree.
// See ADR-0004.
//
// The digest is defined over the artifact itself:
//
//   attestation_id = sha256( canonicalJson( artifact without "attestation_id" ) )
//
// That rule is worth stating in one line because a verifier in another language
// has to reimplement it. Removing exactly one key is the whole trick: it lets
// the file carry its own digest without a separate header/body split, and it
// leaves every other field — including `schema` — inside what the digest covers.
//
// `canonicalJson` (lib/evidence.mjs) pins the serialisation the digest is taken
// over: keys sorted recursively, two-space indent, LF, one trailing newline. The
// attestation uses the same serialiser as every other bundle artifact rather
// than its own, so there is one definition of "canonical" in the system.
//
// There is deliberately **no timestamp**. A timestamp records when a file was
// written, which nobody needs to know, and it would make the digest differ on
// every run over identical content — destroying the one property that makes
// this verifiable. Freshness comes from the OIDs: they stop matching the moment
// the code changes, which is the actual question being asked.

import { canonicalJson, digestOf, SCHEMAS } from './evidence.mjs';

/** The one attestation artifact. Relative to the bundle directory. */
export const ATTESTATION_FILE = 'attestation.json';

/** Bumped from /1 when JSON became canonical. The shape barely moved — /1's
 *  mirror carried these same keys — but the *meaning* of the digest did: it is
 *  now taken over this file, not over a text manifest beside it. A verifier
 *  applying /1 semantics to a /2 artifact would recompute the wrong hash, so
 *  the id has to change with it. */
export const ATTESTATION_SCHEMA = SCHEMAS[ATTESTATION_FILE];

/** The namespace passed to `ssh-keygen -Y sign -n`. Domain separation: a
 *  signature made for this purpose cannot be replayed as a git commit
 *  signature, which uses the namespace "git". */
export const SIG_NAMESPACE = 'apexyard-review';

/** Marker for a path the review saw as deleted. Not a valid git OID, so it
 *  cannot collide with one. */
export const DELETED = 'deleted';

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

const OID_RE = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/** The string fields, in the JSON, that carry the review's identity. Mapped to
 *  shorter internal names on parse so callers are not rewritten every time a
 *  key is renamed for readability in the file. */
const STRING_FIELDS = {
  scope: 'scope',
  reviewed_at_commit: 'head',
  model: 'model',
  gate: 'gate',
  verdict: 'verdict',
};

// Two scales, deliberately separate. Merging them was a bug: `info` is a
// severity a finding can have, but not a threshold anyone would gate on, and
// `none` is a threshold but not a severity. One shared map made
// `gateSatisfied` throw on `info` the moment it walked every severity.

/** How bad a finding is, ascending. */
const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** `--fail-on X` means "fail if any finding is at least as bad as X", so a
 *  gate is the severity rank at which failure starts. `none` never fails, so
 *  its threshold is above every severity. A LOWER threshold is STRICTER. */
const GATE_THRESHOLD = { low: 1, medium: 2, high: 3, critical: 4, none: Infinity };

export function gateRank(gate) {
  const r = GATE_THRESHOLD[gate];
  if (r === undefined) throw new Error(`unknown gate level: ${gate}`);
  return r;
}

export function severityRank(sev) {
  const r = SEVERITY_RANK[sev];
  if (r === undefined) throw new Error(`unknown severity: ${sev}`);
  return r;
}

/**
 * Sort paths by raw UTF-8 bytes.
 *
 * Not `Array.prototype.sort()`. That compares UTF-16 code units, which orders
 * non-BMP characters (emoji, some CJK extensions) differently from the byte
 * order git and `sort` use. `canonicalJson` sorts object keys but leaves arrays
 * alone — array order is data — so the producer defines the order of `files`,
 * and it has to be an order a verifier using different tools reproduces. That
 * means bytes and nothing else.
 */
export function comparePathsBytewise(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Reject paths that cannot be round-tripped through git plumbing.
 *
 * JSON escapes control characters unambiguously, so — unlike the line-oriented
 * format this replaced — a newline in a path can no longer forge an entry. The
 * check stays for a different and still-live reason: git *quotes* such paths on
 * output unless `-z` is used, so a path arriving here already wrapped in quotes
 * means some caller took an unquoted code path. Attesting `"src/a\nb.ts"`
 * — quotes and backslash-n included, as a literal filename — would record an
 * OID against a path that does not exist, and the failure would surface later
 * as an unexplainable coverage gap.
 *
 * These paths do not occur in practice. Failing loudly on one is strictly
 * better than recording something a verifier resolves differently.
 *
 * Checked by code point rather than by regex literal, so this source file
 * never has to contain a raw control character itself.
 */
export function assertSafePath(p) {
  if (typeof p !== 'string' || p.length === 0) {
    throw new Error('path must be a non-empty string');
  }
  for (let i = 0; i < p.length; i += 1) {
    const c = p.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) {
      throw new Error(
        'path contains a control character, which git plumbing does not hand ' +
        `back unquoted: ${JSON.stringify(p)}`,
      );
    }
  }
  if (p.startsWith('"')) {
    throw new Error(`path appears git-quoted, which suggests an unsafe character: ${p}`);
  }
  return p;
}

/**
 * Build the attestation artifact, minus its `attestation_id`.
 *
 * Everything returned here is inside the digest. `attestation_id` is the only
 * key added afterwards, because it is the hash of this.
 */
export function buildAttestation(fields) {
  const { scope, head, model, gate, verdict, findings, files } = fields;

  for (const [k, v] of Object.entries({ scope, head, model, gate, verdict })) {
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(`field "${k}" must be a non-empty string`);
    }
    // Not a format constraint any more — JSON would escape it — but these five
    // fields are rendered into markdown table cells in the CI job summary, and
    // a newline there silently breaks the table it is reporting from.
    if (v.includes('\n')) throw new Error(`field "${k}" must not contain a newline`);
  }
  gateRank(gate);

  if (!Array.isArray(files)) throw new Error('files must be an array');

  const seen = new Set();
  const rows = files.map(({ path, oid }) => {
    assertSafePath(path);
    if (seen.has(path)) throw new Error(`duplicate path in attestation: ${path}`);
    seen.add(path);
    if (typeof oid !== 'string' || !(oid === DELETED || OID_RE.test(oid))) {
      throw new Error(`invalid oid for ${path}: ${oid} (want 40/64 hex chars or "${DELETED}")`);
    }
    return { path, oid };
  });
  rows.sort((a, b) => comparePathsBytewise(a.path, b.path));

  const findingsBySeverity = {};
  for (const s of SEVERITIES) {
    const n = findings?.[s] ?? 0;
    if (!Number.isInteger(n) || n < 0) throw new Error(`findings.${s} must be a non-negative integer`);
    findingsBySeverity[s] = n;
  }

  return {
    schema: ATTESTATION_SCHEMA,
    scope,
    reviewed_at_commit: head,
    model,
    gate,
    verdict,
    findings_by_severity: findingsBySeverity,
    files: rows,
  };
}

/**
 * The digest of an attestation artifact: sha256 over its canonical JSON with
 * `attestation_id` removed.
 *
 * Accepts an artifact with or without the key, so the producer and the verifier
 * call the identical function — the producer has not computed the id yet, and
 * the verifier is checking the one already there.
 */
export function attestationDigest(artifact) {
  if (artifact === null || typeof artifact !== 'object' || Array.isArray(artifact)) {
    throw new Error('attestation must be an object');
  }
  const body = { ...artifact };
  delete body.attestation_id;
  return digestOf(canonicalJson(body));
}

/** The full on-disk form: the artifact plus its own digest, canonically
 *  serialised. This byte string is what gets signed. */
export function renderAttestation(fields) {
  const body = buildAttestation(fields);
  return canonicalJson({ ...body, attestation_id: attestationDigest(body) });
}

/**
 * Read an attestation, checking its shape but NOT its digest — `verifyDigest`
 * does that, and a caller that wants to report both problems separately needs
 * to get this far first.
 *
 * Returns the recorded id, the parsed artifact, and `fields` under the short
 * internal names the generator and verifier use.
 */
export function parseAttestation(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('attestation is empty');
  }

  let artifact;
  try {
    artifact = JSON.parse(text);
  } catch (err) {
    throw new Error(`attestation is not valid JSON: ${err.message}`);
  }
  if (artifact === null || typeof artifact !== 'object' || Array.isArray(artifact)) {
    throw new Error('attestation must be a JSON object');
  }

  if (artifact.schema !== ATTESTATION_SCHEMA) {
    throw new Error(
      `unsupported attestation schema: ${JSON.stringify(artifact.schema)} ` +
      `(expected ${JSON.stringify(ATTESTATION_SCHEMA)})`,
    );
  }

  const digest = artifact.attestation_id;
  if (typeof digest !== 'string' || !DIGEST_RE.test(digest)) {
    throw new Error(
      `attestation_id is not a sha256 digest: ${JSON.stringify(artifact.attestation_id)}`,
    );
  }

  const fields = { files: [] };
  for (const [jsonKey, name] of Object.entries(STRING_FIELDS)) {
    const v = artifact[jsonKey];
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(`attestation field "${jsonKey}" is missing or not a string`);
    }
    fields[name] = v;
  }

  const counts = artifact.findings_by_severity;
  if (counts === null || typeof counts !== 'object' || Array.isArray(counts)) {
    throw new Error('attestation has no findings_by_severity object');
  }
  fields.findings = {};
  for (const [sev, n] of Object.entries(counts)) {
    if (!SEVERITIES.includes(sev)) throw new Error(`unknown severity in findings_by_severity: ${sev}`);
    if (!Number.isInteger(n) || n < 0) throw new Error(`bad count for ${sev}: ${JSON.stringify(n)}`);
    fields.findings[sev] = n;
  }

  if (!Array.isArray(artifact.files)) throw new Error('attestation has no files array');
  const seen = new Set();
  for (const entry of artifact.files) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`malformed files entry: ${JSON.stringify(entry)}`);
    }
    const { path, oid } = entry;
    assertSafePath(path);
    if (seen.has(path)) throw new Error(`duplicate path in attestation: ${path}`);
    seen.add(path);
    if (typeof oid !== 'string' || !(oid === DELETED || OID_RE.test(oid))) {
      throw new Error(`invalid oid for ${path}: ${JSON.stringify(oid)}`);
    }
    fields.files.push({ path, oid });
  }

  return { digest, artifact, fields };
}

/** True when the recorded id matches a fresh digest of everything else in the
 *  file. Catches a hand-edited field — flipping `"gate": "high"` to `"none"`
 *  breaks this. */
export function verifyDigest(text) {
  const { digest, artifact } = parseAttestation(text);
  return digest === attestationDigest(artifact);
}

/**
 * Paths that changed in CI's view but were never attested.
 *
 * The rule is **subset, not equality**: everything CI sees as changed must
 * appear in the attestation, but the attestation may legitimately cover more.
 * Over-review is harmless and routine — the local run diffs against
 * `origin/main` while a CI job may look at a narrower range. Under-review is
 * the failure this exists to catch.
 */
export function uncoveredPaths(attestedPaths, changedPaths) {
  const attested = new Set(attestedPaths);
  return changedPaths.filter((p) => !attested.has(p)).sort(comparePathsBytewise);
}

/**
 * Was the recorded review strict enough, and did it come back clean?
 *
 * Two independent checks, because either alone has a hole:
 *
 *   1. Counts: zero findings at or above `requiredGate`. A review that found
 *      three High issues is not a passing review, whatever its exit code was.
 *   2. Gate strictness: the local run's own threshold must have been at least
 *      as strict as required. A gate of `critical` would let a High-only
 *      review exit 0 and look clean; the counts check catches the numbers, and
 *      this catches the misconfiguration that produced them.
 */
export function gateSatisfied(fields, requiredGate = 'high') {
  const required = gateRank(requiredGate);
  const reasons = [];

  if (fields.gate === undefined) {
    reasons.push('attestation records no gate level');
  } else if (gateRank(fields.gate) > required) {
    reasons.push(
      `the review ran with --fail-on ${fields.gate}, which is weaker than the ` +
      `required ${requiredGate}: findings between them would not have failed it`,
    );
  }

  // "At or above the required gate" is a comparison on the SEVERITY scale
  // against the gate's threshold — not gate-rank against gate-rank.
  const counts = fields.findings ?? {};
  for (const sev of SEVERITIES) {
    if (severityRank(sev) < required) continue;
    const n = counts[sev] ?? 0;
    if (n > 0) reasons.push(`${n} unresolved ${sev} finding(s)`);
  }

  return { ok: reasons.length === 0, reasons };
}
