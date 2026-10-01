# OCR → Rewaa export: port-or-rebuild plan / خطة النقل أو إعادة البناء

**Written:** 2026-09-28 · **Status:** superseded in part — read this box first.

> **UPDATE 2026-09-30.** §4-A's six-sheet workbook **has now been built** (`utils/ocrRewaaExport.ts`), to the product owner's reference file rather than to this plan. See **D12** in `open-decisions.md`, which is authoritative where it differs from this plan. The differences: the sheet names are `Rewaa Simple Products` / `Rewaa Variable Products` / `Source Files & Audit`, the parity columns are `Same in Rewaa Simple` / `Same in Rewaa Variable` / `Rewaa Data Identical`, and the **"auto-download must be dropped" point in §3 and §5 is reversed** for this workflow.

> **CORRECTION, same day.** This plan was written before measuring the live app, and it assumed the Rewaa mapping had to be built. **It did not.** `components/OcrTab.tsx` already exported `All Extracted Data` / `Simple Products` / `Variable Products`, mapped into an uploaded template, handled `Option 1–3`, split variants and price ranges, and excluded the spec row. `grep rewaa` found nothing only because the code never uses that word.
>
> A search of this machine also found two more copies of the app — `Desktop\The-Greatest-Helper` (last commit 2026-01-23) and `D:\POS APP\Ai apps\uploader` (2026-03-10). Neither contains the AI Studio Rewaa work. The live repository is the most complete of all of them.
>
> Measured against the real templates, the live export diverged in **six** places. The three that produced wrong files are fixed in the commit that introduced `utils/templateMapping.ts`: `.csv` template upload, template defaults for unmapped columns, and synonym mapping. Still open: `Variant Name` construction, enforcing the stock default at export, and the comparison columns.
>
> So §4-A below reads as "build"; in practice it was a fix to existing code, done in `utils/templateMapping.ts`. §4-B (input formats) and §4-C (Files Validation) are unaffected by this correction and remain unstarted.

Requested as *"audit the exported AI Studio source against the current repository and produce a porting plan"* (D6). This is that plan, with one change forced by fact: **the applet source could not be obtained**, so the audit half could not be done. What follows is the rebuild plan, plus exactly what would change if the source turns up.

---

## 1. Why there is no port to audit

| Checked | Result |
|---|---|
| `latest.zip` supplied 2026-09-28 | **"ExcelDiff AI"** (`ai.studio/apps/cc7f98af…`), v`0.0.0`, 51 files, 6 diff tools |
| `rewaa`, `OcrTab`, `parity`, `Retail Price`, `Variant SKU`, `docx` in that zip | **0 hits each** |
| `rewaaComparisonService.ts`, `rewaaParityService.ts`, `pdfExtractionService.ts`, `CHANGELOG.md` | **absent** |
| `~/Downloads` for other AI Studio exports | only `exceldiff-ai.zip` — the same app |
| Machine-wide search for those service files outside `excel-helper` | none found |

So there are **three** codebases in play, not two:

| Codebase | AI Studio id | Contains |
|---|---|---|
| `excel-helper` — **the product** (D6) | `44aea71a…` | 25 modules, the real OCR tab, everything shipped to the live site |
| ExcelDiff AI — the supplied zip | `cc7f98af…` | 6 diff tools; an OCR *plan* in `PROMPT.md`, a 115-line `extractDataFromImages()`, **no Rewaa mapping** |
| The Rewaa/OCR applet | **unknown** | `rewaaComparisonService.ts`, 5-tab export, parity columns, v`1.2.1` |

The third has never been exported to this machine. Its transcript also contains a *"Restored from checkpoint 2026-09-17"* partway through, so **it may no longer exist even in AI Studio** — worth checking that app's history before assuming a port is available.

**If the source appears, this plan changes in one place only:** §4 becomes "adapt these files" instead of "write these files". The schemas, decisions and test strategy below hold either way, because they come from the real CSV templates and from D7 — not from the applet.

---

## 2. Ground truth: the two templates

Taken from the CSV files supplied 2026-09-28, not from any implementation.

**Simple — 43 columns.** `Product Name`, `Product SKU`, `Barcode`, `Category`, `Supplier`, `Brand`, `Description`, `Sellable`, `Purchasable`, `Enable stock management`, `Weighted`, `Tracked by batch`, `Tracked by serial`, `Retail Price`, `Wholesale Price`, `Cost`, `Buy Price`, `Tax Code`, `DEF Quantity`, then `Pack1…Pack3` × 8 (`Label`, `Size`, `SKU`, `Barcode`, `DEF Retail Price`, `DEF Buy Price`, `Sellable`, `Purchasable`).

**Variable — 27 columns.** `Product Name`, `Category`, `Supplier`, `Brand`, `Description`, `Option 1`, `Option 1 Value`, `Option 2`, `Option 2 Value`, `Option 3`, `Option 3 Value`, `Variant Name`, `Variant SKU`, `Variant BARCODE`, `Variant DESCRIPTION`, `Sellable`, `Purchasable`, `Enable stock management`, `Weighted`, `Tracked by batch`, `Tracked by serial`, `Retail Price`, `Wholesale Price`, `Cost`, `Buy Price`, `Tax Code`, `DEF Quantity`.

**Defaults, read off the real data rows rather than assumed:**

