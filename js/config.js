/**
 * Nestor Firebase config — paste real keys here.
 *
 * Firebase Console → Project settings (gear) → Your apps → Web app → Config.
 * Keep householdEmails in sync with firestore.rules.
 *
 * Until keys are pasted, the app still loads: sign-in is disabled and you can
 * use Local preview (data stays on this device).
 */
window.NESTOR_CONFIG = {
  firebase: {
    apiKey: "PASTE_API_KEY",
    authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
    projectId: "PASTE_PROJECT_ID",
    storageBucket: "PASTE_PROJECT_ID.appspot.com",
    messagingSenderId: "PASTE_SENDER_ID",
    appId: "PASTE_APP_ID",
  },
  /* The two household logins (Email/Password). Case-insensitive. */
  householdEmails: [
    "PASTE_FRANK_EMAIL@example.com",
    "PASTE_WIFE_EMAIL@example.com",
  ],
};
