# Test fixtures

Committed spreadsheet files for bugs where **the bytes are the point**.

This directory is a deliberate exception. `e2e/helpers/makeFiles.ts` builds its
files in code, and its reasoning is right for what it covers: a 40,000-row
spreadsheet in the repo would dominate every diff and clone, and the property
under test there is the row count, not the bytes.

That reasoning does not apply here. The bug below is *about* how Excel stores and
displays a specific value, so a real file you can open in Excel and see the
behaviour in is worth 18 KB.

`makeScientificNotationXlsx()` in `e2e/helpers/makeFiles.ts` builds the same
content in code, so it is defined once somewhere a reviewer can read it in a
diff. `tests/unit/excelServiceCellValues.test.ts` asserts the builder's output
equals this file sheet for sheet — a continuous check, not a one-time one, so
neither form can drift from the other.

No e2e spec uploads the builder yet; the unit suite loads this file. It is there
for an upload-driven test to use, not because one exists.

---

## `scientific-notation-barcodes.xlsx` — TD-038

**The bug:** long barcodes were silently rewritten into wrong barcodes.

Excel's General number format switches to scientific notation at **12 digits**.
So a 13-digit EAN stored as a number has two representations:

| | |
|---|---|
| `cell.v` — what Excel **stores** | `1234567890123` |
| `cell.w` — what Excel **displays** | `1.23457E+12` |

`getSheetData(…, raw: false)` returned `w`, then "repaired" the scientific string
with `Number()`. Six significant digits in, invented zeros out.

### The wrong result this file produced

Verbatim output of the pre-fix `getSheetData` against this fixture. Column B
holds each barcode as a **number**; column C holds the same digits as **text**,
which is how Excel keeps them intact:

| SKU | B — stored as number | C — stored as text | Price |
|---|---|---|---|
| COMP-001 | **1234570000000** ❌ | 1234567890123 ✓ | 1234.5678 |
| COMP-002 | **1234570000000000** ❌ | 1234567890123456 ✓ | 5 |
| COMP-003 | **9876540000000** ❌ | 9876543210987 ✓ | 3.1 |
| COMP-004 | 12345678901 ✓ | 12345678901 ✓ | 0.15 |
| 000456 | **1112220000000** ❌ | 1112223334445 ✓ | 9.99 |
| AB-0012-X | **5556670000000** ❌ | 5556667778889 ✓ | 1.05 |

Two things that make this the worst kind of failure:

- **The output is still a plausible barcode.** Nothing looks broken. It scans as
  a different product, or matches nothing, and the spreadsheet looks fine.
- **`COMP-004` is correct.** At 11 digits it stays under Excel's threshold, so any
  spot-check on a short barcode passes and the bug looks like it is not there.

`000456` and `AB-0012-X` show the flip side: those SKUs were **never** affected,
because text cells were always returned verbatim. Leading zeros and letters were
fine all along — the damage was confined to numbers of 12+ digits.

### The correct result

`cell.v`, which was available the whole time:

| SKU | Barcode |
|---|---|
| COMP-001 | 1234567890123 |
| COMP-002 | 1234567890123456 |
| COMP-003 | 9876543210987 |
| COMP-004 | 12345678901 |
| 000456 | 1112223334445 |
| AB-0012-X | 5556667778889 |

### What guards it now

`tests/unit/excelServiceCellValues.test.ts` reads **this file** through the real
`getSheetData` and asserts both directions: the true values are returned, and each
specific wrong value from the table above is not. Reverting the fix fails those
assertions by name rather than by a vague diff — measured: **12 of 21 fail**.

Fixed in `utils/cellText.ts` by `scientificNumberOverride()`, which is an
*override* rather than a reformatter: `getSheetData` keeps SheetJS's own value for
every cell and replaces only a number whose displayed text is scientific. A first
attempt rebuilt every value from the cell and silently changed three other
classes — most importantly error cells, which went from `""` to the literal
`"#N/A"`, so a broken VLOOKUP in a barcode column would have exported `#N/A` *as
a barcode*. Verified against a plain `sheet_to_json` baseline: exactly one cell
class differs.

Full reasoning: TD-038 in `docs/quality/tech-debt-register.md`, which also lists
the real blast radius — 23 call sites across 12 modules, not the 3 first claimed.

### A limit worth knowing

If a barcode was already written **into a file** as scientific text by some
earlier export, the digits are gone at rest. No code can recover them — the fix
prevents new corruption, it cannot undo old corruption. Recover those from the
original source.
