# CIRF Changelog

Every change to CIRF, big or small, newest first. Times are West Africa Time (WAT, UTC+1). The SHA is the commit the change landed in, so `git show <sha>` shows the exact diff.

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
