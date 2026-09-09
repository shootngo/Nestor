import { auth, isConfigured } from "./firebase.js";
import { actorFrom, isHouseholdEmail } from "./util.js";

const PREVIEW_USER = {
  uid: "local-preview",
  email: "preview@nestor.local",
  displayName: "Preview",
};

let current = null;
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(current);
}

export function onAuth(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function currentUser() {
  return current;
}

export function actor() {
  return actorFrom(current);
}

export function isPreview() {
  return Boolean(current && current.uid === PREVIEW_USER.uid);
}

export async function startAuth() {
  if (!isConfigured()) {
    current = null;
    emit();
    return;
  }
  auth().onAuthStateChanged(async (user) => {
    if (!user) {
      current = null;
      emit();
      return;
    }
    if (!isHouseholdEmail(user.email)) {
      console.warn("Nestor: signed-in email is not on the household list.");
      await auth().signOut();
      return;
    }
    current = user;
    emit();
  });
}

export async function signIn(email, password) {
  if (!isConfigured()) throw new Error("Paste Firebase keys into js/config.js first.");
  const cred = await auth().signInWithEmailAndPassword(email.trim(), password);
  if (!isHouseholdEmail(cred.user.email)) {
    await auth().signOut();
    throw new Error("This email is not one of the two household accounts.");
  }
  current = cred.user;
  emit();
  return cred.user;
}

export async function signOut() {
  if (isPreview()) {
    current = null;
    emit();
    return;
  }
  if (isConfigured()) await auth().signOut();
  current = null;
  emit();
}

export function enterPreview() {
  current = { ...PREVIEW_USER };
  emit();
  return current;
}

export async function setDisplayName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return;
  if (isPreview()) {
    current = { ...current, displayName: trimmed };
    emit();
    return;
  }
  if (current && current.updateProfile) {
    await current.updateProfile({ displayName: trimmed });
    current = auth().currentUser;
    emit();
  }
}
