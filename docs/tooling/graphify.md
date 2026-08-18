# Graphify — agent code graph / رسم بياني للكود لمساعدة الوكيل

**Installed:** 2026-08-18 · **Version:** `graphify 0.8.44` · **Purpose:** reduce the tokens a coding agent burns orienting itself in this repository.

**The decision itself is recorded in [ADR-0007](../adr/ADR-0007-graphify-is-agent-tooling-not-a-dependency.md).** This page is the how-to.

**Graphify is agent tooling, not an application dependency.** It is not in `package.json`, it is not imported by any application file, and it is not part of any build or deploy path. Nothing in `dist/` is affected by it. Removing it would not change the shipped app in any way.

> **الخلاصة بالعربية:** Graphify أداة للوكيل الذكي فقط، ليست تبعية للتطبيق. تبني خريطة للكود محليًا (بدون إنترنت) حتى يجيب الوكيل عن أسئلة الكود دون قراءة ملفات كاملة. تُبنى بالأمر `graphify update .` ولا تُرفع مخرجاتها إلى Git.

---

## 1. What it is

Graphify parses the repository with a local AST parser and produces a graph: files, the symbols inside them, and the edges between them (`imports`, `imports_from`, `contains`, `calls`). An agent can then ask "who uses this helper?" or "how do these two files connect?" and get a scoped answer of a few hundred bytes, instead of reading several thousand-line components to find out.

It does **not** replace reading code. It replaces the *search* phase — the part where an agent greps, guesses, opens the wrong file, and greps again.

---

## 2. How it is installed here

Two layers, both already in place.

| Layer | Location | Committed? | What it does |
|---|---|:---:|---|
| **Project-scoped skill** | `.claude/skills/graphify/` | ✅ yes | `SKILL.md` + `references/`. Makes `/graphify` available to anyone who clones this repo, without a personal install |
| **Project agent instructions** | `CLAUDE.md` (root `## graphify` section) and `.claude/CLAUDE.md` | ✅ yes | Tells the agent to try `query`/`path`/`explain` before raw browsing |
| **Project PreToolUse hooks** | `.claude/settings.json` | ✅ yes | Injects a reminder when the agent is about to grep or read source, **only if** `graphify-out/graph.json` exists |

### The hooks need `python3`, and fail quietly without it

Both hook commands shell out to `python3` to parse the tool input, and end in `|| true`. Verified working here — fed synthetic tool input, both emit the correct `additionalContext` JSON, and the Bash one fires in normal use. But on a machine where `python3` is not on `PATH` (common on Windows, where it may be `python` or a Store alias), the command fails, `|| true` swallows it, and **the nudge silently stops happening**. Nothing breaks; the reminders just disappear. If an agent seems to be ignoring the graph, check `command -v python3` before assuming the graph is at fault.
| **Generated graph** | `graphify-out/` | ❌ **no** — gitignored | The graph itself; rebuilt locally |
| **CLI binary** | `~/.local/bin/graphify` (per developer) | ❌ n/a | Installed per machine, outside the repo |

Installed with:

```bash
graphify install --project --platform claude
```

The `--project` flag is what makes it repo-scoped rather than only a personal `~/.claude` install. The user-level install was left untouched (`~/.claude/CLAUDE.md` is byte-identical before and after — verified by checksum).

### A Windows install bug worth knowing

`graphify install --project` fails with `PermissionError: [WinError 5]` if `.claude/skills/graphify/references/` **already exists and is non-empty** — the installer uses `os.replace()` on a directory, which Windows refuses for a non-empty target. If you hit it, delete `.claude/skills/graphify/` and re-run. A traceback here does not mean a broken environment.

---

## 3. Rebuilding the graph

```bash
graphify update .          # incremental, local AST only, no API cost
graphify cluster-only . --no-label   # refresh communities + GRAPH_REPORT.md without an LLM
```

`update` is incremental: `graphify-out/manifest.json` stores an `mtime` and an `ast_hash` per file, and only changed files are re-parsed. A full cold rebuild of this repo is 166 files and takes seconds with 12 workers; a warm one is near-instant.

**Do not run `graphify hook install` in this repository.** It installs `post-commit`/`post-checkout` git hooks, but this repo sets `core.hooksPath=.githooks` for the ApexYard pre-push gate. A Graphify hook written to `.git/hooks/` would be silently ignored because of that override; one written into `.githooks/` would become a committed file entangled with the gate. Rebuild manually or with `graphify watch` instead. Current state: `graphify hook status` → *post-commit: not installed, post-checkout: not installed*.

---

## 4. How an agent should use it

Three commands, verified working against this repository:

| Command | Use it for | Verified output |
|---|---|---|
| `graphify query "<question>"` | Orientation — "what is involved in X?" Returns a BFS subgraph (depth 2) of relevant nodes with file and line | `query "lookupEngine"` → 40 nodes: `lookupEngine.ts`, its test, `SmartLookupTab.tsx`, `excelService.ts`, `types.ts`, `translations.ts` |
| `graphify path "<A>" "<B>"` | Relationships — "how does A reach B?" | `path "SmartLookupTab" "lookupEngine"` → `SmartLookupTab() <--contains-- SmartLookupTab.tsx --imports_from--> lookupEngine.ts` |
| `graphify explain "<symbol>"` | A single symbol's exact neighbourhood — importers and members | `explain "lookupEngine.ts"` → its 3 real importers and all 8 exported symbols |

