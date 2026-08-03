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

import { createHash } from 'node:crypto';

export const ATTESTATION_VERSION = 1;
export const MAGIC = `apexyard-review-attestation v${ATTESTATION_VERSION}`;

/** The namespace passed to `ssh-keygen -Y sign -n`. Domain separation: a
 *  signature made for this purpose cannot be replayed as a git commit
 *  signature, which uses the namespace "git". */
export const SIG_NAMESPACE = 'apexyard-review';

/** Marker for a path the review saw as deleted. Not a valid git OID, so it
 *  cannot collide with one. */
export const DELETED = 'deleted';

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

const OID_RE = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/;

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
 * order git and `sort` use. The digest has to be reproducible by a verifier
 * that may sort with different tools, so the ordering must be defined on
 * bytes and nothing else.
 */
export function comparePathsBytewise(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Reject paths that would make the manifest ambiguous.
 *
 * The format is line-oriented and space-delimited, so a path containing a
 * newline or a tab could forge extra entries. Git quotes such paths on output;
 * rather than depend on every producer and consumer unquoting identically,
 * this refuses them outright. They do not occur in practice, and failing loudly
 * on one is strictly better than digesting something a verifier reads back
 * differently.
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
        'path contains a control character, which the manifest format cannot ' +
        `represent unambiguously: ${JSON.stringify(p)}`,
      );
    }
  }
  if (p.startsWith('"')) {
    throw new Error(`path appears git-quoted, which suggests an unsafe character: ${p}`);
  }
  return p;
}

/**
 * Serialise the attestation body.
 *
 * This byte string is what gets digested and signed, so its stability is the
 * contract. Rules, all deliberate:
 *
 *   - LF only. A CRLF checkout must not change the digest, so producers write
 *     LF and `.gitattributes` pins the file to LF.
 *   - Fixed field order. Not object key order, which is an implementation
 *     detail of whoever built the object.
 *   - Files sorted bytewise, one per line, `<oid> <path>`.
 *   - Trailing newline, so appending is always a clean diff.
 *
 * There is deliberately **no timestamp**. A timestamp records when a file was
 * written, which nobody needs to know, and it would make the digest differ on
 * every run over identical content — destroying the one property that makes
 * this verifiable. Freshness comes from the OIDs: they stop matching the
 * moment the code changes, which is the actual question being asked.
 */
export function buildBody(fields) {
  const { scope, head, model, gate, verdict, findings, files } = fields;

  for (const [k, v] of Object.entries({ scope, head, model, gate, verdict })) {
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(`field "${k}" must be a non-empty string`);
    }
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

  const counts = SEVERITIES.map((s) => {
    const n = findings?.[s] ?? 0;
    if (!Number.isInteger(n) || n < 0) throw new Error(`findings.${s} must be a non-negative integer`);
    return `${s}=${n}`;
  }).join(' ');

  const lines = [
    `scope ${scope}`,
    `head ${head}`,
    `model ${model}`,
    `gate ${gate}`,
    `verdict ${verdict}`,
    `findings ${counts}`,
    `files ${rows.length}`,
    ...rows.map((r) => `${r.oid} ${r.path}`),
  ];
  return lines.join('\n') + '\n';
}

export function digestBody(body) {
  return 'sha256:' + createHash('sha256').update(Buffer.from(body, 'utf8')).digest('hex');
}

/** Full on-disk form: magic, digest, separator, body. The digest covers only
 *  the body, so a verifier splits on the separator and rehashes — no need to
 *  reconstruct the header byte-for-byte. */
export function renderAttestation(fields) {
  const body = buildBody(fields);
  return `${MAGIC}\ndigest ${digestBody(body)}\n--\n${body}`;
}

export function parseAttestation(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('attestation is empty');
  }
  // Tolerate a CRLF checkout on read even though producers write LF: failing
  // here would be a confusing way to learn that .gitattributes was missed.
  const normalised = text.replace(/\r\n/g, '\n');

  const sep = normalised.indexOf('\n--\n');
  if (sep === -1) throw new Error('malformed attestation: no "--" separator');

  const header = normalised.slice(0, sep).split('\n');
  const body = normalised.slice(sep + 4);

  if (header[0] !== MAGIC) {
    throw new Error(
      `unsupported attestation format: ${JSON.stringify(header[0])} ` +
      `(expected ${JSON.stringify(MAGIC)})`,
    );
  }
  const digestLine = header.find((l) => l.startsWith('digest '));
  if (!digestLine) throw new Error('malformed attestation: no digest line');
  const digest = digestLine.slice('digest '.length).trim();

  const fields = { files: [] };
  for (const line of body.split('\n')) {
    if (line === '') continue;
    const sp = line.indexOf(' ');
    if (sp === -1) throw new Error(`malformed body line: ${JSON.stringify(line)}`);
    const key = line.slice(0, sp);
    const value = line.slice(sp + 1);

    switch (key) {
      case 'scope': case 'head': case 'model': case 'gate': case 'verdict':
        fields[key] = value; break;
      case 'findings': {
        fields.findings = {};
        for (const pair of value.split(' ')) {
          const [s, n] = pair.split('=');
          if (!SEVERITIES.includes(s)) throw new Error(`unknown severity in findings: ${s}`);
          const parsed = Number.parseInt(n, 10);
          if (!Number.isInteger(parsed)) throw new Error(`bad count for ${s}: ${n}`);
          fields.findings[s] = parsed;
        }
        break;
      }
      case 'files':
        fields.fileCount = Number.parseInt(value, 10); break;
      default:
        // Not an unknown field — an OID-prefixed file row.
        if (OID_RE.test(key) || key === DELETED) {
          fields.files.push({ oid: key, path: value });
        } else {
          throw new Error(`unrecognised body line: ${JSON.stringify(line)}`);
        }
    }
  }

  if (fields.fileCount !== undefined && fields.fileCount !== fields.files.length) {
    throw new Error(
      `file count mismatch: header says ${fields.fileCount}, body has ${fields.files.length}`,
    );
  }

  return { digest, body, fields };
}

/** True when the recorded digest matches a fresh hash of the body. Catches a
 *  hand-edited field — flipping `gate high` to `gate none` breaks this. */
export function verifyDigest(text) {
  const { digest, body } = parseAttestation(text);
  return digest === digestBody(body);
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
