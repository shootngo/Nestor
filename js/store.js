import { db, isConfigured } from "./firebase.js";
import { actor, isPreview } from "./auth.js";
import { nowIso, uid } from "./util.js";

const LOCAL_KEY = "nestor-local-v1";

let bills = [];
let events = [];
let payments = [];
const listeners = new Set();
let unsubs = [];

function emit() {
  const snap = { bills, events, payments };
  for (const fn of listeners) fn(snap);
}

function seedLocal() {
  const me = actor();
  const today = new Date();
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const lastPeriodDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastPeriod = `${lastPeriodDate.getFullYear()}-${String(lastPeriodDate.getMonth() + 1).padStart(2, "0")}`;
  const powerId = uid();
  const netId = uid();
  const waterId = uid();
  const data = {
    bills: [
      {
        id: powerId,
        name: "Power",
        typicalAmount: 168,
        dueDay: 8,
        notes: "Duke Energy",
        archived: false,
        createdBy: me,
        createdAt: nowIso(),
      },
      {
        id: netId,
        name: "Internet",
        typicalAmount: 79.99,
        dueDay: 15,
        notes: "",
        archived: false,
        createdBy: me,
        createdAt: nowIso(),
      },
      {
        id: waterId,
        name: "Water",
        typicalAmount: 42,
        dueDay: 22,
        notes: "",
        archived: false,
        createdBy: me,
        createdAt: nowIso(),
      },
    ],
    events: [
      {
        id: uid(),
        title: "Take out recycling",
        date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-12`,
        notes: "Blue bin",
        billId: "",
        createdBy: me,
        createdAt: nowIso(),
      },
    ],
    payments: [
      {
        id: uid(),
        billId: powerId,
        period: lastPeriod,
        amount: 154.2,
        paidOn: `${lastPeriod}-07`,
        notes: "",
        createdBy: me,
        createdAt: nowIso(),
      },
      {
        id: uid(),
        billId: netId,
        period,
        amount: 79.99,
        paidOn: `${period}-04`,
        notes: "",
        createdBy: me,
        createdAt: nowIso(),
      },
    ],
  };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  return data;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn(err);
  }
  return seedLocal();
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ bills, events, payments }));
  emit();
}

function mapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn({ bills, events, payments });
  return () => listeners.delete(fn);
}

export async function startStore() {
  stopStore();
  if (isPreview() || !isConfigured()) {
    const data = loadLocal();
    bills = data.bills || [];
    events = data.events || [];
    payments = data.payments || [];
    emit();
    return;
  }
  const firestore = db();
  unsubs = [
    firestore.collection("bills").onSnapshot((snap) => {
      bills = mapDocs(snap);
      emit();
    }),
    firestore.collection("events").onSnapshot((snap) => {
      events = mapDocs(snap);
      emit();
    }),
    firestore.collection("payments").onSnapshot((snap) => {
      payments = mapDocs(snap);
      emit();
    }),
  ];
}

export function stopStore() {
  for (const u of unsubs) {
    try {
      u();
    } catch (_) {
      /* ignore */
    }
  }
  unsubs = [];
}

function stampNew() {
  const createdBy = actor();
  return { createdBy, createdAt: nowIso(), updatedBy: createdBy, updatedAt: nowIso() };
}

function stampUpdate(existing) {
  return {
    createdBy: existing.createdBy || actor(),
    createdAt: existing.createdAt || nowIso(),
    updatedBy: actor(),
    updatedAt: nowIso(),
  };
}

async function writeDoc(collection, record) {
  if (isPreview() || !isConfigured()) {
    const listName = collection;
    const list = listName === "bills" ? bills : listName === "events" ? events : payments;
    const idx = list.findIndex((x) => x.id === record.id);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    if (listName === "bills") bills = list;
    if (listName === "events") events = list;
    if (listName === "payments") payments = list;
    saveLocal();
    return record;
  }
  const ref = db().collection(collection).doc(record.id);
  await ref.set(record, { merge: true });
  return record;
}

async function removeDoc(collection, id) {
  if (isPreview() || !isConfigured()) {
    if (collection === "bills") bills = bills.filter((x) => x.id !== id);
    if (collection === "events") events = events.filter((x) => x.id !== id);
    if (collection === "payments") payments = payments.filter((x) => x.id !== id);
    saveLocal();
    return;
  }
  await db().collection(collection).doc(id).delete();
}

export async function saveBill(input) {
  const existing = bills.find((b) => b.id === input.id) || {};
  const record = {
    id: input.id || uid(),
    name: String(input.name || "").trim(),
    typicalAmount: Number(input.typicalAmount) || 0,
    dueDay: Math.min(31, Math.max(1, Number(input.dueDay) || 1)),
    notes: String(input.notes || "").trim(),
    archived: Boolean(input.archived),
    ...(input.id ? stampUpdate(existing) : stampNew()),
  };
  if (!record.name) throw new Error("Give the bill a name.");
  return writeDoc("bills", record);
}

export async function deleteBill(id) {
  const related = payments.filter((p) => p.billId === id);
  for (const p of related) await removeDoc("payments", p.id);
  await removeDoc("bills", id);
}

export async function saveEvent(input) {
  const existing = events.find((e) => e.id === input.id) || {};
  const record = {
    id: input.id || uid(),
    title: String(input.title || "").trim(),
    date: input.date,
    notes: String(input.notes || "").trim(),
    billId: input.billId || "",
    ...(input.id ? stampUpdate(existing) : stampNew()),
  };
  if (!record.title) throw new Error("Give the event a title.");
  if (!record.date) throw new Error("Pick a date.");
  return writeDoc("events", record);
}

export async function deleteEvent(id) {
  await removeDoc("events", id);
}

export async function savePayment(input) {
  const existing =
    payments.find((p) => p.id === input.id) ||
    payments.find((p) => p.billId === input.billId && p.period === input.period) ||
    {};
  const record = {
    id: existing.id || input.id || uid(),
    billId: input.billId,
    period: input.period,
    amount: Number(input.amount),
    paidOn: input.paidOn || nowIso().slice(0, 10),
    notes: String(input.notes || "").trim(),
    ...(existing.id ? stampUpdate(existing) : stampNew()),
  };
  if (!record.billId) throw new Error("Missing bill.");
  if (!record.period) throw new Error("Pick a month.");
  if (!Number.isFinite(record.amount)) throw new Error("Enter the amount paid.");
  return writeDoc("payments", record);
}

export async function deletePayment(id) {
  await removeDoc("payments", id);
}

export function snapshot() {
  return { bills, events, payments };
}
