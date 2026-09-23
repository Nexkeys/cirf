# CIRF API

The backend for the Community Infrastructure Repair Fund Tracker: one Express app, deployed as a single Vercel serverless function, using Firebase Auth for identity and Firestore through the Firebase Admin SDK.

## How a request flows

1. The app signs the user in with Firebase Auth and gets an ID token. There are three ways in: email and password, Google, or phone number and password through `POST /api/auth/phone-sign-in`.
2. Every API call sends `Authorization: Bearer <token>`.
3. `verifyFirebaseToken` checks the token with the Admin SDK and loads the caller's Firestore profile (role and estate).
4. `requireRole` blocks the request if the caller's role isn't allowed on that route.
5. The route checks the caller belongs to the estate that owns the data, then reads or writes Firestore with the Admin SDK.

Browsers never talk to Firestore. `firestore.rules` denies all direct access; that is the backstop, not the main lock.

## Security model

**Why the Firestore rules are only "deny everything".** Security rules only apply to requests from client SDKs, like a browser or phone using the public Firebase config. The Admin SDK on the server skips them completely. CIRF clients never read Firestore directly, so there is no legitimate traffic for a rule to allow. Any `allow` rule would just be a way around the API's checks. Role-based rules would only be needed if the frontend queried Firestore itself, which Doc 3 deliberately avoids. Doing both would mean writing the security logic twice.

**Every Firebase service is locked** (checked against the live project on 2026-09-12):

| Service | State |
| --- | --- |
| Firestore | Deny-all rules. A direct unauthenticated read returns `403 PERMISSION_DENIED`. |
| Realtime Database | Not used by CIRF. Rules are `.read: false, .write: false`, and anonymous reads return 401. |
| Storage | Not used (images go to Cloudinary). No bucket exists. |
| Auth | Email/password and Google enabled. |

**Where each role is enforced (in the API):**

| Who | Enforced by | Rule |
| --- | --- | --- |
| Anyone without a token | `verifyFirebaseToken` | 401 on everything except `/api/health`, `/api/auth/*` and `/api/public/*` |
| Signed in, not registered | `requireRole` | 403 with code `NOT_REGISTERED` until `POST /users/register` |
| Suspended user | `requireRole` | 403 with code `SUSPENDED` everywhere |
| Waiting for approval | `assertSameEstate` | They only have `requestedEstateId`, never `estateId`, so every estate check refuses them until an admin approves |
| Resident | `guards.adminOnly` | 403 on admin actions: create/publish campaigns, verify, quotes, complete, reconcile, manage residents and join requests |
| Any user or admin | `assertSameEstate` | 403 on another estate's estate, campaigns, contributions, quotes, reports |
| Resident viewing data | route filters | Drafts hidden. Only verified contributions plus their own. Join code hidden. Only their own notifications. |
| Public link | `routes/public.js` | Read-only, anonymized report for one campaign. Needs an unguessable 144-bit token. |
| Estate search | `routes/public.js` | Only `id`, `name`, `address`. Estates with "Resident registration" off never appear. |
| Phone sign-in | `routes/auth.js` | The password is checked on the server, and the email never reaches the browser. A wrong password and an unknown number get the same answer. |

Vendors are not accounts. They are quote records an admin enters, so they have no access at all.

The e2e test checks all of this. It includes an admin of a second estate being refused on 14 routes of the first estate, and a resident waiting for approval being refused until they're let in.

**What must stay secret:** the service account key (`FIREBASE_PRIVATE_KEY` on Vercel, `firebase-admin-sdk-.json` locally, which is gitignored) and `CLOUDINARY_API_SECRET`. Anyone with the service account key bypasses every rule above, so rotate it in the Google Cloud console if it ever leaks. `FIREBASE_API_KEY` is not a secret; it only identifies the project.

## Joining an estate

| How | Result |
| --- | --- |
| Admin invites the email (`POST /estates/:id/residents`) | Joins as soon as that email registers |
| Resident enters the estate's join code | Joins straight away. The admin shared the code on purpose, so it skips approval and works even when registration is off. |
| Resident picks the estate from `GET /public/estates` | Waits for approval (`requestedEstateId`) unless the estate turned "Require admin approval" off. The admins get a `join_request` notification. |
| Community lead signs up with `estateName` | Creates the estate with only a name and becomes its admin. The address and household count are added in Estate Settings, and campaigns are refused until the count is there. |

