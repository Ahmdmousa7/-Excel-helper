# Exporter date & number-format audit / تدقيق تنسيق التواريخ والأرقام في التصدير

**Audited:** 2026-08-16 · **Against:** working tree at `00d75dc`
**Scope:** every module that writes a spreadsheet. **No exporter behaviour was changed** — this is a risk table to decide from, as instructed.

**Origin:** TD-045. Smart Lookup exported a returned date column as `46037`. The fix had two halves: parse with `cellNF: true` so SheetJS populates each cell's number format (`z`), and reapply `z` after `aoa_to_sheet`, which writes values only. That fix was applied **to Smart Lookup alone**. This audit asks which other exporters have the same shape.

---

## 0. RETRACTION — the static prediction was wrong / تصحيح

**Added 2026-08-16, after reproduction. The analysis in §1–§2 below predicted the wrong failure, and this correction is the most useful thing in this document.** §1–§2 are left unedited as the record of what reading-without-running got wrong.

| Predicted (static read) | Measured (reproduced) |
|---|---|
| `raw: true` modules export a date as the bare serial **`46037`** | ❌ **Wrong.** `sheet_to_json({ raw: true })` returns a JS **`Date` object** for a date-formatted cell, and `aoa_to_sheet` writes a `Date` back as a real date cell. **Nothing exports `46037`.** The date survives and the calendar day is correct for realistic dates |
| 8 modules at 🔴 High risk of producing a wrong number | The real defect is narrower and universal: **the original number format is replaced by SheetJS's default `m/d/yy`** |
| The two shared writers behave alike | ❌ **Wrong.** `exportToExcelSingleSheet` (xlsx-js-style) *additionally* shifts the 1900 epoch boundary (serial `1` → `2`) and, **in a non-UTC timezone only**, adds a fractional time component (`46037` → `46037.000104…` at UTC+3 — see the correction below). `appendSheet` plus the plain writer do neither |
| Text-mode modules export a date as a string | ✅ **Correct** — the cell comes out `t: 's'` |

### What the defect actually is

**Format fidelity — and it matters more in this app's context than the raw severity suggests.** A sheet authored `dd/mm/yyyy` is exported as `m/d/yy`, so **25/12/2026 renders as 12/25/26**. The stored value is right; the reading convention flips. For an audience that writes dates day-first, that reads as either an invalid date or the wrong month, and there is nothing on screen to signal it.

