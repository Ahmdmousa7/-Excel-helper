// Types for collectors.mjs. See evidence.d.mts for why the implementation is
// plain ESM rather than TypeScript.
//
// The shapes below are written out rather than left as `Record<string, any>`.
// That costs a few lines and buys two things: `tsc` checks the unit suite's
// assertions against them, and anyone reading the bundle format has one place
// that states it.
//
// Every collector returns a union with `Unavailable`. That union IS the design —
// a collector must never report a pass for a tool that did not run — so callers
// are forced to narrow on `available` before reading a result.

export interface Unavailable {
  available: false;
  reason: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SeverityCounts = Record<Severity, number>;

export const SEVERITY_ORDER: Severity[];

export function unavailable(reason: string): Unavailable;
export function toPosixRelative(abs: string, root: string): string;

// --- review / findings -----------------------------------------------------

export interface RawFinding {
  severity?: string;
  category?: string;
  file?: string;
  line?: number;
  summary?: string;
  title?: string;
  detail?: string;
  suggested_fix?: string;
}

export interface RawReview {
  verdict?: string;
  files_reviewed?: number;
  findings?: RawFinding[];
  summary?: string;
}

export interface ReviewPayload {
  available: true;
  gate: string | null;
  model: string | null;
  verdict: string;
  files_reviewed: number;
  findings_total: number;
  findings_by_severity: SeverityCounts;
  summary: string | null;
}

export interface NormalisedFinding {
  category: string | null;
  file: string | null;
  line: number | null;
  severity: string | null;
  summary: string | null;
  detail: string | null;
  suggested_fix: string | null;
}

export interface FindingsPayload {
  available: true;
  total: number;
  by_severity: SeverityCounts;
  findings: NormalisedFinding[];
}

export function sortFindings<T extends RawFinding>(findings: T[]): T[];
export function countBySeverity(findings: Array<{ severity?: string }>): SeverityCounts;
export function collectReview(
  reviewJson: RawReview | null,
  meta: { model: string | null; gate: string | null },
): ReviewPayload | Unavailable;
export function collectFindings(reviewJson: RawReview | null): FindingsPayload | Unavailable;

// --- metrics sections ------------------------------------------------------

export interface TypescriptPayload {
  available: true;
  errors: number;
  error_codes: Record<string, number>;
  passed: boolean;
}

export interface EslintPayload {
  available: true;
  errors: number;
  warnings: number;
  passed: boolean;
  files_with_findings: number;
  top_rules: Array<{ rule: string; errors: number; warnings: number }>;
}

export interface VitestPayload {
  available: true;
  passed?: boolean;
  tests?: {
    total: number | null;
    passed: number | null;
    failed: number | null;
    skipped: number;
    suites: number | null;
  };
  coverage?: {
    branches_pct: number | null;
    functions_pct: number | null;
    lines_pct: number | null;
    statements_pct: number | null;
  };
}

export interface PlaywrightPayload {
  available: true;
  passed_count: number;
  failed_count: number;
  flaky_count: number;
  skipped_count: number;
  total: number;
  passed: boolean;
  failures: string[];
}

export interface BundlePayload {
  available: true;
  passed?: boolean;
  budgets_ok?: number;
  budgets_total?: number;
  metrics?: Array<{
    metric: string;
    gzip_kb: number;
    budget_kb: number;
    used_pct: number;
    over: boolean;
  }>;
  largest_files?: Array<{ file: string; raw_bytes: number; gzip_bytes: number }>;
}

export interface EslintFileResult {
  filePath: string;
  errorCount?: number;
  warningCount?: number;
  messages?: Array<{ ruleId?: string | null; severity: number }>;
}

export function collectTypescript(text: string | null): TypescriptPayload | Unavailable;
export function collectEslint(json: EslintFileResult[] | null): EslintPayload | Unavailable;
export function collectVitest(
  runJson: Record<string, number> | null,
  coverageJson: { total?: Record<string, { pct?: number }> } | null,
): VitestPayload | Unavailable;
export function collectPlaywright(
  json: { suites?: unknown[] } | null,
): PlaywrightPayload | Unavailable;
export function collectBundle(
  json: Record<string, unknown> | null,
): BundlePayload | Unavailable;

// --- dependencies ----------------------------------------------------------

export interface AuditPayload {
  available?: true;
  reason?: string;
  scope?: string;
  critical?: number;
  high?: number;
  moderate?: number;
  low?: number;
  info?: number;
  total?: number;
  passed?: boolean;
  blocking_advisories?: Array<{ name: string; severity: string; range: string | null }>;
}

export interface DependencyPayload {
  available: true;
  production_count: number;
  development_count: number;
  direct: Array<{ name: string; range: string; kind: string; licence: string | null }>;
  audit: AuditPayload | Unavailable;
  licences: Record<string, number>;
}

export function collectDependencies(input: {
  pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null;
  auditJson?: {
    metadata?: { vulnerabilities?: Record<string, number> };
    vulnerabilities?: Record<string, { name: string; severity: string; range?: string }>;
  } | null;
  licences?: Record<string, string | null>;
}): DependencyPayload | Unavailable;

// --- accessibility ---------------------------------------------------------

export interface AccessibilityPayload {
  available: true;
  standard: string;
  pages_scanned: string[] | null;
  violations_total: number;
  by_impact: Record<string, number>;
  by_rule: Record<string, { impact: string | null; nodes: number; pages: string[] }>;
  known_debt_rules: string[] | null;
  unexpected_rules: string[] | null;
  passed: boolean | null;
}

export function collectAccessibility(json: {
  standard?: string;
  known_debt_rules?: string[];
  pages?: string[];
  violations?: Array<{
    id?: string;
    impact?: string;
    nodes?: number;
    nodeCount?: number;
    page?: string;
  }>;
} | null): AccessibilityPayload | Unavailable;

// --- architecture ----------------------------------------------------------

export interface ArchitecturePayload {
  available: true;
  method: string;
  layering: {
    rule: string;
    violations: Array<{
      from: string; from_layer: string; to: string; to_layer: string;
    }>;
    violation_count: number;
  };
  source_files: number;
  total_loc: number;
  by_directory: Record<string, { files: number; loc: number }>;
  oversized: {
    threshold_loc: number;
    count: number;
    files: Array<{ file: string; loc: number }>;
  };
  probable_duplicates: Array<{ base: string; variants: string[] }>;
}

export function collectArchitecture(
  root: string,
  opts?: { locThreshold?: number },
): ArchitecturePayload;
