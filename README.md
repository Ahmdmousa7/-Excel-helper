<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sale Onboarding Team — Excel Helper

[![CI](https://github.com/Ahmdmousa7/-Excel-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/Ahmdmousa7/-Excel-helper/actions/workflows/ci.yml)
[![Governed by ApexYard](https://img.shields.io/badge/governed_by-ApexYard-2F6DF6?style=flat-square)](https://github.com/Ahmdmousa7/apexyard)

Browser-based toolkit for spreadsheet, image, PDF and catalogue prep. React 18 + TypeScript + Vite, deployed to GitHub Pages at [ahmdmousa7.github.io/-Excel-helper](https://ahmdmousa7.github.io/-Excel-helper/).

View in AI Studio: <https://ai.studio/apps/44aea71a-655f-4e14-be7f-713d71b2e672>

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
cp .env.example .env.local     # then fill in VITE_GEMINI_API_KEY
npm run dev
```

`.env.local` is gitignored. Read the notes in [`.env.example`](.env.example) before adding anything — every `VITE_`-prefixed value is inlined into the browser bundle and is readable by anyone who opens devtools.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run verify` | lint → typecheck → unit tests → build (everything the `quality` CI job runs) |
| `npm run lint` | ESLint. Errors fail; warnings are documented known debt. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit suite (32 tests) |
| `npm run test:coverage` | Unit tests with coverage thresholds |
| `npm run e2e` | Playwright (59 tests, 9 suites) |
| `npm run e2e:report` | Open the last Playwright HTML report |

## Quality gates

Every push and pull request runs [CI](.github/workflows/ci.yml). These are its hard gates — they fail the run, though nothing is blocked at the merge until branch protection is enabled (see below):

- **TypeScript** — `tsc --noEmit` must be clean
- **Unit tests** — including coverage thresholds
- **Build** — `vite build` must succeed
- **Playwright** — the full e2e suite
- **Bundle budget** — gzipped initial load, measured from the built `index.html`

The **ApexYard AI review is deliberately not in that list.** It runs locally before every push (`npm run verify:local`) because no Anthropic credential is permitted in CI, which means nothing in the pipeline enforces it. That gap is real and is tracked as TD-027 — see [ADR-0001](docs/adr/ADR-0001-ai-review-runs-locally-not-in-ci.md).

ESLint **errors** block; ESLint warnings are reported but do not. See [`eslint.config.js`](eslint.config.js) for where that line sits and why.

## Documentation

| Doc | Contents |
|---|---|
| [`docs/APEXYARD.md`](docs/APEXYARD.md) | How the automated code review works, what it checks, how to change it |
| [`docs/TESTING.md`](docs/TESTING.md) | Test layout, the e2e auth bypass, ratchets, debugging failures |
| [`docs/reports/integration-review-2026-08-02.md`](docs/reports/integration-review-2026-08-02.md) | Baseline findings: 9 fixed, 8 open with suggested fixes |
| [`BRANDING.md`](BRANDING.md) | Brand guidance |

## Setup for maintainers

**No Anthropic API key is required, and none should ever be added.** This project's policy is that Anthropic credentials never leave the maintainer's machine — not in GitHub Secrets, not in Actions, not in a Docker image, not in a committed env file.

The AI code review therefore runs locally, before every push:

```bash
npm run verify:local     # AI review, then every other gate, in order
```

GitHub verifies everything that does not need a model, across **two** workflows:

| Workflow | Checks | Aggregate check |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | TypeScript, ESLint errors, Vitest + coverage, Playwright, build, bundle budget | `CI` |
| [`security.yml`](.github/workflows/security.yml) | Production dependency audit, TruffleHog verified-secret scan, committed-env-file check (all blocking); licence, markdown, and link checks (report-only) | `Security` |

Then [`deploy.yml`](.github/workflows/deploy.yml) publishes to Pages — gated on `CI` passing — and verifies the live site.

**Branch protection is not currently enabled on `main`,** so none of the above blocks a push today; they report. Enabling it would mean requiring **both** `CI` and `Security`, not `CI` alone — the dependency audit and secret scan live in the second one.

See [docs/APEXYARD.md](docs/APEXYARD.md#why-the-ai-review-is-local-only) for the reasoning and the trade-off it accepts.
