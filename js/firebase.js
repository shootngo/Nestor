import { cfg, firebaseConfigured } from "./util.js";

let app = null;

export function isConfigured() {
  return firebaseConfigured();
}

export function initFirebase() {
  if (!firebaseConfigured()) return null;
  if (app) return app;
  if (!window.firebase) {
    throw new Error("Firebase SDK did not load. Check the network, then refresh.");
  }
  app = window.firebase.initializeApp(cfg().firebase);
  return app;
}

export function auth() {
  initFirebase();
  return window.firebase.auth();
}

export function db() {
  initFirebase();
  return window.firebase.firestore();
}
