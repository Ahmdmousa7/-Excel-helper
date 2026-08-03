import { describe, it, expect } from 'vitest';
import {
  ATTESTATION_SCHEMA,
  DELETED,
  SEVERITIES,
  gateRank,
  comparePathsBytewise,
  assertSafePath,
  buildAttestation,
  attestationDigest,
  renderAttestation,
  parseAttestation,
  verifyDigest,
  uncoveredPaths,
  gateSatisfied,
} from '../../scripts/lib/attestation.mjs';
import { isCanonical } from '../../scripts/lib/evidence.mjs';

const oid = (c: string) => c.repeat(40);

const base = {
  scope: 'origin/main...HEAD',
  head: 'a'.repeat(40),
  model: 'claude-opus-5',
  gate: 'high',
  verdict: 'APPROVED',
  findings: { critical: 0, high: 0, medium: 0, low: 2, info: 1 },
  files: [
    { path: 'components/A.tsx', oid: oid('1') },
    { path: 'utils/b.ts', oid: oid('2') },
  ],
};

describe('the digest is deterministic', () => {
  it('does not depend on the order files are supplied in', () => {
    const forward = renderAttestation(base);
    const reversed = renderAttestation({ ...base, files: [...base.files].reverse() });
    expect(reversed).toBe(forward);
  });

  it('does not depend on object key order', () => {
    const shuffled = {
      files: base.files, verdict: base.verdict, gate: base.gate,
      model: base.model, head: base.head, scope: base.scope, findings: base.findings,
    };
    expect(renderAttestation(shuffled)).toBe(renderAttestation(base));
  });

  it('produces the same digest across repeated runs with no timestamp drift', () => {
    // A timestamp in the artifact would break this, which is why there isn't
    // one: the digest has to be a function of the reviewed content alone.
    expect(renderAttestation(base)).toBe(renderAttestation(base));
  });

  it('emits LF only, so a CRLF checkout cannot change the digest', () => {
    expect(renderAttestation(base)).not.toContain('\r');
  });

  it('sorts paths by UTF-8 bytes, not UTF-16 code units', () => {
    // U+1F600 is a surrogate pair in UTF-16 and sorts before U+FF5E there,
    // but after it in UTF-8. canonicalJson sorts keys and leaves arrays alone,
    // so the producer owns this order and it must be the byte order.
    const emoji = '\u{1F600}.ts';
    const wide = '～.ts';
    expect(comparePathsBytewise(wide, emoji)).toBeLessThan(0);
    expect([emoji, wide].sort()[0]).toBe(emoji); // naive sort disagrees
    const { artifact } = parseAttestation(renderAttestation({
      ...base,
      files: [{ path: emoji, oid: oid('3') }, { path: wide, oid: oid('4') }],
    }));
    expect(artifact.files.map((f) => f.path)).toEqual([wide, emoji]);
  });
});

describe('the artifact carries its own digest', () => {
  it('writes canonical JSON, so one id means one byte string', () => {
    // The digest is defined over canonicalJson, so a non-canonical file would
    // hash to the expected id while its bytes differed from the ones signed.
    expect(isCanonical(renderAttestation(base))).toBe(true);
  });

  it('declares the schema the digest semantics belong to', () => {
    const { artifact } = parseAttestation(renderAttestation(base));
    expect(artifact.schema).toBe(ATTESTATION_SCHEMA);
  });

  it('excludes attestation_id itself from the digest, and nothing else', () => {
    // The one-key-removed rule. A verifier in another language reimplements
    // exactly this, so it gets its own test rather than being implied by
    // verifyDigest passing.
    const body = buildAttestation(base);
    expect(body).not.toHaveProperty('attestation_id');
    const id = attestationDigest(body);
    expect(attestationDigest({ ...body, attestation_id: id })).toBe(id);
    expect(attestationDigest({ ...body, attestation_id: 'sha256:' + '0'.repeat(64) })).toBe(id);
  });

  it('changes the id when any other field changes', () => {
    const body = buildAttestation(base);
    expect(attestationDigest({ ...body, gate: 'none' })).not.toBe(attestationDigest(body));
  });
});

