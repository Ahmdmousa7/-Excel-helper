# Open module decisions / قرارات معلّقة

Two findings from the 2026-08-16 module audit that are **code decisions, not documentation drift**. Both are recorded here with the evidence needed to decide. **Neither has been implemented**, by instruction.

---

## D4 — RewaaTab: obsolete, or unfinished? / هل هي وحدة ملغاة أم غير مكتملة؟

### The finding

`components/RewaaTab.tsx` exists and is **unreachable**. It is not imported by `App.tsx`, has no tab entry and no id in `menuGroups`. Meanwhile the translation layer describes it fully, in **both** locales:

| Artefact | Location |
|---|---|
| `tabs.rewaa: 'Rewaa Manager'` | `utils/translations.ts:130` (en), `:526` (ar) |
| `toolInfo.rewaa` — desc + instructions | `:65` (en), `:526` (ar) |
| `rewaa: { … rewaaField … }` block | `:299` (en), plus the Arabic block |

So the app ships strings for a tool no user can open.

### Evidence of intent

Searched all 141 commits:

```
git log -S "RewaaTab" -- App.tsx      → no commits
git log -S "t.tabs.rewaa"             → no commits
git log --diff-filter=A -- components/RewaaTab.tsx  → 9ceff04
```

- **`RewaaTab` has never appeared in `App.tsx`** in recorded history.
- **`t.tabs.rewaa` has never appeared in a tabs array.**
- The component was added in `9ceff04` "chore: replace with latest local version" — the **second-oldest commit**, which is the wholesale import of the pre-existing codebase.

**Conclusion available from evidence:** this is **not an intentionally removed module** — a removal would leave a deletion commit. It arrived with the initial import and was never wired.

**Honest limit:** `9ceff04` is a bulk import, so whether the component was reachable in whatever pre-git version it came from is **unknowable from this repository**. If it worked somewhere before, that history is not here.

### What it appears to do

Reads the loaded workbook (`getSheetData(..., false)` ×2), maps columns to Rewaa import fields by product type (Simple / Variable / Composite), and writes `Rewaa_<type>_Import.xlsx`. It has 6 error/warning paths and its own `platform.rewaatech.com/inventory/products/import-products/add?token=` URL builder.

### If it is obsolete — what removal involves

1. Delete `components/RewaaTab.tsx`.
2. Delete `tabs.rewaa`, `toolInfo.rewaa` and the `rewaa: {}` block from **both** locales.
3. Check `Rewaa_*_Import.xlsx` is referenced nowhere else.
4. Nothing else: no test, no nav id, no dependency is exclusive to it.

### If it is intended to remain — what is missing to make it reachable

1. A `lazy()` import in `App.tsx`.
2. A `tabs` entry with an unused id (**26, 27, 30–34 are taken**; the deleted modules freed **1, 11, 27**).
3. An id added to a `menuGroups` group — `t.menu.excelTools` is the natural home.
4. An `isExcelTool` entry if the file-upload chrome should show for it.
5. A decision on the token-bearing import URL, which is the same class of thing as the Magic Links token (TD-048).
6. Tests — it would be a 5th untested platform-mapping module.

### Recommendation

**Ask the product owner whether Rewaa import is still a workflow.** The evidence says it was never live here, so no user can be relying on it, which makes deletion the low-risk default. Do not wire it up merely because the strings exist.

---

## D5 — the Groq key field / حقل مفتاح Groq

> **RESOLVED 2026-08-17 — implemented as recommended.** The field, `verifyGroqKey`, the
> `groqKey`/`groqStatus`/`testingGroq` state, the misleading Sidebar term, the storage
> accessor and the translation labels are all gone (commit `5c24fa2`).
> `getStoredApiKeys()` is now `{ gemini: string }`.
>
> **CLOSED 2026-09-21.** The last open piece — the orphaned `localStorage['groq_api_key']`
> value stranded in the browsers of anyone who ever typed a key there, with no UI left
> to clear it — is now cleaned by a one-shot `removeItem` in `App.tsx`, next to and in
> the same shape as the Magic Links cleanup. The two dev scripts that still seeded the
> key (`measure-mobile-overflow.mjs`, `observe-origins.mjs`) were deleted in the same
> change, so **nothing in the tree reads or writes it any more.**
>
> Both `removeItem` lines are a migration, not an invariant: delete them once returning
> users have all loaded the app at least once. Tracked in TD-048's fix note.
>
> The description below is written in the present tense and is preserved as the record
> of *why* the removal happened. **Read it as history, not as current behaviour.**

