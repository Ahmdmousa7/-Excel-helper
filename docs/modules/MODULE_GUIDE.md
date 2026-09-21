# Module Guide / دليل الوحدات

**Audited:** 2026-08-16 · **Against:** the working tree at commit `00d75dc`
**Method:** every claim was read out of source, tests, translation files and the navigation config. Where code and existing documentation disagree, the code wins and the disagreement is listed in §0.

> **How to read this.** §1 is the index — start there. §2 is one bilingual entry per module. §3–§6 are cross-cutting reference tables. §7 covers what was deleted. §9 is the debugging runbook. Nothing here is aspirational: where a capability is not implemented, it says so.

---

## 0. Documentation Drift Report / تقرير انحراف التوثيق

Produced before the guide was written. These are mismatches between what existing documentation claims and what the code does.

| # | Documented behaviour | Actual behaviour | Status | Action |
|---|---|---|---|---|
| D1 | `README.md`: "`npm run test` — Vitest unit suite (**32 tests**)" | **313 tests** across 12 files | ✅ **Fixed 2026-08-16** | README now states 313 / 12 files, dated |
| D2 | `README.md`: "`npm run e2e` — Playwright (**59 tests, 9 suites**)" | **107 tests, 16 spec files** | ✅ **Fixed 2026-08-16** | README now states 107 / 16 specs, dated |
| D3 | `docs/TESTING.md`: "`e2e/**`, **nine suites** matching the nine risk areas", with a 9-row table | **16 spec files.** Undocumented: `invalid-files`, `large-files`, `modal`, `offline`, `smart-lookup`, `support-chat-fallback`, `composite-quantity-rules` | ✅ **Fixed 2026-08-16** | The 7 missing rows were added and the "nine suites" claim replaced with the verified count |
| D4 | `utils/translations.ts` defines `tabs.rewaa` ("Rewaa Manager"), `toolInfo.rewaa`, and a full `rewaa: {}` block in **both** locales | **`components/RewaaTab.tsx` is unreachable** — not imported by `App.tsx`, no tab entry, no `menuGroups` id. The translations describe a module no user can open | 🐞 **Deferred — code decision** | Evidence and both options written up in [open-decisions.md](open-decisions.md#d4). Never wired in 141 commits |
| D5 | ~~The API-key modal offers a **Groq** key field, a Test button, and a link to `console.groq.com/keys` | `verifyGroqKey` is a stub: `return key.length > 10`. It never contacts Groq, and **no AI code path reads the Groq key**. Any 11-character string "passes" | 🐞 **Deferred — code decision** | See [open-decisions.md](open-decisions.md#d5). No `GroqService` ever existed; a Groq key also lights the sidebar "configured" dot~~ · ✅ **Fixed 2026-08-17** — field, stub, state, sidebar term, storage accessor and labels all removed (`5c24fa2`). One item stays open by decision: the orphaned `localStorage['groq_api_key']` value has no UI left to clear it |
| D6 | `App.tsx` lazily imports `VariableBalanceTabV2` | Never rendered — no JSX reference. ESLint already flags it | 🟡 Dead import | Delete the import, or wire the V2 tab |
| D7 | `docs/TESTING.md` cites "a 100-of-101 failure" | The suite is now 107 tests | ✅ **Fixed 2026-08-16** | Reworded to "100 of the 101 tests at the time" |
| D8 | `docs/modules/smart-lookup.md` title claim | **Matches** — corrected from "XLOOKUP+" to "forgiving exact match" on 2026-08-16 | ✅ Aligned | None |
| D9 | `docs/modules/removed-modules.md` | **Matches** — the three deleted modules are absent from source, navigation and translations | ✅ Aligned | None |

**Not drift, but load-bearing:** there is **no router**. Tools are entries in an array in `App.tsx` selected by in-memory state, so "entry point" below means *tab id + component*, never a URL path. No module has a route, and no deep link exists to any tool.

---

## 1. Module Index / فهرس الوحدات

23 tools + 1 dashboard + 1 always-mounted widget, grouped as the sidebar groups them.

| Module | Purpose | Entry point (tab id) | Main files | Input types | Output | Status |
|---|---|---|---|---|---|---|
| **Home** | Landing page, recent files, tool launcher | `-1` | `components/HomeTab.tsx` | none | navigation only | Active |
| **Remove Blanks** | Drop empty columns from a sheet | `30` | `components/CleanTool.tsx` | `.xlsx .xls .csv` | XLSX `Cleaned_*` or ZIP | Active |
| **Compare Files** | Match/diff two sheets, optional AI analysis | `31` | `components/CompareTool.tsx`, `utils/compareUtils.ts` | `.xlsx .xls .csv` | XLSX `Comparison_*` | Active |
| **Deduplicator (Pro)** | Hash-based duplicate removal | `32` | `components/DeduplicateTool.tsx` | loaded workbook | XLSX `Scrubbed_*`, sheet `Scrubbed_Data` | Active |
| **Merge Datasets** | Append or join two sheets | `33` | `components/MergeTool.tsx`, `utils/mergeUtils.ts` | `.xlsx .xls .csv` | XLSX `Merged_Output.xlsx` + `Schema_Mismatch_Report.xlsx` | Active |
| **Separator** | Split rows into chunks / extract sheets | `34` | `components/SplitterTool.tsx` | loaded workbook | XLSX or ZIP | Active |
| **Smart Lookup** | Forgiving exact-match join between two sheets | `23` | `components/SmartLookupTab.tsx`, `utils/lookupEngine.ts` | `.xlsx .csv` | XLSX `SmartLookup_*` or ZIP | Active |
| **Files Validation** | Validate product files against Rewaa rules | `16` | `components/FileValidationTab.tsx` | `.xlsx .xls .csv` | XLSX `Validated_*` | Active |
| **AI Translator** | Bulk AR↔EN column translation | `0` | `components/TranslateTab.tsx`, `utils/translationBatch.ts` | loaded workbook | XLSX `Translated_*` / `PARTIAL_*` | Active |
| **Table Unpivot** | Wide → tall (flatten attribute columns) | `22` | `components/UnpivotTab.tsx` | loaded workbook | XLSX `Vertical_*` | Active |
| **Packs Manager** | Group rows sharing a key into pack columns | `2` | `components/PacksTab.tsx` | loaded workbook | XLSX `Packs_Processed_*` | Active |
| **Product Variants** | Generate missing variant combinations | `14` | `components/VariableBalanceTab.tsx` | loaded workbook | XLSX | Active |
| **Salla Organizer** | Split Salla exports into Simple/Variable | `5` | `components/SallaTab.tsx` | `.xlsx` | XLSX `Salla_Analyzed*` | Active |
| **Zid Organizer** | Organise Zid products, fill parent names | `13` | `components/ZidTab.tsx` | `.xlsx` | XLSX `Zid_Organized_*` / `Zid_Mapped_*` | Active |
| **Composite Check** | Validate composite items against raw materials | `4` | `components/CompositeTab.tsx`, `utils/quantityRule.ts` | `.xlsx`, 2 sheets | XLSX, 3 sheets | Active |
| **OCR Extraction** | Images/PDF → structured table via AI | `12` | `components/OcrTab.tsx` | `image/*`, `.pdf`, `.xlsx` template | XLSX | Active |
| **Web Scraper** | URL → structured table via AI | `3` | `components/WebScraperTab.tsx` | URL + prompt | XLSX | Active |
| **PDF Tools** | Merge / split PDFs | `7` | `components/PdfToolsTab.tsx` | `application/pdf` | PDF or ZIP | Active |
| **Images to PDF** | Images → one PDF | `8` | `components/ImageToPdfTab.tsx` | `image/png,jpeg,webp` | PDF | Active |
| **Merge Images** | Stitch images vertically/horizontally | `6` | `components/MergeImagesTab.tsx` | `image/*` | PNG | Active |
| **Image Compressor** | Compress images in-browser | `9` | `components/ImageCompressorTab.tsx` | `image/*` | image or ZIP | Active |
| **Project Summary** | Build/export a project report | `26` | `components/ProjectSummaryTab.tsx`, `utils/projectSummarySchema.ts` | `.xlsx .xls .csv` | PDF / clipboard | Active |
| **QR Generator** | Single or bulk QR codes | `10` | `components/QrCodeTab.tsx` | text, or `.csv .xlsx .xls` | PNG or ZIP | Active |
| **Google Sheets Import** | Import a public Sheet by URL | `19` | `components/GoogleSheetsTab.tsx`, `services/excelService.ts` | Google Sheets URL | in-app workbook + XLSX | Active |
| **Support Chat / Data Analyst** | Floating AI assistant + Pandas generator | *(not a tab — always mounted)* | `components/SupportChat.tsx` | text, loaded workbook | chat text, markdown table, Python | Active |
| **Rewaa Manager** | Map products for Rewaa import | *(none)* | `components/RewaaTab.tsx` | — | — | **🐞 Orphaned — see D4** |
| Check Duplicates | — | — | — | — | — | **Removed** 2026-08-16 |
| CSV to Excel | — | — | — | — | — | **Removed** 2026-08-16 |
| Magic Links | — | — | — | — | — | **Removed** 2026-08-16 |
---

## 2. Per-module guide / دليل كل وحدة

**Conventions.** "Loaded workbook" means the file opened once in the shell and shared by every tab — most tools have no uploader of their own. Where a log message is hard-coded English in source, the Arabic column says *(English only in code)* rather than inventing a translation.

---

### 2.1 Smart Lookup / البحث الذكي

#### What it does / ماذا يفعل؟
**EN:** Joins two sheets on a key column and appends chosen columns from the reference sheet to every source row. Matching is exact but *forgiving*: case-insensitive, whitespace-trimmed, and (with Smart Match on) leading-zero- and type-insensitive, so `"007"` matches `7`.
**AR:** يربط ورقتين عبر عمود مفتاح ويضيف الأعمدة المختارة من الورقة المرجعية إلى كل صف. المطابقة تامة لكن مرنة: تتجاهل حالة الأحرف والمسافات، ومع «المطابقة الذكية» تتجاهل النوع والأصفار البادئة، فيطابق `"007"` الرقم `7`.

#### Who uses it / من يستخدمها؟
**EN:** Anyone enriching a product list from a master file — pulling cost, name or barcode onto an export whose keys are formatted inconsistently.
**AR:** أي شخص يثري قائمة منتجات من ملف رئيسي — لجلب التكلفة أو الاسم أو الباركود إلى ملف تصدير مفاتيحه غير موحّدة التنسيق.

#### Input / ماذا يدخل؟
**EN:** The loaded workbook as *source*; the reference is either another sheet of the same file or a separate upload (`accept=".xlsx,.csv"`). Required selections: source sheet, lookup column, reference sheet, match column, and ≥1 return column. Optional: Smart Match (default on), "First row is a header" (default on), a custom not-found value, and a max-rows-per-file batch size.
**AR:** المصنّف المحمّل كمصدر؛ والمرجع إما ورقة أخرى من الملف نفسه أو ملف مرفوع (`.xlsx,.csv`). المطلوب: ورقة المصدر، عمود البحث، الورقة المرجعية، عمود المطابقة، وعمود إرجاع واحد على الأقل. اختياري: المطابقة الذكية، «الصف الأول عناوين»، قيمة مخصصة لعدم التطابق، وحجم دفعة التصدير.

#### Output / ماذا يخرج؟
**EN:** `SmartLookup_<original name>.xlsx`, one sheet `Lookup Results` = all source columns then the return columns. Header row is styled. Number formats (`z`) are carried, so dates stay dates. With a batch size set, a ZIP of `Lookup_Part_N.xlsx`. Downloadable; preview shows the first 50 rows.
**AR:** ملف `SmartLookup_<الاسم>.xlsx` بورقة واحدة `Lookup Results` تضم أعمدة المصدر ثم أعمدة الإرجاع، مع تنسيق للعناوين والحفاظ على تنسيقات الأرقام والتواريخ. وعند تحديد حجم دفعة: ملف ZIP بأجزاء. قابل للتنزيل، والمعاينة تعرض أول 50 صفاً.

#### Files it reads / ما الملفات التي يقرأها؟
`.xlsx`, `.csv` — read through `readGrid(XLSX, worksheet)` in `utils/lookupEngine.ts`, which preserves each cell's value, type (`t`) and number format (`z`).

#### Errors / ما الأخطاء التي تظهر؟
| Error (EN) | Arabic | Trigger / السبب |
|---|---|---|
| `Please select Lookup Column, Match Column, and at least one Return Column.` | `اختر عمود البحث وعمود المطابقة وعموداً واحداً على الأقل للإرجاع.` | Run pressed with an incomplete configuration |
| `Settings changed during the lookup — run it again.` | `تم تغيير الإعدادات أثناء البحث — أعد التشغيل.` | A setting changed while a run was in flight |
| `Lookup failed: <message>` | `فشل البحث: <رسالة>` | Any throw inside the run (corrupt sheet, bad column index) |
| `Download error: <message>` | `خطأ في التحميل: <رسالة>` | Export threw |

#### Error handling / ماذا يحدث عند الخطأ؟
**EN:** A superseded run discards its own result and returns to idle rather than overwriting newer state. A failure logs and sets `ERROR`; nothing partial is exported. Any configuration change clears the held result, so Download can never write rows the screen is not showing.
**AR:** التشغيل المُلغى يتخلص من نتيجته ويعود للحالة الخاملة. الفشل يُسجَّل وتُضبط الحالة على خطأ ولا يُصدَّر شيء جزئي. أي تغيير في الإعدادات يمسح النتيجة المحفوظة، فلا يمكن تنزيل صفوف غير معروضة.

#### Edge cases / ما الحالات الخاصة؟
**Duplicate keys →** first match wins, as `VLOOKUP` does. **Error cells (`#N/A`) →** cannot be a key on either side. **Blank keys →** never indexed, counted as a miss. **Dates →** value plus `z` carried; preview formats via `XLSX.SSF`. **Leading zeros / numbers-as-text →** equal under Smart Match only. **Headerless data →** toggle off and no row is skipped. **Ragged rows →** short reference rows yield `''`, no crash. **10k rows →** unit-tested, first-match order holds.

#### Unsupported features / ما الذي لا يدعمه؟
**EN:** No approximate/range match, no wildcards, no search-from-last, no case-sensitive mode, no `MATCH`-style position output, no `HLOOKUP`, no named ranges or table refs, one reference sheet only. Deliberately deferred — see `docs/modules/smart-lookup.md`.
**AR:** لا يدعم المطابقة التقريبية أو النطاقات أو الرموز البديلة أو البحث من الآخر أو الحساسية لحالة الأحرف أو إرجاع الموضع أو `HLOOKUP` أو النطاقات المسمّاة، وورقة مرجعية واحدة فقط.

#### Code location / أين الكود؟
`components/SmartLookupTab.tsx` (UI, state, export) · `utils/lookupEngine.ts` (`readGrid`, `normalizeKey`, `buildLookup`, `formatCell`, `writeSheet`) · `services/excelService.ts` (`readExcelFile`, `saveWorkbook`, `writeWorkbookBuffer`).

#### Tests / أين الاختبارات؟
`tests/unit/lookupEngine.test.ts` (33) — the join, first-match order, error cells, formats, headerless data, 10k rows. `e2e/smart-lookup.spec.ts` (3) — **compares the downloaded file to the on-screen preview cell for cell**, so any future divergence fails regardless of values (the test TD-043 lacked); plus first-match and date-format checks.

---

### 2.2 Composite Check / فحص المنتجات المركبة

#### What it does / ماذا يفعل؟
**EN:** Validates a sheet of composite products against a raw-materials sheet: that every ingredient SKU exists, that quantities are numbers greater than zero, and optionally computes cost. Reports errors with a cell reference.
**AR:** يتحقق من ورقة المنتجات المركبة مقابل ورقة المواد الخام: وجود كل رمز مادة، وأن المقادير أرقام أكبر من صفر، ويحسب التكلفة اختيارياً. ويسجل الأخطاء مع مرجع الخلية.

#### Who uses it / من يستخدمها؟
**EN:** Anyone preparing a bill-of-materials import — catching typos and leftover lines before they reach inventory.
**AR:** من يجهّز استيراد قوائم المواد — لالتقاط الأخطاء والأسطر المتبقية قبل وصولها للمخزون.

#### Input / ماذا يدخل؟
**EN:** One `.xlsx` with **two sheets**, selected by name: a Composite sheet and a Raw sheet. Layout: N fixed columns (default 4) then repeating `(Ingredient SKU, Qty)` pairs. Columns must be selected explicitly — the tool refuses to run otherwise. Optional: Compact Columns, Strict Empty Check (default on), Fuzzy typo detection, Raw SKU/Cost mapping for costing.
**AR:** ملف `.xlsx` واحد بورقتين تُحدَّدان بالاسم. التنسيق: أعمدة ثابتة (4 افتراضياً) ثم أزواج متكررة (رمز المادة، المقدار). يجب اختيار الأعمدة صريحاً. اختياري: ضغط الأعمدة، الفحص الصارم للفراغات، كشف الأخطاء المطبعية، وربط الرمز والتكلفة لحساب الكلفة.

#### Output / ماذا يخرج؟
**EN:** One workbook with three sheets — **Validation Errors** (the row, `Error Description`, `وصف الخطأ (عربي)`, `Error Location` as a cell ref like `F3`), **Valid Products**, and **Summary** (date, shift statistics, shift log).
**AR:** مصنّف بثلاث أوراق: «أخطاء التحقق» (الصف، وصف الخطأ بالإنجليزية والعربية، وموقع الخلية مثل `F3`)، و«المنتجات الصحيحة»، و«الملخص».

#### Files it reads / ما الملفات التي يقرأها؟
The loaded `.xlsx`, two named sheets, via `getSheetData(workbook, sheet, raw)`.

#### Errors / ما الأخطاء التي تظهر؟
| Error (EN) | Arabic | Trigger |
|---|---|---|
| `Please select both Composite and Raw sheets.` | *(English only in code)* | Run without both sheets chosen |
| `Select columns to validate.` | *(English only in code)* | No columns selected — the run silently does nothing else |
| `Please map Raw SKU and Cost columns.` | *(English only in code)* | Costing requested without mapping |
| Row error: `Zero Qty '0'` | `مقدار الاستخدام من المادة يساوي صفر '0'` | A quantity equal to zero |
| Row error: `Negative Qty '-3'` | `مقدار الاستخدام من المادة بالسالب '-3'` | A quantity below zero |
| Row error: `Non-numeric Qty 'abc'` | `الكمية غير صحيحة (يجب أن تكون رقماً) 'abc'` | Text, hex, `Infinity`, `NaN` |
| Row error: `Missing Qty for Ingredient 'X'` | `الكمية مفقودة للمكون 'X'` | SKU present, quantity blank — **only when Strict Empty Check is on** |
| Row error: `Missing SKU for Qty 'N'` | `رمز المكون مفقود للكمية 'N'` | Quantity present, SKU blank |
| Row error: `Possible Typo: 'A' … 'B'` | `خطأ إملائي محتمل` | Fuzzy match near-miss |

#### Error handling / ماذا يحدث عند الخطأ؟
**EN:** Row-level problems do not stop the run — they are collected and written to the Validation Errors sheet with a cell reference, while clean rows go to Valid Products. Configuration problems are warnings that block the run until fixed.
**AR:** أخطاء الصفوف لا توقف العملية — تُجمع وتُكتب في ورقة الأخطاء مع مرجع الخلية، وتنتقل الصفوف السليمة إلى ورقة المنتجات الصحيحة. أما أخطاء الإعداد فتمنع التشغيل حتى تُصحَّح.

#### Edge cases / ما الحالات الخاصة؟
**`0` and `0.0` →** both flagged (numeric comparison, not string). **`-0` →** reported as zero, not negative. **Hex `0x10` →** non-numeric, not 16. **`Infinity`/`NaN` →** non-numeric. **`1e-3` →** valid (0.001). **Blank quantity with Strict Empty Check OFF →** reported by nothing (documented gap). **Scientific notation in SKUs →** handled by the shared `cellText` override.

#### Unsupported features / ما الذي لا يدعمه؟
No CSV input (`accept=".xlsx"`), no cross-file validation, no automatic fixing of quantities, no per-row undo.

#### Code location / أين الكود؟
`components/CompositeTab.tsx` (validation pass, `translateErrorToArabic`) · `utils/quantityRule.ts` (`classifyQuantity`).

#### Tests / أين الاختبارات؟
`tests/unit/quantityRule.test.ts` (21) — 0, `0.0`, `-0`, negatives, scientific notation, hex/octal/binary, `NaN`/`Infinity`, blanks, arrays, and a 100k-character ReDoS guard. `e2e/composite-quantity-rules.spec.ts` — drives the real UI and asserts message, **language**, and cell reference in the downloaded workbook.

---

### 2.3 AI Translator / المترجم الذكي

#### What it does / ماذا يفعل؟
**EN:** Translates selected columns between Arabic and English in batches via Gemini, preserving structure, with a glossary of terms to leave untranslated.
**AR:** يترجم الأعمدة المختارة بين العربية والإنجليزية على دفعات عبر Gemini، مع الحفاظ على البنية وقائمة مصطلحات تُترك بلا ترجمة.

#### Who uses it / من يستخدمها؟
**EN:** Catalogue owners producing bilingual product data without translating cell by cell.
**AR:** أصحاب الكتالوجات لإنتاج بيانات منتجات ثنائية اللغة دون ترجمة خلية بخلية.

#### Input / ماذا يدخل؟
**EN:** The loaded workbook; ≥1 column selected. Options: direction (auto / AR→EN / EN→AR), mode (merge / separate / consolidate), domain, comma-separated glossary, batch size. Requires a Gemini API key.
**AR:** المصنّف المحمّل وعمود واحد على الأقل. الخيارات: الاتجاه، والنمط، والمجال، وقائمة المصطلحات، وحجم الدفعة. ويلزم مفتاح Gemini.

#### Output / ماذا يخرج؟
**EN:** `Translated_<name>.xlsx`, or **`PARTIAL_Translated_<name>.xlsx`** when anything is missing. Sheets: *Original File*, *Translated File*, *Translation Summary*. The summary carries a per-row `Status` of `Translated` / `Already bilingual` / `NOT TRANSLATED`, and — when the run degraded to a weaker model — a notice at the top.
**AR:** ملف `Translated_<الاسم>.xlsx` أو `PARTIAL_...` عند وجود نقص، بثلاث أوراق: الأصل، المترجم، وملخص الترجمة الذي يحتوي حالة كل صف وتنبيهاً عند تغيّر الموديل.

#### Files it reads / ما الملفات التي يقرأها؟
The loaded workbook only (no uploader of its own).

#### Errors / ما الأخطاء التي تظهر؟
| Error (EN) | Arabic | Trigger |
|---|---|---|
| `Please select columns.` | *(English only in code)* | Run with no column selected |
| `No Internet Connection.` | *(English only in code)* | `navigator.onLine` is false |
| `Batch returned N results for M items — cannot tell which is which, so the whole batch was discarded…` | *(English only)* | Length mismatch between request and reply |
| `Batch reply was not a list of translations at all — …` | *(English only)* | Reply was not an array |
| `N item(s) in this batch came back empty — left untranslated.` | *(English only)* | Blank results inside an accepted batch |
| `Batch failed, stopping here: <message>` | *(English only)* | A batch threw (quota, network) |
| `Model "<a>" is unavailable; continuing on "<b>". Output quality may differ.` | *(English only)* | Model retired mid-run |

#### Error handling / ماذا يحدث عند الخطأ؟
**EN:** A failing batch **breaks the loop but keeps every completed batch** — the export still happens, prefixed `PARTIAL_`, with the reason in the Summary sheet and the status set to ERROR. A length mismatch discards that whole batch rather than risk filing translations against the wrong rows. Rate limits rotate to the next key if several are configured, otherwise sleep and retry.
**AR:** فشل دفعة يوقف الحلقة لكن يحفظ كل ما تمّ — ويُصدَّر الملف بادئته `PARTIAL_` مع ذكر السبب. وعدم تطابق الأعداد يُلغي الدفعة كاملة تجنباً لإسناد ترجمات لصفوف خاطئة. وحدود المعدل تُدوّر المفاتيح إن وُجدت.

#### Edge cases / ما الحالات الخاصة؟
**Already-bilingual rows →** skipped, counted separately, never sent. **Duplicate source strings →** deduplicated before sending. **Numeric replies →** a finite number counts as a translation (`500`). **`null`/objects/`NaN` →** treated as blank. **Empty batch reply →** counted as missing, not success. **Model fallback →** recorded in the workbook.

#### Unsupported features / ما الذي لا يدعمه؟
No resume of a partial run, no per-cell retry, no offline translation, no language other than AR↔EN.

#### Code location / أين الكود؟
`components/TranslateTab.tsx` · `utils/translationBatch.ts` (`alignBatchResults`) · `services/geminiService.ts` (`translateBatch`, `'quality'` tier).

#### Tests / أين الاختبارات؟
`tests/unit/translationBatch.test.ts` (15) — the alignment guard that prevents silent row-shifting, numeric results, blanks, non-arrays. `tests/unit/geminiModels.test.ts` (41) — model fallback, per-key retirement, `onNotice` delivery.

---

### 2.4 Files Validation / التحقق من الملفات

#### What it does / ماذا يفعل؟
**EN:** Checks a product file against Rewaa import rules — symbols, SKU, barcode, prices — auto-fixing what it safely can and listing the rest.
**AR:** يفحص ملف منتجات مقابل قواعد استيراد رواء — الرموز والأكواد والباركود والأسعار — ويصلح ما يمكن إصلاحه بأمان ويسرد الباقي.

#### Input / ماذا يدخل؟ · Output / ماذا يخرج؟
**EN:** `.xlsx .xls .csv` (own uploader). Columns are mapped to standard fields (SKU, Barcode, …). Output `Validated_<name>.xlsx` with styled highlighting of problem cells.
**AR:** يقبل `.xlsx .xls .csv`، وتُربط الأعمدة بالحقول القياسية. ويُخرج `Validated_<الاسم>.xlsx` مع تمييز الخلايا المشكلة.

#### Errors / ما الأخطاء التي تظهر؟
| Error (EN) | Arabic | Trigger |
|---|---|---|
| `Sheet <name> is empty.` | *(English only)* | Selected sheet has no rows |
| `Error: <message>` | `خطأ: <رسالة>` (via `t.common.error`) | Validation threw |
| `Export Error: <message>` | *(English only)* | Writing the workbook failed |

#### Error handling · Edge cases · Unsupported
**EN:** Row problems are highlighted rather than fatal; the preview caps at 100 rows. Scientific-notation barcodes are protected by the shared `cellText` override (TD-038). No cross-file validation, and the rule set is not user-editable.
**AR:** المشاكل تُميَّز ولا تُوقف العملية، والمعاينة محدودة بـ 100 صف. الباركود بالصيغة العلمية محمي عبر الأداة المشتركة. لا تحقق بين ملفات، ولا يمكن للمستخدم تعديل القواعد.

#### Code location / أين الكود؟ · Tests / أين الاختبارات؟
`components/FileValidationTab.tsx` (1,057 lines). **No dedicated tests** — the shared cell-value behaviour it relies on is covered by `tests/unit/excelServiceCellValues.test.ts` and `tests/unit/cellText.test.ts`, but no test exercises this module's own rules. See §8.

---

### 2.5 Compare Files / مقارنة الملفات

#### What it does / ماذا يفعل؟
**EN:** Compares two sheets on mapped key columns and reports matches and differences, with an optional AI written analysis.
**AR:** يقارن ورقتين عبر أعمدة مفاتيح مُحدَّدة ويسرد المتطابق والمختلف، مع تحليل نصي اختياري بالذكاء الاصطناعي.

#### Input · Output
**EN:** `.xlsx .xls .csv`, two sheets, mapped columns. Output `Comparison_<name>.xlsx`. The AI analysis is text shown in the UI. Diff preview caps at 100 rows.
**AR:** يقبل `.xlsx .xls .csv` بورقتين وأعمدة مُربوطة، ويخرج `Comparison_<الاسم>.xlsx`، ويظهر التحليل نصاً في الواجهة. المعاينة محدودة بـ 100 اختلاف.

#### Errors · Error handling
| Error (EN) | Trigger |
|---|---|
| `Model "<a>" is unavailable; continuing on "<b>". Output quality may differ.` | AI model retired during analysis |
| `<message>` from the AI service | Key/quota/network failure — the comparison itself still stands |

**EN:** The spreadsheet comparison is local and always completes; only the optional AI narrative can fail, and it fails without losing the diff.
**AR:** المقارنة نفسها محلية وتكتمل دائماً؛ التحليل الذكي وحده قد يفشل دون فقدان نتيجة المقارنة.

#### Unsupported · Code · Tests
No three-way compare, no cell-level colour diff export. `components/CompareTool.tsx`, `utils/compareUtils.ts`. Tests: `tests/unit/compareUtils.test.ts`; e2e opens this tool in 6 places (`TOOL.compareFiles`).

---

### 2.6 Merge Datasets / دمج البيانات

**EN:** Appends two sheets or joins them on a key, producing `Merged_Output.xlsx`. **AR:** يُلحق ورقتين أو يدمجهما عبر مفتاح، ويُخرج `Merged_Output.xlsx`.

- **Input / المدخل:** `.xlsx .xls .csv`, two sheets, join algorithm selected. **Output:** `Merged_Output.xlsx`, plus a separate `Schema_Mismatch_Report.xlsx` when the two sheets' columns do not line up.
- **Errors:** configuration warnings plus `<message>` on throw; the join itself is local so there are no API failures.
- **Edge cases:** duplicate keys and blank cells behave per `utils/mergeUtils.ts`; verify there before relying on either.
- **Unsupported:** no fuzzy join, no multi-key UI beyond what the mapping offers.
- **Code:** `components/MergeTool.tsx`, `utils/mergeUtils.ts`. **Tests:** `tests/unit/mergeUtils.test.ts`; e2e opens it 3×.

---

### 2.7 Remove Blanks / إزالة الفراغات

**EN:** Drops empty columns from one or more files, starting at a chosen row. **AR:** يحذف الأعمدة الفارغة من ملف أو أكثر بدءاً من صف محدد.

- **Input:** `.xlsx .xls .csv`, **multiple files at once**, plus a start row. **Output:** `Cleaned_<base>_<sheet>.xlsx`, or `Cleaned_Archive_N_Files.zip` for several — written by `exportToExcelSingleSheet` in `utils/excelUtils.ts`.
- **Errors:** `Failed to parse file: <message>` (unreadable file, per file), `No files to clean.` (run with none added). Both English-only in code.
- **Error handling:** a file that fails to parse is reported and skipped; the others still process.
- **Code:** `components/CleanTool.tsx`. **Tests:** no unit test; **the most-exercised tool in e2e** — 15 references via `TOOL.removeBlanks`, which makes it the de-facto smoke path for upload → process → download.

---

### 2.8 Separator / التقسيم

**EN:** Splits a sheet into row-count chunks, or extracts every sheet into its own file. **AR:** يقسّم ورقة إلى أجزاء بعدد صفوف، أو يستخرج كل ورقة في ملف منفصل.

- **Input:** loaded workbook; target sheet and max rows, or "split by sheet". **Output:** single XLSX or a ZIP.
- **Errors:** `No data rows found to split.`, `Error exporting split sheets: <message>` — English-only.
- **Edge cases:** a sheet with only a header row yields the "no data rows" warning rather than an empty file.
- **Code:** `components/SplitterTool.tsx`. **Tests:** no unit test; 9 e2e references (`TOOL.separator`).

---

### 2.9 Deduplicator (Pro) / مزيل التكرار

**EN:** Removes duplicate rows by hashing the selected columns. Distinct from the deleted "Check Duplicates" tool. **AR:** يزيل الصفوف المكررة عبر تجزئة الأعمدة المختارة. وهو مختلف عن أداة «فحص التكرار» المحذوفة.

- **Input:** loaded workbook, ≥1 column. **Output:** `Scrubbed_<name>.xlsx`, single sheet `Scrubbed_Data`.
- **Errors:** `Not enough data rows.`, `Deduplication error: <message>` — English-only.
- **Unsupported:** no fuzzy/near-duplicate detection, no highlight-only mode, no auto-rename of duplicates.
- **Code:** `components/DeduplicateTool.tsx` (210 lines). **Tests:** 1 e2e reference — reachability only, no behavioural coverage.

---

### 2.10 Table Unpivot / تحويل الجدول

**EN:** Turns wide attribute columns into tall rows — fixed columns repeat, value columns rotate down. **AR:** يحوّل الأعمدة العريضة إلى صفوف — تتكرر الأعمدة الثابتة وتنزل أعمدة القيم.

- **Input:** loaded workbook; ≥1 fixed column **and** ≥1 transform column. **Output:** `Vertical_<name>.xlsx`.
- **Errors:** `Please select at least one fixed column and one transform column.`, `<message>` on throw — English-only.
- **Code:** `components/UnpivotTab.tsx` (339 lines). **Tests:** none.

---

### 2.11 Packs Manager / إدارة العبوات

**EN:** Flattens several rows sharing a key into one row with numbered pack columns. **AR:** يدمج عدة صفوف تشترك في مفتاح واحد في صف واحد بأعمدة عبوات مرقّمة.

- **Input:** loaded workbook; a grouping key column — **auto-detected** where possible, with a log line naming the guess so it can be overridden.
- **Output:** `Packs_Processed_<name>.xlsx`; groups with problems are moved to an `Errors` sheet.
- **Errors / notable logs:** `Please select a Key Column (e.g., SKU or Barcode).`; `Fixed N scientific notation issues.`; `Found N pack groups with errors (moved to 'Errors' sheet).` — English-only.
- **Edge cases:** scientific-notation keys are repaired and counted; problem groups are quarantined rather than dropped.
- **Code:** `components/PacksTab.tsx` (743 lines). **Tests:** none.

---

### 2.12 Product Variants / متغيرات المنتج

**EN:** Ensures every option combination exists (every Colour × every Size), generating the missing rows. **AR:** يضمن وجود كل تركيبات الخيارات (كل لون × كل مقاس) وينشئ الصفوف الناقصة.

- **Input:** loaded workbook; a grouping column (Product ID/SKU) and ≥1 option column.
- **Output:** XLSX with generated rows, styled via `xlsx-js-style`.
- **Errors:** `Please select a grouping column (Product ID/SKU).`, `Please select at least one option column (e.g. Size).`, `Skipped group <key>: <message>` — English-only.
- **Error handling:** a group that throws is **skipped with its key named**, and the rest still process.
- **Code:** `components/VariableBalanceTab.tsx` (1,383 lines — the largest module). A `VariableBalanceTabV2` exists and is **not reachable** (drift D6). **Tests:** none.

---

### 2.13 Salla Organizer / منظّم سلة

**EN:** Splits a Salla export into Simple and Variable products and can map columns to a template. **AR:** يفصل ملف سلة إلى منتجات بسيطة ومتغيرة ويمكنه ربط الأعمدة بقالب.

- **Input:** `.xlsx` only. Needs the Type column (`النوع`) — auto-detected, else asked for explicitly.
- **Output:** `Salla_Analyzed<suffix>_<name>.xlsx`, or `Mapped_<source>_<name>.xlsx`; includes `Summary Report` / `Batch Info` sheets.
- **Errors:** `Please select the 'Type' column (النوع) manually below.`, `No data found for selected source: <x>`, `Error loading template: <message>` — English-only (with an Arabic column name inside the English string).
- **Code:** `components/SallaTab.tsx` (782 lines). **Tests:** none.

---

### 2.14 Zid Organizer / منظّم زد

**EN:** Organises Zid products: identifies "Has Variant", fills parent names down for variable products, separates Simple/Variable, removes empty columns. **AR:** ينظّم منتجات زد: يحدد «له متغير»، ويكمل أسماء الأصل للمنتجات المتغيرة، ويفصل البسيط عن المتغير، ويحذف الأعمدة الفارغة.

- **Input:** `.xlsx` only; requires Has Variant / Name columns mapped.
- **Output:** `Zid_Organized_<name>.xlsx` or `Zid_Mapped_<source>_<name>.xlsx`.
- **Errors:** `Please select required columns (Has Variant / Name) in the mapping section.`, `No data found for selected source: <x>`, `Error loading template: <message>` — English-only.
- **Code:** `components/ZidTab.tsx` (840 lines). **Tests:** none.
---

### 2.15 OCR Extraction / استخراج OCR

#### What it does / ماذا يفعل؟
**EN:** Sends images or PDFs (or pasted text) to Gemini and returns a structured table — invoices, menus, receipts — optionally shaped by an uploaded Excel template.
**AR:** يرسل الصور أو ملفات PDF (أو نصاً ملصوقاً) إلى Gemini ويعيد جدولاً منظماً — فواتير أو قوائم أو إيصالات — ويمكن تحديد شكله بقالب Excel.

#### Input / ماذا يدخل؟
**EN:** `accept="image/*,.pdf"` for media, `accept=".xlsx"` for the optional schema template. Two paths: **image/PDF** → `extractFromMedia` (`quality` tier, Pro-first); **pasted text** → `extractStructuredData` (`fast` tier, Flash-first). Requires a Gemini key.
**AR:** يقبل الصور وPDF، وقالب `.xlsx` اختياري. مسارَان: الوسائط عبر `extractFromMedia` (فئة الجودة)، والنص عبر `extractStructuredData` (الفئة السريعة). ويلزم مفتاح Gemini.

#### Output / ماذا يخرج؟
XLSX of the extracted rows. Progress is reported per file, and per extracted item name as the stream arrives.

#### Errors / ما الأخطاء التي تظهر؟
| Error (EN) | Arabic | Trigger |
|---|---|---|
| `Error processing <filename>: <message>` | *(English only)* | Per-file failure — API, quota, unreadable media |
| `Error processing text: <message>` | *(English only)* | Text-path failure |
| `Template Error: <message>` | *(English only)* | The `.xlsx` template could not be read |
| `No data extracted.` | *(English only)* | The model returned nothing usable |
| `Model "<a>" is unavailable; continuing on "<b>". Output quality may differ.` | *(English only)* | Model retired mid-run — logged as a **warning**, not as green progress |

#### Error handling / ماذا يحدث عند الخطأ؟
**EN:** Failures are **per file**: one bad image is reported by name and the batch continues. A model retirement walks down the candidate list and says so.
**AR:** الأخطاء لكل ملف على حدة: يُذكر اسم الملف الفاشل وتستمر الدفعة. وتغيّر الموديل يُسجَّل تنبيهاً.

#### Edge cases / ما الحالات الخاصة؟
Streamed replies are parsed incrementally, so partial JSON is normal mid-run. Arabic text round-trips. Large images consume request quota faster — the image path asks for Pro, which has the tighter free-tier limits.

#### Unsupported / ما الذي لا يدعمه؟
No local/offline OCR (no Tesseract), no bounding boxes or coordinates, no page-range selection for PDFs, no handwriting guarantee.

#### Code / أين الكود؟ · Tests / أين الاختبارات؟
`components/OcrTab.tsx` (880 lines) · `services/geminiService.ts` (`extractFromMedia`, `extractStructuredData`). **No module test.** The AI plumbing it depends on is covered by `tests/unit/geminiModels.test.ts` — including that `extractFromMedia` reports a fallback through `onNotice` and *not* through the progress channel.

---

### 2.16 Web Scraper / كاشط الويب

**EN:** Fetches a URL, cleans the page text, and asks Gemini to extract structured data described by a prompt or selected fields. **AR:** يجلب صفحة ويب وينظّف نصها ويطلب من Gemini استخراج بيانات منظمة وفق وصف أو حقول مختارة.

- **Input / المدخل:** a URL and a description. **Page text is truncated at 500,000 characters** (`WebScraperTab.tsx:167`). Uses the `quality` tier. Requires a Gemini key.
- **Output:** XLSX of extracted rows.
- **Errors:** `Please enter a valid URL.` · `Please describe what data to extract or select fields.` · `<model fallback notice>` · `خطأ: <message>` via `t.common.error` — the first three English-only.
- **Error handling:** a scrape that finds nothing raises a specific message naming the likely cause: a JS-rendered SPA or an anti-scraping block, and suggests OCR instead.
- **Edge cases:** SPAs that render client-side yield no data — a documented, expected failure, not a bug. Pages over 500k characters are silently truncated.
- **Unsupported:** no JS execution/headless rendering, no pagination, no authentication, no proxy/CORS workaround.
- **Code:** `components/WebScraperTab.tsx` (378 lines). **Tests:** none for the module; AI layer covered by `geminiModels.test.ts`.

---

### 2.17 PDF Tools / أدوات PDF

**EN:** Merges several PDFs in a chosen order, or splits one by page range or page count. **AR:** يدمج عدة ملفات PDF بترتيب مختار، أو يقسّم ملفاً بنطاق صفحات أو بعددها.

- **Input:** `accept="application/pdf"`, multiple files for merge. **Output:** a PDF, or a ZIP for a multi-way split.
- **Library:** `pdf-lib` — chosen because it manipulates PDFs entirely in the browser, so documents never leave the machine.
- **Errors:** 3 error/warning paths — encrypted or corrupt PDFs surface the library's message.
- **Unsupported:** no OCR, no password removal, no compression, no page rotation.
- **Code:** `components/PdfToolsTab.tsx` (437 lines). **Tests:** none.

---

### 2.18 Images to PDF / الصور إلى PDF

**EN:** Combines images into one PDF with a page size and margin. **AR:** يجمع الصور في ملف PDF واحد بحجم صفحة وهوامش.

- **Input:** `accept="image/png, image/jpeg, image/webp"` — note **no GIF, no SVG, no TIFF/HEIC**. **Output:** one PDF.
- **Errors:** 4 paths, including unsupported/undecodable images.
- **Code:** `components/ImageToPdfTab.tsx` (379 lines), `pdf-lib`. **Tests:** none.

---

### 2.19 Merge Images / دمج الصور

**EN:** Stitches images into one long image, vertically or horizontally. **AR:** يدمج الصور في صورة واحدة طويلة، عمودياً أو أفقياً.

- **Input:** `accept="image/*"`. **Output:** a PNG, produced with the **Canvas API** — no library.
- **Edge cases:** very large combined dimensions can exceed browser canvas limits; the practical ceiling is the browser's, not the app's.
- **Code:** `components/MergeImagesTab.tsx` (395 lines). **Tests:** none.

---

### 2.20 Image Compressor / ضاغط الصور

**EN:** Compresses images locally with a quality preset (Balanced / Extreme / HQ). **AR:** يضغط الصور محلياً وفق إعداد جودة.

- **Input:** `accept="image/*"`. **Output:** compressed image, or a ZIP for several.
- **Privacy:** processing is entirely in-browser; no upload.
- **Code:** `components/ImageCompressorTab.tsx` (478 lines), `jszip`. **Tests:** none.

---

### 2.21 Project Summary / ملخص المشروع

**EN:** Builds a project/task report from typed fields and an optional spreadsheet, then exports a styled PDF or copies it. **AR:** يبني تقرير مشروع من حقول مُدخلة وجدول اختياري، ثم يصدّره PDF أو ينسخه.

- **Input:** `.xlsx .xls .csv` optional; form fields **persisted to `localStorage['projectSummaryFields']`** so work survives a reload.
- **Output:** PDF via `jspdf` + `jspdf-autotable`; also clipboard copy. (`html2canvas` appears in the bundle as a **transitive** dependency of `jspdf` — no component imports it.)
- **Errors:** export failures surface the library message.
- **Code:** `components/ProjectSummaryTab.tsx` (839 lines), `utils/projectSummarySchema.ts`. **Tests:** `tests/unit/projectSummarySchema.test.ts` — protects the field schema.

---

### 2.22 QR Generator / منشئ QR

**EN:** Generates one QR code from text, or many from a spreadsheet column. **AR:** ينشئ رمز QR واحداً من نص، أو عدة رموز من عمود في جدول.

- **Input:** text (single mode) or `accept=".csv, .xlsx, .xls"` with data in **Column A** (bulk mode). **Output:** PNG, or a ZIP in bulk.
- **Errors:** 3 paths — empty input, unreadable file, oversized payload.
- **Edge cases:** an 8,000-character payload is exercised by `e2e/error-handling.spec.ts`; the QR library imposes its own capacity limit.
- **Code:** `components/QrCodeTab.tsx` (455 lines), `qrcode`. **Tests:** **best-covered small module** — `happy-path` (end-to-end generate), `clipboard` (copy + rejection), `download` (asserts real PNG magic bytes), `error-handling` (empty and huge input).

---

### 2.23 Google Sheets Import / استيراد جوجل شيتس

**EN:** Imports a **public** Google Sheet by URL and turns it into the in-app workbook. **AR:** يستورد ورقة جوجل عامة عبر رابط ويحولها إلى مصنّف داخل التطبيق.

- **Input:** a Google Sheets URL. History kept in `localStorage['gsheet_history']`. **Output:** loaded workbook + `<sheet name>.xlsx`.
- **Errors:** `Invalid Google Sheet URL.` (no id extracted) · `Access Denied. Sheet must be Public (Anyone with link).` (HTML sign-in page detected instead of data) · `Empty file.` · `HTTP <status>` · `Failed to fetch Google Sheet. Check internet or privacy settings.` — all English-only, all raised in `services/excelService.ts`.
- **Error handling:** the fetch is retried across export endpoints; the last error's message is surfaced. A sign-in page is **detected by sniffing for `<!DOCTYPE`/`<html`/`Sign in`** in the response, which is why a private sheet gives a clear message instead of a parser crash.
- **Unsupported:** no OAuth, no private sheets, no write-back, no live sync.
- **Code:** `components/GoogleSheetsTab.tsx` (259 lines), `services/excelService.ts`. **Tests:** none directly; `e2e/offline.spec.ts` covers total network failure at the shell level.

---

### 2.24 Support Chat / Data Analyst — الدعم ومحلل البيانات

**EN:** An always-mounted floating widget with three tabs: Chat (contact form), Excel Knowledge (static tips), and **Data Analyst**, which reasons over the loaded file and returns an answer, a markdown table, and runnable Pandas code.
**AR:** أداة عائمة دائمة الظهور بثلاث ألسنة: محادثة، وموسوعة إكسل، و«محلل البيانات» الذي يحلل الملف المحمّل ويعيد إجابة وجدولاً وكود Pandas قابلاً للتشغيل.

- **Input:** typed question; the loaded sheet is converted to CSV and **truncated to 15,000 characters** (`SupportChat.tsx:404`). Last 6 messages are sent as history. Uses the **`fast` tier** — Flash-first, by explicit request (see ADR-0006).
- **Output:** chat text, an optional parsed markdown table, and a `python` code block.
- **Errors:** `Error: <message>` and `Model changed: <notice>` — both posted **into the transcript**, because this widget has no log panel.
- **Error handling:** both are flagged `isNotice`, which keeps them **out of the next prompt's history** — otherwise the model would be told it had said "Error: 429 quota exceeded" and would answer accordingly.
- **Edge cases:** only the first ~15k characters of a large sheet are visible to the model, so answers about later rows are unreliable **by design**.
- **Code:** `components/SupportChat.tsx`. **Tests:** `e2e/support-chat-fallback.spec.ts` (2) — the fallback notice reaches the user, and neither notices nor errors leak into the next prompt.

---

### 2.25 Home / الصفحة الرئيسية

**EN:** Dashboard: upload entry point, recent files (`localStorage['recent_files']`), and launch cards for four featured tools. **AR:** لوحة رئيسية: نقطة رفع الملفات، والملفات الأخيرة، وبطاقات تشغيل لأربع أدوات مميزة.

- **Code:** `components/HomeTab.tsx` (228 lines), `components/FileUploaderBase.tsx`. **Tests:** covered indirectly by `smoke` and `happy-path`.

---

## 3. Cross-module shared behaviour / السلوك المشترك

| Layer | Where | Used by | Notes |
|---|---|---|---|
| **File upload (shell)** | `components/FileUploaderBase.tsx` — `accept=".xlsx, .xls, .csv"` | Home + every tool that reads "the loaded workbook" | One file is loaded once and shared. Most tools have **no uploader of their own** |
| **Per-module upload** | each component's own `<input accept=…>` | Smart Lookup, Files Validation, Salla, Zid, Composite, OCR, PDF/image tools, QR, Compare, Merge, Remove Blanks | The `accept` values differ per module — see §4 |
| **Parsing** | `services/excelService.ts` → `readExcelFile`, `getSheetData` | all spreadsheet modules | `XLSX.read(..., { raw: true, cellNF: true })`. `cellNF` populates `z`, which is what keeps dates dates (TD-045) |
| **Cell-value correction** | `utils/cellText.ts` → `scientificNumberOverride` | text-mode reads across modules | Stops a 13-digit barcode arriving as `1.23457E+12` (TD-038) |
| **Export** | `saveWorkbook` (style-capable), `writeWorkbookBuffer` | all XLSX exports | `XLSX.write` from the plain lib **drops cell styles**; only these two preserve them |
| **Logging / notifications** | `addLog(msg, type)` → `LogsFooter` | every module | There is **no toast system**. The logs footer is **closed by default**, so a warning can be missed entirely |
| **Progress** | `components/ProgressBar.tsx` | most long-running modules | Loops are synchronous, so the bar cannot repaint mid-loop in several modules |
| **i18n** | `utils/translations.ts`, `TRANSLATIONS[language]`, `localStorage['app_lang']` | UI chrome everywhere | **Coverage is uneven:** tab titles and descriptions are localised, but **most `addLog` messages are hard-coded English**. Smart Lookup and Composite Check's error descriptions are the exceptions |
| **AI provider** | `services/aiServiceFactory.ts` → `GeminiService` | Translate, OCR, Web Scraper, Compare, Support Chat | **Gemini is the only implemented provider.** The Groq key field was a stub and is now removed (D5, `5c24fa2`) |
| **Model tiers** | `MODEL_CANDIDATES` in `services/geminiService.ts` | as above | `quality` = Pro-first, `fast` = Flash-first, each ending in the other family plus a `*-latest` alias so a retirement degrades instead of failing. See ADR-0006 |
| **API keys** | `services/apiKeyStorage.ts`, `localStorage['gemini_api_key']` | AI modules | Keys are user-supplied, stored in the browser, never committed. Several Gemini keys may be entered **one per line** to rotate on rate limits. `localStorage['groq_api_key']` is no longer read or written, and a one-shot `removeItem` in `App.tsx` clears the value left behind in browsers that once had one — see D5, closed 2026-09-21 |
| **Authentication** | none | — | ADR-0005 removed sign-in and Firebase. There is no auth, no backend, no per-user data |
| **Error boundary** | `components/ErrorBoundary.tsx`, mounted in `index.tsx` | whole app | A thrown render is a visible error, not a white screen |
| **Theme** | `THEMES` in `App.tsx`, `localStorage['app_theme']` | shell | Light / Midnight / Forest |
| **Voice control** | `hooks/useVoiceControl.ts` | shell | Web Speech API; commands: home, translator, salla, zid, reset, start, logs |

---

## 4. File-type support matrix / مصفوفة أنواع الملفات

Verified from each module's `accept` attribute and its parser. ✅ supported · 🟡 partial · ❌ unsupported

| Module | XLSX | XLS | CSV | PDF | DOCX | JSON | Images | Other |
|---|---|---|---|---|---|---|---|---|
| Smart Lookup | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | — |
| Composite Check | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | needs 2 sheets |
| AI Translator | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ | ❌ | via shell uploader |
| Files Validation | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | — |
| Compare Files | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | — |
| Merge Datasets | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | — |
| Remove Blanks | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | multi-file |
| Separator | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ | ❌ | ZIP out |
| Deduplicator (Pro) | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ | ❌ | via shell uploader |
| Table Unpivot | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ | ❌ | via shell uploader |
| Packs Manager | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ | ❌ | via shell uploader |
| Product Variants | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ | ❌ | via shell uploader |
| Salla Organizer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — |
| Zid Organizer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — |
| OCR Extraction | ✅ (template) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | `image/*` |
| Web Scraper | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | URL only |
| PDF Tools | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ZIP out |
| Images to PDF | ❌ | ❌ | ❌ | ✅ out | ❌ | ❌ | 🟡 | PNG/JPEG/WebP only |
| Merge Images | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | PNG out |
| Image Compressor | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ZIP out |
| Project Summary | ✅ | ✅ | ✅ | ✅ out | ❌ | ❌ | ❌ | PDF out |
| QR Generator | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ out | PNG/ZIP out |
| Google Sheets Import | ✅ out | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Sheets URL |
| Support Chat | 🟡 | 🟡 | 🟡 | ❌ | ❌ | ❌ | ❌ | first 15k chars only |

**Nothing in the app reads DOCX or JSON.** 🟡 for XLS/CSV on shell-uploader modules means the shell accepts the extension and SheetJS parses it, but the module has no dedicated handling or test for it.

---

## 5. Error-message index / فهرس رسائل الخطأ

Exact strings from source. Arabic given where the code has it.

| Module | Error (EN) | Arabic | Trigger | User action |
|---|---|---|---|---|
| Shell / Google Sheets | `Invalid Google Sheet URL.` | — | No sheet id in the URL | Paste the full `docs.google.com/spreadsheets/d/…` link |
| Google Sheets | `Access Denied. Sheet must be Public (Anyone with link).` | — | An HTML sign-in page came back instead of data | Set sharing to "Anyone with the link" |
| Google Sheets | `Empty file.` | — | Workbook has no sheets | Check the source sheet |
| Google Sheets | `Failed to fetch Google Sheet. Check internet or privacy settings.` | — | All export endpoints failed | Check connectivity / sharing |
| Smart Lookup | `Please select Lookup Column, Match Column, and at least one Return Column.` | `اختر عمود البحث وعمود المطابقة وعموداً واحداً على الأقل للإرجاع.` | Incomplete configuration | Complete the three selections |
| Smart Lookup | `Settings changed during the lookup — run it again.` | `تم تغيير الإعدادات أثناء البحث — أعد التشغيل.` | Config changed mid-run | Press Run again |
| Smart Lookup | `Lookup failed: <msg>` / `Download error: <msg>` | `فشل البحث` / `خطأ في التحميل` | Throw during run or export | Read the message; check sheet and columns |
| Composite | `Zero Qty '0'` | `مقدار الاستخدام من المادة يساوي صفر '0'` | Quantity = 0 | Fix or delete the ingredient line |
| Composite | `Negative Qty '-3'` | `مقدار الاستخدام من المادة بالسالب '-3'` | Quantity < 0 | Correct the sign |
| Composite | `Non-numeric Qty 'abc'` | `الكمية غير صحيحة (يجب أن تكون رقماً) 'abc'` | Text/hex/NaN/Infinity | Enter a plain number |
| Composite | `Missing Qty for Ingredient 'X'` | `الكمية مفقودة للمكون 'X'` | Blank quantity, Strict Empty Check on | Fill it in |
| Composite | `Missing SKU for Qty 'N'` | `رمز المكون مفقود للكمية 'N'` | Blank SKU | Fill in the SKU |
| Composite | `Please select both Composite and Raw sheets.` | — | Sheets not chosen | Choose both |
| Composite | `Select columns to validate.` | — | No columns ticked | Tick the columns |
| Translate | `Please select columns.` | — | No column selected | Select at least one |
| Translate | `No Internet Connection.` | — | Offline | Reconnect |
| Translate | `Batch returned N results for M items — cannot tell which is which…` | — | Model returned a different count | Re-run; the batch was discarded, not mis-filed |
| Translate | `Batch failed, stopping here: <msg>` | — | Quota/network/model error | Export is still produced as `PARTIAL_`; re-run to continue |
| Translate / OCR / Scraper / Compare | `Model "<a>" is unavailable; continuing on "<b>". Output quality may differ.` | — | Model id retired | None required; note the quality change |
| AI (all) | `No usable Gemini model for the "<tier>" tier — every candidate was rejected as unavailable (…). Set GEMINI_API_KEY and run "node scripts/list-gemini-models.mjs"…` | — | Every candidate id gone | Run the script and update `MODEL_CANDIDATES` |
| API key modal | badge `Key OK — app needs updating` | `المفتاح سليم — التطبيق يحتاج تحديثاً` | Key valid, no usable model | **Do not rotate the key** — update the model list |
| OCR | `Error processing <file>: <msg>` · `No data extracted.` · `Template Error: <msg>` | — | Per-file failure / empty result / bad template | Retry that file; check the template |
| Web Scraper | `Please enter a valid URL.` · `Please describe what data to extract or select fields.` | — | Missing URL or prompt | Provide both |
| Files Validation | `Sheet <name> is empty.` · `Export Error: <msg>` | — | Empty sheet / write failure | Pick another sheet |
| Remove Blanks | `Failed to parse file: <msg>` · `No files to clean.` | — | Unreadable file / none added | Re-export the file as `.xlsx`; add files |
| Separator | `No data rows found to split.` | — | Header-only sheet | Check the sheet |
| Deduplicator | `Not enough data rows.` | — | Fewer rows than needed | Check the sheet |
| Unpivot | `Please select at least one fixed column and one transform column.` | — | Incomplete selection | Select both kinds |
| Packs | `Please select a Key Column (e.g., SKU or Barcode).` | — | No key column | Select one |
| Product Variants | `Please select a grouping column (Product ID/SKU).` · `Skipped group <k>: <msg>` | — | No group column / a group threw | Select it; inspect the named group |
| Salla | `Please select the 'Type' column (النوع) manually below.` | — | Type column not auto-detected | Select it |
| Zid | `Please select required columns (Has Variant / Name) in the mapping section.` | — | Mapping incomplete | Map both |

**Localisation gap:** most rows above have no Arabic. Only Smart Lookup's messages, Composite's error *descriptions*, and `t.common.*` strings are translated.
---

## 6. Input/output examples / أمثلة المدخلات والمخرجات

### 6.1 Smart Lookup

**Input** — one workbook, two sheets:

```
Sheet "Source"            Sheet "Ref"
SKU     | Note            Key   | Value        | WhenAdded (date-formatted)
A-1     | dup key         A-1   | FIRST        | 2026-01-15
a-1     | case differs    A-1   | LAST         | 2026-01-16
  A-2   | padded          A-2   | padded-match | 2026-01-17
007     | leading zeros   7     | zero-stripped| 2026-01-18
A-9     | no match
```

**User selects** → Source sheet `Source`, lookup column `SKU`; reference sheet `Ref`, match column `Key`; return columns `Value` + `WhenAdded`; Smart Match **on**; first row is a header **on**.

**Module does** → builds an index keyed on the normalised `Key`, keeping the **first** row per key; appends the two return columns per source row, carrying each matched cell's number format.

**Output** — `SmartLookup_<name>.xlsx`, sheet `Lookup Results`:

```
SKU     | Note           | Value         | WhenAdded
A-1     | dup key        | FIRST         | 2026-01-15   ← first duplicate, not last
a-1     | case differs   | FIRST         | 2026-01-15   ← case-insensitive
  A-2   | padded         | padded-match  | 2026-01-17   ← whitespace ignored
007     | leading zeros  | zero-stripped | 2026-01-18   ← Smart Match
A-9     | no match       | Not Found     | Not Found
```

**Expected result:** `WhenAdded` shows a **date**, not `46037`; the preview shows exactly these values, cell for cell.

### 6.2 Composite Check

**Input** — `Composite` sheet (4 fixed columns, then SKU/Qty pairs) and a `Raw` sheet listing `RAW-100…RAW-500`:

```
Name   | SKU      | Cat  | Unit | Ing 1   | Qty 1 | Ing 2   | Qty 2
Burger | COMP-001 | Food | pc   | RAW-100 | 2     | RAW-200 | 1.5
Pizza  | COMP-002 | Food | pc   | RAW-100 | 0     | RAW-300 | 3
Wrap   | COMP-004 | Food | pc   | RAW-100 | -3    | RAW-200 | 2
```

**User selects** → Composite sheet, Raw sheet, all 8 columns; Strict Empty Check on.

**Output** — three sheets. `Validation Errors`:

```
… | Error Description  | وصف الخطأ (عربي)                          | Error Location
… | Zero Qty '0'       | مقدار الاستخدام من المادة يساوي صفر '0'     | F3
… | Negative Qty '-3'  | مقدار الاستخدام من المادة بالسالب '-3'      | F5
```

`Valid Products` contains only **Burger**. `Summary` carries the date and shift statistics.

### 6.3 AI Translator (partial run)

**Input** — 25 unique product names, 3 already bilingual. **User selects** → column `Name`, direction auto, batch size 20.

**Module does** → skips the 3 bilingual rows, sends 22 in two batches. Batch 2 fails on a quota error.

**Output** — `PARTIAL_Translated_<name>.xlsx`. The `Translation Summary` sheet leads with:

```
*** PARTIAL TRANSLATION — THIS FILE IS NOT COMPLETE ***
Translated 20 of 22 items that needed translation.
3 further item(s) were already bilingual and were never sent.
Stopped because: 429 quota exceeded
```

and every row is marked `Translated`, `Already bilingual`, or `NOT TRANSLATED`.

### 6.4 OCR Extraction

**Input** — 3 photographed invoices (`.jpg`) + an optional `.xlsx` template whose headers define the wanted fields.
**User selects** → the images, the template, then Run.
**Module does** → for each file, `extractFromMedia` on the `quality` tier, streaming; if the Pro id is retired it drops to the next candidate and logs a **warning**.
**Output** — one XLSX of all extracted rows; a file that fails is named in the log and the other two still complete.

---

## 7. Removed modules / الوحدات المحذوفة

Full record in [`removed-modules.md`](removed-modules.md). Summary:

| Module | Removed | Why | Replacement | Cleanup still outstanding |
|---|---|---|---|---|
| **Check Duplicates** | 2026-08-16 | No longer needed | **None.** `Deduplicator (Pro)` (tab 32) is a *different* tool that survives — similar name, separate implementation | None |
| **CSV to Excel** | 2026-08-16 | No longer needed | None. Every spreadsheet module already accepts `.csv` through the shared parser | None. Dependencies `papaparse` + `@types/papaparse` removed with it (single consumer) |
| **Magic Links** | 2026-08-16 | No longer needed | None | **Yes — TD-048.** The module stored an admin bearer JWT at `localStorage['rewaa_admin_token']`; a one-shot `removeItem` now runs at app start. That cleanup is a migration and should be deleted later. Revoking the token itself is an action on `admin.platform.rewaatech.com`, unverified |

**What was deliberately kept:** `services/excelService.ts`, `ProgressBar`, `FileUploaderBase`, and `xlsx` / `xlsx-js-style` / `jszip` — all had surviving consumers, verified rather than assumed.

**No compatibility routes were retained, and none were needed:** there is no router, no URL per tool and no public API, so nothing external could hold a reference.

---

## 8. Known cross-module risks / المخاطر المشتركة

| Risk | Detail | Affects | Ref |
|---|---|---|---|
| **E2E flakiness** | Roughly one test per full run failed, a different one each time. One proven cause fixed (a fixed `waitForTimeout` followed by a single non-retrying measurement). Two observations remain unexplained; the worker cap did **not** settle it. **18 other `waitForTimeout` calls remain** — each a bet that a fixed delay outlasts the work | whole suite | **TD-040** |
| **Model retirement** | Google retires preview model ids. On 2026-08-05 one retirement broke OCR, Compare, Support Chat, Translate and Web Scraper simultaneously. Mitigated by ordered candidate lists ending in `*-latest` aliases, per-key retirement memory, and user-visible fallback notices | all AI modules | ADR-0006 |
| **Model list can go stale** | `MODEL_CANDIDATES` was once **five-sixths fiction** — ids that never existed on the key, so both tiers silently resolved to the same Flash id while claiming Pro. Verify with `scripts/list-gemini-models.mjs`, never by inference | all AI modules | ADR-0006 |
| **Free-tier quota** | The `quality` tier is Pro-first, and Pro has the tighter free-tier limits. Large OCR/Translate batches hit 429s. Several keys can be entered **one per line** to rotate | Translate, OCR, Scraper, Compare | — |
| **Large-file memory** | Everything runs in the browser tab. Parsing keeps the workbook in memory; Smart Lookup additionally materialises one object per cell **and** retains the full result set. Loops are synchronous, so the tab freezes and there is no cancel | all spreadsheet modules | audit §31 in `smart-lookup.md` |
| **Shared parser behaviour** | `raw: true` means dates arrive as serial numbers and error cells as numeric codes. Any module that does not carry `z` will export `46037` instead of a date — Smart Lookup was fixed; **others are unaudited** | all spreadsheet modules | TD-045 |
| **Logs footer closed by default** | Every warning and error goes to `addLog`. There is no toast. A user who never opens the footer sees **nothing** | every module | — |
| **Dependency audit** | `npm audit` reports a moderate `dompurify` XSS advisory. The gate's dependency stage passes — it does not fail on moderate | build/gate | — |
| **Styles dropped on write** | Plain `XLSX.write` silently discards cell styles. Only `saveWorkbook` / `writeWorkbookBuffer` preserve them; this already produced an unstyled batch export | any styled export | — |
| **Transitive bundle weight** | `html2canvas` is a **201 KB** chunk and is **not a direct dependency** — nothing in `package.json`, no component imports it. It arrives through `jspdf` (Project Summary). `e2e/regression.spec.ts` already asserts it does not load on first paint, so the risk is bundle size on that one route, not startup | Project Summary | — |
| **Orphaned code** | `RewaaTab` (unreachable, fully translated) and `VariableBalanceTabV2` (imported, never rendered) | maintenance | D4, D6 |

---

## 9. How to investigate a bug in a module / كيف تفحص خطأً

1. **Identify the module.** Match the sidebar label to §1 to get the tab id and files. Beware the two similar names: *Deduplicator (Pro)* ≠ the deleted *Check Duplicates*.
2. **Get the input.** Ask for the actual file. Most bugs here are data-shaped: leading zeros, a date column, an error cell, a header that is not a header.
3. **Reproduce in the UI.** Load the file, use the same selections. **Open the logs footer first** — it is closed by default and is where every message goes.
4. **Check the browser console.** Uncaught throws surface there and in the ErrorBoundary; `addLog` messages do not.
5. **Locate the component.** `components/<Module>Tab.tsx` per §1.
6. **Trace the service.** Spreadsheet path → `services/excelService.ts` (`readExcelFile`, `getSheetData`, `saveWorkbook`). AI path → `services/aiServiceFactory.ts` → `services/geminiService.ts`. Shared logic → `utils/`.
7. **Check the tests.** §2 lists them per module. If the module is in the "no tests" list (§8 of the report below), there is no safety net — write the failing test first.
8. **Compare expected vs actual output.** Download the file and read it with SheetJS rather than eyeballing it in Excel — a date shown as `46037` and a date shown as a date are the same value with different `z`.
9. **Classify the layer:** UI (selection/state) · parser (`readExcelFile`, `raw`/`cellNF`) · transformation (the module or its `utils/` helper) · API (Gemini: key, quota, retired model) · export (`writeSheet`, styles, `z`).
10. **Run the smallest test first.** `npx vitest run tests/unit/<file>` (seconds), then the one spec `npx playwright test e2e/<file>.spec.ts`, and only then `npm run verify:local` (~15 min). **Kill any stray `vite preview` on port 4173 first** — it makes Playwright fail to start with 0 tests, which looks like a code failure and is not.

---

## 10. Documentation quality rules / قواعد جودة التوثيق

1. **Code is the source of truth.** Where this guide and the code disagree, the code is right and this guide is a bug. Fix the guide.
2. **Documentation must be updated when behaviour changes** — in the same commit. Every drift item in §0 exists because that did not happen.
3. **Every major module should have tests protecting documented behaviour.** A documented guarantee with no test is a hope. Smart Lookup had four defects and no tests; that was not a coincidence.
4. **Unsupported features must be stated explicitly.** A reader looking for wildcards in Smart Lookup needs to find "not implemented", not silence.
5. **Do not claim compatibility that has not been verified.** Never write "XLOOKUP-compatible", "Excel-compatible" or "supports CSV" unless the specific capability has been exercised. The title *"Smart Lookup (XLOOKUP+)"* claimed a parity the code never had, and shipped that way for months.
6. **Prefer a verifiable statement over a flattering one.** "Case-insensitive and whitespace-trimmed, unlike `VLOOKUP`" is useful; "smart matching" is not.
7. **Do not put counts in prose unless you will maintain them.** Drift items D1–D3 are all stale numbers.

---

## 11. Test-coverage backlog / قائمة أعمال تغطية الاختبارات

Recorded as a **prioritised backlog, not started** — by instruction. 10 of 25 modules have meaningful tests, 2 are marginal, **13 have none**.

Priority is `lines × data-correctness risk × silence` — how big it is, how wrong its output can be, and whether a defect would be *visible*. A module that produces a plausible-looking wrong spreadsheet ranks above one that visibly fails.

| Rank | Module | Lines | Why it ranks here | First test to write |
|---:|---|---:|---|---|
| 1 | **Files Validation** | 1,057 | Its entire purpose is judging data correctness, and a wrong verdict is invisible — a file passes and the bad rows reach an import. Also exports `Validated_*` echoing input rows | One fixture per rule: SKU, barcode, price, symbols. Assert the verdict **and** the highlighted cell |
| 2 | **Product Variants** | 1,383 | Largest module in the app. It **generates rows**, so a defect invents product data rather than dropping it. `Skipped group <k>` already admits per-group failure | A 2×3 option matrix with a known gap; assert exactly which rows are generated and that none are duplicated |
| 3 | **Packs Manager** | 743 | Flattens N rows into one — off-by-one in pack numbering is silent. Already repairs scientific notation, so it handles known-fragile data | A key with 3 members → assert pack column order; a malformed group → assert it lands in the `Errors` sheet |
| 4 | **Salla Organizer** | 782 | Output feeds a **live platform import**. Type-column auto-detection is heuristic | A mixed Simple/Variable export; assert the split and the `Summary Report` counts |
| 5 | **Zid Organizer** | 840 | Same, plus **fill-parent-name-down**, which corrupts silently if it fills the wrong rows | Variable products with blank parent names; assert the fill and the Simple/Variable separation |
| 6 | **Table Unpivot** | 339 | Small and purely deterministic — the cheapest real win. Wide→tall is exactly unit-testable | 2 fixed + 3 value columns → assert row count and attribute/value pairing |
| 7 | **Google Sheets Import** | 259 | Five distinct error paths, all string-matched on responses (`<!DOCTYPE`, `Sign in`). Fragile to Google changing a page | Mock the fetch: private-sheet HTML, empty workbook, HTTP 500. Assert each message |
| 8 | **OCR Extraction** | 880 | AI plumbing is covered by `geminiModels.test.ts`; the **module's** template handling and per-file error isolation are not | A mocked endpoint failing file 2 of 3; assert files 1 and 3 still land and file 2 is named |
| 9 | **Web Scraper** | 378 | 500k truncation and the "no data" path are both undocumented-by-test | A page over the limit; assert truncation. An SPA-like empty body; assert the specific guidance message |
| 10 | **PDF Tools** | 437 | `pdf-lib` behaviour on encrypted/corrupt input is unknown to us | A corrupt PDF and an encrypted PDF; assert a visible error, not a crash |
| 11 | **Images to PDF** | 379 | Narrow `accept` (no GIF/SVG/TIFF) is a claim with no test | Feed a GIF; assert it is rejected rather than silently skipped |
| 12 | **Image Compressor** | 478 | Output quality is subjective; correctness bar is "does not corrupt" | Round-trip a PNG and a JPEG; assert the output decodes and is smaller |
| 13 | **Merge Images** | 395 | Canvas dimension limits are a browser ceiling we do not test | Two large images; assert either a valid PNG or a clear error — not a blank canvas |
| — | *Deduplicator (Pro)* | 210 | **Marginal today**: 1 e2e reference proves only that the tab opens | Duplicate rows across selected columns; assert which row survives |
| — | *Home* | 228 | **Marginal today**: covered indirectly by `smoke` / `happy-path` | None needed beyond the shell suites |

**Already covered, for contrast:** Smart Lookup (33 unit + 3 e2e), Composite Check (21 unit + 1 e2e), AI Translator (15 + 41 shared), QR Generator (4 e2e suites), Compare Files, Merge Datasets, Project Summary, Remove Blanks, Separator, Support Chat.

**Cheapest first if the goal is coverage per hour:** #6 Table Unpivot, then #7 Google Sheets Import, then #3 Packs. **Highest risk first if the goal is safety:** #1, #2, #4/#5.

---

## 12. Related documents / مستندات ذات صلة

| Document | What it holds |
|---|---|
| [`smart-lookup.md`](smart-lookup.md) | Smart Lookup's verified capability matrix — 37 capabilities, the baseline for its next increment |
| [`removed-modules.md`](removed-modules.md) | The three deleted modules, what was kept, and the TD-048 token cleanup |
| [`open-decisions.md`](open-decisions.md) | **D4 (RewaaTab) and D5 (Groq key)** — evidence and options, deliberately not decided |
| [`exporter-date-format-audit.md`](exporter-date-format-audit.md) | The `raw: true` / date-serialisation risk across **all 20 exporting modules** — 8 high, 6 medium |
| [`../quality/tech-debt-register.md`](../quality/tech-debt-register.md) | TD-001 → TD-048 |
| [`../TESTING.md`](../TESTING.md) | Suite layout and ratchets |
