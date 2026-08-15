# Smart Lookup — verified capability reference

**Audited:** 2026-08-16 · **Remediated:** 2026-08-16 · **Against:** `components/SmartLookupTab.tsx` + `utils/lookupEngine.ts`
**Method:** source read plus live runs of the real UI against a probe workbook. Behaviour claims are observed, not inferred, except where marked *(by inspection)*.

> **Scope of the remediation:** correctness and architecture only. Approximate/range match, wildcards and full `XLOOKUP` semantics were deliberately **not** implemented — see *Deliberately not done*.

## What the module is

One exact-match join, in one place: `utils/lookupEngine.ts`.

```
readGrid(sheet) → buildLookup(source, ref, options) → rows → writeSheet()
                                   ↓
                        preview and export both read THESE rows
```

It used to be two joins. `runLookup` kept the first row for a duplicated key and `handleDownload` kept the last, so the preview a user approved and the file they downloaded disagreed (TD-043). The export no longer performs a lookup at all — it writes the rows the preview was built from.

The engine works on **cells**, not values. That is load-bearing: a value alone cannot tell you `46037` is a date rather than a number (TD-045), or that a key is `#N/A` rather than the number 15 (TD-047). Both are cell facts — `z` and `t` — and both were discarded by the old flatten-to-values step.

### The matching rule

`normalizeKey()` is the only rule:

| Input | Becomes | Note |
|---|---|---|
| any value | `String(v).trim().toLowerCase()` | matching is **always** case- and whitespace-insensitive |
| `"007"`, Smart Match on | `"7"` | leading zeros stripped only when the string is all digits |
| `"Item-01"`, Smart Match on | `"item-01"` | the all-digits guard protects mixed keys |
| an error cell (`t === 'e'`) | `null` | cannot be a key, either side |
| blank | `null` | cannot be a key, either side |

**Smart Match is a superset of Excel, not a match mode.** It finds things `VLOOKUP` would not. That is the point of the tool, and also why results legitimately differ from a manual formula — trimming and case-folding are not `VLOOKUP` behaviour.

## Parity table

Status: ✅ full parity · 🟡 partial · ❌ missing · 🐞 incorrect

