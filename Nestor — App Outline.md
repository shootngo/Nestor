# Nestor — App Outline

**Concept:** A private household notebook app for me and my wife. Calendar-driven, with everything else hanging off it. Built on Firebase. Data should not be exposed on the open internet.

**Platform:** Android phones, two users (me and my wife).

## Core structure — Calendar
- The calendar is the home screen and main navigation
- Calendar events link out to a note page or fillable info page
- Color-coded at a glance: red = unpaid/overdue, yellow = due within ~7 days, green = paid/handled
- Same color logic applies to maintenance tasks

## Bills
- Section broken into individual bills (power, internet, etc.)
- Each shows monthly amount and paid/unpaid status
- Log amount paid each month so the app builds history
- Generated graphs showing trends and usage over time (e.g. power usage by month, year over year)

## Private Notes
- Passwords and sensitive info
- Safe combination stored unlabeled so it isn't identifiable as a safe combo
- This is the piece that needs the most protection

## Home Maintenance
- Recurring task schedule: HVAC filters, pest spraying, etc.
- Feeds the calendar

## Documents / Warranties
- Appliance receipts, warranty info, model numbers
- Photo of receipt attached to the entry
- Also tracks installment items (e.g. cell phone paid monthly through the bill) with start date and payoff end date, which drops onto the calendar

## Vehicles
- Oil changes, tag renewals

## Shared List
- Shopping / to-do list both users can edit

## Emergency Info Page
- Insurance policy numbers, account contacts, where important things are located
- Meant so my wife can find critical info fast if I'm on the road

## Cross-cutting features
- Push notifications for upcoming events, plus an alert if a bill hits 5 days past due and still unpaid
- Search bar covering all sections
- Export/backup to a file
- Entries show which user added them

## Branding
- Name: Nestor
- Icon: a house inside a bird's nest
- Splash screen: an egg hatching, breaking open to reveal the house inside

## Original idea, possibly still in play
- A physical QR code posted in a couple of spots in the house (office, etc.) that only this app can read — either decrypting stored info directly, or just deep-linking into the app

## Open questions I'd want feedback on
- Where should the sensitive data actually live — local-only on both phones, or encrypted in Firebase so it syncs?
- How to handle the private notes section so a stolen phone doesn't hand someone everything
- Whether a single shared account or two linked accounts makes more sense for two users

---

## Storage recommendation (added after discussion)

**Lean: split the data.** Don't put the sensitive stuff in Firebase at all.

- Keep passwords, safe combo, and emergency info **local-only** on each phone, encrypted with a shared passphrase both of you know.
- Sync only the calendar, bills, and maintenance through Firebase (encrypted at rest, but the server never holds plaintext).
- This way a stolen phone or a Firebase breach doesn't hand over the crown jewels.

**How the split still lets you see each other's changes:**
Each phone holds its own encrypted copy. When your wife adds or changes something, her phone encrypts it and pushes the ciphertext to Firebase. Your phone pulls it down and decrypts it locally. You both see everything, just like a shared account — the difference is the server never holds a readable version. The passphrase is the only key, and it lives on the phones, not in Firebase.

**Private notes specifically:** Add a separate unlock — biometric plus passphrase — so even someone who has the phone still has to crack that layer.

**Two users:** Go with two linked accounts sharing one household, not a single shared login. Cleaner audit trail, and you can revoke access if something goes sideways.

**QR code idea:** Fun, but shelve it for v1 — it's a novelty that adds attack surface.

That should be enough for another AI to poke holes in. The storage question is the one I'd push them hardest on.