# Nestor

Private household notebook for Frank and his wife. Calendar-first, bills next. Completeness is optional.

**This repo is section 1 only:** PWA shell, Email/Password auth, calendar, bills, and payment history. Home maintenance, private notes, documents, vehicles, shopping, emergency info, push, search, and full export are later sections.

Live (after GitHub Pages is on): https://shootngo.github.io/nestor/

## What is in section 1

- **PWA** named Nestor (`id` `/nestor/`, cache `nestor-v2`) so it never collides with Nickey, Rosa, or Stashr.
- **Icon:** house in a nest (`icon-512.png`, `icon-192.png`, `apple-touch-icon.png`).
- **Splash:** egg hatching a house (`assets/splash.jpg`) — shown briefly on first load of a session.
- **Theme:** sage, cream, nest browns.
- **Calendar** month view. Bills color **red** unpaid/overdue, **yellow** due within ~7 days, **green** paid. Events open a fillable detail page.
- **Bills** with name, typical monthly amount, due day. Log amount paid per month. Simple Chart.js trend on the bill page.
- **Attribution** on bills, payments, and events (`createdBy` uid / email / displayName).

## Run locally

From the repo root:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/

With the placeholder Firebase config, use **Local preview** on the sign-in screen. Preview data stays in this browser’s `localStorage`. It is not synced.

## GitHub Pages

1. Repo **Settings → Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`.
4. Save. The site is https://shootngo.github.io/nestor/
5. If the repo is **private**, Pages needs GitHub Pro (or make the repo public). Firebase rules still lock the data to two emails — Pages only hosts the static shell.

Add `shootngo.github.io` as an authorized domain in Firebase (step 8 below).

## Firebase — exact Console steps

Paste keys into [`js/config.js`](js/config.js). Keep the two household emails in sync with [`firestore.rules`](firestore.rules).

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

### 9. What Frank must paste (checklist)

| Where | What |
| --- | --- |
| `js/config.js` → `firebase.*` | Web app config from Project settings |
| `js/config.js` → `householdEmails` | Frank’s email + wife’s email |
| `firestore.rules` household list | The same two emails, lowercase |
| Firebase Auth users | Those two accounts, Email/Password |
| Auth authorized domains | `shootngo.github.io` + `localhost` |

Commit the edited `js/config.js` and `firestore.rules` (they are not secrets in the Firebase web-app sense, but they *are* your project identifiers). **Never commit passwords.**

## Firestore shape (section 1)

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
```

One payment document per bill per month (saving again updates that month).

## Security — how Frank locks it down

1. Publish `firestore.rules` with **only** the two emails.
2. Do not enable other Auth providers.
3. Do not add a Sign up screen.
4. Production-mode Firestore (deny by default except the three collections above).
5. Optional later: custom claims (`household: true`) instead of an email list.

The allowlist in `js/config.js` is a courtesy. Anyone can edit a copy of the client. **Rules are the lock.**

The shell can be cached offline. Live calendar/bill data needs the network (Firestore). Local preview is the exception.

## Add to Home Screen (Android)

1. Open the Pages URL in Chrome.
2. Menu → **Add to Home screen** / **Install app**.
3. You should see **Nestor** and the nest icon — not Nickey, Rosa, or Stashr.

## Out of scope (do not expect these yet)

Home maintenance, encrypted private notes, documents/warranties, vehicles, shopping/todo, emergency info, FCM push, global search, full export.
