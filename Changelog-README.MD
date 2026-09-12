# CIRF Changelog

Every change to CIRF, big or small, newest first. Times are West Africa Time (WAT, UTC+1). The SHA is the commit the change landed in, so `git show <sha>` shows the exact diff.

---

## 2026-09-12 21:27 WAT · `4186a06` · Backend

**Reconciliation and levy calculation services, with unit tests**

- Added `server/services/reconciliation.js`. It compares total collected with the actual repair cost, then splits a surplus (refund) or shortfall (balance owed) across contributors in proportion to what each paid. It uses the largest remainder method, so the adjustments always add up exactly to the variance.
- Added `server/services/levy.js`: flat or per-unit levy calculation, each resident's expected levy, and paid / partial / pending / unpaid status.
- Added 13 unit tests using Node's built-in test runner. All pass.
- Installed backend dependencies: express 5.2.1, firebase-admin 14.4.0, cloudinary 2.11.0, pdfkit 0.20.2, multer 2.3.0, zod 4.6.2.
