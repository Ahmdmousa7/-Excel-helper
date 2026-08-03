import { describe, it, expect } from 'vitest';
import {
  REQUIRED_ARTIFACTS,
  SUMMARY_FILE,
  SCHEMAS,
  sortKeysDeep,
  canonicalJson,
  isCanonical,
  digestOf,
  findNonDeterministic,
  assertDeterministic,
  envelope,
  checkArtifact,
  missingArtifacts,
  isBundlePath,
} from '../../scripts/lib/evidence.mjs';
import {
  unavailable,
  sortFindings,
  countBySeverity,
  collectReview,
  collectFindings,
  collectTypescript,
  collectEslint,
  collectVitest,
  collectPlaywright,
  collectBundle,
  collectDependencies,
  collectAccessibility,
} from '../../scripts/lib/collectors.mjs';

const ID = `sha256:${'a'.repeat(64)}`;
const OTHER_ID = `sha256:${'b'.repeat(64)}`;

/**
 * Narrow a collector result to its available form.
 *
 * The Unavailable union forces this at every call site, which is the point —
 * production code must establish that a tool ran before reading its numbers.
 * The tests pay the same cost rather than casting it away.
 */
function avail<T extends { available: boolean }>(s: T): Extract<T, { available: true }> {
  expect(s.available).toBe(true);
  return s as Extract<T, { available: true }>;
}