describe('the digest detects tampering', () => {
  it('accepts an untouched attestation', () => {
    expect(verifyDigest(renderAttestation(base))).toBe(true);
  });

  it('rejects a weakened gate', () => {
    // The exact edit someone would make to launder a failing review.
    const text = renderAttestation(base).replace('"gate": "high"', '"gate": "none"');
    expect(text).not.toBe(renderAttestation(base));
    expect(verifyDigest(text)).toBe(false);
  });

  it('rejects a downgraded finding count', () => {
    const dirty = { ...base, findings: { ...base.findings, high: 3 } };
    const text = renderAttestation(dirty).replace('"high": 3', '"high": 0');
    expect(verifyDigest(text)).toBe(false);
  });

  it('rejects a swapped file hash', () => {
    const text = renderAttestation(base).replace(oid('1'), oid('9'));
    expect(verifyDigest(text)).toBe(false);
  });

  it('rejects a smuggled-in file entry', () => {
    // Adding a file to the attested set is how an unreviewed change would be
    // laundered past the coverage check. In the line-oriented format this was
    // caught by a redundant `files N` count; in JSON the digest catches it, so
    // the count field is gone.
    const { artifact } = parseAttestation(renderAttestation(base));
    const smuggled = {
      ...artifact,
      files: [...artifact.files, { path: 'sneaky.ts', oid: oid('7') }],
    };
    expect(verifyDigest(JSON.stringify(smuggled, null, 2) + '\n')).toBe(false);
  });

  it('rejects a removed file entry', () => {
    const { artifact } = parseAttestation(renderAttestation(base));
    const trimmed = { ...artifact, files: artifact.files.slice(1) };
    expect(verifyDigest(JSON.stringify(trimmed, null, 2) + '\n')).toBe(false);
  });
});

describe('round-tripping', () => {
  it('parses back every field it wrote', () => {
    const { fields, digest } = parseAttestation(renderAttestation(base));
    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(fields.scope).toBe(base.scope);
    expect(fields.head).toBe(base.head);
    expect(fields.model).toBe(base.model);
    expect(fields.gate).toBe(base.gate);
    expect(fields.verdict).toBe(base.verdict);
    expect(fields.findings).toEqual(base.findings);
    expect(fields.files).toHaveLength(2);
  });

  it('tolerates a CRLF checkout on read', () => {
    // JSON treats CR as whitespace between tokens, and the digest is taken over
    // a re-serialisation of the parsed object — so a CRLF working copy verifies.
    // .gitattributes still pins LF, because the SIGNATURE is over raw bytes.
    const crlf = renderAttestation(base).replace(/\n/g, '\r\n');
    expect(verifyDigest(crlf)).toBe(true);
  });

  it('records deletions', () => {
    const text = renderAttestation({ ...base, files: [{ path: 'gone.ts', oid: DELETED }] });
    const { fields } = parseAttestation(text);
    expect(fields.files[0]).toEqual({ path: 'gone.ts', oid: DELETED });
  });

  it('refuses an unknown schema version', () => {
    const text = renderAttestation(base)
      .replace(ATTESTATION_SCHEMA, 'apexyard.evidence.attestation/99');
    expect(() => parseAttestation(text)).toThrow(/unsupported attestation schema/);
  });

  it('refuses text that is not JSON', () => {
    expect(() => parseAttestation('apexyard-review-attestation v1\n'))
      .toThrow(/not valid JSON/);
  });

  it('refuses a JSON array, which would read as an empty object', () => {
    expect(() => parseAttestation('[]\n')).toThrow(/must be a JSON object/);
  });

  it('refuses an attestation with no id', () => {
    const { artifact } = parseAttestation(renderAttestation(base));
    delete (artifact as { attestation_id?: string }).attestation_id;
    expect(() => parseAttestation(JSON.stringify(artifact)))
      .toThrow(/attestation_id is not a sha256 digest/);
  });

  it('refuses an attestation missing a required string field', () => {
    const { artifact } = parseAttestation(renderAttestation(base));
    delete (artifact as { verdict?: string }).verdict;
    expect(() => parseAttestation(JSON.stringify(artifact)))
      .toThrow(/field "verdict" is missing/);
  });
});

