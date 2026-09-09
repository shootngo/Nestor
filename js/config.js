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
    apiKey: "AIzaSyDIOkUTuXQ7vQHoUdC23CX2M_ihwHI6QKU",
    authDomain: "nestor-c2ae8.firebaseapp.com",
    projectId: "nestor-c2ae8",
    storageBucket: "nestor-c2ae8.firebasestorage.app",
    messagingSenderId: "487623313396",
    appId: "1:487623313396:web:bbcd15fc7608465c5a1ba1",
  },
  /* The two household logins (Email/Password). Case-insensitive. */
  householdEmails: [
    "shootngo@gmail.com",
    "jeannie.newall@gmail.com",
  ],
};