## Folder layout

```
api/index.js              Vercel entry point (the only deployed function)
server/
  app.js                  Express app: JSON parsing, routers, error handling
  dev.js                  Stand-alone local API for `npm run dev:api`
  routes/                 One file per resource, paths match the API spec
  middleware/             verifyFirebaseToken, requireRole, guards, errorHandler
  services/
    reconciliation.js     Pure reconciliation maths (unit tested)
    levy.js               Pure levy and payment-status maths (unit tested)
    transparencyReport.js Builds the audit-trail report (JSON, PDF, public)
    pdfReport.js          Renders the report with pdfkit
    audit.js              Append-only campaign event log
    notifications.js      In-app notifications
    estates.js            Join codes, new estates, how a resident joins
    passwordCheck.js      Checks a password with Firebase Auth, for phone sign-in
    firebaseAdmin.js      Admin SDK setup
    cloudinary.js         Image uploads
  lib/                    Small helpers: errors, validation, phone numbers, formatting
  e2e/lifecycle.e2e.js    Full lifecycle test against the Firebase emulators
firestore.rules           Deny-all rules
```

## Running it locally

```bash
npm install
npm run dev         # the site and the API together on http://localhost:5173 (reads .env)
```

`npm run dev` answers `/api` from the Express app inside Vite's dev server, so there's nothing else to start. Restart it after changing anything under `server/`. To work on the API with automatic restarts, run `npm run dev:api` (API on :3001) and start Vite with `API_PROXY_TARGET=http://localhost:3001` set, and Vite passes `/api` through to it.

Local credentials come from `.env`. See `.env.example`. Locally, `FIREBASE_SERVICE_ACCOUNT_PATH` points at the downloaded service account JSON. `npm run dev` uses the real Firebase project, so accounts made there are real.

## Trying the app on the emulators

To click through sign-up, estate joining and sign-in without creating practice accounts in the real Firebase project, run everything against the local emulators. Use two terminals:

```bash
npm run emulators           # Auth + Firestore emulators (needs Java)
npm run dev:emulators       # site and API on :5173, both using the emulators
```

The settings live in `.env.emulators`, which holds no secrets. Emulator data disappears when the emulators stop. Google sign-in and Cloudinary uploads only work against the real project.

To see the dashboards with realistic data, run `npm run seed:emulators` once the emulators are up. It wipes the emulators and creates Maple Estate: 62 members, a ₦3,500,000 transformer campaign with 13 days of verified contributions, three vendor quotes, and one resident waiting for approval. Sign in as `john@cirf.test` (community lead), `amina@cirf.test` (resident) or `kemi@cirf.test` (waiting for approval). Every password is `password123`. The script refuses to run unless the emulator settings are loaded, so it can't write to the real project.

## Tests

```bash
npm test            # unit tests: reconciliation, levy, dashboard overview and phone number maths
npm run test:e2e    # whole campaign lifecycle through the real API, on the Firebase emulators (needs Java)
```

The e2e test refuses to run unless emulator hosts are set, so it can never write to the real project.

On Windows the Firestore emulator's `java.exe` can keep running after the test finishes. If the next run says "Port 8085 is not open", end that `java.exe` process in Task Manager (its command line mentions `cloud-firestore-emulator`).

## Campaign lifecycle

| Status | How it gets there | What's allowed |
| --- | --- | --- |
| `draft` | `POST /campaigns` | Admin edits details, adds quotes. Hidden from residents. |
| `fundraising` | `POST /campaigns/:id/publish` | Contributions, verification, quotes, reminders |
| `repairing` | `PUT /vendor-quotes/:id/select` | Contributions still accepted, vendor can be re-selected |
| `completed` | `POST /campaigns/:id/complete` (actual cost) | Pending contributions can still be verified/rejected |
| `reconciled` | `POST /campaigns/:id/reconcile` | Read only. Numbers are final. |

## Endpoints

Access: **Public** needs no token, **Signed in** means any Firebase user even before registering, **Resident** means any registered user (admins included), **Admin** means community leads only. Everything is scoped to the caller's own estate.