### The finding

The API-key modal presents a **Groq** field with a label, a Test button, and a link to `console.groq.com/keys`. It does nothing.

```ts
// services/geminiService.ts:243
export const verifyGroqKey = async (key: string): Promise<boolean> => {
    // Placeholder as Groq implementation details are not the focus, assuming simple check
    return key.length > 10;
};
```

It never contacts Groq. **Any 11-character string passes**, and the modal then shows a green *valid* badge.

### Evidence of intent

```
git log -S "GroqService"  → no commits
```

**No Groq provider has ever existed** in 141 commits. `AiServiceFactory.getService()` returns `new GeminiService()` unconditionally, and **no AI code path reads `groq_api_key`**.

The only mention of Groq outside the key plumbing is a **comment** in `types/ai.types.ts:6` explaining why tiers are provider-agnostic: *"a Groq or OpenRouter implementation would receive a string it cannot honour"*. That is design rationale for the `AiTier` abstraction — not evidence of an integration.

### The surface, complete

| File | What it holds |
|---|---|
| `components/ApiKeyModal.tsx` | the field, Test button, badge, `console.groq.com` link |
| `components/Sidebar.tsx:183` | **`(keyCount > 0 \|\| groqKey)` lights the green "keys configured" dot** |
| `App.tsx` | `groqKey`, `groqStatus`, `testingGroq` state and `handleTestGroq` |
| `services/apiKeyStorage.ts` | reads/writes `localStorage['groq_api_key']` |
| `services/geminiService.ts:243` | the stub |
| `utils/translations.ts` | `getGroq` and related labels, both locales |
| `e2e/modal.spec.ts`, `e2e/pages/AppShell.ts` | clear the key in setup only |

### Why this is worse than cosmetic

`Sidebar.tsx:183` means **entering a Groq key alone turns on the green "configured" indicator** while every AI feature remains unusable for want of a Gemini key. A user can be told they are set up, be shown a valid badge, and still have nothing work. That is a misleading state produced by three separate affordances agreeing with each other.

### Recommendation

**Remove the dead field and its verification UI.** Specifically: the modal section, `verifyGroqKey`, the `groqKey`/`groqStatus`/`testingGroq` state, the `groqKey` term in the Sidebar indicator, the storage key, and the translation labels — keeping `getStoredApiKeys`' shape if anything else depends on it.

**Do not build a Groq integration to justify the UI.** The `AiTier` abstraction already makes adding a provider a contained change if it is ever wanted; the field is not what makes that possible, and its presence today only misinforms.

**Before removing, confirm one thing:** that no one is relying on the field as a place to *store* a key for manual use elsewhere. It is a plausible-if-unintended use, and `localStorage['groq_api_key']` would disappear with the field — the same orphaned-value question TD-048 raised.

---

## D6 — the AI Studio applet is not the product / تطبيق AI Studio ليس المنتج

**DECIDED 2026-09-28.** Recorded because it has already cost real work.

Five sessions of OCR / Rewaa-mapping development happened in a **Google AI Studio applet** — `rewaaParityService.ts`, `rewaaComparisonService.ts`, `pdfExtractionService.ts`, a 5-tab master export, parity columns, `.docx`/spreadsheet ingestion, version `1.2.1`. **None of it exists in this repository**, verified by file check: every one of those paths is absent and `package.json` is still `1.0.0`. The two codebases have never been synced, and `app/applet/` here holds three unrelated test scripts.

The live site at `ahmdmousa7.github.io/-Excel-helper` is built from **this repository**. So that work reaches no user.

### The decision

> **`D:\Rewaa agent tool\excel-helper` is the product repository. The AI Studio applet is not.**

And, equally binding:

> **Do not rebuild the Rewaa/OCR work from scratch if the applet source can be exported.** Port and adapt it, then reconcile with this repo's architecture and tests. An audit and a porting plan come first, and are reviewed before any production code changes.

### Why it is written down

The failure mode is not that someone chose the wrong repo — it is that nobody noticed two were diverging until five increments had landed in the one without users. Anyone told "the OCR export already works" should check **here** before believing it.

---

## D7 — three product rules for the Rewaa/OCR work / ثلاث قواعد

**DECIDED 2026-09-28**, before implementation, so they are not re-litigated mid-build.

### 1. Template row 2 is metadata, not data

