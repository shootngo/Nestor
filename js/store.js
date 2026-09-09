import { db, isConfigured } from "./firebase.js";
import { actor, isPreview } from "./auth.js";
import { mergeServerDocs, rememberDelete, rememberSet, upsertInto } from "./store-sync.js";
import { addInterval, nowIso, parseYmd, uid, ymd } from "./util.js";

const LOCAL_KEY = "nestor-local-v1";
const COLLECTIONS = ["bills", "events", "payments", "maintenance"];

let bills = [];
let events = [];
let payments = [];
let maintenance = [];
const listeners = new Set();
let unsubs = [];
/** Local writes waiting for onSnapshot to catch up (`collection:id` → set|delete). */
const pendingWrites = new Map();

function emit() {
  const snap = { bills, events, payments, maintenance };
  for (const fn of listeners) fn(snap);
}

function getList(name) {
  if (name === "bills") return bills;
  if (name === "events") return events;
  if (name === "payments") return payments;
  if (name === "maintenance") return maintenance;
  return [];
}

function setList(name, list) {
  if (name === "bills") bills = list;
  if (name === "events") events = list;
  if (name === "payments") payments = list;
  if (name === "maintenance") maintenance = list;
}

function upsertLocal(collection, record) {
  rememberSet(pendingWrites, collection, record);
  setList(collection, upsertInto(getList(collection), record));
}

function removeLocal(collection, id) {
  rememberDelete(pendingWrites, collection, id);
  setList(
    collection,
    getList(collection).filter((x) => x.id !== id)
  );
}

function applyServerDocs(collection, serverList) {
  setList(collection, mergeServerDocs(serverList, pendingWrites, collection));
}

function shiftYmd(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

function seedMaintenance(me) {
  return [
    {
      id: uid(),
      name: "Change HVAC filter",
      notes: "Hall closet — 20×25×1",
      intervalCount: 90,
      intervalUnit: "days",
      nextDue: shiftYmd(5),
      lastCompleted: shiftYmd(-85),
      createdBy: me,
      createdAt: nowIso(),
    },
    {
      id: uid(),
      name: "Pest spray",
      notes: "Exterior + garage",
      intervalCount: 3,
      intervalUnit: "months",
      nextDue: shiftYmd(-4),
      lastCompleted: shiftYmd(-95),
      createdBy: me,
      createdAt: nowIso(),
    },
    {
      id: uid(),
      name: "Clean gutters",
      notes: "",
      intervalCount: 6,
      intervalUnit: "months",
      nextDue: shiftYmd(28),
      lastCompleted: "",
      createdBy: me,
      createdAt: nowIso(),
    },
  ];
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
    maintenance: seedMaintenance(me),
  };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  return data;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (!Array.isArray(data.maintenance)) data.maintenance = seedMaintenance(actor());
      return data;
    }
  } catch (err) {
    console.warn(err);
  }
  return seedLocal();
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ bills, events, payments, maintenance }));
  emit();
}

function mapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn({ bills, events, payments, maintenance });
  return () => listeners.delete(fn);
}

export async function startStore() {
  stopStore();
  if (isPreview() || !isConfigured()) {
    const data = loadLocal();
    bills = data.bills || [];
    events = data.events || [];
    payments = data.payments || [];
    maintenance = data.maintenance || [];
    emit();
    return;
  }
  const firestore = db();
  unsubs = COLLECTIONS.map((name) =>
    firestore.collection(name).onSnapshot((snap) => {
      applyServerDocs(name, mapDocs(snap));
      emit();
    })
  );
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
  pendingWrites.clear();
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
    upsertLocal(collection, record);
    saveLocal();
    return record;
  }
  const ref = db().collection(collection).doc(record.id);
  await ref.set(record, { merge: true });
  upsertLocal(collection, record);
  emit();
  return record;
}

async function removeDoc(collection, id) {
  if (isPreview() || !isConfigured()) {
    removeLocal(collection, id);
    saveLocal();
    return;
  }
  await db().collection(collection).doc(id).delete();
  removeLocal(collection, id);
  emit();
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

function normalizeInterval(input) {
  const count = Math.max(0, Math.floor(Number(input.intervalCount) || 0));
  const unit = ["days", "weeks", "months"].includes(input.intervalUnit) ? input.intervalUnit : "days";
  return { intervalCount: count, intervalUnit: unit };
}

export async function saveMaintenance(input) {
  const existing = maintenance.find((t) => t.id === input.id) || {};
  const interval = normalizeInterval(input);
  const record = {
    id: input.id || uid(),
    name: String(input.name || "").trim(),
    notes: String(input.notes || "").trim(),
    intervalCount: interval.intervalCount,
    intervalUnit: interval.intervalUnit,
    nextDue: String(input.nextDue || "").trim(),
    lastCompleted: String(input.lastCompleted || "").trim(),
    ...(input.id ? stampUpdate(existing) : stampNew()),
  };
  if (!record.name) throw new Error("Give the task a name.");
  return writeDoc("maintenance", record);
}

export async function deleteMaintenance(id) {
  await removeDoc("maintenance", id);
}

export async function markMaintenanceDone(id, completedOn) {
  const existing = maintenance.find((t) => t.id === id);
  if (!existing) throw new Error("Task not found.");
  const doneOn = String(completedOn || ymd(new Date())).trim();
  if (!doneOn) throw new Error("Pick the date you finished it.");
  let nextDue = existing.nextDue || "";
  if (existing.intervalCount > 0) {
    nextDue = ymd(addInterval(parseYmd(doneOn), existing.intervalCount, existing.intervalUnit));
  } else {
    nextDue = "";
  }
  return saveMaintenance({
    ...existing,
    lastCompleted: doneOn,
    nextDue,
  });
}

export function snapshot() {
  return { bills, events, payments, maintenance };
}
