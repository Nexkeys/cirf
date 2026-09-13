# CIRF Changelog

Every change to CIRF, big or small, newest first. Times are West Africa Time (WAT, UTC+1). The SHA is the commit the change landed in, so `git show <sha>` shows the exact diff.

---

## 2026-09-13 00:50 WAT · `f14d3ac` · Frontend (auth screens)

**The auth screens, built from `Auth Screens.png`** (branch `build/frontend-auth`)

- Screens and routes:
  - Home hero (`/`)
  - Welcome (`/welcome`)
  - Sign In (`/signin`)
  - Create Account (`/signup`)
  - Reset Your Password (`/forgot-password`)
  - Check Your Email (`/forgot-password/sent`)
  - The flow is Home → Get Started → Welcome → Get Started → Create Account.
- Matching the design:
  - Colours were sampled and spacing measured from the design file.
  - Each screen was screenshotted at the design's exact size and compared side by side, then corrected twice (font sizes, field heights, photo framing, a password-field width bug).
  - Photos keep the design's framing on phones and switch to a normal cover crop on wide screens.
- Sign in with:
  - email and password
  - phone number and password (through the new API route)
  - Google; a first-time Google user is sent to Create Account to finish their profile.
  - "Remember me" chooses between staying signed in and signing out when the tab closes.
- Create Account:
  - Community leads type their estate's name.
  - Residents search for their estate and pick it, then see "Waiting for Approval".
  - Errors show under the field they belong to.
- `/account` is a temporary landing page until the dashboards exist. It covers: in an estate, waiting for approval (check again or cancel), no estate yet, suspended, and API unreachable.
- Logo: the plain logo is split into the house mark and the wordmark (`scripts/optimize-images.mjs`), and CSS masks colour them per screen (green and dark on cream, green and white on Welcome, all white on Home). The favicon is generated from the same mark.
- Images: the 2 MB PNG photos become WebP at 800 and 1600 px (56–176 KB), and the Google "G" is trimmed.
- Security: `vite.config.js` passes only the four public Firebase web config values to the browser, never the server keys.
- Wide screens: sign-in forms sit beside the Welcome photo panel. This isn't in the design; it's an addition for desktop.
- Local testing without the live project: `npm run emulators`, `dev:api:emulators` and `dev:emulators`, with settings in `.env.emulators`.
- Verified:
  - 6 UI flows driven in headless Edge against the emulators all pass, with no page errors: lead sign-up, field errors, estate search and join request, phone sign-in, wrong password, and reset with resend.
  - Lint is clean, the build passes, and unit tests pass 16/16.
- Housekeeping:
  - New dependencies: react-router 8.3.1, lucide-react 1.45.0, @fontsource-variable/inter 5.3.0, and sharp 0.35.4 (dev).
  - Removed the Vite starter styles and images.
  - Committed the design images at their new `public/Images` location.
- Committed separately, together with this entry: your own `.gitignore` edit, which adds `Changelog-README.md` and `firebase-debug.log`. Git keeps tracking this changelog anyway, because the file was already committed before that line existed.
- Pushed `build/backend` and `build/frontend-auth` to GitHub. `main` is unchanged.

---

## 2026-09-13 00:22 WAT · `792c520` · Backend (auth support)

**Phone sign-in, estate search and join approval**

The auth screen designs need things the API couldn't do yet: "Email or Phone Number" on Sign In, and "Community / Estate" on Create Account. The Estate Settings design adds "Resident registration" and "Require admin approval" toggles.

- `POST /api/auth/phone-sign-in` (new, `server/routes/auth.js`):
  - Finds the account for a phone number, checks the password on the server (`services/passwordCheck.js`), and returns a Firebase custom token.
  - The email never reaches the browser, and a wrong password and an unknown number get the same answer.
- Phone numbers are stored as `+234…` (`lib/phone.js`, with 3 unit tests) and kept unique in a new `phoneNumbers` collection.
- `GET /api/public/estates?q=` (new): a new resident finds their estate by the start of its name. It returns only id, name and address. Estates with registration switched off never appear.
- Join approval:
  - A resident who picks an estate gets `requestedEstateId`, never `estateId`. Every existing estate check therefore keeps refusing them until an admin approves.
  - Admins approve (`POST /estates/:id/join-requests/:userId/approve`) or decline (`DELETE …`), and get a `join_request` notification.
  - Residents can withdraw a request or ask again (`/users/me/join-request`).
  - `GET /users/me` now includes `joinRequest`.
  - Estates have `allowRegistration` and `requireApproval`, both on by default.
  - A join code still works when registration is off.
