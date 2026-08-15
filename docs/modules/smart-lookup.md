# Smart Lookup — verified capability reference

**Audited:** 2026-08-16 · **Against:** `components/SmartLookupTab.tsx` (509 lines, the entire module)
**Method:** source read plus a live run of the real UI against a probe workbook. Behaviour claims below are observed, not inferred, except where marked *(by inspection)*.

> **Status of this document:** an audit record. Nothing here has been fixed yet — it exists so the fixes can be chosen deliberately. Two defects it records are user-visible today.

## What the module actually is

One exact-match join, implemented once and then implemented again slightly differently for export.

```
build Map<normalisedKey, refRow>  →  for each source row, Map.get(key)  →  append return columns
```

That is the whole engine. There is no formula parser, no match-mode switch, no range logic. `normalizeValue()` (lines 24–37) is the only matching rule:

| Input | Normalised to | Consequence |
|---|---|---|
| any value | `String(val).trim().toLowerCase()` | matching is **always** case-insensitive and **always** whitespace-insensitive |
| `"007"` with Smart Match on | `"7"` | leading zeros stripped when the string is **all digits** (`/^\d+$/`) |
| `"Item-01"` with Smart Match on | `"item-01"` | the all-digits guard deliberately protects mixed keys |

**Smart Match is a superset of Excel, not a match mode.** It makes the tool find things `VLOOKUP` would not. That is the module's reason to exist, and it is also why results legitimately differ from a manual formula — see the parity table.

## Confirmed defects

### 1. 🐞 The preview and the downloaded file disagree on duplicate keys

`runLookup` keeps the **first** row for a duplicated key; `handleDownload` keeps the **last**.

```ts
// line 165 — preview
if (key && !refMap.has(key)) refMap.set(key, row);
// line 221 — export   ← no guard
if (key) refMap.set(key, refRows[i]);
```

Observed on a reference sheet with two `A-1` rows:

| | Value column | Date column |
|---|---|---|
| On-screen preview | `FIRST` | `46037` |
| Downloaded file | **`LAST`** | **`46038`** |

The user validates one result and ships another. Excel's `VLOOKUP`/`XLOOKUP` default to the **first** match, so the preview is the correct half.

The root cause is that the lookup runs **twice** from two hand-written copies. Export does not reuse the preview's result; it rebuilds the index and re-runs the join.

### 2. 🐞 Dates come back as serial numbers

`readExcelFile` parses with `{ raw: true }` and no `cellDates`, so a date cell is a serial number by the time Smart Lookup sees it. A returned date column exports as `46037`, not a date. Excel's `VLOOKUP` returns a value that still displays as a date.

Observed: `WhenAdded` returned `46037`/`46038` in both preview and file.

### 3. 🐞 Header styling can throw *(by inspection)*

```ts
if (!ws[ref].s) ws[ref].s = {};   // line 275
```
`ws[ref]` is undefined when a header cell is empty, which `aoa_to_sheet` produces for a blank/undefined header. The download then fails with `Download Error: Cannot read properties of undefined`. Reachable whenever a chosen return column has no header text.

### 4. 🐞 Error cells can match the wrong row *(by inspection)*

With `raw: true`, an error cell's value is SheetJS's numeric error code, so `#N/A` in a key column normalises to a digit string (e.g. `"15"`) and can collide with a genuine key of `15`. Excel propagates the error instead.

## Parity table

Status: ✅ full parity · 🟡 partial · ❌ missing · 🐞 incorrect