The Rewaa Simple and Variable templates carry a second row of specifications — `Text | required`, `Text | required | unique in the file and in the system`, `list yes no Default yes`. It is **template/spec metadata**. Exclude it from ordinary exports; include it only when the export is *explicitly* a template or spec export. Emitting it into a normal product file would inject a junk row that an importer may well accept as a product.

### 2. Identifiers are exact text — `00123` ≠ `123`

**Leading zeros are significant and must be preserved.** SKU and barcode are identifiers, not numbers: compare them as text, never by converting to a number first.

**This reverses an earlier instruction.** A previous message asked for leading zeros to be *stripped* during duplicate detection, so `00123` would be flagged as a duplicate of `123`. That rule was rejected on review because it manufactures false duplicates — it merges two genuinely distinct SKUs and then "resolves" the conflict by renaming one of them, corrupting a catalogue while reporting success. **The stripping rule must not be implemented.**

### 3. Diacritics and invisible marks ARE stripped — and this is not the same rule

`6287013210006ِ` (a barcode carrying an Arabic kasra) **must** match `6287013210006`. Diacritics, zero-width characters and stray punctuation are invisible artefacts of copy-paste; they change the rendering, not the identifier. Leading zeros are part of the identifier. The two rules point in opposite directions on purpose:

| Input | Compared against | Match? | Why |
|---|---|:--:|---|
| `6287013210006ِ` | `6287013210006` | ✅ yes | the kasra is an invisible mark |
| `00123` | `123` | ❌ **no** | the zeros are part of the code |

Normalization strips marks. It does **not** touch digits. And in every case the **original cell value is preserved in the output** — normalization exists only for the comparison.

> **IMPLEMENTED 2026-09-28** in `utils/identifiers.ts` (`identifierKey`), used by Files Validation. Both halves of this rule are pinned by tests, and mutation-checked: making the key strip leading zeros fails the suite, and so does making it stop stripping marks. Visible punctuation is also left alone — SKUs use `-`, and the resolver appends `-1`, so stripping hyphens would manufacture collisions.

### 4. No unsolicited downloads

> **SUPERSEDED for OCR → Rewaa by D12 (2026-09-30).** The product owner reversed this rule for that one workflow: a clean OCR → Rewaa run downloads its workbook by itself, and the explicit buttons stay. Every other module still follows the rule below.

Do not auto-trigger a browser download when processing finishes. Browsers block unprompted downloads and the behaviour varies by security settings, so a "it just downloads" design fails silently for some users. Use an explicit user action:

```
Processing complete  →  [ Download Excel ]
```

---

## D8 — should Pack SKU columns count as duplicates at all? / هل تُحسب أكواد العبوات مكررة؟

**DECIDED 2026-09-28 — option B: Pack SKUs keep counting as duplicates.** The product owner answered "yes" to *should Pack SKUs count as duplicates?*. This was not the recommendation, and the consequence stands as described below: a Pack SKU equal to an earlier product SKU is treated as a duplicate and that pack cell is renamed. No code change.

*Original finding, kept for the record:*

Files Validation's auto-mapper maps any header *containing* "sku" to the SKU field, so `Pack1 SKU`, `Pack2 SKU` and `Pack3 SKU` take part in duplicate detection alongside the product SKU.

But the Rewaa Simple template's own spec row describes a Pack SKU as **`SKU from product in system or in the file`** — a **reference** to another product, not a new identifier. On that reading, a Pack SKU *equal* to some product's SKU is not a duplicate; it is the pack pointing at its unit, which is exactly what it is supposed to do.

### What happens today

- Before 2026-09-28: a duplicate-SKU fix wrote the new SKU into **every** SKU-mapped column of the row, overwriting its pack SKUs. **Fixed** — each fix now rewrites only the colliding cell, pinned by `e2e/files-validation.spec.ts`.
- **Still true:** if a Pack SKU equals an earlier product SKU, it is counted as a duplicate and **that pack cell is renamed** (`S-1` → `S-1-1`), breaking the reference.

### The decision

| Option | Effect |
|---|---|
| **A. Exclude Pack SKU columns from SKU duplicate detection** (recommended) | Pack references are left alone. A pack SKU is then only checked for being non-empty when a pack label exists, as today |
| B. Keep them in, as now | A pack referencing an existing product has its reference renamed |

Recommendation is **A**, but it changes what the validator reports, so it is not made unilaterally. The same heuristic the module already uses to avoid *generating* SKUs for pack columns (`headerName.includes('pack')`) would identify them.

