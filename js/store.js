import { db, isConfigured } from "./firebase.js";
import { actor, isPreview } from "./auth.js";
import { mergeServerDocs, rememberDelete, rememberSet, upsertInto } from "./store-sync.js";
import { addInterval, nowIso, parseYmd, uid, ymd } from "./util.js";

const LOCAL_KEY = "nestor-local-v1";
const COLLECTIONS = Object.freeze([
  "bills",
  "events",
  "payments",
  "maintenance",
  "vehicles",
  "vehicleTasks",
  "shopping",
]);

let bills = [];
let events = [];
let payments = [];
let maintenance = [];
let vehicles = [];
let vehicleTasks = [];
let shopping = [];
const listeners = new Set();
const errorListeners = new Set();
let unsubs = [];
let storeGen = 0;
let ready = emptyReady();
let storeErrors = {};
/** Local writes waiting for onSnapshot to catch up (`collection:id` → set|delete). */
const pendingWrites = new Map();

function emptyReady() {
  return {
    bills: false,
    events: false,
    payments: false,
    maintenance: false,
    vehicles: false,
    vehicleTasks: false,
    shopping: false,
  };
}

function allReady() {
  return {
    bills: true,
    events: true,
    payments: true,
    maintenance: true,
    vehicles: true,
    vehicleTasks: true,
    shopping: true,
  };
}

function snapshotData() {
  return {
    bills,
    events,
    payments,
    maintenance,
    vehicles,
    vehicleTasks,
    shopping,
    ready: { ...ready },
    errors: { ...storeErrors },
  };
}

function emit() {
  const snap = snapshotData();
  for (const fn of listeners) fn(snap);
}

export function onStoreError(fn) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}

function reportError(collection, err) {
  const code = (err && err.code) || "";
  const message = (err && err.message) || String(err);
  storeErrors[collection] = code ? `${code}: ${message}` : message;
  console.error(`[Nestor] Firestore ${collection} failed`, err);
  for (const fn of errorListeners) {
    try {
      fn({ collection, code, message, err });
    } catch (_) {
      /* ignore */
    }
  }
}

function getList(name) {
  if (name === "bills") return bills;
  if (name === "events") return events;
  if (name === "payments") return payments;
  if (name === "maintenance") return maintenance;
  if (name === "vehicles") return vehicles;
  if (name === "vehicleTasks") return vehicleTasks;
  if (name === "shopping") return shopping;
  return [];
}