| Field | Value | Evidence |
|---|---|---|
| `Sellable`, `Purchasable` | `yes` | every sample row |
| **`Enable stock management`** | **`no`** | every sample row — and this **confirms** the later correction; an earlier instruction had it as `yes` |
| `Weighted`, `Tracked by batch`, `Tracked by serial` | `no` | every sample row |
| `Wholesale Price`, `Cost`, `Buy Price` | `0` | every sample row |
| `Pack* Sellable` / `Pack* Purchasable` | `yes` | present even on unpacked products |
| `Pack* DEF Retail Price` / `DEF Buy Price` | `0` | same |
| `Tax Code`, `DEF Quantity` | blank | same |

**Variant Name** is built as `Product Name | Option 1 Value` — `حري | Hari` + `نص | Half` → `حري | Hari | نص | Half`. Note both halves already contain ` | ` internally, so the separator is not a safe delimiter to parse back out; build only, never split.

**Row 2 of both templates is a spec row** (`Text | required | unique in the file and in the system`). Per D7 it is metadata and must **not** appear in ordinary exports.

---

## 3. Decisions already binding (D7)

| Rule | Consequence for this work |
|---|---|
| Template row 2 is metadata | excluded from ordinary exports; emitted only by an explicit template/spec export |
| **`00123` ≠ `123`** | identifiers compared as **exact text**; leading zeros preserved. **The earlier zero-stripping rule must not be implemented** — it manufactures false duplicates and then "resolves" them by renaming, corrupting a catalogue while reporting success |
| Diacritics **are** stripped | `6287013210006ِ` matches `6287013210006`; marks are invisible artefacts, digits are not. Original cell values always preserved in output |
| No unsolicited downloads | the applet's auto-download-on-complete does **not** come across; explicit `[ Download Excel ]` action |

---

## 4. What to build, in order

Three increments, each gated and reviewed. **Nothing starts without approval.**

### A — Rewaa mapping (the core)

- `services/rewaaTemplates.ts` — both schemas as data: headers, defaults, and the spec row kept separately so it can never leak into a normal export.
- `services/rewaaMapping.ts` — one `normalizeHeader()` used by **both** the mapper and the comparison. This is the single most important design point: the applet's parity columns reported `FALSE` on correct rows because the mapper lowercased keys and the checker did not, so `Regular price` was found by one and missed by the other. Normalising once and sharing the result makes that class of bug unrepresentable rather than merely fixed.
- Synonyms: `regular price` / `price` / `retail price` → `Retail Price`, and the equivalents for SKU, barcode, category.
- Split rule: a row with `Option 1` **and** `Option 1 Value` is variable; otherwise simple.
- One button → one workbook, tabs: `Rewaa Simple`, `Rewaa Variable`, `Generic All Data`, `Generic Simple`, `Generic Variable`, `Source Files`. Variable tabs omitted when empty.
- Comparison columns `In Rewaa Simple` / `In Rewaa Variable` on `Generic All Data`.
- **Export via this repo's existing helpers**, which carry the TD-049 fix. Do not introduce a new writer.

**Tests:** schema shape; every default; the `Regular price` → `Retail Price` regression; variant-name construction with Arabic text; the simple/variable split; spec row never present; mapper and comparison agreeing by construction.

### B — OCR input formats

`.xlsx`, `.xls`, `.csv`, `.docx` into the **same** extraction → normalization → validation → mapping → output pipeline, not a parallel path.

**Zero new dependencies**, which matters because this repo gates on dependency audit and bundle budget:

- spreadsheets → SheetJS, already present, via `readExcelFile` with its existing `raw`/`cellNF` semantics;
- `.docx` → **JSZip**, already present. A `.docx` is a zip; the text lives in `word/document.xml`. No parser library needed.

### C — Files Validation

> **COMPLETE 2026-09-28.** All three items below shipped (see Files Validation in `MODULE_GUIDE.md`). Cross-file validation was considered as a follow-on and is deliberately **not planned** — see **D14** in `open-decisions.md`.

The three earlier asks, now governed by D7: diacritic/punctuation normalization for duplicate matching (**no** zero-stripping), barcode auto-resolution appending `-1`/`-2` mirroring the existing SKU behaviour, and per-error / per-fix sheets in the output.

---

## 5. Risks worth naming before starting

- **`excelService.ts` has diverged** between the applet and this repo, and this repo's copy carries the TD-049 fix, `cellNF: true`, `writeWorkbookBuffer` and documented `raw` semantics. If a port ever happens, that file is **reconciled, never overwritten** — overwriting it silently reintroduces the wrong-date bug that was just fixed and deployed.
- **React version gap.** The applet is React 19; this repo is React 18. Any ported component needs checking, not copying.
- **No tests come with a port.** The applet has none in the supplied export. Ported code arrives unguarded and must earn its tests here.
- **`FileValidationTab` is already a large file** carrying two sheet builders (TD-049). Increment C adds to it. Worth considering whether the error-sheet generation belongs in a service instead.
- **Auto-download must be dropped on the way in** (D7). It is the applet's behaviour and would otherwise be ported by reflex.

---

## 6. What is needed to proceed

Either:

1. **Export the Rewaa/OCR applet** — in AI Studio, the app whose files include `services/rewaaComparisonService.ts` or a `components/OcrTab.tsx` containing "Rewaa". Confirm before exporting: `package.json` version **`1.2.1`** and a **`CHANGELOG.md`** present. Then §4 becomes an adaptation rather than a rebuild.
2. **Or approve the rebuild** on the plan above, accepting that the applet's implementation is set aside. The specs in the transcripts are detailed and the CSV templates are authoritative, so the rebuild is well-defined — and it arrives with tests and a review gate, which the applet version never had.

**Recommendation:** try (1) once, because it is five minutes and may save real work. If the app is gone or the export does not contain those files, take (2) without further delay — the plan does not depend on it.
