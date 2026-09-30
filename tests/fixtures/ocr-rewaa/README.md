# OCR → Rewaa reference files (supplied 2026-09-30)

Three files from the product owner, plus one derived from them. **These define
what the OCR tab must produce.** See D12 in `docs/modules/open-decisions.md`.

| File | Role | What it is |
|---|---|---|
| `correct-output.xlsx` | **CONTRACT: the expected output** | The workbook the OCR tab must produce for `source.xlsx`: 6 sheets, 180 rows. Every cell is compared by `tests/unit/ocrRewaaExport.test.ts`. |
| `wrong-output.xlsx` | **REGRESSION EXAMPLE** | What the app produced before 2026-09-30: 3 generic sheets, Arabic-first names, no Rewaa sheets, the two size pairs left as Simple rows. The suite asserts it does NOT pass. |
| `source.xlsx` | **INPUT EXAMPLE** | What OCR was run on: a Web Scraper export of `kelah.yallaqrcodes.com` (the contract names it `kelah.yallaqrcodes.com_extract_1790703069069.xlsx`, so the tests upload it under that name). |
| `model-answer.json` | Mocked model reply | Derived by `derive-model-answer.py`. It has the shape the live model returned in the wrong run (`Arabic \| English`, sizes as Simple rows, no SKUs), and the contract's English wording, because translation is the model's job, not the pipeline's. |

## What the contract requires, in short

- Sheets, in order: `Generic All Data`, `Generic Simple`, `Generic Variable`,
  `Rewaa Simple Products` (43 columns), `Rewaa Variable Products` (27 columns),
  `Source Files & Audit`.
- Every bilingual cell is written `English | Arabic`.
- Two Simple rows with the same name and category, no options and two different
  prices become `Size | الحجم` variants: `Small | صغير` for the cheaper one,
  `Large | كبير` for the dearer.
- Generic prices stay as text (`'4.00'`). Rewaa prices are numbers (`4`).
- Rewaa defaults: Sellable and Purchasable `yes`; Weighted and Tracked `no`;
  Wholesale, Cost, Buy Price and DEF Quantity `0`; Pack columns and Tax Code
  blank; `Enable stock management` always `no`.
- A missing price is blank on the Generic sheets and `0` on the Rewaa sheets,
  and the row is marked `Same in Rewaa … = FALSE` / `Rewaa Data Identical = FALSE`.
- Blank cells are empty text cells, except `Variant Name` on simple rows, which
  has no cell.
- SKUs are random `GEN-n`, unique, and the same SKU identifies a row on every
  sheet.

## Where the output intentionally differs from the contract (approved 2026-09-30)

| Cell | Contract | Written | Why |
|---|---|---|---|
| `Rewaa Variable Products` → `Option 1` | literal text `Option 1` | the option name (`Size \| الحجم`) | Rewaa's own template sample carries the name; the literal loses it on import |
| `Source Files & Audit` → `File Size` | `0.0 KB` | the real size | The contract's value was wrong |
| `Source Files & Audit` → `Verification Notes` | "…verified parity" | the number of rows that differ | Five rows are marked not identical |

## Regenerating `model-answer.json`

```
cd tests/fixtures/ocr-rewaa
python derive-model-answer.py      # needs openpyxl; exits non-zero if a value cannot be derived
```