`graphify-out/GRAPH_REPORT.md` (24 KB) is the whole-architecture view. Read it only when the three scoped commands are not enough — at ~6k tokens it costs more than most questions are worth.

### Accuracy check, since a wrong map is worse than no map

`explain "exportToExcelSingleSheet"` listed 5 importers. `grep -rln` listed 6 files. The graph was **right and grep was wrong**: the sixth file, `e2e/exporter-date-format.spec.ts`, only mentions the helper in a doc comment (line 11) and never imports it. The graph distinguishes an import edge from a textual mention; grep cannot.

Two accuracy caveats observed:

- **`query` is label-biased toward prose.** `query "smart lookup engine"` returned mostly Markdown nodes, because documentation headings match natural-language phrasing better than code identifiers do. For code, query the **identifier** (`"lookupEngine"`), not the description.
- **`path` warns on ambiguous matches** (`warning: source match was ambiguous`) when several nodes score alike. The resolved path was correct in every case checked, but the warning means "I picked one of several candidates" — confirm the endpoints are the ones you meant.

---

## 5. What is generated, and what must never be committed

Everything Graphify produces lands in `graphify-out/`, which is gitignored (`.gitignore:43`):

| File | Size | Contents |
|---|---:|---|
| `graph.json` | ~1.0 MB | The graph. At the time of writing: 1,145 nodes, 2,141 edges before clustering, 1,756 after it prunes. These counts move with every commit — they are a snapshot, not a target |
| `graph.html` | ~918 KB | Interactive viewer. **Loads `vis-network` from `unpkg.com` when you open it in a browser** — that is the viewer fetching a JS library, not Graphify sending anything out |
| `GRAPH_REPORT.md` | ~24 KB | Architecture summary by community |
| `manifest.json` | ~26 KB | Per-file `mtime`, `ast_hash`, `semantic_hash` — the staleness index |
| `cache/` | varies | Per-file AST cache that makes `update` incremental |
| `.graphify_labels.json`, `.graphify_root` | small | Community labels and root marker |

**Do not commit `graphify-out/`.** Three reasons: it is derived, so it is regenerable in seconds; it goes stale on nearly every commit, so a committed copy would be wrong more often than right; and `graph.json` plus `graph.html` are ~1.9 MB of churning binary-ish diff noise. If a future need ever justifies committing it (for example a CI job that cannot run the CLI), document the reason at the point of the change — the current default is deliberate, not an oversight.

**What *is* committed** is the configuration: `.claude/` and the root `CLAUDE.md`. That is the point of a project-scoped install — a teammate clones the repo, runs `graphify update .`, and has the same setup.

---

## 6. Privacy: does it send source code anywhere?

**No, not during normal local use — verified two ways.**

**Static.** Every outbound LLM host in the package is confined to a single module, `llm.py`: `generativelanguage.googleapis.com`, `api.anthropic.com`, `api.openai.com`, `api.deepseek.com`, `api.moonshot.ai`, Azure OpenAI, and `localhost:11434` for Ollama. Only `dedup.py`, `prs.py` and `__main__.py` import it. The AST extraction path does not. There is no telemetry or analytics host anywhere in the package.

**Empirical.** A full cold re-extract of all 166 files was run with every HTTP egress route blackholed:

```bash
rm -rf graphify-out/cache
HTTP_PROXY=http://127.0.0.1:1 HTTPS_PROXY=http://127.0.0.1:1 ALL_PROXY=http://127.0.0.1:1 \
  graphify update . --no-cluster
```

It completed normally — 166/166 files, 1,128 nodes at that point — with exit code 0. A tool making HTTP calls through that proxy would have failed or stalled. Corroborating evidence: `manifest.json` shows **0 of 171 tracked files with a non-empty `semantic_hash`**, which is the field populated by LLM extraction, and the CLI itself prints *"Re-extracting code files (no LLM needed)"* and *"Tip: set GEMINI_API_KEY or GOOGLE_API_KEY to use Gemini for semantic extraction."*

### When an external model *would* be used