### Auth
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/phone-sign-in` | Public | Body: `phone`, `password`. Returns `customToken` for `signInWithCustomToken()`. |

### Users
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/users/register` | Signed in | Create the profile after Firebase sign-up. Body: `name`, `phone?`, `role?` (`resident`/`admin`), `unitNumber?`. Residents add `estateId?` or `joinCode?`, leads add `estateName?`. |
| GET | `/api/users/me` | Resident | Profile, estate, and `joinRequest` (the estate they're waiting for, or null) |
| PUT | `/api/users/me` | Resident | Update `name`, `phone` |
| POST | `/api/users/me/join-request` | Resident | Residents with no estate ask to join one. Body: `estateId` or `joinCode`. |
| DELETE | `/api/users/me/join-request` | Resident | Withdraw a request that hasn't been answered |
| GET | `/api/users/me/contributions` | Resident | Own contribution history across campaigns |
| GET | `/api/users/me/notifications` | Resident | Latest 50 notifications and unread count |
| PUT | `/api/users/me/notifications/read-all` | Resident | Mark all as read |

Phone numbers are stored as `+234...` and must be unique, so any usual way of writing a number signs in to the same account.

### Estates
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/estates` | Admin | Create the admin's estate. Body: `name`, `address?`, `totalHouseholds?`, `totalUnits?` |
| GET | `/api/estates/:id` | Resident | Details and stats (join code and `joinRequestCount` for admins only) |
| PUT | `/api/estates/:id` | Admin | Update `name`, `address`, `totalHouseholds`, `totalUnits`, `communityType` (`residential_estate`/`street`/`compound`/`other`), `imageUrl`, `allowRegistration`, `requireApproval`, or `regenerateJoinCode: true` for a new code |
| GET | `/api/estates/:id/residents?campaignId=` | Admin | Residents, pending invites, `joinRequests`, and paid/unpaid status for a campaign |
| POST | `/api/estates/:id/residents` | Admin | Add an existing user or invite an email. Body: `email`, `unitNumber?`, `units?` |
| PUT | `/api/estates/:id/residents/:userId` | Admin | Change `unitNumber`, `units`, `status` (`active`/`suspended`), `role`. Nobody can change their own role or status, or the estate owner's. |
| DELETE | `/api/estates/:id/residents/:userId` | Admin | Remove from estate (their contributions stay on record). The owner can't be removed. |
| POST | `/api/estates/:id/transfer-ownership` | Owner | `{ userId }`: hand the estate to another member, who becomes an admin. The old owner stays a co-admin. The owner is `ownerId`, or `createdBy` until the first transfer. |
| POST | `/api/estates/:id/join-requests/:userId/approve` | Admin | Let someone in. Body: `unitNumber?`, `units?` |
| DELETE | `/api/estates/:id/join-requests/:userId` | Admin | Decline a request |
| DELETE | `/api/estates/:id/invites/:email` | Admin | Cancel an invite |

### Campaigns
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/campaigns?status=a,b` | Resident | Estate campaigns, each with the caller's `myPayment` |
| POST | `/api/campaigns` | Admin | Create a draft. Body: `title`, `description`, `category`, `targetAmount`, `levyMethod?` (`flat`/`per_unit`), `deadline?` (YYYY-MM-DD), `imageUrl?`. Refused until the estate has its household (or unit) count. |
| GET | `/api/campaigns/:id` | Resident | Full detail with `myPayment` |
| GET | `/api/campaigns/:id/progress` | Resident | Lightweight polling endpoint (one read) |
| GET | `/api/campaigns/:id/overview` | Resident | Dashboard figures: paid / pending / overdue households, money verified this week, quote count, refund or shortfall estimate, and a day-by-day running total for the chart. Counts only, no names. Refetch when `/progress` changes. |
| PUT | `/api/campaigns/:id` | Admin | Edit while still a draft |
| POST | `/api/campaigns/:id/publish` | Admin | Open to residents, creates the public link token |
| PUT | `/api/campaigns/:id/payment-details` | Admin | Where residents pay: `{ bankName, accountName, accountNumber }` (10 digits) or `null`. Allowed until the repair is complete, even after publishing; every change goes into the audit trail. `POST /api/campaigns` also accepts `paymentDetails`. |
| POST | `/api/campaigns/:id/reminders` | Admin | Notify every active resident who still owes |

### Contributions
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/campaigns/:id/contributions` | Resident | Admins see all. Residents see verified ones plus their own. |
| POST | `/api/campaigns/:id/contributions` | Resident | Body: `amount`, `method`, `reference?`, `note?`, `paidAt?`, `proofUrl?`. Admins may add `userId` to record cash for a resident (starts verified). |
| PUT | `/api/contributions/:id/verify` | Admin | Body: `status?` (`verified`/`rejected`), `reason` (required to reject) |

### Vendor quotes
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/campaigns/:id/vendor-quotes` | Resident | Quotes cheapest first, with a summary |
| POST | `/api/campaigns/:id/vendor-quotes` | Admin | Body: `vendorName`, `quotedAmount`, `vendorPhone?`, `notes?`, `attachmentUrl?`, `deliveryDays?`, `warrantyMonths?`, `contactPerson?`, `vendorEmail?`, `vendorAddress?`, `scope?` (e.g. "Transformer Replacement (100kVA)"), `inclusions?` (up to 8 short lines) |
| PUT | `/api/vendor-quotes/:id/select` | Admin | Select a vendor. `reason` is required if it isn't the cheapest quote. |

### Reconciliation and transparency
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/campaigns/:id/complete` | Admin | Body: `actualCost`, `completionNote?`, `receiptUrl?`, `costItems?` (up to 10 `{ label, amount }` that must add up exactly to `actualCost`; shown as the Spending Breakdown and in the PDF) |
| POST | `/api/campaigns/:id/reconcile` | Admin | Run and store the reconciliation (refused while contributions are pending) |
| GET | `/api/campaigns/:id/reconciliation` | Resident | The stored result, plus the caller's own row as `mine` |
| GET | `/api/campaigns/:id/transparency-report` | Resident | Full audit trail as JSON |
| GET | `/api/campaigns/:id/transparency-report/pdf` | Resident | Same report as a PDF download |
| GET | `/api/public/campaigns/:publicToken` | Public | Anonymized report for the share link |
| GET | `/api/public/campaigns/:publicToken/pdf` | Public | Anonymized PDF |

### Notifications, uploads and search
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| PUT | `/api/notifications/:id/read` | Resident | Mark one as read |
| POST | `/api/uploads/image` | Resident | `multipart/form-data` with `file` (JPG/PNG/WebP/HEIC, 4 MB max) and `purpose`. Returns the Cloudinary `url` to send with a campaign, contribution or quote. |
| GET | `/api/public/estates?q=` | Public | Estates whose name starts with `q` (2+ letters), for the Create Account screen |

Errors always look like `{ "error": { "message": "...", "code": "...", "details": [{ "field": "...", "message": "..." }] } }`. `code` appears only where the app has to act on it: `NOT_REGISTERED`, `SUSPENDED`, `REGISTRATION_CLOSED`, `INVALID_CREDENTIALS`.

## Reconciliation, in one paragraph

`variance = totalCollected - actualCost`, using verified contributions only. Each contributor's share of the variance is proportional to what they paid: a positive adjustment is a refund owed to them, a negative one is an extra balance they owe. Shares are split with the largest remainder method, so they add up to the variance exactly, with no Naira lost to rounding. The result is stored once in `reconciliations/{campaignId}` and can't be re-run.

## Notes for the frontend

- Poll `GET /campaigns/:id/progress` every 3 to 5 seconds while the page is visible. Refetch the contribution list only when `verifiedCount`, `pendingCount` or `updatedAt` change. Firestore's free tier allows 50k reads a day.
- All money is whole Naira integers.

## Deploying on Vercel

Set these in the Vercel project's environment variables:

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: from the service account JSON. The private key can be pasted as-is. Never give these a `VITE_` prefix.
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_APP_ID`: the public web config. The frontend build uses them for sign-in, and the API uses the key for phone sign-in.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

In the Firebase console, go to Authentication → Settings → Authorized domains and add the Vercel domain. Otherwise Google sign-in is refused on the deployed site.

Firestore rules: paste `firestore.rules` into Firebase console → Firestore → Rules and publish, or run `npx firebase-tools deploy --only firestore:rules --project cirf-b708c` after `firebase login`.
