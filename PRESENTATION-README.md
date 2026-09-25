#  CIRF Project Defense Presentation

**Presenter:** Ernest Uwaoma
**Project:** CIRF, the Community Infrastructure Repair Fund Tracker
**Length:** about 9 minutes (6 if I skip the notes in *italics*)

---

## At a glance

| # | Section | Time |
| :---: | --- | :---: |
| 1 | Introduction | 30 sec |
| 2 | What CIRF does | 1 min |
| 3 | Why I chose this project | 1 min |
| 4 | Stack, frameworks and tools | 1 min 30 sec |
| 5 | The API and endpoints | 1 min |
| 6 | Webhooks | 20 sec |
| 7 | The frontend | 45 sec |
| 8 | How the codebase is organised | 1 min |
| 9 | Challenges I faced | 1 min 30 sec |
| 10 | Key takeaways | 45 sec |
| 11 | Closing | 30 sec |

---

## 1. Introduction

> Good morning, everyone.
>
> My name is **Ernest Uwaoma**, and my final-year project is **CIRF**, which stands for the **Community Infrastructure Repair Fund Tracker**.
>
> In the next few minutes I'll show you what it does, why I built it, how I built it, and what I learned along the way.

---

## 2. What CIRF Does

> In many Nigerian estates, when a transformer blows or a pole falls, the residents raise the money to fix it themselves.
>
> Raising the money is usually not the problem. **Trust** is. People ask: *Who has paid? How much did the repair really cost? Where did the extra money go?*
>
> CIRF answers those questions. It follows a repair from start to finish in **six steps**:

1. **Campaign:** the community lead creates a repair campaign and sets a target. CIRF calculates a fair levy for each household.
2. **Contribute:** residents pay into the estate's account and record the payment in CIRF with a proof of payment.
3. **Verify:** the lead checks each payment against the bank alert, then verifies or rejects it.
4. **Quotes:** the lead compares vendor quotes and picks one. If it isn't the cheapest, they must explain why.
5. **Complete:** when the work is done, the lead records the actual cost and uploads the receipt.
6. **Reconcile:** CIRF compares what was collected with what was spent, and works out each person's refund or balance. It then produces a **Transparency Report** that anyone can read.

> There are two kinds of users. **Community leads** manage campaigns, residents and payments. **Residents** contribute, follow progress, and see exactly where their money went.
>
> One important point: **CIRF does not handle money.** It records and checks payments. The money stays in the estate's own bank account.

---

## 3. Why I Chose This Project

> I chose CIRF because it's a **real problem** that I've seen around me.
>
> In General Alagbado, Lagos, residents were charged **₦20,000 per household** after a transformer fault. In Katampe 2, Abuja, residents raised **₦3.7 million** to fix a transformer themselves, and it ended in **public protests** about how the money was spent.
>
> These communities don't need a bank. They need a **simple, shared record** that everyone can trust. It also let me build a full-stack project: sign-in, an API, money calculations, uploads and reports.

---

## 4. Stack, Frameworks and Tools

| Layer | What I used | Why I chose it |
| --- | --- | --- |
| **Frontend** | **React 19** with **Vite** | React is what I know best, and Vite makes development fast. |
| **Routing** | **React Router** | Each screen has its own URL, so pages can be bookmarked and shared. |
| **Styling** | **CSS Modules** | Each component's styles stay separate, so nothing clashes. |
| **Backend** | **Express 5** on **Vercel** | One simple Node.js API, hosted for free next to the frontend. |
| **Authentication** | **Firebase Auth** | Secure email, phone and Google sign-in without storing passwords myself. |
| **Database** | **Firestore** through the **Firebase Admin SDK** | A free, flexible database. Only my server can reach it. |
| **File uploads** | **Cloudinary** | Stores photos and receipts for free. Firebase Storage needed a paid plan. |
| **PDF reports** | **pdfkit** | Generates the downloadable transparency report on the server. |
| **Validation** | **Zod** | Checks every request's data before it touches the database. |
| **Testing** | **Node test runner** and **Firebase Emulators** | Unit tests for the money logic, and full tests on a fake Firebase so I never touch real data. |
| **Icons and images** | **lucide-react** and **sharp** | Clean icons, and compressed images so pages load fast. |

