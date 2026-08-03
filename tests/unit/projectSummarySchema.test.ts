import { describe, it, expect } from 'vitest';
import {
  isStringArray,
  isFieldCondition,
  isFieldDef,
  isFieldDefArray,
} from '../../utils/projectSummarySchema';

/**
 * The template is read from localStorage, which since ADR-0005 is its only copy.
 * These tests exist because the guard has to be right in BOTH directions:
 *
 *   - reject the shapes that crash the tab (the ErrorBoundary trap)
 *   - accept every shape the app itself writes
 *
 * The second half matters as much as the first. An over-strict predicate would
 * silently discard a real saved template and reset it to the defaults, which is
 * worse than the crash it was added to prevent — the user loses work rather than
 * a render.
 */

describe('isStringArray', () => {
  it('accepts an empty array and an array of strings', () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['Yes', 'No'])).toBe(true);
  });

  it('rejects non-arrays and arrays with a non-string element', () => {
    expect(isStringArray('Yes')).toBe(false);
    expect(isStringArray(null)).toBe(false);
    expect(isStringArray([1])).toBe(false);
    expect(isStringArray([null])).toBe(false);
    expect(isStringArray([{}])).toBe(false);
  });
});

describe('isFieldCondition', () => {
  it('accepts a string value and a string-array value', () => {
    expect(isFieldCondition({ fieldId: 'a', value: 'Yes' })).toBe(true);
    expect(isFieldCondition({ fieldId: 'a', value: ['Yes', 'No'] })).toBe(true);
  });

  it('rejects a value whose elements are not strings', () => {
    // isFieldVisible does `cond.value.some(v => v.toLowerCase())`, so this is a
    // crash rather than a cosmetic problem.
    expect(isFieldCondition({ fieldId: 'a', value: [1] })).toBe(false);
    expect(isFieldCondition({ fieldId: 'a', value: [null] })).toBe(false);
    expect(isFieldCondition({ fieldId: 'a', value: {} })).toBe(false);
  });

  it('rejects a missing or non-string fieldId', () => {
    expect(isFieldCondition({ value: 'Yes' })).toBe(false);
    expect(isFieldCondition({ fieldId: 7, value: 'Yes' })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isFieldCondition(null)).toBe(false);
    expect(isFieldCondition('x')).toBe(false);
  });
});

describe('isFieldDef accepts everything the app writes', () => {
  it('accepts a plain field', () => {
    expect(isFieldDef({ id: 'accountName', label: 'Account Name', options: [] })).toBe(true);
  });

  it('accepts a field with dropdown options', () => {
    expect(isFieldDef({ id: 'sku', label: 'SKU', options: ['Yes', 'No', 'N/A'] })).toBe(true);
  });

  it('accepts the multiline note field', () => {
    expect(isFieldDef({ id: 'note', label: 'Note', options: [], isMultiline: true })).toBe(true);
  });

  it('accepts a single condition, string or array value', () => {
    expect(isFieldDef({
      id: 'a', label: 'A', options: [], condition: { fieldId: 'b', value: 'Zid' },
    })).toBe(true);
    expect(isFieldDef({
      id: 'a', label: 'A', options: [], condition: { fieldId: 'b', value: ['Zid', 'Salla'] },
    })).toBe(true);
  });

  it('accepts a conditions array, including empty', () => {
    expect(isFieldDef({
      id: 'a',
      label: 'A',
      options: [],
      conditions: [{ fieldId: 'b', value: 'Zid' }, { fieldId: 'c', value: ['X'] }],
    })).toBe(true);
    expect(isFieldDef({ id: 'a', label: 'A', options: [], conditions: [] })).toBe(true);
  });
});

describe('isFieldDef rejects the shapes that crash the tab', () => {
  it('rejects conditions that is not an array', () => {
    // `conds.every is not a function`
    expect(isFieldDef({ id: 'a', label: 'A', options: [], conditions: 'x' })).toBe(false);
  });

  it('rejects a null entry inside conditions', () => {
    // throws on `cond.fieldId`
    expect(isFieldDef({ id: 'a', label: 'A', options: [], conditions: [null] })).toBe(false);
  });

  it('rejects a non-string element inside a condition value', () => {
    expect(isFieldDef({
      id: 'a', label: 'A', options: [], conditions: [{ fieldId: 'a', value: [1] }],
    })).toBe(false);
  });

  it('rejects options containing a non-string, which renders as an <option> child', () => {
    expect(isFieldDef({ id: 'a', label: 'A', options: [null] })).toBe(false);
    expect(isFieldDef({ id: 'a', label: 'A', options: [{}] })).toBe(false);
  });

  it('rejects a missing id, label, or options', () => {
    expect(isFieldDef({ label: 'A', options: [] })).toBe(false);
    expect(isFieldDef({ id: 'a', options: [] })).toBe(false);
    expect(isFieldDef({ id: 'a', label: 'A' })).toBe(false);
  });

  it('rejects a non-boolean isMultiline', () => {
    expect(isFieldDef({ id: 'a', label: 'A', options: [], isMultiline: 'yes' })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isFieldDef(null)).toBe(false);
    expect(isFieldDef([])).toBe(false);
    expect(isFieldDef('x')).toBe(false);
  });
});

describe('isFieldDefArray', () => {
  it('accepts an array of valid fields', () => {
    expect(isFieldDefArray([
      { id: 'a', label: 'A', options: [] },
      { id: 'b', label: 'B', options: ['Yes'], condition: { fieldId: 'a', value: 'x' } },
    ])).toBe(true);
  });

  it('accepts an empty array — a template with every field deleted', () => {
    expect(isFieldDefArray([])).toBe(true);
  });

  it('rejects a bare object, which is what the ErrorBoundary trap looked like', () => {
    expect(isFieldDefArray({ not: 'an array' })).toBe(false);
  });

  it('rejects an array where a single entry is malformed', () => {
    expect(isFieldDefArray([
      { id: 'a', label: 'A', options: [] },
      { id: 'b', label: 'B', options: [null] },
    ])).toBe(false);
  });
});