---

## D9 — OCR Extraction already auto-downloads / الاستخراج يُنزّل الملف تلقائياً

> **SUPERSEDED 2026-09-30 by D12 for the OCR → Rewaa workflow.** Do not remove its automatic download again because of the text below. D9 still holds for invoice, receipt and custom-schema extractions, which keep the Export button and no automatic download.

**DECIDED 2026-09-28 — option A: the auto-download is removed.** The product owner agreed. Extraction now finishes and the workbook is produced only when the user clicks **Export**.

*Original finding, kept for the record:*

D7 decided *"Do not auto-trigger a browser download when processing finishes … use an explicit user action."* That rule was written about porting the AI Studio applet — but the **live** OCR tab already does it: when extraction completes, `handleProcess` calls `exportData(allResults)` unconditionally (`// Auto export logic`), and a workbook downloads with no click.

Why it matters: the download fires long after the click that started it — an extraction can take a minute — so browsers treat it as unsolicited, and depending on settings it is blocked, prompted, or silently dropped. A user can finish an extraction and have nothing arrive.

A manual **Export** button already exists in the results bar, so removing the automatic download strands nobody.

| Option | Effect |
|---|---|
| **A. Remove the auto-download** (recommended, per D7) | The file is produced only when the user clicks Export |
| B. Keep it | Existing behaviour; some browsers will block it |

Not changed unilaterally, because it removes behaviour users may rely on. `e2e/ocr-text-input.spec.ts` currently waits for the automatic download; under option A it would click Export instead.

---

## D10 — resolved barcodes are not scannable, and that is accepted / الباركود المعدَّل لا يُمسح ضوئياً

**DECIDED 2026-09-28 — keep as is.**

Files Validation resolves a duplicate barcode by appending `-1`, `-2` (and a barcode equal to an SKU the same way). The result — `6287013210006-1` — is no longer a valid EAN/GTIN and will not scan at a till, so it will not match the code printed on the product.

The product owner chose to keep this behaviour. It is not hidden: every rename is listed in the export's Change Log and in the `Fix_Resolved Duplicate Barcode` / `Fix_Resolved Barcode = SKU` sheets, which are the places to review a resolved barcode before import.

---

## D11 — `gemini-3-flash-preview` as the last image-OCR fallback / آخر نموذج احتياطي لاستخراج الصور

**Decided 2026-09-29 (product owner): add it, on the condition that it is verified on the actual key.**

**The problem (TD-052).** In the live OCR run of 2026-09-29, every Pro model in the `quality` list had no quota on the free-tier key (429, `limit: 0`), and `gemini-3.6-flash` and `gemini-flash-latest` were overloaded (503). The only model that answered was `gemini-3-flash-preview` — which was in the `fast` list, not the `quality` list image OCR uses. So image OCR could not succeed on that key.

**The evidence it is verified, not guessed.** The same run sent the real `ocr.jpg` image (streamed, image inline) to `gemini-3-flash-preview` on that key: **HTTP 200**, 76 items extracted. The id was also confirmed to exist by `scripts/list-gemini-models.mjs` on 2026-08-13. No other id was added.

**The change.** `gemini-3-flash-preview` is appended as the **last** entry of `MODEL_CANDIDATES.quality`. Nothing ahead of it moves, so it is only reached when every other quality candidate is retired, has no quota on the key, or is overloaded. The `quality` tier is shared (Translate, Web Scraper, Compare also use it), so it is their last resort too — the same trade the tier already makes by ending on Flash.

**If it is ever retired:** the existing fallback strikes it off on the first 404, per key, and the call fails with the readable "no model available" message. Re-verify with `scripts/list-gemini-models.mjs` before changing the list.

**AR:** أُضيف `gemini-3-flash-preview` كآخر خيار احتياطي لاستخراج الصور، بعد التحقق منه على المفتاح الفعلي (استجابة 200 لصورة حقيقية). لا يُستخدم إلا إذا تعذّرت كل النماذج الأخرى.

---

## D12 — OCR → Rewaa: the supplied correct file is the output contract / الملف الصحيح هو المرجع

**DECIDED 2026-09-30 (product owner).**

**Why.** The product owner ran OCR on a real menu (`tests/fixtures/ocr-rewaa/source.xlsx`) and got `wrong-output.xlsx`: three generic sheets, Arabic-first names, no Rewaa sheets. They supplied `correct-output.xlsx` as the exact expected output. Root cause: the OCR tab only produced Rewaa-shaped sheets when the user uploaded templates in the "Advanced" mapping panel. The six-sheet workbook of `ocr-rewaa-plan.md` §4-A was never built, because the plan was marked superseded on 2026-09-28.