| # | Feature | Manual Excel capability | Smart Lookup support | Status | Evidence | Remaining gap | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Exact match | `VLOOKUP(…,0)`, `XLOOKUP` | Hash join on the normalised key | ✅ | e2e + 23 unit tests | — | — |
| 2 | Return column left of key | `XLOOKUP` / `INDEX+MATCH` only | Any column, either side | ✅ | Unit test | — | — |
| 3 | Multi-column return | `XLOOKUP` spill | Checkbox list, order preserved | ✅ | Unit + e2e | — | — |
| 4 | Duplicate keys | First match | **First match**, preview and file | ✅ | **Fixed — TD-043.** e2e compares file to preview cell for cell | — | — |
| 5 | Dates | Stays a date | `z` carried; preview formats too | ✅ | **Fixed — TD-045** | — | — |
| 6 | Empty return-column header | N/A | Exports normally | ✅ | **Fixed — TD-046** | — | — |
| 7 | Error cells as keys | `#N/A` propagates | Treated as no-key | ✅ | **Fixed — TD-047.** Unit tests both sides | — | — |
| 8 | Approximate / range match | `VLOOKUP(…,TRUE)`, `XLOOKUP ±1` | None | ❌ | Deliberately deferred | Price tiers, tax bands | P1 (next) |
| 9 | Wildcards | `XLOOKUP` mode 2 | None | ❌ | Deliberately deferred | Partial codes | P2 |
| 10 | Search from last | `XLOOKUP` mode −1 | None | ❌ | Deliberately deferred | "Most recent" | P2 |
| 11 | Case-SENSITIVE match | `EXACT()` + `INDEX/MATCH` | Always insensitive | ❌ | `toLowerCase` unconditional | Case-distinct SKUs | P3 |
| 12 | Whitespace significance | `"A "` ≠ `"A"` | Always trimmed | 🟡 | Documented above | More lenient than Excel | P3 |
| 13 | Type coercion | `"1"` ≠ `1` | Equal under Smart Match | 🟡 | The tool's purpose; a toggle | — | — |
| 14 | Leading zeros | `"007"` ≠ `7` | Equal under Smart Match | 🟡 | Same | — | — |
| 15 | `MATCH` (position) | Returns an index | None | ❌ | — | No row-number output | P3 |
| 16 | `HLOOKUP` / row-wise | `HLOOKUP` | None | ❌ | — | Transposed sheets | P3 |
| 17 | Not-found value | `XLOOKUP if_not_found` | Text box; empty = blank cell | ✅ | **Fixed.** Localised default | — | — |
| 18 | Several ref sheets | `IFERROR(VLOOKUP…)` | One | ❌ | — | Split reference data | P2 |
| 19 | Several workbooks | Cross-workbook | One external file | 🟡 | — | Two sources max | P3 |
| 20 | Named ranges | `VLOOKUP(x, MyRange,…)` | None | ❌ | — | — | P3 |
| 21 | Tables / structured refs | `Table1[Col]` | None | ❌ | — | — | P3 |
| 22 | Dynamic ranges | Spill refs, `OFFSET` | Whole sheet | 🟡 | — | No row-range inputs | P3 |
| 23 | No header row | Formulas need no headers | **"First row is a header" toggle** | ✅ | **Fixed.** Unit test | — | — |
| 24 | Hidden sheets | Referenceable | Listed normally | ✅ | — | — | — |
| 25 | Result data types | Preserved | Preserved | ✅ | Unit test (numbers, booleans) | — | — |
| 26 | Number formatting | Follows source | `z` carried to output | ✅ | **Fixed with TD-045** — also currency, percent | — | — |
| 27 | Blank lookup key | `#N/A` | Counted as a miss | 🟡 | Unit test | Not distinguished from a real miss | P3 |
| 28 | Blank reference key | Would match | Never indexed | ✅ | Unit test | — | — |
| 29 | Spill / dynamic array | Spills | Static grid | ✅ | Equivalent for a file tool | — | — |
| 30 | Large data — correctness | Scales | O(n+m) hash join | ✅ | 10k-row unit test, first-match order held | — | — |
| 31 | Large data — responsiveness | Excel stays usable | Synchronous; blocks the tab | 🟡 | No yields in the loops | UI freeze, no cancel | P2 |
| 32 | Progress accuracy | N/A | Coarse (0 → 20 → 90 → 100) | 🟡 | Cannot paint mid-loop | Same fix as #31 | P3 |
| 33 | Batch ZIP export | Manual | Supported, same sheet builder | ✅ | Now styled like single files | — | — |
| 34 | UI — match mode | Formula argument | Smart Match on/off only | 🟡 | — | Depends on #8/#9 | P1 (with #8) |
| 35 | UI — search mode | `XLOOKUP` argument | None | ❌ | — | See #10 | P2 |
| 36 | UI — localisation | N/A | Fully localised, en + ar | ✅ | **Fixed** | — | — |
| 37 | Test coverage | N/A | 23 unit + 3 e2e | ✅ | **Fixed — TD-044** | — | — |

### Totals

| | Before | After |
|---|---:|---:|
| ✅ Full parity | 9 | **18** |
| 🟡 Partial | 12 | **8** |
| ❌ Missing | 12 | **11** |
| 🐞 Incorrect | 4 | **0** |
| Audited | 37 | 37 |

## Deliberately not done

Approximate/range match (#8), wildcards (#9), search-from-last (#10) and full `XLOOKUP` semantics were held back on purpose: correctness and architecture first, feature expansion second. The engine now takes an options object, so a match mode is an added field rather than a rewrite — which is the point of doing it in this order.

## Documentation accuracy

| Claim | Verdict |
|---|---|
| ~~"Smart Lookup (XLOOKUP+)"~~ → **"Smart Lookup (forgiving exact match)"** | **Corrected.** `XLOOKUP` has match modes, search modes and `if_not_found`; only the last of those exists here. The title claimed a parity the code did not have. |
| "Advanced VLOOKUP that handles mixed types and leading zeros automatically" | ✅ Accurate. |
| "You can upload a separate reference file" | ✅ Accurate. |
| Left-of-key return | Was implemented and undocumented — recorded above (#2). |
| Batch ZIP export | Was implemented and undocumented — recorded above (#33). |
| Always case-insensitive / always trimmed | Was undocumented and is the likeliest source of "why did this match?" — recorded above. |

## Where the tests are

- `tests/unit/lookupEngine.test.ts` — 23 tests on the join and the matching rule.
- `e2e/smart-lookup.spec.ts` — 3 specs. The first compares the downloaded file against the on-screen preview **cell for cell**, so a future divergence fails whatever the values are; it is the test TD-043 did not have.
