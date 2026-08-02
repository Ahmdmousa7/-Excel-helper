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

Every pull request runs [CI](.github/workflows/ci.yml). These block a merge:

- **TypeScript** — `tsc --noEmit` must be clean
- **Unit tests** — including coverage thresholds
- **Build** — `vite build` must succeed
- **Playwright** — all 59 e2e tests
- **ApexYard review** — no High or Critical findings

ESLint **errors** block; ESLint warnings are reported but do not. See [`eslint.config.js`](eslint.config.js) for where that line sits and why.

Branch protection should require the single aggregate check named **`CI`**.

## Documentation

| Doc | Contents |
|---|---|
| [`docs/APEXYARD.md`](docs/APEXYARD.md) | How the automated code review works, what it checks, how to change it |
| [`docs/TESTING.md`](docs/TESTING.md) | Test layout, the e2e auth bypass, ratchets, debugging failures |
| [`docs/reports/integration-review-2026-08-02.md`](docs/reports/integration-review-2026-08-02.md) | Baseline findings: 9 fixed, 8 open with suggested fixes |
| [`BRANDING.md`](BRANDING.md) | Brand guidance |

## Setup for maintainers

The ApexYard review job needs one repository secret:

**Settings → Secrets and variables → Actions** → `ANTHROPIC_API_KEY`

Without it the review job skips with a warning instead of failing. That is also what happens on pull requests opened from forks, since GitHub withholds secrets from them by design.
