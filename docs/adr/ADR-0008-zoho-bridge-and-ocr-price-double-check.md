# ADR-0008 — The Zoho bridge, and a second reading that double-checks OCR prices

**Status:** Accepted
**Date:** 2026-11-17
**Deciders:** Maintainer (Ahmdmousa7)

> In the context of the Account Setup team turning a customer's menu PDF on a Zoho task into a Rewaa import file by hand, facing a copy-and-paste loop between two tabs and OCR price errors that look plausible enough to ship, I decided to (1) let the Account Setup userscript hand a task's files to the OCR tab and take the finished workbook back over same-window `postMessage`, opted into by a `#zoho-bridge` URL hash, and (2) cross-check every extracted price against a second, independent, name-and-price-only model reading before anything is sent, accepting one extra model call per image or PDF and that a review which could not cross-check anything must wait for a person.

## 1. The bridge

### Transport

The userscript runs inside this page (a Tampermonkey `@match` on the app's URL), so the two talk with `window.postMessage` on **this window only**. The userscript relays to the Zoho tab through its own storage. Nothing is posted to another origin, and no other site can talk to the app.

| Option | Why not / why yes |
|---|---|
| A backend callback | Rejected: [ADR-0005](ADR-0005-no-accounts-no-backend.md) — no accounts, no backend. |
| Download, then upload the file by hand | The status quo this replaces. Two tabs, two file dialogs, easy to attach the wrong file to the wrong task. |
| Cross-origin `postMessage` between the Zoho tab and this app | Rejected: the app would have to trust a second origin, and a Zoho page is not ours to audit. |
| Same-window `postMessage`, userscript relays (chosen) | No new origin is trusted. The userscript is already the trusted party on both sides. |

### The contract

`utils/zohoBridge.ts` holds it: four message types (`rewaa-ocr-ready`, `-load`, `-loaded`, `-result`), the `#zoho-bridge` opt-in, and the guards. Treat the message shapes as a versioned API: the userscript ships separately, so a change here must stay readable by the version already installed.

### Trust model

- `isOwnMessage`: same window, same origin.
- `isBridgeLoad`: a type guard with a file-count cap (20) and a per-file size cap.
- `safeFileName`: no path parts, no control characters.
- Files are decoded **before** the app acknowledges a load. A corrupt payload is reported in the log, and the userscript is not told it arrived.

### Auto start and auto send

Opened from Zoho, the tab extracts as a Restaurant Menu with no click. It sends the workbook back with no click **only** when the review below has nothing open, every input extracted, and every image or PDF was cross-checked. If the second reading could not run for any file, the panel names those files and the send waits for a person. Otherwise it waits, and the manual button stays available behind a confirmation.

## 2. The price double-check

An OCR price error is dangerous because it is plausible: `16` for `18` passes every format check. Re-reading the table cannot find it; only reading the source again can.

| Option | Why not / why yes |
|---|---|
| Static checks only | Kept, but not enough: they find a missing or non-numeric price, never a wrong one. |
| Run the same extraction twice | Rejected: the same long prompt tends to make the same mistake twice. |
| A second, deliberately simpler reading: names and prices only (chosen) | Independent enough to disagree when the first reading is wrong, cheap enough to run every time. |

`utils/ocrReview.ts` compares the two readings per source file. Where they agree, the row is trusted. A different price is offered as a one-click fix, and an item only the second reading found is offered as a missing row. The static checks run alongside it.

### Cost

One extra model call per image or PDF. Text inputs (spreadsheets, Word documents) are not re-read, because their text is exact. The check is **on by default** for every user, because a wrong price that reaches a customer's till costs far more than one call. The checkbox under *Active Features* turns it off for a run.

### What it does not prove

Two readings that agree can still both be wrong. The review narrows what a person has to look at from every row to the rows the readings disagree on. It is not a guarantee.
