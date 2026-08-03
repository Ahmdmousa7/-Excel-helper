// Types for evidence.mjs. Same reasoning as attestation.d.mts: the
// implementation is plain ESM so the CLIs run under bare `node` in a git hook
// and in CI with no build step, and this gives `tsc --noEmit` and the vitest
// suite something to check against.

export const BUNDLE_DIR: string;
export const REQUIRED_ARTIFACTS: string[];
export const SUMMARY_FILE: string;
export const SIGNERS_FILE: string;
export const SCHEMAS: Record<string, string>;

export function isBundlePath(p: string, dir?: string): boolean;
export function sortKeysDeep<T>(value: T): T;
export function canonicalJson(value: unknown): string;
export function isCanonical(text: string): boolean;
export function digestOf(text: string): string;
export function findNonDeterministic(value: unknown, path?: string, out?: string[]): string[];
export function assertDeterministic<T>(value: T, label?: string): T;
// Generic over the payload so the envelope's fields AND the payload's fields
// are both typed at the call site — no `any`, and no cast in the tests.
export function envelope<P extends object>(
  name: string,
  attestationId: string,
  payload: P,
): P & { schema: string; attestation_id: string };
export function checkArtifact(
  name: string,
  text: string,
  expectedAttestationId: string,
): string[];
export function missingArtifacts(present: string[]): string[];