| Trigger | What is sent | How to prevent it |
|---|---|---|
| An API key is present in the environment (`GEMINI_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `KIMI_API_KEY`, `MOONSHOT_API_KEY`) **and** a command that does semantic work is run | Source content, for semantic extraction | Leave the keys unset. **All seven were verified unset on this machine.** |
| `graphify extract --backend <gemini\|openai\|claude\|kimi\|deepseek\|ollama>` | Source content for semantic enrichment | Use `graphify update` instead — it is AST-only by design |
| Community **labelling** (the naming of clusters) | Cluster summaries | Pass `--no-label`, which is what was used here. Communities are numbered (`Community 8`), not named |
| Opening `graphify-out/graph.html` | Nothing about your code — the browser fetches `vis-network` from a CDN | Open it offline or ignore the missing viewer library |

Because no key is set, the LLM path is unreachable today regardless of which command is run: the backends are selected by key presence. **If anyone sets one of those keys for another purpose, semantic extraction becomes possible** — that is the single condition to watch, and it is why `--no-label` is written into the rebuild commands above rather than left to chance.

---

## 7. Staleness: how it goes wrong and how to tell

The graph is a snapshot. It goes stale the moment a file changes, and a stale graph is actively misleading — it will report an import that was deleted, or miss one that was added.

**Symptoms:** `explain` lists a symbol that no longer exists; `query` returns a file you deleted; `path` finds no route between two files that clearly import each other; a node's line number points at the wrong line.

**Fix, in order:**

```bash
graphify update .                    # 1. incremental — resolves almost everything
rm -rf graphify-out/cache && graphify update .   # 2. force a full re-parse if the AST cache is suspect
rm -rf graphify-out && graphify update . && graphify cluster-only . --no-label   # 3. nuclear
```

Nothing is lost by deleting `graphify-out/` — it is entirely derived.

**When the repo changes:** the graph does **not** update itself. There is no watcher and no git hook installed here (see §3). Either run `graphify update .` after a batch of edits, or run `graphify watch` in a spare terminal for the duration of a session. Treat any graph answer that contradicts the file in front of you as a stale graph, and trust the file.

---

## 8. Measured benefit

Three real orientation questions, comparing the graph route against what an agent would otherwise read. Token figures are bytes ÷ 4, which is a rough but consistent approximation.

| Question | Graph route | Raw route | Files avoided |
|---|---|---|---|
| Where is `exportToExcelSingleSheet` defined and who uses it? | `explain` → 479 B (**~119 tok**) | `utils/excelUtils.ts` + `CleanTool.tsx` + `MergeTool.tsx` + `SplitterTool.tsx` = 64,396 B (**~16,100 tok**) | 4 |
| How does `SmartLookupTab` reach the lookup engine? | `path` → 136 B (**~34 tok**) | `SmartLookupTab.tsx` + `lookupEngine.ts` = 40,297 B (**~10,100 tok**) | 2 |
| What is involved in AI provider fallback? | `query` → 6,270 B (**~1,570 tok**) | `aiServiceFactory.ts` + `geminiService.ts` = 38,600 B (**~9,650 tok**) | 2 |

**Order of magnitude, not a rounding error.** The first two questions cost **under 1 % of the raw route** (0.7 % and 0.3 %). The third, a deliberately broad question, costs **16 %** — still a 6× saving, but visibly less dramatic. That is the honest shape of the result: the narrower and more structural the question, the bigger the win, and a vague question buys you much less.

The comparison is also generous to the raw route in one respect and harsh in another. Generous: it counts only the files an agent would read *knowing which ones to read* — in practice it also opens wrong files first, which the graph avoids. Harsh: an agent would often read a *portion* of a large file rather than all of it. Treat the ratio as directional, not exact.

### Where raw reads are still required

The graph holds structure, not behaviour. It cannot tell you:

- **What code does** — logic, conditionals, ordering. `explain "formatCell"` gives its importers, not that it calls `XLSX.SSF.format` only when `t === 'n' && z`.
- **Anything you intend to edit.** Every modification still needs the actual lines.
- **Runtime and data-shape questions** — what a cell object looks like at a given moment, why a test fails.
- **Non-import coupling** — `localStorage` keys, string-keyed translation lookups, dynamic imports. These are real dependencies with no AST edge, and the graph is blind to them. The orphaned `groq_api_key` key documented in `docs/modules/open-decisions.md` is exactly this class of link.
- **Very recent edits**, until `update` is re-run.

**Concrete payoff already banked:** `explain "exportToExcelSingleSheet"` surfaced `MergeTool.tsx` as an importer, which contradicted `docs/modules/exporter-date-format-audit.md` — that document had Merge Datasets on the `appendSheet` path only. It uses both writers (`components/MergeTool.tsx:170`, the "separate files" ZIP mode). The audit has been corrected. A static read had missed it twice.

---

## 9. Two claims this document does not make

- **There is no "strict mode" and no "soft-nudge mode" in v0.8.44.** Those terms do not appear anywhere in the CLI help or the skill files. What exists is a `PreToolUse` hook that injects advisory text; it emits `additionalContext` only, with **no** `permissionDecision: deny`, so it cannot block a tool call — verified by parsing `.claude/settings.json`. The hook's wording says "MANDATORY", but the mechanism is a reminder. The nearest thing to a strict mode would be a denying hook, and none is installed. Nothing was enabled beyond this default.
- **The upstream repository was not verified.** The install used the CLI and skill already present on this machine. The package's own source references `https://github.com/safishamsi/graphify`, which is **not** the `https://github.com/Graphify-Labs/graphify` URL this work was requested against. That discrepancy is unresolved and worth confirming before treating either as canonical.

---

## 10. Uninstalling

```bash
graphify claude uninstall     # removes the CLAUDE.md section + PreToolUse hook
rm -rf .claude/skills/graphify graphify-out
```

Then drop the `graphify-out/` block from `.gitignore`. No application file references Graphify, so nothing else needs touching.