| # | Feature | Manual Excel capability | Smart Lookup support | Status | Evidence | Missing / Gap | Recommended fix | Priority |
|---|---|---|---|---|---|---|---|---|
| 1 | Exact match | `VLOOKUP(…,0)`, `XLOOKUP` default | Map keyed on normalised value | ✅ | Live run: `A-9` → `Not Found`; `A-1` → matched | — | — | — |
| 2 | Return column left of key | Only `XLOOKUP` / `INDEX+MATCH`; `VLOOKUP` cannot | Any column by index, either side | ✅ | `returnCols` is independent of `matchCol` (line 189) | — | — | — |
| 3 | Multi-column return | `XLOOKUP` spill, or several formulas | Checkbox list, appended in order | ✅ | Live run returned `Value` + `WhenAdded` | — | — | — |
| 4 | Duplicate keys — which row wins | First match (both functions) | **Preview first, export last** | 🐞 | `FIRST` vs `LAST`, above | Two divergent index builds | Delete the export copy; reuse the preview result | **P0** |
| 5 | Dates | Returned date stays a date | Serial number | 🐞 | `46037` in preview and file | No `cellDates`, no format carry | Parse with `cellDates`, or set `z` on returned date cells | **P0** |
| 6 | Empty header on a return column | Not applicable | Download throws | 🐞 | `ws[ref].s` on undefined cell | Unguarded cell access | `if (ws[ref])` before styling | **P1** |
| 7 | Error cells as keys | `#N/A` propagates | Error code can match a number | 🐞 | `raw:true` yields the code | No `t === 'e'` check | Treat error cells as no-key | P2 |
| 8 | Approximate / range match | `VLOOKUP(…,TRUE)`, `XLOOKUP ±1` | None | ❌ | Only `Map.get` exists | Price tiers, tax bands, grade bands | Sorted array + binary search on numeric keys | **P1** |
| 9 | Wildcards | `VLOOKUP("A*")`, `XLOOKUP` mode 2 | None | ❌ | No pattern path | Partial-code matching | Opt-in mode; scan instead of hash | P2 |
| 10 | Search from last | `XLOOKUP` search mode −1 | None | ❌ | — | "Most recent price" | Expose as a first/last toggle — see #4 | P2 |
| 11 | Case-SENSITIVE match | `EXACT()` + `INDEX/MATCH` | Always case-insensitive | ❌ | `.toLowerCase()` unconditional (line 27) | Case-distinct SKUs collide | Option; drop `toLowerCase` when off | P3 |
| 12 | Whitespace significance | `VLOOKUP` treats `"A "` ≠ `"A"` | Always trimmed | 🟡 | `  A-2  ` matched `A-2` | More lenient than Excel — silently differs | Document; fold into a match-strictness option | P2 |
| 13 | Type coercion (text/number) | `"1"` ≠ `1` in Excel | Both `"1"` under Smart Match | 🟡 | Deliberate; the module's purpose | Differs from formula | Already surfaced as a toggle | — |
| 14 | Leading zeros | `"007"` ≠ `7` | Equal under Smart Match | 🟡 | `007` matched `7` live | Same as above | — | — |
| 15 | `MATCH` (position only) | `MATCH()` returns an index | None | ❌ | No row-number output | Cannot get position | Return-column option "row number" | P3 |
| 16 | `HLOOKUP` / row-wise | `HLOOKUP` | None | ❌ | Column-oriented only | Transposed sheets | Transpose-on-read option | P3 |
| 17 | Not-found value | `XLOOKUP if_not_found`, `IFERROR` | Hard-coded `"Not Found"` | 🟡 | Line 194 | No blank / 0 / custom; **not translated**; a string in a numeric column | Text box + blank option; localise | **P1** |
| 18 | Lookup across several sheets | `IFERROR(VLOOKUP(s1),VLOOKUP(s2))` | One ref sheet | ❌ | Single `refSheet` | Split reference data | Multi-sheet ref list, first hit wins | P2 |
| 19 | Several workbooks | Cross-workbook refs | One external file | 🟡 | One `refFile` | Two sources max | Accept multiple ref files | P3 |
| 20 | Named ranges | `VLOOKUP(x, MyRange, …)` | None | ❌ | Sheet + column index only | Named ranges ignored | Read `workbook.Workbook.Names` | P3 |
| 21 | Tables / structured refs | `Table1[Col]` | None | ❌ | Same | — | Same | P3 |
| 22 | Dynamic ranges | Spill refs, `OFFSET` | Whole sheet always | 🟡 | Reads every row | No range limit; header row assumed | Row-range inputs | P3 |
| 23 | Data has no header row | Formulas need no headers | Row 1 always consumed as headers | 🟡 | Loops start at `i = 1` | First record silently lost | "My data has no headers" checkbox | **P1** |
| 24 | Hidden sheets | Referenceable | Listed like any other | ✅ | `fileData.sheets` includes them | — | — | — |
| 25 | Result data types | Preserved | Preserved for numbers/text | ✅ | Raw values copied (line 190) | Dates excepted — see #5 | — | — |
| 26 | Number formatting | Follows source cell | Lost | 🟡 | `aoa_to_sheet` writes bare values | Currency/percent/date formats gone | Copy `z` from source cell | P2 |
| 27 | Blank lookup key | `#N/A` | Row output, all `"Not Found"` | 🟡 | `key` falsy → no match | Not distinguished from a real miss | Separate marker | P3 |
| 28 | Blank key in reference | Would be matched | Skipped (`if (key)`) | ✅ | Sensible | — | — | — |
| 29 | Spill / dynamic array | `XLOOKUP` spills | Static grid | ✅ | Equivalent outcome | N/A to a file tool | — | — |
| 30 | Large data — correctness | Formulas scale | Hash join, O(n+m) | ✅ | Right algorithm | — | — | — |
| 31 | Large data — responsiveness | Excel stays usable | Synchronous loop blocks the tab | 🟡 | No `await` inside the loops | UI freezes; no cancel | Chunk with yields; cancel button | P2 |
| 32 | Progress accuracy | N/A | Reported | 🟡 | `setProgress` inside a blocking loop cannot paint | Bar jumps | Same fix as #31 | P3 |
| 33 | Batch export to ZIP | Manual | Supported | ✅ | Beyond Excel | — | — | — |
| 34 | UI — match mode | Argument on the formula | Only Smart Match on/off | 🟡 | One checkbox | No exact/approx/wildcard | Depends on #8, #9 | **P1** |
| 35 | UI — search mode | `XLOOKUP` argument | None | ❌ | — | See #10 | — | P2 |
| 36 | UI — localisation | N/A | Panel is hard-coded English | 🟡 | `t` imported, mostly unused | Arabic users see English + `"Not Found"` | Move strings into `translations.ts` | P2 |
| 37 | Test coverage | N/A | **None** | ❌ | No unit or e2e spec references this module | Every defect above could have shipped unnoticed | Unit-test the join; e2e the preview/export agreement | **P0** |

