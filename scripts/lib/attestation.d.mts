// Types for attestation.mjs.
//
// The implementation is plain ESM rather than TypeScript because the CLIs that
// use it (`scripts/attest-review.mjs`, `scripts/evidence.mjs`,
// `scripts/verify-evidence.mjs`) run under bare `node` in a git hook and in CI,
// with no build step and no loader. Compiling them would put a toolchain between
// a push and its own verification, which is the last place to want one.
//
// So the logic stays runnable-as-is and this file gives `tsc --noEmit` and the
// vitest suite something to check against. Keep the two in sync by hand — the
// signatures are small and the unit tests exercise every export.

export const ATTESTATION_FILE: 'attestation.json';
export const ATTESTATION_SCHEMA: string;
export const SIG_NAMESPACE: string;
export const DELETED: 'deleted';
export const SEVERITIES: readonly string[];

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Gate = 'low' | 'medium' | 'high' | 'critical' | 'none';

export interface AttestedFile {
  path: string;
  /** A 40- or 64-hex-character git blob OID, or the literal `deleted`. */
  oid: string;
}

/**
 * The fields a parsed attestation exposes, under the short internal names the
 * generator and the verifier use. `head` is `reviewed_at_commit` in the JSON,
 * and `findings` is `findings_by_severity`.
 *
 * Every one is optional because `gateSatisfied` and the CI job summary have to
 * report on a partially-readable attestation without throwing — but
 * `parseAttestation` never returns one with a field missing. It rejects the
 * artifact instead.
 */
export interface AttestationFields {
  scope?: string;
  head?: string;
  model?: string;
  gate?: string;
  verdict?: string;
  findings?: Partial<Record<Severity, number>>;
  files: AttestedFile[];
}

export interface BuildFields {
  scope: string;
  head: string;
  model: string;
  gate: string;
  verdict: string;
  findings?: Partial<Record<Severity, number>>;
  files: AttestedFile[];
}

/** The on-disk shape. `attestation_id` is absent from what `buildAttestation`
 *  returns, because it is the digest of exactly that. */
export interface Attestation {
  schema: string;
  attestation_id?: string;
  scope: string;
  reviewed_at_commit: string;
  model: string;
  gate: string;
  verdict: string;
  findings_by_severity: Record<Severity, number>;
  files: AttestedFile[];
}

export function gateRank(gate: string): number;
export function severityRank(sev: string): number;
export function comparePathsBytewise(a: string, b: string): number;
export function assertSafePath(p: string): string;
export function buildAttestation(fields: BuildFields): Attestation;
export function attestationDigest(artifact: object): string;
export function renderAttestation(fields: BuildFields): string;
export function parseAttestation(text: string): {
  digest: string;
  artifact: Attestation;
  fields: AttestationFields;
};
export function verifyDigest(text: string): boolean;
export function uncoveredPaths(attestedPaths: string[], changedPaths: string[]): string[];
export function gateSatisfied(
  fields: Pick<AttestationFields, 'gate' | 'findings'>,
  requiredGate?: string,
): { ok: boolean; reasons: string[] };
