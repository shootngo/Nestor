export function cfg() {
  return window.NESTOR_CONFIG || { firebase: {}, householdEmails: [] };
}

export function firebaseConfigured() {
  const key = (cfg().firebase && cfg().firebase.apiKey) || "";
  return Boolean(key) && !String(key).startsWith("PASTE_");
}

export function householdEmails() {
  return (cfg().householdEmails || [])
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e && !e.startsWith("paste_"));
}

export function isHouseholdEmail(email) {
  const list = householdEmails();
  if (!list.length) return true;
  return list.includes(String(email || "").toLowerCase());
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function ymd(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYmd(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function periodKey(date) {
  const d = date instanceof Date ? date : parseYmd(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(a, b) {
  const ms = startOfDay(a) - startOfDay(b);
  return Math.round(ms / 86400000);
}

export function dueDate(dueDay, year, monthIndex) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, Number(dueDay) || 1), last);
  return new Date(year, monthIndex, day);
}

export function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function weekdayLong(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function displayNameOf(person) {
  if (!person) return "Someone";
  return person.displayName || (person.email || "").split("@")[0] || "Someone";
}

export function byline(record, verb = "Added") {
  const who = displayNameOf(record && record.createdBy);
  const when = record && record.createdAt ? formatWhen(record.createdAt) : "";
  return when ? `${verb} by ${who} · ${when}` : `${verb} by ${who}`;
}

export function formatWhen(value) {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value.seconds) return new Date(value.seconds * 1000);
  return null;
}

export function nowIso() {
  return new Date().toISOString();
}

export function actorFrom(user) {
  if (!user) return { uid: "", email: "", displayName: "Someone" };
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || (user.email || "").split("@")[0] || "Someone",
  };
}

/**
 * Color on calendar: red unpaid/overdue, yellow due within ~7 days, green paid.
 */
export function billStatus(bill, payments, year, monthIndex, today = new Date()) {
  const period = `${year}-${pad2(monthIndex + 1)}`;
  const payment = (payments || []).find((p) => p.billId === bill.id && p.period === period);
  if (payment) return { tone: "paid", label: "Paid", payment };
  const due = dueDate(bill.dueDay, year, monthIndex);
  const delta = daysBetween(due, today);
  if (delta < 0) return { tone: "unpaid", label: "Unpaid", due };
  if (delta <= 7) return { tone: "due", label: "Due soon", due };
  return { tone: "upcoming", label: "Upcoming", due };
}

export function uid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const INTERVAL_UNITS = { days: "day", weeks: "week", months: "month" };

export function addInterval(date, count, unit) {
  const src = date instanceof Date ? date : parseYmd(date);
  const n = Math.max(1, Number(count) || 1);
  const d = new Date(src.getFullYear(), src.getMonth(), src.getDate());
  if (unit === "weeks") {
    d.setDate(d.getDate() + n * 7);
    return d;
  }
  if (unit === "months") {
    const day = d.getDate();
    const result = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, last));
    return result;
  }
  d.setDate(d.getDate() + n);
  return d;
}

export function recurrenceLabel(task) {
  const n = Number(task && task.intervalCount) || 0;
  if (n <= 0) return "";
  const unit = INTERVAL_UNITS[task.intervalUnit] ? task.intervalUnit : "days";
  const base = INTERVAL_UNITS[unit];
  return n === 1 ? `Every ${base}` : `Every ${n} ${base}s`;
}

/**
 * Color on calendar: red overdue, yellow due within ~7 days, green done/handled.
 */
export function maintenanceStatus(task, today = new Date()) {
  if (task.lastCompleted && !task.nextDue) {
    return { tone: "paid", label: "Done" };
  }
  if (!task.nextDue) {
    return { tone: "upcoming", label: "Unscheduled" };
  }
  const due = parseYmd(task.nextDue);
  const done = task.lastCompleted ? parseYmd(task.lastCompleted) : null;
  if (done && startOfDay(done).getTime() >= startOfDay(due).getTime()) {
    return { tone: "paid", label: "Done", due };
  }
  const delta = daysBetween(due, today);
  if (delta < 0) return { tone: "unpaid", label: "Overdue", due };
  if (delta <= 7) return { tone: "due", label: "Due soon", due };
  return { tone: "upcoming", label: "Upcoming", due };
}