**The rules** (implemented in `utils/ocrRewaaExport.ts`, and compared cell by cell with the contract in `tests/unit/ocrRewaaExport.test.ts`):

| # | Rule |
|---|---|
| 1 | **Scope.** The OCR → Rewaa workflow is the Free Form and Restaurant Menu templates with no custom schema. Invoice, Receipt and custom-schema extractions are unchanged. |
| 2 | The workbook has six sheets: `Generic All Data`, `Generic Simple`, `Generic Variable`, `Rewaa Simple Products`, `Rewaa Variable Products`, `Source Files & Audit`. It needs no template upload. |
| 3 | Bilingual text is written `English \| Arabic`. The prompt asks for this order, and `englishFirst` enforces it for exactly-two-part Arabic/Latin values. |
| 4 | Two Simple rows with the same name and category, no options and two different prices become `Size \| الحجم` variants, `Small \| صغير` (cheaper) and `Large \| كبير`. **Pairs only.** A group of three or more is left alone and reported in the log. |
| 5 | Rewaa prices are numbers. A missing price is `0` on the Rewaa sheets, blank on the Generic sheets, and the row is flagged `Rewaa Data Identical = FALSE`. This overrides the earlier "blank, never 0" rule for this workbook only. |
| 6 | Rewaa defaults follow the contract: Pack columns and Tax Code blank, DEF Quantity `0`. The uploaded-template path (`Mapped Simple` / `Mapped Variable`, `utils/templateMapping.ts`) keeps its own defaults. |
| 7 | <a id="d12-rule-7"></a>`Enable stock management` is always `no`. The brief for this change said "yes"; the product owner confirmed `no`, as on 2026-09-29. **This is an approved business transformation (reconfirmed 2026-09-30):** both Rewaa sheets deliberately write `no`, even where the model extracted `yes`, while the Generic sheets keep the model's original value. **The transformation is intentionally excluded from the `Rewaa Data Identical` / `Same in Rewaa Simple` / `Same in Rewaa Variable` comparison.** That comparison checks name, category, price, SKU, option names and values, and Variant Name. So a row whose stock value was forced to `no` is still reported as identical: the change is a rule, not data loss. `e2e/ocr-rewaa-export.spec.ts` asserts this behaviour. Do not add the column to the comparison without a new product decision. |
| 8 | **Automatic download (reverses D9 for this workflow).** A run downloads its workbook by itself only when every input extracted and the workbook was built. A failed OCR, zero rows, or a failed build downloads nothing. A partial failure is held: no automatic download, but the buttons work. There is one automatic download per run. A browser can block it without telling the page, so the result panel always keeps **Download Excel**. |
| 9 | **Download ZIP**: `<base>.xlsx` (the same workbook), `source/<each original file>` byte for byte (pasted text as `pasted-text.txt`), and `summary.json` (counts, per-file status, rows needing review, the rules above). The name is `OCR-Rewaa-<first source>[-and-N-more]-<YYYYMMDD-HHMMSS>.zip`. It is built only from the run's rows and file metadata, never from storage, so no key or token can reach it (the e2e suite checks this against the seeded key). |

**Approved deviations from the contract** (asked and answered 2026-09-30):

- Rewaa Variable `Option 1` carries the real option name, not the fixture's literal `Option 1`.
- The audit `File Size` is the real size (the fixture said `0.0 KB`).
- The audit `Verification Notes` report how many rows differ.

**Known limits.** Translations come from the model and vary between runs; only the order is enforced. Size inference sees only exact name and category matches. A blocked browser download cannot be detected.

**AR:** الملف `correct-output.xlsx` هو المرجع الملزم لمخرجات استخراج OCR إلى رواء: ست أوراق، والنص بترتيب «إنجليزي | عربي»، ويتحوّل المنتج المكرر بسعرين إلى مقاسَي صغير/كبير، والسعر المفقود يُكتب 0 في أوراق رواء مع وسم الصف بأنه غير مطابق، وإدارة المخزون دائماً `no`. يُنزَّل الملف تلقائياً بعد نجاح الاستخراج فقط (عكس D9 لهذا المسار)، ويتوفر زر «تنزيل ZIP» يضم الملف الأصلي وملف رواء وملخصاً.