Secondary, on the `exportToExcelSingleSheet` path only (**Remove Blanks**, **Separator**, and Merge Datasets' separate-files mode): the serial gains about nine seconds of spurious time, so the cell is no longer a clean date serial and an exact comparison against a date will miss. The calendar day is unaffected for realistic dates.

**Correction, 2026-08-18 — that drift is timezone-dependent, not universal.** SheetJS converts between serials and `Date` objects through **local time**. Under `TZ=UTC` the round trip is exact and there is no drift at all; the ~9s was measured on a UTC+3 machine. This was found because the review caught two unit tests that passed locally and failed under `TZ=UTC`, which is what CI runs. The honest statement of the defect is therefore **stronger** than "the value drifts": *the same input file exports a different number depending on the exporting machine's timezone*, so an export is not reproducible across machines. The epoch-boundary shift (serial `1` → `2`) was re-verified and holds in **both** timezones.

### Corrected severity

| Path | Modules | What actually happens | Severity |
|---|---|---|:---:|
| `readGrid` + `writeSheet` | Smart Lookup | Original format and exact serial preserved | ✅ None |
| raw → `appendSheet` | Compare Files, Deduplicator, Salla, Zid | Real date; **format replaced with `m/d/yy`** | 🟡 Medium |
| raw → `exportToExcelSingleSheet` | Remove Blanks, Separator | Real date; format replaced; **timezone-dependent value drift** (none under UTC, ~+9s at UTC+3); epoch-boundary day shift in both | 🟡 Medium |
| raw → **both** writers, depending on output mode | Merge Datasets | `appendSheet` for merged/multi-sheet output; **`exportToExcelSingleSheet` for the "separate files" ZIP mode** (`components/MergeTool.tsx:170`), which carries the value-drift defect too | 🟡 Medium |
| raw **and** text mixed | Packs Manager | Both of the above, depending on the path taken | 🟡 Medium |
| text mode → any writer | Composite Check, Table Unpivot, Product Variants, Files Validation, AI Translator, Google Sheets Import | Date becomes a **text cell** — no sorting, no date arithmetic | 🟡 Medium |
| output not copied from a dated sheet | OCR, Web Scraper, Project Summary, Support Chat | No date to lose | ⚪ Low |

**Nothing is 🔴 High.** The original table's 8 High ratings were based on the `46037` prediction and are withdrawn.

### Evidence

- `tests/unit/exporterDateFormat.test.ts` — **22 tests** pinning every claim above, run green under both `TZ=UTC` and a non-UTC zone, including the two writers' differing behaviour and the `dd/mm/yyyy` → `m/d/yy` flip.
- `e2e/exporter-date-format.spec.ts` — end-to-end through **Remove Blanks**: upload a `yyyy-mm-dd` column, download, inspect the cell. The exported cell reads `1/15/26`, which is how the `46037` prediction was disproved.
- `it.fails()` / `test.fail()` mark the assertions describing desired behaviour. They pass while the defect exists and **start failing the moment it is fixed**, which is the signal to remove the marker. One such marker had to be removed already: the serial-preservation assertion it guarded *does* hold under UTC, so `it.fails()` raised "Expect test to fail" in CI. **An inverted marker is only valid while the defect is unconditional** — that is the lesson, and it cost a red gate to learn.

**A third correction, found later:** §2 lists Merge Datasets under `appendSheet` alone. It uses **both** writers — `exportToExcelSingleSheet` per file in the "separate files" ZIP mode (`components/MergeTool.tsx:170`). §2 is left as-written per the note above; the table in this section is the corrected one. This was surfaced by `graphify explain "exportToExcelSingleSheet"`, which listed `MergeTool.tsx` as an importer where the static read had not — see `docs/tooling/graphify.md`.

---

## 1. The mechanism, precisely

Three facts combine into the bug:

1. **`readExcelFile` parses with `{ raw: true, cellNF: true }`** (`services/excelService.ts:13`). `cellNF` is what makes `cell.z` available at all — it was added for TD-045 and is now global, so **every module already has access to the format**. None but Smart Lookup reads it.
2. **`getSheetData(wb, sheet, raw)`** returns plain values, discarding `t` and `z`:
   - `raw = true` → a date is its **serial number** (`46037`).
   - `raw = false` (the default) → a date is SheetJS's **display text** (`"1/15/26"`), a string.
3. **Every writer used in this app is `aoa_to_sheet`**, which takes values only and sets no format:
   - `XLSX.utils.aoa_to_sheet` directly (11 components)
   - `appendSheet()` → `aoa_to_sheet` (`excelService.ts:175`)
   - `exportToExcelSingleSheet()` → `aoa_to_sheet` (`utils/excelUtils.ts:58`)

So the failure mode depends on the **read** mode:

| Read mode | A date becomes | Severity | Why |
|---|---|---|---|
| `raw = true` | `46037` — a number | 🔴 **High** | Looks like data, is not a date, silently wrong in any downstream import |
| `raw = false` | `"1/15/26"` — text | 🟡 **Medium** | Human-readable, but no longer a date **value**; Excel left-aligns it and date maths fails |
| cells preserved (`readGrid` + `writeSheet`) | a real date | ✅ None | Smart Lookup only |

**The same applies to currency, percent and any custom format** — not only dates. A `SAR 1,200.00` cell exports as `1200` under raw, or as the string `"SAR 1,200.00"` under text mode.

---

## 2. Module-by-module risk table

Verified per module from its `getSheetData` calls and its write path.

| Module | Read mode | Write path | Carries `z`? | Date risk | Notes |
|---|---|---|---|:---:|---|
| **Smart Lookup** | `readGrid` (cells) | `writeSheet` | ✅ yes | ✅ **None** | The fixed reference implementation (TD-045) |
| **Compare Files** | `raw = true` ×4 | `appendSheet` | ❌ | 🔴 High | Exports `Comparison_*`; a compared date column becomes serials |
| **Deduplicator (Pro)** | `raw = true` ×2 | `appendSheet` | ❌ | 🔴 High | `Scrubbed_*` carries whole rows through, dates included |
| **Merge Datasets** | `raw = true` ×2 | `appendSheet` | ❌ | 🔴 High | Both sides of a join pass through unchanged |
| **Remove Blanks** | `raw = true` | `exportToExcelSingleSheet` | ❌ | 🔴 High | Copies every surviving column verbatim |
| **Separator** | `raw = true` | `exportToExcelSingleSheet` | ❌ | 🔴 High | Pure row pass-through — highest exposure per row |
| **Packs Manager** | `raw = true` **and** `false` | `aoa_to_sheet` ×12 | ❌ | 🔴 High | Mixed modes in one module; already repairs scientific notation, so the class of problem is known here |
| **Salla Organizer** | `raw = true` ×2, `false` ×1 | `aoa_to_sheet` ×3 | 🟡 partial | 🔴 High | Sets `z = '@'` (force **text**) on some cells to protect SKUs — proof the `z` channel is understood, just not used for dates |
| **Zid Organizer** | `raw = true`, `false` ×2 | `aoa_to_sheet` | 🟡 partial | 🔴 High | Same `z = '@'` pattern as Salla |
| **Composite Check** | default (`false`) ×2 | `aoa_to_sheet` ×8 | ❌ | 🟡 Medium | Error/valid sheets echo source rows as text |
| **Table Unpivot** | `false` | `aoa_to_sheet` | ❌ | 🟡 Medium | Fixed columns repeat down as text |
| **Product Variants** | `false` ×2, default ×1 | `aoa_to_sheet` ×4 | ❌ | 🟡 Medium | Generated rows copy the parent's cells |
| **Files Validation** | *(reads sheet directly)* | `aoa_to_sheet` ×6 | ❌ | 🟡 Medium | `Validated_*` echoes input rows |
| **AI Translator** | default (`false`) ×2 | `aoa_to_sheet` ×3 | ❌ | 🟡 Medium | *Original File* and *Translated File* sheets carry source columns |
| **OCR Extraction** | `false` (template only) | `aoa_to_sheet` ×3 | ❌ | ⚪ Low | Rows are AI-generated, not copied from a dated sheet |
| **Web Scraper** | — | `aoa_to_sheet` | ❌ | ⚪ Low | Output is AI-generated text |
| **Google Sheets Import** | — | `aoa_to_sheet` | ❌ | 🟡 Medium | Re-emits an imported sheet; the CSV export endpoint already flattens dates to text upstream |
| **Project Summary** | — | `aoa_to_sheet` ×1 | ❌ | ⚪ Low | Output is a PDF; the sheet path is incidental |
| **QR Generator** | default (`false`) | *(no sheet output)* | n/a | ✅ None | Reads column A as text, writes PNG/ZIP |
| **Support Chat** | — | `aoa_to_sheet` ×1 | ❌ | ⚪ Low | Analyst export of model output |
| *RewaaTab (orphaned)* | `false` ×2 | `aoa_to_sheet` ×2 | ❌ | — | Unreachable — see the D4 decision note |

### Totals

| Risk | Count | Modules |
|---|---:|---|
| 🔴 High (`raw = true` → serial numbers) | **8** | Compare Files, Deduplicator, Merge Datasets, Remove Blanks, Separator, Packs Manager, Salla, Zid |
| 🟡 Medium (text mode → date-as-string) | **6** | Composite Check, Table Unpivot, Product Variants, Files Validation, AI Translator, Google Sheets Import |
| ⚪ Low (output not copied from a dated sheet) | **4** | OCR, Web Scraper, Project Summary, Support Chat |
| ✅ Fixed / not applicable | **2** | Smart Lookup, QR Generator |

**14 of 20 exporting modules can degrade a date.** Eight of them produce a plainly wrong number.

---

## 3. What is *not* claimed here

- **Nothing has been reproduced yet.** This is a static read of read-mode and write-path per module. A module marked 🔴 will corrupt a date **only if a user actually exports a date column through it** — for several (Salla, Zid) the realistic payloads are SKUs, names and prices, where the practical impact is on **currency formats** rather than dates.
- **No severity is asserted for the user's real files.** That needs one export per module with a date column, which is the recommended next step and was deliberately not done here.
- **`raw = true` is not itself a bug.** It is the correct choice for barcodes and long numbers — it is what avoids the scientific-notation corruption of TD-038. The defect is discarding `z`, not reading raw.

---

## 4. If this is fixed later

Smart Lookup's approach generalises, and the expensive half is already global:

1. `cellNF: true` is **already set** for the whole app, so `z` is available everywhere with no parsing change.
2. The reusable piece is a cell-preserving read plus a format-reapplying write — `readGrid` / `writeSheet` in `utils/lookupEngine.ts` are exactly that, and are not lookup-specific despite living there. Moving them to a shared module would let any exporter adopt the fix in a few lines.
3. `appendSheet` and `exportToExcelSingleSheet` are the two shared choke points. Teaching **those two** to accept optional formats would fix 5 of the 8 high-risk modules at once (Compare, Deduplicator, Merge, Remove Blanks, Separator).
4. Verify the way TD-045 was verified: assert on the exported cell's `z`, reading the downloaded file with `cellNF: true` — a test that reads it without that option will report `undefined` and look like a failure when the fix is working.

**Recommended order if approved:** the two shared helpers first (5 modules, one change), then Packs/Salla/Zid individually, then the medium-risk group.
