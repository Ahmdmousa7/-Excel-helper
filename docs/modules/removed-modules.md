# Removed modules

A record of features deleted from the app, what went with them, and what was
deliberately left behind. Kept because "why is there no CSV tab?" is a question
someone will ask, and because the things NOT deleted are the part worth writing
down — a later reader can rediscover a deletion from git, but not the reasoning
that spared a shared file.

---

## 2026-08-16 — Check Duplicates, CSV to Excel, Magic Links

Removed at the maintainer's request: no longer needed. No deprecation period and
no compatibility shims — see *Backward compatibility* below for why none were
required.

### What went

| Module | Component | Other code removed |
|---|---|---|
| Check Duplicates | `components/DuplicatesTab.tsx` (820 lines) | tab entry (id 1), lazy import, voice command, `tabs.duplicates`, `toolInfo.duplicates`, the `duplicates: {}` block — all in both locales |
| CSV to Excel | `components/CsvConverterTab.tsx` (550 lines) | tab entry (id 11), lazy import, `tabs.csv`, `toolInfo.csv`, the `csv: {}` block — both locales. **Dependencies `papaparse` and `@types/papaparse`** |
| Magic Links | `components/MagicLinkTab.tsx` (435 lines) | tab entry (id 27), lazy import, `AppShell.TOOL.magicLinks` and its three e2e usages |

Two lucide icons — `Copy` and `Key` — became unused in `App.tsx` and went with
them. The other unused icon imports in that file predate this work and were left
alone.

### What was deliberately NOT removed

- **`components/DeduplicateTool.tsx` — "Deduplicator (Pro)" (tab id 32).** A
  different module with a similar name. It imports nothing from `DuplicatesTab`,
  and it is still in the sidebar. The removal is verified against this: the
  browser check asserts the three names are gone *and* that this one is still
  present, because a name-based deletion is exactly the kind that takes a
  neighbour with it.
- **`services/excelService.ts`, `ProgressBar`, `FileUploaderBase`, and the
  `xlsx` / `xlsx-js-style` / `jszip` dependencies.** All used by the removed
  modules and by many surviving ones. Checked, not assumed.
- **The permissive `connect-src https:` in the CSP.** Magic Links called
  `admin.platform.rewaatech.com`, but the CSP never named that host — the
  directive is deliberately broad and documented as such in `index.html`, so
  there was nothing module-specific to withdraw.

### Backward compatibility

**None was needed, and that is a property of this app rather than a judgement
call.** It is a single-page browser tool with no router, no URL per tool, no
backend and no public API: tools are entries in an array in `App.tsx`, selected
by in-memory state. There is no route, endpoint or persisted identifier that an
outside caller could still be holding. Nothing was retained for compatibility
because there is nothing that could break.

The one thing that outlives the code is noted below.

### The orphaned token, and what was done about it

Magic Links stored an admin bearer token at `localStorage['rewaa_admin_token']`,
written by the module and read only by it. Deleting the module does not delete
that value from a browser that already has one.

**A one-line cleanup now runs at startup** — `localStorage.removeItem(...)` in
`App.tsx`'s first effect. An earlier draft of this document claimed "nothing in
the repo can fix it", which was wrong: the app cannot revoke the token server
side, but it can certainly stop storing it, and leaving a bearer token in users'
profiles when one line clears it is not a defensible trade.

It is a **one-shot cleanup, not a permanent invariant.** Delete it once enough
time has passed that returning users have all loaded the app at least once.

What the app still cannot do, and what may need a decision elsewhere:

- The token authenticates against `admin.platform.rewaatech.com`, not this app,
  so clearing the local copy does not revoke it.
- If those tokens are long-lived, revoking them is an action on the admin
  platform. Whether that is worth doing depends on their lifetime, which this
  repository does not know.

### A near neighbour that is NOT Magic Links

`components/RewaaTab.tsx` builds a `platform.rewaatech.com/inventory/...?token=`
import URL. Same company, similar shape, unrelated feature — it is part of the
Rewaa Manager tab and was not touched. Noted because "the other place that puts
a token in a rewaatech URL" is exactly what a future search for this cleanup
will turn up.
