# ADR-0006 — Features ask for a tier, not a model id

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** Maintainer (Ahmdmousa7)

> In the context of an app whose every AI feature hardcoded a Google *preview* model id, facing an outage caused by Google retiring `gemini-3-pro-preview`, I decided to have features request a capability tier (`'fast'` / `'quality'`) that the service resolves against an ordered candidate list, accepting that a retirement can silently move a run onto a weaker model and that the tier is now a judgement call recorded here rather than inline at each call site.

## What changed

| Before | After |
|---|---|
| Each feature named a model: `model: "gemini-3-pro-preview"` | Each feature names a tier: `generateText(prompt, 'quality')` |
| A retirement broke every feature using that id, at the moment of the click | The service walks its tier's list; a retirement costs one wasted request |
| `SupportChat.tsx` called the SDK directly, with its own literal | Everything goes through `services/geminiService.ts` |
| Model ids in three files | One place: `MODEL_CANDIDATES` |

## Why

**A pinned preview id is a fact with an expiry date.** On 2026-08-05 Google retired `gemini-3-pro-preview` and OCR, Compare's AI Analysis, Support Chat, Translate and Web Scraper all returned a 404 as a raw JSON blob the instant a user clicked a button. Nothing was wrong with the app except a string.

**Retrying and key rotation both fail on this error, which is why it needs its own detector.** A retired model is gone for every key, so the existing "rotate and retry" path burned three minutes of backoff before failing. `isModelUnavailable()` separates it from a quota (429) and an auth failure, and the two detectors are tested to stay disjoint — a 429 routed down the model-swap path would swap models on every rate limit and never rotate keys.

**A list degrades; a constant fails.** `MODEL_CANDIDATES.quality` ends in Flash ids on purpose: on a 500-row translation, a slightly weaker translation of the remaining rows beats losing the run. That trade is only acceptable if it is *visible*, which is the subject of the next section.

## The tiers, and which feature asks for which

`'quality'` leads with Pro; `'fast'` leads with Flash. Both end in the other's ids, so a tier degrades rather than dies.

| Feature | Tier | Why |
|---|---|---|
| Translate | `quality` | Translation looks mechanical and is not — idiom, domain terms, the glossary carve-out |
| Web Scraper | `quality` | Structure extraction from arbitrary HTML |
| Compare — AI Analysis | `quality` | Reasoning over two datasets |
| OCR — image path (`extractFromMedia`) | `quality` | Reading a photographed invoice is the hardest input in the app |
| OCR — text path (`extractStructuredData`, default) | `fast` | Structure from text already transcribed; volume matters more |
| Support Chat / Data Analyst | `fast` | **By explicit request, 2026-08-12.** See below |

**Support Chat's tier is a deliberate downgrade and deserves the note.** It previously used Pro with the comment "Switched to PRO for better reasoning on data analysis tasks", and its prompt does ask the model to reason over a spreadsheet and emit a runnable Pandas script — the workload with the strongest case for Pro in the app. The maintainer asked for Gemini 3.1 Flash for this feature specifically, after asking which model each module used. It is recorded here because the local review flagged the change as an unexplained quality regression, correctly: "'fast' by request" is a claim a reviewer cannot verify from a diff. **To revert, change one argument** at `components/SupportChat.tsx` to `'quality'`.

## Consequences

- **A fallback is no longer silent.** `translateBatch` takes an `onNotice` callback; `TranslateTab` puts the message in the log and at the top of the exported workbook's Translation Summary sheet. A `console.warn` was the only record before, which is to say none — the file looked identical to one produced entirely on Pro. Verified in a browser against an endpoint that retires `gemini-3.1-pro`.
- **The other tier consumers still only warn to the console.** OCR, Compare and Web Scraper produce output the user reads immediately rather than a file that outlives the session, so the case is weaker — but it is a gap, not a decision, and a gap needs an id or it is just a sentence in a document nobody re-reads: **TD-041**.
- **The candidate lists are unverified against a real key.** They are ordered on judgement, and an id that does not exist is skipped at a cost of one request. `GEMINI_API_KEY=… node scripts/list-gemini-models.mjs` prints what a key can actually use; running it is the way to trim dead entries. Until then the lists are a guess that fails safe.
- **Retirements are not persisted.** A page reload re-checks. A retirement is permanent but a transient 404 is not, and a bad `localStorage` entry would outlive the problem with no way for a user to clear it.
- **Exhausting a tier reports "invalid key" in the API-key modal** — the wrong cause. TD-039.

## Alternatives considered

- **Keep pinning ids, update on breakage.** This is the status quo that produced the outage. The failure lands on the user, not on CI.
- **Ask the ListModels endpoint at runtime and pick the best available.** Authoritative, but it spends a request on every page load, needs its own failure handling, and "best" still needs a hardcoded preference order — so it buys accuracy the app cannot act on.
- **One tier.** Rejected: OCR at Pro prices for transcription, or translation at Flash quality. The split is the point.