function setList(name, list) {
  if (name === "bills") bills = list;
  if (name === "events") events = list;
  if (name === "payments") payments = list;
  if (name === "maintenance") maintenance = list;
  if (name === "vehicles") vehicles = list;
  if (name === "vehicleTasks") vehicleTasks = list;
  if (name === "shopping") shopping = list;
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

function seedVehicles(me) {
  const crvId = uid();
  const truckId = uid();
  return {
    vehicles: [
      {
        id: crvId,
        name: "CR-V",
        year: "2018",
        make: "Honda",
        model: "CR-V",
        plate: "",
        notes: "",
        createdBy: me,
        createdAt: nowIso(),
      },
      {
        id: truckId,
        name: "F-150",
        year: "2016",
        make: "Ford",
        model: "F-150",
        plate: "",
        notes: "",
        createdBy: me,
        createdAt: nowIso(),
      },
    ],
    vehicleTasks: [
      {
        id: uid(),
        vehicleId: crvId,
        name: "Oil change",
        kind: "oil",
        notes: "Full synthetic 0W-20",
        intervalCount: 6,
        intervalUnit: "months",
        nextDue: shiftYmd(4),
        lastCompleted: shiftYmd(-180),
        createdBy: me,
        createdAt: nowIso(),
      },
      {
        id: uid(),
        vehicleId: crvId,
        name: "Tag renewal",
        kind: "tag",
        notes: "",
        intervalCount: 1,
        intervalUnit: "years",
        nextDue: shiftYmd(22),
        lastCompleted: shiftYmd(-340),
        createdBy: me,
        createdAt: nowIso(),
      },
      {
        id: uid(),
        vehicleId: truckId,
        name: "Oil change",
        kind: "oil",
        notes: "",
        intervalCount: 5,
        intervalUnit: "months",
        nextDue: shiftYmd(-8),
        lastCompleted: shiftYmd(-160),
        createdBy: me,
        createdAt: nowIso(),
      },
      {
        id: uid(),
        vehicleId: truckId,
        name: "Tag renewal",
        kind: "tag",
        notes: "",
        intervalCount: 1,
        intervalUnit: "years",
        nextDue: shiftYmd(48),
        lastCompleted: "",
        createdBy: me,
        createdAt: nowIso(),
      },
    ],
  };
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

function seedShopping(me) {
  return [
    {
      id: uid(),
      text: "Milk",
      aisle: "Dairy",
      notes: "2%",
      checked: false,
      createdBy: me,
      createdAt: nowIso(),
    },
    {
      id: uid(),
      text: "Bananas",
      aisle: "Produce",
      notes: "",
      checked: false,
      createdBy: me,
      createdAt: nowIso(),
    },
    {
      id: uid(),
      text: "Paper towels",
      aisle: "Household",
      notes: "",
      checked: false,
      createdBy: me,
      createdAt: nowIso(),
    },
    {
      id: uid(),
      text: "Call about the HVAC quote",
      aisle: "",
      notes: "Filter size is in Home Maintenance",
      checked: false,
      createdBy: me,
      createdAt: nowIso(),
    },
    {
      id: uid(),
      text: "Coffee",
      aisle: "Pantry",
      notes: "",
      checked: true,
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
    shopping: seedShopping(me),
    ...seedVehicles(me),
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
      if (!Array.isArray(data.vehicles) || !Array.isArray(data.vehicleTasks)) {
        const seeded = seedVehicles(actor());
        if (!Array.isArray(data.vehicles)) data.vehicles = seeded.vehicles;
        if (!Array.isArray(data.vehicleTasks)) data.vehicleTasks = seeded.vehicleTasks;
      }
      if (!Array.isArray(data.shopping)) data.shopping = seedShopping(actor());
      return data;
    }
  } catch (err) {
    console.warn(err);
  }
  return seedLocal();
}

function saveLocal() {
  localStorage.setItem(
    LOCAL_KEY,
    JSON.stringify({ bills, events, payments, maintenance, vehicles, vehicleTasks, shopping })
  );
  emit();
}

function mapDocs(snap) {
  // Firestore's document id is canonical. Spreading data first avoids a stored
  // `id` field (or a reserved path like "new") collapsing many docs into one.
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(snapshotData());
  return () => listeners.delete(fn);
}

function useLocalStore() {
  return isPreview() || !isConfigured();
}

function applyRemoteSnap(gen, name, snap) {
  if (gen !== storeGen) return;
  applyServerDocs(name, mapDocs(snap));
  ready[name] = true;
  delete storeErrors[name];
  emit();
}

function failRemote(gen, name, err) {
  if (gen !== storeGen) return;
  ready[name] = true;
  reportError(name, err);
  emit();
}

export async function startStore() {
  const gen = ++storeGen;
  stopStore();
  storeGen = gen;
  if (useLocalStore()) {
    const data = loadLocal();
    bills = data.bills || [];
    events = data.events || [];
    payments = data.payments || [];
    maintenance = data.maintenance || [];
    vehicles = data.vehicles || [];
    vehicleTasks = data.vehicleTasks || [];
    shopping = data.shopping || [];
    ready = allReady();
    emit();
    return;
  }
  const firestore = db();
  // Always listen to every household collection, including shopping.
  unsubs = COLLECTIONS.map((name) =>
    firestore.collection(name).onSnapshot(
      (snap) => {
        try {
          applyRemoteSnap(gen, name, snap);
        } catch (err) {
          failRemote(gen, name, err);
        }
      },
      (err) => failRemote(gen, name, err)
    )
  );
  await Promise.all(
    COLLECTIONS.map(async (name) => {
      try {
        const snap = await firestore.collection(name).get();
        applyRemoteSnap(gen, name, snap);
      } catch (err) {
        failRemote(gen, name, err);
      }
    })
  );
}

export function stopStore() {
  storeGen += 1;
  for (const u of unsubs) {
    try {
      u();
    } catch (_) {
      /* ignore */
    }
  }
  unsubs = [];
  pendingWrites.clear();
  ready = emptyReady();
  storeErrors = {};
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
  if (useLocalStore()) {
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
  if (useLocalStore()) {
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
  const unit = ["days", "weeks", "months", "years"].includes(input.intervalUnit)
    ? input.intervalUnit
    : "days";
  return { intervalCount: count, intervalUnit: unit };
}

const TASK_KINDS = new Set(["oil", "tag", "inspection", "tires", "other"]);

function normalizeTaskKind(kind) {
  const value = String(kind || "").trim().toLowerCase();
  return TASK_KINDS.has(value) ? value : "other";
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

/** Hash path segments that must never be used as a vehicles/{id} document id. */
export const RESERVED_VEHICLE_IDS = new Set(["new", "edit", "tasks"]);

/**
 * Pick a Firestore document id for a vehicle write.
 * Blank or reserved ids ("new", "edit", "tasks") always create a fresh id so
 * Add vehicle cannot overwrite a singleton doc at vehicles/new.
 */
export function assignVehicleDocId(inputId, makeId = uid) {
  const id = String(inputId ?? "").trim();
  if (!id || RESERVED_VEHICLE_IDS.has(id)) return makeId();
  return id;
}

export async function saveVehicle(input) {
  const requested = String(input.id ?? "").trim();
  const id = assignVehicleDocId(requested);
  const existing = vehicles.find((v) => v.id === id) || {};
  const isUpdate = Boolean(requested && requested === id);
  const record = {
    id,
    name: String(input.name || "").trim(),
    year: String(input.year || "").trim(),
    make: String(input.make || "").trim(),
    model: String(input.model || "").trim(),
    plate: String(input.plate || "").trim(),
    notes: String(input.notes || "").trim(),
    ...(isUpdate ? stampUpdate(existing) : stampNew()),
  };
  if (!record.name) throw new Error("Give the vehicle a name.");
  return writeDoc("vehicles", record);
}

export async function deleteVehicle(id) {
  const related = vehicleTasks.filter((t) => t.vehicleId === id);
  for (const t of related) await removeDoc("vehicleTasks", t.id);
  await removeDoc("vehicles", id);
}

export async function saveVehicleTask(input) {
  const existing = vehicleTasks.find((t) => t.id === input.id) || {};
  const interval = normalizeInterval(input);
  const record = {
    id: input.id || uid(),
    vehicleId: String(input.vehicleId || existing.vehicleId || "").trim(),
    name: String(input.name || "").trim(),
    kind: normalizeTaskKind(input.kind || existing.kind),
    notes: String(input.notes || "").trim(),
    intervalCount: interval.intervalCount,
    intervalUnit: interval.intervalUnit,
    nextDue: String(input.nextDue || "").trim(),
    lastCompleted: String(input.lastCompleted || "").trim(),
    ...(input.id ? stampUpdate(existing) : stampNew()),
  };
  if (!record.vehicleId) throw new Error("Pick a vehicle.");
  if (!record.name) throw new Error("Give the reminder a name.");
  return writeDoc("vehicleTasks", record);
}

export async function deleteVehicleTask(id) {
  await removeDoc("vehicleTasks", id);
}

export async function markVehicleTaskDone(id, completedOn) {
  const existing = vehicleTasks.find((t) => t.id === id);
  if (!existing) throw new Error("Reminder not found.");
  const doneOn = String(completedOn || ymd(new Date())).trim();
  if (!doneOn) throw new Error("Pick the date you finished it.");
  let nextDue = existing.nextDue || "";
  if (existing.intervalCount > 0) {
    nextDue = ymd(addInterval(parseYmd(doneOn), existing.intervalCount, existing.intervalUnit));
  } else {
    nextDue = "";
  }
  return saveVehicleTask({
    ...existing,
    lastCompleted: doneOn,
    nextDue,
  });
}

export async function saveShopping(input) {
  const existing = shopping.find((s) => s.id === input.id) || {};
  const record = {
    id: input.id || uid(),
    text: String(input.text || "").trim(),
    aisle: String(input.aisle || "").trim(),
    notes: String(input.notes || "").trim(),
    checked: Boolean(input.checked),
    ...(input.id ? stampUpdate(existing) : stampNew()),
  };
  if (!record.text) throw new Error("What do you need?");
  return writeDoc("shopping", record);
}

export async function deleteShopping(id) {
  await removeDoc("shopping", id);
}

export async function toggleShopping(id) {
  const existing = shopping.find((s) => s.id === id);
  if (!existing) throw new Error("Item not found.");
  return saveShopping({
    ...existing,
    checked: !existing.checked,
  });
}

export async function clearCompletedShopping() {
  const done = shopping.filter((s) => s.checked);
  for (const item of done) await removeDoc("shopping", item.id);
}

export function snapshot() {
  return snapshotData();
}
