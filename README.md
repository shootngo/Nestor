# Nestor

Private household notebook for Frank and his wife. Calendar-first, bills and home maintenance next. Completeness is optional.

**This repo is sections 1–2:** PWA shell, Email/Password auth, calendar, bills, payment history, and home maintenance. Private notes, documents, vehicles, shopping, emergency info, push, search, and full export are later sections.

Live (after GitHub Pages is on): https://shootngo.github.io/nestor/

## What is in sections 1–2

- **PWA** named Nestor (`id` `/nestor/`, cache `nestor-v5`) so it never collides with Nickey, Rosa, or Stashr.
- **Icon:** house in a nest (`icon-512.png`, `icon-192.png`, `apple-touch-icon.png`).
- **Splash:** egg hatching a house (`assets/splash.jpg`) — shown briefly on first load of a session.
- **Theme:** sage, cream, nest browns.
- **Calendar** month view. Bills and maintenance color **red** unpaid/overdue, **yellow** due within ~7 days, **green** paid/done. Events open a fillable detail page.
- **Bills** with name, typical monthly amount, due day. Log amount paid per month. Simple Chart.js trend on the bill page.
- **Home maintenance** recurring tasks (every N days/weeks/months, or just a next-due date). Mark done advances the next due. Same calendar colors as bills.
- **Attribution** on bills, payments, events, and maintenance (`createdBy` uid / email / displayName).

## Run locally

From the repo root:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/

With Firebase wired, sign in with a household Email/Password account. Use **Local preview** if you only want data on this device (`localStorage`, not synced).

## GitHub Pages

1. Repo **Settings → Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`.
4. Save. The site is https://shootngo.github.io/nestor/
5. If the repo is **private**, Pages needs GitHub Pro (or make the repo public). Firebase rules still lock the data to two emails — Pages only hosts the static shell.

Add `shootngo.github.io` as an authorized domain in Firebase (step 8 below).

## Firebase — exact Console steps

**Project `nestor-c2ae8` is already wired** in [`js/config.js`](js/config.js) and [`firestore.rules`](firestore.rules) (`shootngo@gmail.com`, `jeannie.newall@gmail.com`).

Frank still does these three steps in Firebase Console by hand:

1. **Enable Email/Password** — Authentication → Sign-in method → Email/Password → Enable → Save.
2. **Create both users** — Authentication → Users → Add user for `shootngo@gmail.com` and `jeannie.newall@gmail.com`.
3. **Publish rules** — Firestore → Rules → paste [`firestore.rules`](firestore.rules) → Publish.

The rest of this section is the original Console walkthrough (create project / paste keys are already done).

### 1. Create a project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. **Add project** → name it something like `nestor-home` (name is yours).
3. Google Analytics is optional; you can skip it.
4. Create.

### 2. Register a web app

1. Project overview → **Add app** → **Web** (`</>`).
2. App nickname: `Nestor`.
3. Do **not** need Firebase Hosting for GitHub Pages.
4. Register app.
5. Copy the `firebaseConfig` object.

### 3. Paste config into Nestor

In [`js/config.js`](js/config.js) replace:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

Leave `measurementId` out unless you turned Analytics on.

### 4. Enable Email/Password

1. **Build → Authentication → Get started** (if prompted).
2. **Sign-in method**.
3. **Email/Password** → Enable → Save.
4. Do **not** enable Email link / passwordless for v1.

There is **no public sign-up** in the app. Only Console-created users can sign in.

### 5. Create the two household users

1. Authentication → **Users → Add user**.
2. Add Frank’s email + a password.
3. Add your wife’s email + a password.
4. Optional: after first sign-in, set a display name in Nestor → **More** (stored on Auth and used as `createdBy.displayName`).

### 6. Paste the two emails into the app

In [`js/config.js`](js/config.js):

```js
householdEmails: [
  "frank@example.com",
  "wife@example.com",
],
```

The client uses this list to reject anyone else after sign-in. **Real lock-down is the Firestore rules.**

### 7. Create Firestore

1. **Build → Firestore Database → Create database**.
2. Start in **production mode**.
3. Pick a location (pick once; you cannot change it later).
4. Open **Rules**.
5. Replace the rules with the contents of [`firestore.rules`](firestore.rules).
6. Change the two placeholder emails to the **same two addresses, lowercase**:

```
'frank@example.com',
'wife@example.com'
```

7. **Publish**.

### 8. Authorized domains (GitHub Pages)

1. Authentication → **Settings → Authorized domains**.
2. Keep `localhost` and `PROJECT_ID.firebaseapp.com`.
3. **Add domain**: `shootngo.github.io`

Without this, sign-in from Pages will fail.

### 9. Remaining Console work (checklist)

Config and rules in this repo are already filled in for `nestor-c2ae8`. **Never commit passwords or service account keys.**

| Where | Status |
| --- | --- |
| `js/config.js` → `firebase.*` | Done (`nestor-c2ae8`) |
| `js/config.js` → `householdEmails` | Done |
| `firestore.rules` household list | Done (lowercase emails) |
| Firebase Auth: Email/Password on | **Frank — Console** |
| Firebase Auth users | **Frank — create both accounts** |
| Firestore → Rules → Publish | **Frank — publish `firestore.rules`** |
| Auth authorized domains | `shootngo.github.io` + `localhost` |

## Firestore shape (sections 1–2)

Shared household collections — both users read/write everything. Every write stamps `createdBy`:

```
{ uid, email, displayName }
```

```
events/{id}
  title, date (YYYY-MM-DD), notes, billId?, createdBy, createdAt, updatedBy, updatedAt

bills/{id}
  name, typicalAmount, dueDay (1–31), notes, archived,
  createdBy, createdAt, updatedBy, updatedAt

payments/{id}
  billId, period (YYYY-MM), amount, paidOn (YYYY-MM-DD), notes,
  createdBy, createdAt, updatedBy, updatedAt

maintenance/{id}
  name, notes, intervalCount (0 = one-time), intervalUnit (days|weeks|months),
  nextDue (YYYY-MM-DD), lastCompleted (YYYY-MM-DD),
  createdBy, createdAt, updatedBy, updatedAt
```

One payment document per bill per month (saving again updates that month). Marking a maintenance task done sets `lastCompleted` and, when an interval is set, advances `nextDue`.

## Security — how Frank locks it down

1. Publish `firestore.rules` with **only** the two emails.
2. Do not enable other Auth providers.
3. Do not add a Sign up screen.
4. Production-mode Firestore (deny by default except the four collections above).
5. Optional later: custom claims (`household: true`) instead of an email list.

The allowlist in `js/config.js` is a courtesy. Anyone can edit a copy of the client. **Rules are the lock.**

The shell can be cached offline. Live calendar/bill/maintenance data needs the network (Firestore). Local preview is the exception.

## Add to Home Screen (Android)

1. Open the Pages URL in Chrome.
2. Menu → **Add to Home screen** / **Install app**.
3. You should see **Nestor** and the nest icon — not Nickey, Rosa, or Stashr.

## Out of scope (do not expect these yet)

Encrypted private notes, documents/warranties, vehicles, shopping/todo, emergency info, FCM push, global search, full export.
