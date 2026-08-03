// Types for attestation.mjs.
//
// The implementation is plain ESM rather than TypeScript because the two CLIs
// that use it (`scripts/attest-review.mjs`, `scripts/verify-attestation.mjs`)
// run under bare `node` in a git hook and in CI, with no build step and no
// loader. Compiling them would put a toolchain between a push and its own
// verification, which is the last place to want one.
//
// So the logic stays runnable-as-is and this file gives `tsc --noEmit` and the
// vitest suite something to check against. Keep the two in sync by hand — the
// signatures are small and the unit tests exercise every export.

export const ATTESTATION_VERSION: number;
export const MAGIC: string;
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

export interface AttestationFields {
  scope?: string;
  head?: string;
  model?: string;
  gate?: string;
  verdict?: string;
  findings?: Partial<Record<Severity, number>>;
  fileCount?: number;
  files: AttestedFile[];
  /** Only present when a producer recorded a signer identity. */
  signer?: string;
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

export function gateRank(gate: string): number;
export function comparePathsBytewise(a: string, b: string): number;
export function assertSafePath(p: string): string;
export function buildBody(fields: BuildFields): string;
export function digestBody(body: string): string;
export function renderAttestation(fields: BuildFields): string;
export function parseAttestation(text: string): {
  digest: string;
  body: string;
  fields: AttestationFields;
};
export function verifyDigest(text: string): boolean;
export function uncoveredPaths(attestedPaths: string[], changedPaths: string[]): string[];
export function gateSatisfied(
  fields: Pick<AttestationFields, 'gate' | 'findings'>,
  requiredGate?: string,
): { ok: boolean; reasons: string[] };