describe('canonical JSON', () => {
  it('sorts keys recursively so producer insertion order cannot change the bytes', () => {
    const a = canonicalJson({ z: 1, a: { d: 4, b: 2 } });
    const b = canonicalJson({ a: { b: 2, d: 4 }, z: 1 });
    expect(a).toBe(b);
  });

  it('preserves array order, which is data rather than an accident', () => {
    expect(sortKeysDeep([{ b: 1, a: 2 }, 'x'])).toEqual([{ a: 2, b: 1 }, 'x']);
    expect(canonicalJson(['b', 'a'])).toContain('"b"');
    expect(JSON.parse(canonicalJson(['b', 'a']))).toEqual(['b', 'a']);
  });

  it('emits LF and exactly one trailing newline', () => {
    const out = canonicalJson({ a: 1 });
    expect(out).not.toContain('\r');
    expect(out.endsWith('}\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });

  it('round-trips through isCanonical', () => {
    expect(isCanonical(canonicalJson({ b: 1, a: [1, 2] }))).toBe(true);
  });

  it('rejects a reformat — different indent is not canonical', () => {
    expect(isCanonical(JSON.stringify({ a: 1 }, null, 4) + '\n')).toBe(false);
  });

  it('rejects unsorted keys even when the JSON is valid', () => {
    expect(isCanonical('{\n  "z": 1,\n  "a": 2\n}\n')).toBe(false);
  });

  it('rejects a missing trailing newline', () => {
    expect(isCanonical(JSON.stringify({ a: 1 }, null, 2))).toBe(false);
  });

  it('refuses values JSON cannot represent, instead of dropping them silently', () => {
    expect(() => canonicalJson({ a: NaN })).toThrow(/not representable/);
    expect(() => canonicalJson({ a: Infinity })).toThrow(/not representable/);
    expect(() => canonicalJson({ a: undefined })).toThrow(/undefined would be dropped/);
    expect(() => canonicalJson({ a: 1n })).toThrow(/bigint/);
  });

  it('produces a stable digest', () => {
    expect(digestOf(canonicalJson({ a: 1 }))).toBe(digestOf(canonicalJson({ a: 1 })));
    expect(digestOf('a')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('the determinism guard', () => {
  it('catches timestamp-shaped keys', () => {
    for (const key of [
      'timestamp', 'generated_at', 'created_at', 'ran_at', 'date', 'datetime',
      'duration', 'duration_ms', 'elapsed_ms', 'ms', 'start_time', 'pid', 'hostname',
    ]) {
      expect(findNonDeterministic({ [key]: 1 }).length, key).toBeGreaterThan(0);
    }
  });

  it('catches a time-varying key nested anywhere', () => {
    const bad = findNonDeterministic({ a: { b: [{ duration_ms: 5 }] } });
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain('$.a.b[0].duration_ms');
  });

  it('catches a date-shaped VALUE under an innocuous key', () => {
    expect(findNonDeterministic({ note: '2026-08-03T10:00:00Z' })).toHaveLength(1);
    expect(findNonDeterministic({ note: '2026-08-03' })).toHaveLength(1);
  });

  it('does not flag a semver, a hash, or a path', () => {
    expect(findNonDeterministic({
      version: '0.20.3',
      oid: 'cc8134c8c23ff7a0d8a8b00765c3f6aa71156ca3',
      digest: `sha256:${'f'.repeat(64)}`,
      file: 'components/App.tsx',
    })).toEqual([]);
  });

  it('does not flag a legitimate count named like a metric', () => {
    expect(findNonDeterministic({ total: 3, passed_count: 101, lines_pct: 78 })).toEqual([]);
  });

  it('reports every offender, not just the first', () => {
    expect(findNonDeterministic({ duration: 1, timestamp: 2, pid: 3 })).toHaveLength(3);
  });

  it('throws with all paths listed', () => {
    expect(() => assertDeterministic({ duration: 1 }, 'metrics.json'))
      .toThrow(/metrics\.json contains non-reproducible content/);
  });
});

describe('the artifact envelope', () => {
  it('stamps schema and attestation_id', () => {
    const a = envelope('review.json', ID, { verdict: 'approved' });
    expect(a.schema).toBe(SCHEMAS['review.json']);
    expect(a.attestation_id).toBe(ID);
    expect(a.verdict).toBe('approved');
  });

  it('refuses an artifact name with no registered schema', () => {
    expect(() => envelope('nope.json', ID, {})).toThrow(/no schema registered/);
  });

  it('refuses an attestation_id that is not a sha256 digest', () => {
    expect(() => envelope('review.json', 'v1.2.3', {})).toThrow(/must be a sha256 digest/);
    expect(() => envelope('review.json', 'sha256:short', {})).toThrow(/must be a sha256 digest/);
  });

  it('refuses a payload that tries to set its own envelope fields', () => {
    expect(() => envelope('review.json', ID, { schema: 'x' })).toThrow(/must not set schema/);
    expect(() => envelope('review.json', ID, { attestation_id: OTHER_ID }))
      .toThrow(/must not set schema or attestation_id/);
  });

  it('refuses a non-deterministic payload at construction time', () => {
    expect(() => envelope('metrics.json', ID, { duration_ms: 12 }))
      .toThrow(/non-reproducible/);
  });
});

describe('artifact verification rules', () => {
  const good = (name: string, payload: Record<string, unknown> = {}) =>
    canonicalJson(envelope(name, ID, payload));

  it('accepts a well-formed artifact', () => {
    expect(checkArtifact('review.json', good('review.json'), ID)).toEqual([]);
  });

  it('rejects invalid JSON', () => {
    expect(checkArtifact('review.json', '{oops', ID)[0]).toMatch(/not valid JSON/);
  });

  it('rejects a non-canonical artifact', () => {
    const text = JSON.stringify(envelope('review.json', ID, {}), null, 4) + '\n';
    expect(checkArtifact('review.json', text, ID).some((p) => /canonical form/.test(p))).toBe(true);
  });

  it('rejects a wrong schema id', () => {
    const obj = envelope('review.json', ID, {});
    obj.schema = 'apexyard.evidence.review/99';
    const problems = checkArtifact('review.json', canonicalJson(obj), ID);
    expect(problems.some((p) => /declares schema/.test(p))).toBe(true);
  });

  it('rejects a missing attestation_id', () => {
    const text = canonicalJson({ schema: SCHEMAS['review.json'], verdict: 'approved' });
    expect(checkArtifact('review.json', text, ID).some((p) => /no attestation_id/.test(p)))
      .toBe(true);
  });

  // The staleness rule, and the reason the id is the attestation digest.
  it('rejects a STALE artifact bound to a different reviewed state', () => {
    const stale = canonicalJson(envelope('review.json', OTHER_ID, {}));
    const problems = checkArtifact('review.json', stale, ID);
    expect(problems.some((p) => /is STALE/.test(p))).toBe(true);
  });

  it('rejects an artifact carrying timestamp-shaped content', () => {
    // Built by hand: envelope() would have refused it at construction.
    const text = canonicalJson({
      schema: SCHEMAS['metrics.json'], attestation_id: ID, vitest: { duration_ms: 9 },
    });
    expect(checkArtifact('metrics.json', text, ID).some((p) => /non-reproducible/.test(p)))
      .toBe(true);
  });
});

describe('the bundle-path rule (one definition, two callers)', () => {
  // This rule lived in two files and they disagreed, which produced a state
  // where CI could never be green: the generator recorded the bundle's own
  // artifacts in the attested scope while the generator that rewrites them ran
  // on every pass, so their hashes were stale by construction.
  it('matches the bundle directory itself', () => {
    expect(isBundlePath('.apexyard')).toBe(true);
  });

  it('matches everything inside the bundle', () => {
    for (const p of [
      '.apexyard/attestation',
      '.apexyard/attestation.sig',
      '.apexyard/allowed_signers',
      '.apexyard/review.json',
      '.apexyard/review-summary.md',
      '.apexyard/review/prompt.md',
      '.apexyard/raw/eslint.json',
    ]) {
      expect(isBundlePath(p), p).toBe(true);
    }
  });

  it('does not match a sibling whose name merely starts the same way', () => {
    expect(isBundlePath('.apexyard-old/attestation')).toBe(false);
    expect(isBundlePath('.apexyardish')).toBe(false);
  });

  it('does not match ordinary source files', () => {
    expect(isBundlePath('scripts/evidence.mjs')).toBe(false);
    expect(isBundlePath('components/App.tsx')).toBe(false);
  });

  it('honours a custom bundle directory', () => {
    expect(isBundlePath('evidence/review.json', 'evidence')).toBe(true);
    expect(isBundlePath('.apexyard/review.json', 'evidence')).toBe(false);
  });
});

describe('required-artifact presence', () => {
  it('lists nothing when the bundle is complete', () => {
    expect(missingArtifacts([...REQUIRED_ARTIFACTS, SUMMARY_FILE])).toEqual([]);
  });

  it('names each absent artifact', () => {
    expect(missingArtifacts([])).toEqual([...REQUIRED_ARTIFACTS, SUMMARY_FILE]);
  });

  it('requires the human-readable summary too', () => {
    expect(missingArtifacts(REQUIRED_ARTIFACTS)).toEqual([SUMMARY_FILE]);
  });

  it('covers every artifact the user asked for', () => {
    expect(REQUIRED_ARTIFACTS).toEqual([
      'attestation.json',
      'review.json',
      'findings.json',
      'metrics.json',
      'architecture.json',
      'dependency-report.json',
      'accessibility-report.json',
    ]);
    expect(SUMMARY_FILE).toBe('review-summary.md');
  });
});

describe('collectors never fabricate a pass', () => {
  // The single most important property of the bundle: "0 failures" and "never
  // ran" look identical in a summary table and mean opposite things.
  it('reports available:false with a reason when a tool did not run', () => {
    for (const section of [
      collectTypescript(null),
      collectEslint(null, '/repo'),
      collectVitest(null, null),
      collectPlaywright(null),
      collectBundle(null),
      collectAccessibility(null),
      collectReview(null, { model: 'm', gate: 'high' }),
      collectFindings(null),
      collectDependencies({ pkg: null }),
    ]) {
      // Narrowing on `available` is the whole point of the union: a caller
      // cannot reach a result without first establishing the tool ran.
      expect(section.available).toBe(false);
      if (section.available !== false) throw new Error('expected unavailable');
      expect(typeof section.reason).toBe('string');
      expect(section.reason.length).toBeGreaterThan(0);
      expect(section).not.toHaveProperty('passed');
    }
  });

  it('unavailable() never reports zero failures', () => {
    const u = unavailable('did not run');
    expect(u).toEqual({ available: false, reason: 'did not run' });
  });
});

describe('collector determinism', () => {
  it('orders findings stably regardless of the order the model emitted them', () => {
    const a = [
      { severity: 'low', category: 'z', file: 'b.ts', line: 2, summary: 's2' },
      { severity: 'high', category: 'a', file: 'a.ts', line: 1, summary: 's1' },
      { severity: 'low', category: 'a', file: 'a.ts', line: 1, summary: 's3' },
    ];
    const forward = sortFindings(a).map((f) => f.summary);
    const reversed = sortFindings([...a].reverse()).map((f) => f.summary);
    expect(reversed).toEqual(forward);
    expect(forward[0]).toBe('s1'); // high first
  });

  it('counts by severity and ignores unknown severities', () => {
    expect(countBySeverity([{ severity: 'HIGH' }, { severity: 'nonsense' }, { severity: 'low' }]))
      .toEqual({ critical: 0, high: 1, medium: 0, low: 1, info: 0 });
  });

  it('produces a deterministic findings payload', () => {
    const review = {
      verdict: 'approved',
      findings: [
        { severity: 'low', file: 'b.ts', summary: 'x' },
        { severity: 'high', file: 'a.ts', summary: 'y' },
      ],
    };
    const once = canonicalJson(envelope('findings.json', ID, avail(collectFindings(review))));
    const twice = canonicalJson(envelope('findings.json', ID, avail(collectFindings(review))));
    expect(once).toBe(twice);
    expect(findNonDeterministic(JSON.parse(once))).toEqual([]);
  });

  it('strips playwright durations and keeps only outcomes', () => {
    const pw = {
      suites: [{
        title: 'smoke',
        specs: [
          { title: 'loads', tests: [{ status: 'expected', results: [{ duration: 1234 }] }] },
          { title: 'breaks', tests: [{ status: 'unexpected', results: [{ duration: 99 }] }] },
        ],
        suites: [],
      }],
    };
    const out = avail(collectPlaywright(pw));
    expect(out.passed_count).toBe(1);
    expect(out.failed_count).toBe(1);
    expect(out.passed).toBe(false);
    expect(out.failures).toEqual(['smoke > breaks']);
    expect(findNonDeterministic(out)).toEqual([]);
  });

  it('keeps vitest counts and coverage percentages but no timings', () => {
    const out = avail(collectVitest(
      { numTotalTests: 70, numPassedTests: 70, numFailedTests: 0, numTotalTestSuites: 5 },
      { total: { lines: { pct: 78.1 }, branches: { pct: 60 }, functions: { pct: 70 }, statements: { pct: 78 } } },
    ));
    expect(out.tests?.passed).toBe(70);
    expect(out.coverage?.lines_pct).toBe(78.1);
    expect(out.passed).toBe(true);
    expect(findNonDeterministic(out)).toEqual([]);
  });

  it('summarises typescript errors by code', () => {
    const out = avail(collectTypescript('a.ts(1,2): error TS2345: bad\nb.ts(3,4): error TS2345: bad\n'));
    expect(out.errors).toBe(2);
    expect(out.error_codes).toEqual({ TS2345: 2 });
    expect(out.passed).toBe(false);
    expect(avail(collectTypescript('')).passed).toBe(true);
  });

  it('summarises eslint per rule, worst first', () => {
    const out = avail(collectEslint([
      { filePath: '/repo/a.ts', errorCount: 1, warningCount: 1,
        messages: [{ ruleId: 'no-x', severity: 2 }, { ruleId: 'no-y', severity: 1 }] },
    ], '/repo'));
    expect(out.errors).toBe(1);
    expect(out.warnings).toBe(1);
    expect(out.passed).toBe(false);
    expect(out.top_rules[0].rule).toBe('no-x');
  });

  it('marks the audit passed only when critical and high are both zero', () => {
    const mk = (v: Record<string, number>) => {
      const d = collectDependencies({
        pkg: { dependencies: {}, devDependencies: {} },
        auditJson: { metadata: { vulnerabilities: v }, vulnerabilities: {} },
      });
      return avail(d).audit as { passed?: boolean };
    };
    expect(mk({ critical: 0, high: 0, moderate: 4, low: 1, total: 5 }).passed).toBe(true);
    expect(mk({ critical: 0, high: 1, moderate: 0, low: 0, total: 1 }).passed).toBe(false);
    expect(mk({ critical: 1, high: 0, moderate: 0, low: 0, total: 1 }).passed).toBe(false);
  });

  it('groups accessibility violations by rule and impact', () => {
    const out = avail(collectAccessibility({
      standard: 'WCAG 2.2 AA',
      pages: ['b', 'a'],
      known_debt_rules: ['select-name', 'color-contrast'],
      violations: [
        { id: 'select-name', impact: 'critical', nodes: 4, page: 'data-tools' },
        { id: 'select-name', impact: 'critical', nodes: 1, page: 'home' },
        { id: 'color-contrast', impact: 'serious', nodes: 2, page: 'home' },
      ],
    }));
    expect(out.violations_total).toBe(7);
    expect(out.by_impact.critical).toBe(5);
    expect(out.by_rule['select-name'].nodes).toBe(5);
    expect(out.by_rule['select-name'].pages).toEqual(['data-tools', 'home']);
    expect(out.pages_scanned).toEqual(['a', 'b']);
    // Both observed rules are allow-listed, so the gate passes regardless of
    // how many NODES they produced. Rule classes, not node counts.
    expect(out.unexpected_rules).toEqual([]);
    expect(out.passed).toBe(true);
    expect(findNonDeterministic(out)).toEqual([]);
  });

  it('leaves accessibility passed null when no allow-list is recorded', () => {
    expect(avail(collectAccessibility({ violations: [] })).passed).toBeNull();
  });

  it('fails accessibility when a rule outside the allow-list appears', () => {
    // The unit mismatch this replaced compared 18 nodes to a 7-rule allow-list
    // and reported a failure on a passing suite.
    const out = avail(collectAccessibility({
      known_debt_rules: ['color-contrast'],
      violations: [
        { id: 'color-contrast', impact: 'serious', nodes: 40, page: 'home' },
        { id: 'select-name', impact: 'critical', nodes: 1, page: 'home' },
      ],
    }));
    expect(out.unexpected_rules).toEqual(['select-name']);
    expect(out.passed).toBe(false);
  });

  it('passes when many nodes come from allow-listed rules only', () => {
    const out = avail(collectAccessibility({
      known_debt_rules: ['color-contrast'],
      violations: [{ id: 'color-contrast', impact: 'serious', nodes: 999, page: 'home' }],
    }));
    expect(out.violations_total).toBe(999);
    expect(out.passed).toBe(true);
  });
});
