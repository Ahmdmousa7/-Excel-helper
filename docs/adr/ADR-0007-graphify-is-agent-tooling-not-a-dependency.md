# ADR-0007 — Graphify is agent tooling, never an application dependency

**Status:** Accepted
**Date:** 2026-08-18
**Deciders:** Maintainer (Ahmdmousa7)

> In the context of a coding agent that spent most of its budget grepping and opening the wrong files before it could answer anything, facing a repository where a single component is 39 KB and the search phase cost more than the work, I decided to install Graphify 0.8.44 as a **project-scoped agent skill** that builds a local AST graph, accepting that the graph is a snapshot that goes stale on every commit and that it can answer structural questions only — while committing to keep it entirely outside the application's dependency tree, build, and deploy path.

## What changed

| Before | After |
|---|---|
| An agent oriented itself by grepping, then reading whole files | It runs `graphify query` / `path` / `explain` first, and reads files to *edit* them |
| Answering "who imports this helper?" cost ~16k tokens of file reads | ~119 tokens, and more precisely — see below |
| Agent setup lived only in the maintainer's `~/.claude` | `.claude/skills/graphify/` is committed, so a clone gets the same setup |
| No repository policy on agent tooling in the dependency tree | This ADR: agent tooling is committed **configuration**, never a package |

## Why

**The search phase was the expensive part, and it is the part a graph replaces.** Measured on three real questions: a structural question costs under 1 % of the raw-read route, and a deliberately vague one costs 16 %. The ratio is directional rather than exact — it counts only the files an agent would read *knowing which ones to read*, and in practice it opens wrong files first. Full numbers in [`docs/tooling/graphify.md`](../tooling/graphify.md#8-measured-benefit).

**It is more accurate than grep, not merely cheaper.** `explain "exportToExcelSingleSheet"` returned 5 importers where `grep -rln` returned 6 files; the sixth mentions the helper only in a doc comment. It also found a real error in [the exporter audit](../modules/exporter-date-format-audit.md) — Merge Datasets uses both shared writers, not just `appendSheet`, which two static reads had missed.

**Nothing leaves the machine on the local path, and that was verified rather than assumed.** A full 166-file re-extract completed with every HTTP proxy blackholed; `manifest.json` records 0 of 171 files with an LLM `semantic_hash`; all seven provider API keys are unset; and LLM egress is confined to one module of the package. The condition to watch is a key being set for some *other* purpose, which is why the documented rebuild commands pass `--no-label` explicitly instead of relying on the absence of a key.

## The trade-offs accepted

**The graph is a snapshot, and a stale graph is worse than none.** It does not update itself — no watcher, no git hook (the repo's `core.hooksPath=.githooks` belongs to the ApexYard gate, and a Graphify hook would either be silently ignored or entangle itself with that). The rule is: when a graph answer contradicts the file in front of you, trust the file and run `graphify update .`.

**It holds structure, not behaviour.** It cannot say what code does, and it is blind to non-import coupling — `localStorage` keys, string-keyed translation lookups, dynamic imports. The orphaned `groq_api_key` in [open-decisions.md](../modules/open-decisions.md#d5) is exactly the class of link with no AST edge.

**The nudge is advisory, and deliberately so.** The `PreToolUse` hooks emit `additionalContext` with no `permissionDecision`, so they cannot block a tool call — verified by parsing `.claude/settings.json`. Their wording says "MANDATORY"; the mechanism is a reminder. No blocking mode was enabled, and v0.8.44 has no such mode to enable.

## Why not a dependency

Because it would be a category error with real cost. Graphify parses this repository for the benefit of whoever is editing it; it is never executed by the shipped app, which is a static browser bundle with no server. Adding it to `package.json` would put a Python-backed developer tool into the dependency audit, the bundle budget's blast radius, and every contributor's `npm install` — for zero runtime benefit. The bundle-budget stage passing unchanged after this install is the standing proof that it stayed out.

The generated `graphify-out/` is likewise **not committed**: derived, regenerable in seconds, stale on nearly every commit, and ~1.9 MB of churn. If a future need ever justifies committing it, the reason belongs in that change.

## Consequences

- A clone needs the CLI installed per machine (`~/.local/bin/graphify`), then `graphify update .`. The skill and hooks come with the repo.
- The hooks depend on `python3` and a POSIX shell. Where `python3` is absent the hook fails into `|| true` and **silently stops nudging** — no error, just no reminder. That is a portability caveat, not a breakage; both hooks were verified emitting correct JSON on the maintainer's Windows setup.
- Revisit if: the CLI's local-only guarantee changes in a future version, a provider key gets set in the environment for another reason, or the graph proves stale often enough that a watcher becomes worth the coupling.