## Documentation accuracy

| Claim | Where | Verdict |
|---|---|---|
| "Smart Lookup (**XLOOKUP+**)" | `translations.ts` → `smartLookup.title` | ❌ **Overstated.** `XLOOKUP` has match modes, search modes and `if_not_found`; none are implemented. It is an exact-match join with lenient normalisation. |
| "Advanced VLOOKUP that handles mixed types and leading zeros automatically" | `toolInfo.smartLookup.desc` | ✅ Accurate. |
| "You can upload a separate reference file" | `toolInfo.smartLookup.instr` | ✅ Accurate. |
| Left-of-key return | nowhere | Implemented but **undocumented** — the one genuine advantage over `VLOOKUP` and it is not mentioned. |
| Batch ZIP export | nowhere | Implemented, undocumented. |
| Always case-insensitive / always trimmed | nowhere | Real behaviour, undocumented, and the likeliest source of "why did this match?" |

## Totals

| | Count |
|---|---:|
| Capabilities audited | 37 |
| ✅ Full parity | 9 |
| 🟡 Partial | 12 |
| ❌ Missing | 12 |
| 🐞 Incorrect | 4 |

## Highest-priority gaps

1. **#4 — preview ≠ export on duplicate keys.** Silent, and it produces a file that differs from what was approved on screen.
2. **#37 — no tests at all.** The only module of this size with none.
3. **#5 — dates export as serials.** Any date column is corrupted on the way out.
4. **#23 — header row always assumed.** Headerless data silently loses its first record.
5. **#17 — not-found is a hard-coded, untranslated string** written into numeric columns.
6. **#8 — no approximate match.** The largest genuine capability gap against Excel.

## Recommended implementation order

1. **Unify the two lookups** (#4). Export should reuse the preview's rows. Fixes the divergence and deletes a duplicate implementation — everything below gets cheaper.
2. **Add the test suite** (#37) around the unified path, before changing behaviour further.
3. **Dates and the styling crash** (#5, #6) — small, contained, user-visible.
4. **Not-found behaviour and the header toggle** (#17, #23) — UI plus one option each.
5. **Approximate match** (#8), then **wildcards** (#9) and **first/last** (#10) once the engine takes a mode.
6. **Localisation** (#36) and **responsiveness** (#31).
7. Correct the **"XLOOKUP+"** title, or implement enough of `XLOOKUP` to earn it.
