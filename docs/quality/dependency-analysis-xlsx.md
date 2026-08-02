# Dependency analysis — TD-001: `xlsx@0.18.5`

**Status: awaiting approval.** Replacing the library that parses every user file is a major-dependency change, so this is decided before it is implemented.

## Root cause

SheetJS **left the public npm registry**. `xlsx@0.18.5` (May 2022) is the last version ever published there, and it is permanently vulnerable:

| CVE | Issue | Fixed in | Available on npm? |
|---|---|---|:---:|
| CVE-2023-30533 | Prototype pollution via a crafted file | 0.19.3 | **No** |
| CVE-2024-22363 | ReDoS | 0.20.2 | **No** |

Patched builds exist only at `cdn.sheetjs.com`. The GitHub repo and the npm package are both unmaintained; [SheetJS issue #2961](https://git.sheetjs.com/sheetjs/sheetjs/issues/2961) is the maintainers declining to publish the fix to npm. `npm audit` reports `NO FIX` because, from npm's perspective, there is none.

`xlsx-js-style@1.2.0` is a fork of the same vulnerable base and inherits the flaw.

## Risk — why this one is not theoretical

The advisory says workflows that *do not read arbitrary files* are unaffected. **This app's entire purpose is reading arbitrary files.** Every finding below assumes an attacker who can get a user to open a spreadsheet — which for a "send me your product export" tool is the normal workflow, not an attack scenario.

| Factor | Assessment |
|---|---|
| Exploit path | Crafted `.xlsx` → `XLSX.read()` → `Object.prototype` polluted |
| Escalation | Any later `obj.someKey` read across the whole app returns attacker-controlled data. Realistic path to XSS via a polluted property reaching a render. |
| Blast radius | 26 import sites across 20 components — every tool, not one |
| Exposure | Public site, no auth wall on the parsing itself once signed in |
| Mitigation today | None |

**Severity: Critical.** It is the only shipping vulnerability that is both reachable and unpatched.

## Approaches compared

I evaluated four. The two that matter are 1 and 2.

### 1. `@e965/xlsx` — a maintained npm republish of upstream SheetJS

A community fork that republishes SheetJS builds (0.20.x) to npm, tracking upstream.

| | |
|---|---|
| API change | **None.** Same module, same exports. A path rewrite. |
| Fixes both CVEs | Yes |
| Migration | 26 import specifiers + `package.json`. Mechanical. |
| Effort | **4–6 h** including regression testing |
| Risk | Supply-chain: trusting a third-party republisher rather than the origin |

### 2. Vendor from `cdn.sheetjs.com` — the authoritative source

Install directly from SheetJS's own registry (`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`).

| | |
|---|---|
| API change | **None.** It is literally upstream. |
| Fixes both CVEs | Yes |
| Migration | One `package.json` line; imports unchanged |
| Effort | **2–3 h** |
| Risk | A non-npm registry URL in `package.json`. Dependabot and `npm audit` cannot see it, so future CVEs need manual watching. Some corporate proxies block it. |

### 3. `exceljs` — a genuinely different library

| | |
|---|---|
| API change | **Total.** Async, cell-object model, different workbook shape. Every one of the 26 sites rewrites. |
| Fixes both CVEs | Yes (unaffected codebase) |
| Effort | **60–80 h** plus a full regression pass on 30 tools |
| Risk | High. Formatting, formula, and edge-case behaviour differ; `xlsx-js-style` styling has no direct equivalent |

### 4. Do nothing + sanitise

Freeze `Object.prototype` or deep-clean parsed objects before use.

| | |
|---|---|
| Effort | 8–12 h |
| Risk | **Rejected.** Mitigates the symptom at 26 call sites and stays vulnerable to CVE-2024-22363. Defence you have to remember to apply is defence that eventually is not applied. |

## Benchmark

Against the reference projects you named:

- **SheetJS's own demos** ship from `cdn.sheetjs.com` — approach 2 is what upstream tells you to do.
- **Excalidraw** pins exact versions and runs Dependabot with a merge queue; it would not tolerate a `NO FIX` in a runtime dep.
- **VS Code Web** vendors and audits parsers deliberately rather than tracking npm latest.

The common thread is that none of them would leave an unpatched parser on the untrusted-input path. All three approaches beat the status quo; the question is only which trade-off you take.

## Recommendation

**Approach 1 — `@e965/xlsx`.**

Approach 2 is more authoritative and slightly cheaper, and I would pick it for a project with a dedicated security owner watching SheetJS releases. This project does not have that. A CDN tarball URL is invisible to `npm audit`, Dependabot, and the audit gate being added in TD-002 — so the *next* SheetJS CVE would go unnoticed exactly the way this one did. That is the failure mode that produced TD-001 in the first place.

`@e965/xlsx` keeps the dependency inside the ecosystem that has automated scanning, at the cost of trusting a republisher. For a codebase whose main defence is going to be an automated audit gate, staying visible to that gate is worth more than removing one hop of supply-chain trust.

**Recommended plan:**

1. Swap `xlsx` → `@e965/xlsx` and `xlsx-js-style` → `@e965/xlsx-js-style` (or keep styling on the current fork if no equivalent — see step 3).
2. Alias in `vite.config.ts` so the 26 import sites stay untouched:
   ```ts
   resolve: { alias: { 'xlsx': '@e965/xlsx' } }
   ```
   This makes it a one-file change and a one-line revert.
3. Verify styling parity — `xlsx-js-style` is the risk in this migration, not `xlsx`. If there is no maintained equivalent, keep it **export-only** (it never parses untrusted input, so the CVE does not apply to that path) and record the reasoning here.
4. Full regression: `npm run verify && npm run e2e`, plus a manual pass over the five spreadsheet tools.
5. Re-run `npm audit --production` and confirm the entry is gone.

**Estimated effort: 4–6 hours. Risk: low, and revert is one line.**

## Decision

- [ ] **Approved** — proceed with `@e965/xlsx`
- [ ] Prefer approach 2 (CDN tarball) — accept audit-tooling blindness
- [ ] Prefer approach 3 (`exceljs`) — accept 60–80 h and a full rewrite
- [ ] Defer — accept the risk, with a stated revisit date

*Decided: ______  ·  By: ______*
