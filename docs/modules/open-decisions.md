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