describe('input validation', () => {
  it('rejects a path containing a newline', () => {
    expect(() => assertSafePath(`a.ts\n${oid('5')} b.ts`)).toThrow(/control character/);
  });

  it('rejects a path containing a tab', () => {
    expect(() => assertSafePath('a\tb.ts')).toThrow(/control character/);
  });

  it('rejects a git-quoted path', () => {
    expect(() => assertSafePath('"weird\\tname.ts"')).toThrow(/git-quoted/);
  });

  it('rejects a duplicate path', () => {
    expect(() => buildAttestation({
      ...base,
      files: [{ path: 'a.ts', oid: oid('1') }, { path: 'a.ts', oid: oid('2') }],
    })).toThrow(/duplicate path/);
  });

  it('rejects a duplicate path on the way back in, too', () => {
    // buildAttestation cannot be the only guard: the verifier reads files it
    // did not write, and two entries for one path would let the later one's OID
    // be ignored depending on which the consumer looked at first.
    const { artifact } = parseAttestation(renderAttestation(base));
    const dupe = { ...artifact, files: [artifact.files[0], artifact.files[0]] };
    expect(() => parseAttestation(JSON.stringify(dupe))).toThrow(/duplicate path/);
  });

  it('rejects a malformed oid', () => {
    expect(() => buildAttestation({ ...base, files: [{ path: 'a.ts', oid: 'nope' }] }))
      .toThrow(/invalid oid/);
  });

  it('accepts a 64-char oid, for a SHA-256 repository', () => {
    expect(() => buildAttestation({ ...base, files: [{ path: 'a.ts', oid: 'a'.repeat(64) }] }))
      .not.toThrow();
  });

  it('rejects an unknown gate level', () => {
    expect(() => buildAttestation({ ...base, gate: 'whenever' })).toThrow(/unknown gate level/);
  });

  it('rejects a negative finding count', () => {
    expect(() => buildAttestation({ ...base, findings: { high: -1 } })).toThrow(/non-negative/);
  });

  it('rejects a newline in a field rendered into the CI summary table', () => {
    expect(() => buildAttestation({ ...base, verdict: 'APPROVED\n| oops |' }))
      .toThrow(/must not contain a newline/);
  });

  it('defaults absent severities to zero rather than omitting them', () => {
    const artifact = buildAttestation({ ...base, findings: {} });
    expect(artifact.findings_by_severity).toEqual({
      critical: 0, high: 0, medium: 0, low: 0, info: 0,
    });
  });
});

describe('coverage is a subset rule, not equality', () => {
  it('passes when the attestation covers exactly what changed', () => {
    expect(uncoveredPaths(['a.ts', 'b.ts'], ['a.ts', 'b.ts'])).toEqual([]);
  });

  it('passes when the review covered MORE than CI sees as changed', () => {
    // Routine: the local run diffs against origin/main while a CI job may look
    // at a narrower range. Over-review is not a failure.
    expect(uncoveredPaths(['a.ts', 'b.ts', 'c.ts'], ['a.ts'])).toEqual([]);
  });

  it('fails when a changed file was never reviewed', () => {
    expect(uncoveredPaths(['a.ts'], ['a.ts', 'sneaky.ts'])).toEqual(['sneaky.ts']);
  });

  it('reports every gap, sorted, not just the first', () => {
    expect(uncoveredPaths([], ['z.ts', 'a.ts', 'm.ts'])).toEqual(['a.ts', 'm.ts', 'z.ts']);
  });
});

describe('the recorded review has to have been strict enough and clean', () => {
  const clean = { gate: 'high', findings: { critical: 0, high: 0, medium: 4, low: 9, info: 2 } };

  it('accepts a clean review at the required gate', () => {
    expect(gateSatisfied(clean, 'high').ok).toBe(true);
  });

  it('accepts a review run at a STRICTER gate than required', () => {
    expect(gateSatisfied({ gate: 'low', findings: {} }, 'high').ok).toBe(true);
  });

  it('rejects a review run at a weaker gate, even with zero counts', () => {
    // `--fail-on critical` exits 0 on a pile of High findings. The counts
    // happen to be zero here, so only the strictness check catches it.
    const r = gateSatisfied({ gate: 'critical', findings: {} }, 'high');
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/weaker than the required high/);
  });

  it('rejects --fail-on none outright', () => {
    expect(gateSatisfied({ gate: 'none', findings: {} }, 'high').ok).toBe(false);
  });

  it('rejects unresolved findings at the required level', () => {
    const r = gateSatisfied({ gate: 'high', findings: { high: 2 } }, 'high');
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x: string) => /2 unresolved high/.test(x))).toBe(true);
  });

  it('rejects unresolved findings ABOVE the required level', () => {
    const r = gateSatisfied({ gate: 'high', findings: { critical: 1 } }, 'high');
    expect(r.ok).toBe(false);
  });

  it('ignores findings below the required level', () => {
    expect(gateSatisfied({ gate: 'high', findings: { medium: 9, low: 40 } }, 'high').ok).toBe(true);
  });

  it('rejects an attestation with no gate recorded', () => {
    const r = gateSatisfied({ findings: {} }, 'high');
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/no gate/);
  });

  it('orders gate strictness so that lower rank is stricter', () => {
    expect(gateRank('low')).toBeLessThan(gateRank('high'));
    expect(gateRank('high')).toBeLessThan(gateRank('critical'));
    expect(gateRank('critical')).toBeLessThan(gateRank('none'));
  });

  it('covers every severity the review can emit', () => {
    expect(SEVERITIES).toEqual(['critical', 'high', 'medium', 'low', 'info']);
  });
});