- Community leads can name their estate while registering (`estateName`). An estate's address and household counts are now optional, and creating or re-pricing a campaign returns a clear 400 until the count the levy needs is set.
- Error responses can carry a `code` (`NOT_REGISTERED`, `SUSPENDED`, `REGISTRATION_CLOSED`, `INVALID_CREDENTIALS`), so the app can open the right screen.
- Tests: unit 16/16. E2e 18/18, with 4 new checks: phone sign-in, estate search with approval, closed registration, and declining a request.
- Docs: `server/README.md` covers the new endpoints, a "Joining an estate" table, security rows for search and phone sign-in, and the Vercel env vars. `.env.example` adds `FIREBASE_API_KEY`.
- Checked (read-only): the server can reach Firebase's password check with the project's API key. A made-up email got `INVALID_LOGIN_CREDENTIALS`, and no account was created.

---

## 2026-09-12 22:28 WAT · `72b75a2` · Backend (security)

**Estate isolation test and security model docs**

- New e2e check: an admin of a *different* estate gets 403 on 13 routes belonging to the first estate: estate details and edits, residents, campaigns, contributions, quotes, vendor selection, verification, reconciliation, and both report formats. The e2e suite now has 14 checks, all passing.
- `server/README.md` now has a "Security model" section. It explains why deny-all Firestore rules are the complete ruleset when every request goes through the Admin SDK, where each role (anyone, resident, admin, other estate, public link) is enforced in the API, and which secrets must never leak.
- Checked the live Firebase project (read-only):
  - Firestore: a direct client read returns `403 PERMISSION_DENIED`.
  - Realtime Database: rules are `.read/.write: false`, and anonymous reads get 401.
  - Storage: no bucket exists, so nothing is exposed.
  - Auth: Email/Password and Google sign-in are both enabled.

---

## 2026-09-12 21:50 WAT · `30e24fe` · Backend

**The full CIRF backend API**

- Express 5 app in `server/`, deployed on Vercel as one serverless function (`api/index.js`), so the free plan's 12-function limit never matters.
- Auth: every protected route verifies the Firebase ID token, loads the caller's role and estate, and refuses another estate's data. Firestore is only reached through the Admin SDK, and `firestore.rules` denies all direct access.
- Routes:
  - Registration: join by code, by admin invite, or sign up as a new community lead
  - Estates and residents
  - Campaigns: draft → fundraising → repairing → completed → reconciled
  - Contributions, with admin verify or reject
  - Vendor quotes: picking anything but the cheapest requires a written reason
  - Repair completion and reconciliation
  - Transparency report as JSON and PDF, plus an anonymized public link
  - Notifications, Cloudinary image uploads, payment reminders, and a lightweight progress endpoint for polling
- Every state change writes to an append-only audit trail (`campaigns/{id}/events`). The transparency report replays it as the timeline.
- Added an end-to-end test (`npm run test:e2e`) that runs a whole campaign through the real API on the Firebase emulators. All 13 checks pass. The resident and public PDFs were also checked by eye.
- Config: Vercel rewrites, a Vite `/api` proxy for local dev, `.env.example`, `firebase.json` for the emulators, and the `dev:api`, `test` and `test:e2e` npm scripts.
- Docs: `server/README.md` covers every endpoint, the lifecycle, the reconciliation rule and the deployment steps.
- Local only, not committed: added `FIREBASE_SERVICE_ACCOUNT_PATH` to `.env`.

---

## 2026-09-12 21:27 WAT · `4186a06` · Backend

**Reconciliation and levy calculation services, with unit tests**

- Added `server/services/reconciliation.js`. It compares total collected with the actual repair cost, then splits a surplus (refund) or shortfall (balance owed) across contributors in proportion to what each paid. It uses the largest remainder method, so the adjustments always add up exactly to the variance.
- Added `server/services/levy.js`: flat or per-unit levy calculation, each resident's expected levy, and paid / partial / pending / unpaid status.
- Added 13 unit tests using Node's built-in test runner. All pass.
- Installed backend dependencies: express 5.2.1, firebase-admin 14.4.0, cloudinary 2.11.0, pdfkit 0.20.2, multer 2.3.0, zod 4.6.2.
