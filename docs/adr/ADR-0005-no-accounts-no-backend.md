# ADR-0005 — The app has no accounts and no backend

**Status:** Accepted
**Date:** 2026-08-03
**Deciders:** Maintainer (Ahmdmousa7)
**Supersedes:** the implicit "Google sign-in gates the app" design that shipped without an ADR. That absence is why this file exists — ADR-0001…0004 record decisions about *review tooling*, and none covered authentication, which is the larger decision by some distance.

> In the context of a browser-only spreadsheet toolkit whose sign-in gate had begun locking its own maintainer out, facing a Firebase dependency whose only surviving job was that gate, I decided to remove authentication and Firebase entirely, making the app a pure client-side tool, accepting that the public Pages URL becomes usable by anyone with the link and that per-account cloud sync of one tab's template is permanently gone.

## What changed

| Before | After |
|---|---|
| Google sign-in required before the app rendered | App opens straight to the workspace |
| Firebase Auth + Firestore initialised on every load | No Firebase; **~480 KB** vendor chunk deleted |
| One `users/{userId}` doc per signer, holding a `preferences` blob | `localStorage` only |
| `firestore.rules` deployed status unverified (TD-026) | Moot — no Firestore |

## Why

**The gate had stopped working.** The sign-in button called `signInWithPopup` with no guard against a second in-flight call, so a double click produced `auth/cancelled-popup-request` and the attempt failed. The maintainer was locked out of the live site. That was the trigger, not the reason.

**The reason is that the gate was never load-bearing.** It is worth being precise, because "we removed authentication" deserves scrutiny:

- `firestore.rules` grants access to exactly **one** collection, `users/{userId}`, behind `isOwner`/`isAdmin`. There was no shared business data, no multi-tenant records, nothing another user could read.
- Every tool — spreadsheet transforms, QR, PDF, OCR, CSV, dedupe, merge, split — is **pure client-side computation**. Files never left the browser. The gate protected no processing, only the act of opening the page.
- The single feature reading the user document was `ProjectSummaryTab`'s template sync, which already wrote `localStorage` first on every save and guarded every Firestore call.

So the gate was an *access restriction on a public URL*, not a data protection boundary. Removing it changes who can open the page; it does not expose anything that was previously protected.

## What was considered

| Option | Why not / why yes |
|---|---|
| **Guard the double-click** (`isSigningIn` flag, or catch `cancelled-popup-request`) | Rejected — it fixes the symptom and keeps a gate the maintainer had asked twice to remove. It also leaves the ~480 KB Firebase chunk on the first-paint path to protect nothing. |
| **Swap Google for a shared passcode** | Rejected. A client-side passcode in a static bundle is theatre: it ships in the JavaScript. It would be the "unenforced convention dressed as a control" this project already refused once (ADR-0002 § *the honest framing*). |
| **Keep optional sign-in** — no gate, but a button for cloud sync | Rejected as the worst of both. It keeps all of Firebase for one tab's preference blob, and leaves a control most users would never understand the purpose of. |
| **Remove auth, keep Firebase for sync** | Rejected. With nobody signed in, `auth.currentUser` is permanently null, so every Firestore call no-ops. Keeping a 480 KB dependency to execute nothing is strictly worse than deleting it. |
| **Remove both** (chosen) | Chosen. The app becomes what it actually is: a client-side toolkit with local persistence. |

## Consequences

- **The public URL is open.** Anyone with the link can use the tools. This is the accepted trade, and it is the one thing here that is not reversible retroactively — the site was unauthenticated from this deploy onward, and that cannot be undone by a later commit. Stated plainly rather than buried.
- **Cross-device template sync is gone.** A `ProjectSummaryTab` template saved on one machine no longer appears on another. `localStorage` is per-browser and per-origin. Anyone relying on that has to re-save locally, and clearing site data now loses the template for good. This is the only real capability loss and it was previously unstated.
- **No credential of any kind is left in the client.** `firebase-applet-config.json` is deleted along with the Firebase web API key it carried — which was never a secret (TD-026 explains why), but is now simply absent.
- **TD-026 is closed as moot.** It tracked whether `firestore.rules` was actually deployed and whether the API key had referrer restrictions. With no Firestore and no key, there is nothing to verify.
- **The bundle drops by roughly 115 KB gzipped** on the first-paint path — `vendor-firebase` was the largest vendor chunk, bigger than React. Budgets in `bundle-budget.json` were ratcheted down to match, per the ratchet convention in that file.
- **`e2e/fixtures.ts` and the live spec no longer filter `firebase`/`firestore` console noise.** Those filters existed because Firebase logged errors the app could not control. With Firebase gone, such a message would mean it came back, so the entries were removed — the same reasoning that file already applied to `cdn.tailwindcss.com` and CSP violations.
- **Google Sheets sync is unaffected.** It uses Google Identity Services (`accounts.google.com/gsi/client`) with an OAuth client ID from `localStorage`, entirely independently of Firebase. The CSP entries for `accounts.google.com` and `apis.google.com` stay for that reason.
- **The e2e auth bypass is retired.** `VITE_E2E_AUTH_BYPASS` existed only to get Playwright past the gate. `build:e2e` and its separate `--outDir dist-e2e` are kept: the bypass is gone but the reason for separate output directories is not — any build into the directory `vite preview` is serving still swaps the bundle mid-run, which is what produced a 100-of-101 failure once.

## What this does NOT change

Worth stating, because "removed authentication" invites the wrong inference:

- No file the user opens is uploaded anywhere. That was true before and is true now.
- API keys the user pastes (Gemini, Groq) stay in `localStorage`, same as before.
- The review, evidence, and CI apparatus (ADR-0001…0004) is untouched.

## Artifacts

- Deleted: `firebase.ts`, `utils/firebaseUtils.ts`, `components/AuthWrapper.tsx`, `firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`
- Changed: `index.tsx`, `components/Sidebar.tsx` (Logout removed), `components/ProjectSummaryTab.tsx` (cloud branches removed), `components/ErrorBoundary.tsx` (Firestore-error special case removed), `vite.config.ts`, `package.json`
- `docs/quality/tech-debt-register.md` — TD-037 closed, TD-026 closed as moot