> My main rule was: **everything must work on free tiers.** That's why I used Express on Vercel instead of Firebase Cloud Functions, and Cloudinary instead of Firebase Storage. Both of those Firebase services need a paid plan.
>
> I also used **JavaScript on both frontend and backend**, so I only had to think in one language.

---

## 5. The API and Endpoints

> The backend is one Express app with **about 45 endpoints**, grouped by what they manage.

| Group | Examples | What they do |
| --- | --- | --- |
| **Auth and users** | `POST /users/register`, `GET /users/me` | Sign up, profile, joining an estate |
| **Estates** | `GET /estates/:id/residents`, `POST /estates/:id/join-requests/:userId/approve` | Estate settings, residents, approvals |
| **Campaigns** | `POST /campaigns`, `POST /campaigns/:id/publish` | Create, edit, publish, track progress |
| **Contributions** | `POST /campaigns/:id/contributions`, `PUT /contributions/:id/verify` | Record, verify or reject payments |
| **Vendor quotes** | `POST /campaigns/:id/vendor-quotes`, `PUT /vendor-quotes/:id/select` | Add and choose quotes |
| **Reconciliation** | `POST /campaigns/:id/complete`, `POST /campaigns/:id/reconcile` | Close the repair and settle the money |
| **Reports** | `GET /campaigns/:id/transparency-report/pdf` | The report as data or as a PDF |
| **Notifications** | `GET /users/me/notifications` | In-app alerts |
| **Uploads** | `POST /uploads/image` | Photos, receipts and proofs of payment |
| **Public** | `GET /public/campaigns/:token` | The report for people without an account, with names hidden |

> Every request follows the same path:

1. The user signs in with Firebase and gets a **token**.
2. The app sends that token with every request.
3. The server **checks the token**, loads the user's **role** and **estate**, and blocks anything they're not allowed to do.
4. Only then does it read or write the database.

> The browser **never talks to the database directly**. My Firestore security rules simply say "deny everything", and all the real checks live in the API. That way there's only one place to get security right.

---

## 6. Webhooks

> CIRF **doesn't use webhooks**, and that was a deliberate choice.
>
> Webhooks are useful when an outside service needs to call you, for example a payment gateway saying "this payment succeeded". CIRF **records** payments. It doesn't process them, so there's nothing external calling back.
>
> For live updates, the app **checks a small progress endpoint every 15 seconds**, and only reloads when something has changed. That keeps it simple and within the free database limits.
>
> *If I added online payments in the future, with Paystack for example, a webhook would be the right way to confirm payments automatically.*

---

## 7. The Frontend

> The frontend has **about 20 screens**: the public Home, About and User Guide pages, the sign-in and sign-up flow, and the dashboard with Overview, Campaigns, Contributions, Vendor Quotes, Reconciliation, Transparency Report, Notifications and Settings.
>
> I built each screen from the **designs**, and every screen works from a **390-pixel phone** up to a full desktop.

> A few things I added for a better experience: **loading screens** instead of blank pages, **success messages** after every action, **pagination** on every list, and the rule that **residents only see what they should**.

---

## 8. How the Codebase Is Organised

> The project is one repository with the frontend and the backend side by side. Here's what each main folder holds:

| Folder | What's inside |
| --- | --- |
| **`src/pages/`** | One file per screen, like `Home.jsx`, `SignIn.jsx` and `Dashboard.jsx`. The campaign screens are grouped in `campaigns/` and the settings screens in `settings/`. |
| **`src/components/`** | Reusable pieces used across screens: buttons, form fields, charts, tables, the sidebar, dialogs, the loading skeletons and the pager. |
| **`src/auth/`** | Keeps track of who is signed in, and decides which screens they're allowed to open. |
| **`src/lib/`** | Small helpers: calling the API, uploading images, formatting naira and dates, and paging lists. |
| **`src/styles/`** | The shared colours, fonts and layouts that every screen uses. |
| **`server/routes/`** | The API endpoints, one file per area: campaigns, contributions, estates, quotes and so on. |
| **`server/middleware/`** | The checks that run before every request: is the token valid, and is this role allowed? |
| **`server/services/`** | The business logic: levy maths, reconciliation, the transparency report, PDFs and notifications. |
| **`server/e2e/`** | The end-to-end test that runs a whole campaign against the Firebase emulators. |
| **`api/index.js`** | The single entry point Vercel runs, which starts the Express app. |

