/**
 * Shape validation for the Project Summary template.
 *
 * WHY THIS EXISTS
 * ---------------
 * The template is stored in `localStorage`, and since ADR-0005 removed Firebase
 * that is the ONLY copy. `JSON.parse` returns `any`, so handing the result
 * straight to `FieldDef[]` state threw on the first `fields.map()` during render
 * — outside the loader's try/catch, so the catch never saw it. The whole tab was
 * replaced by the ErrorBoundary with no route back except clearing site data.
 *
 * While Firestore held a second copy that was survivable. As the only store, one
 * bad value stranded the tool permanently.
 *
 * WHY IT IS WRITTEN AGAINST `unknown`
 * -----------------------------------
 * A first attempt asserted `as FieldDef` before checking, which made every check
 * statically always-true: the compiler could not distinguish
 * `typeof o === 'string'` from dead code, and — the part that actually bit —
 * could not point out that `condition` and `conditions` were never checked at
 * all, even though `isFieldVisible` calls `conds.every(...)` and
 * `value.some(v => v.toLowerCase())` on them. A stored `{"conditions": "x"}`
 * still crashed.
 *
 * Reading through `Record<string, unknown>` keeps each property `unknown`, so
 * TypeScript verifies these predicates genuinely establish the interface, and
 * will complain if the interface is later widened.
 *
 * The predicates are STRICT rather than coercing. A malformed template falls back
 * to the defaults with a console message, which is recoverable; silently
 * repairing a shape risks writing the repaired version back over the user's data.
 */

export interface FieldCondition {
  fieldId: string;
  value: string | string[];
}

export interface FieldDef {
  id: string;
  label: string;
  options: string[];
  isMultiline?: boolean;
  condition?: FieldCondition;
  conditions?: FieldCondition[];
}

export const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

export const isFieldCondition = (v: unknown): v is FieldCondition => {
  if (v === null || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  // The element check on `value` is not pedantry: `isFieldVisible` calls
  // `cond.value.some(v => v.toLowerCase())`, so `value: [1]` is a crash.
  return typeof c.fieldId === 'string'
    && (typeof c.value === 'string' || isStringArray(c.value));
};

export const isFieldDef = (v: unknown): v is FieldDef => {
  if (v === null || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  return typeof f.id === 'string'
    && typeof f.label === 'string'
    && isStringArray(f.options)
    && (f.isMultiline === undefined || typeof f.isMultiline === 'boolean')
    && (f.condition === undefined || isFieldCondition(f.condition))
    && (f.conditions === undefined
      || (Array.isArray(f.conditions) && f.conditions.every(isFieldCondition)));
};

/** True when `v` is a usable template: an array of well-formed `FieldDef`. */
export const isFieldDefArray = (v: unknown): v is FieldDef[] =>
  Array.isArray(v) && v.every(isFieldDef);