> So when a community lead taps **Verify** on a screen in `pages`, the request goes through a helper in `lib`, reaches a route in `server/routes`, passes the checks in `middleware`, and the maths happens in `services`. Each folder has one job, which made the project easier to build and to test.

---

## 9. Challenges I Faced

**1. Deploying the API to Vercel**

> At first the live API kept crashing. It turned out to be three separate problems: the wrong Node version, two libraries that didn't agree on how to load each other, and the Firebase private key losing its line breaks inside Vercel's settings. I learned to **read the logs carefully and fix one thing at a time**.

**2. Staying on the free plan**

> Without Cloud Functions or Firebase Storage, I had to host the API on Vercel and send uploads to Cloudinary. I also made the app check a tiny "has anything changed?" endpoint instead of reloading everything, so it doesn't use up the free database reads.

**3. Making sure the money always adds up**

> What if two admins verify the same payment at the same moment? I used **database transactions**, so a payment can only be counted once. Refunds are split in proportion to what each person paid, and the rounding is handled so the numbers **add up to the exact naira**. These calculations have their own unit tests.

**4. Dates and time zones**

> The server runs on UTC, but users are in Nigeria. A payment made at 11:30 pm could show up on the wrong day, so I made sure every date is worked out in **Nigerian time**.

**5. Making every screen fit a phone**

> Most residents will use CIRF on a phone, so I tested every screen at phone, tablet and desktop sizes.

---

## 10. Key Takeaways

- **Plan the data first.** Once I knew what a campaign, a contribution and a reconciliation looked like, the screens were much easier to build.
- **Security belongs on the server.** Hiding a button isn't protection. The API checks every request.
- **Test the money logic.** I have **26 unit tests** and **21 end-to-end tests** that run a whole campaign, from sign-up to the final report.
- **Small details build trust.** Loading states, clear error messages and success messages make people feel the app is working for them.
- **Free tools go a long way** if you design around their limits.

---

## 11. Closing

> To close: CIRF takes something that usually runs on **WhatsApp messages and trust**, and gives it a **clear, shared record**, from the first contribution to the final receipt.
>
> It doesn't replace how communities already organise themselves. It gives them **structure, visibility and accountability**, so the next community doesn't have to protest to find out where their money went.
>
> **Every naira should have a traceable destination.**
>
> Thank you for listening. I'm happy to take your questions, or show you a live demo.

---

## If there's time for a demo

1. **Home page:** the story in one scroll.
2. **Sign in as the community lead:** show the Overview dashboard.
3. **Contributions:** open a pending payment, view the proof, and verify it.
4. **Vendor Quotes:** show the comparison and the chosen vendor.
5. **Transparency Report:** download the PDF and show the public link.
6. **Phone view:** open the same screens at phone size.

---

## Quick answers to likely questions

| Question | Short answer |
| --- | --- |
| **Can someone fake a payment?** | They can record one, but it stays **Pending** until the lead checks it against the bank alert and the proof of payment. Only verified payments count. |
| **What stops a resident from seeing admin data?** | The server checks the role and estate on every request, and the database refuses all direct access. |
| **Why not use a payment gateway?** | Estates already collect money through their bank accounts. CIRF focuses on accountability. A gateway such as Paystack would be a good next step. |
| **How do you know the reconciliation is correct?** | It's a separate, pure function with its own unit tests, and the end-to-end test checks the final refunds to the exact naira. |
| **What would you add next?** | Online payments with webhooks, SMS or WhatsApp notifications, and support for several campaigns running side by side in the reports. |
