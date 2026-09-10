import {
  billStatus,
  dueDate,
  escapeHtml,
  formatMoney,
  maintenanceStatus,
  monthLabel,
  parseYmd,
  recurrenceLabel,
  vehicleLabel,
  weekdayLong,
  ymd,
} from "./util.js";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, monthIndex, -startPad + i + 1);
    cells.push({ date: d, inMonth: false, ymd: ymd(d) });
  }
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, monthIndex, day);
    cells.push({ date: d, inMonth: true, ymd: ymd(d) });
  }
  while (cells.length % 7) {
    const d = new Date(year, monthIndex, days + (cells.length - startPad - days) + 1);
    cells.push({ date: d, inMonth: false, ymd: ymd(d) });
  }
  return cells;
}

export function itemsOnDay(cell, { bills, events, payments, maintenance, vehicles, vehicleTasks }, today) {
  const d = cell.date;
  const year = d.getFullYear();
  const month = d.getMonth();
  const dayItems = [];
  for (const bill of (bills || []).filter((b) => !b.archived)) {
    const due = dueDate(bill.dueDay, year, month);
    if (ymd(due) !== cell.ymd) continue;
    const status = billStatus(bill, payments, year, month, today);
    dayItems.push({
      kind: "bill",
      id: bill.id,
      title: bill.name,
      tone: status.tone,
      statusLabel: status.label,
      meta: `${formatMoney(bill.typicalAmount)} · ${status.label}`,
      href: `#/bills/${bill.id}`,
    });
  }
  for (const task of maintenance || []) {
    const doneToday = task.lastCompleted === cell.ymd;
    const dueToday = task.nextDue === cell.ymd;
    if (doneToday) {
      const recur = recurrenceLabel(task);
      dayItems.push({
        kind: "maintenance",
        id: task.id,
        title: task.name,
        tone: "paid",
        statusLabel: "Done",
        meta: recur ? `Done · ${recur}` : "Done",
        href: `#/maintenance/${task.id}`,
      });
    }
    if (dueToday && !doneToday) {
      const status = maintenanceStatus(task, today);
      const recur = recurrenceLabel(task);
      dayItems.push({
        kind: "maintenance",
        id: task.id,
        title: task.name,
        tone: status.tone,
        statusLabel: status.label,
        meta: recur ? `${status.label} · ${recur}` : status.label,
        href: `#/maintenance/${task.id}`,
      });
    }
  }
  for (const ev of events || []) {
    if (ev.date !== cell.ymd) continue;
    dayItems.push({
      kind: "event",
      id: ev.id,
      title: ev.title,
      tone: "event",
      statusLabel: "Event",
      meta: ev.notes || "Event",
      href: `#/event/${ev.id}`,
    });
  }
  const vehicleById = new Map((vehicles || []).map((v) => [v.id, v]));
  for (const task of vehicleTasks || []) {
    const vehicle = vehicleById.get(task.vehicleId);
    const label = vehicle ? vehicleLabel(vehicle) : "Vehicle";
    const href = `#/vehicles/${task.vehicleId}/tasks/${task.id}`;
    const title = `${label} · ${task.name}`;
    const doneToday = task.lastCompleted === cell.ymd;
    const dueToday = task.nextDue === cell.ymd;
    if (doneToday) {
      const recur = recurrenceLabel(task);
      dayItems.push({
        kind: "vehicle",
        id: task.id,
        title,
        tone: "paid",
        statusLabel: "Done",
        meta: recur ? `Done · ${recur}` : "Done",
        href,
      });
    }
    if (dueToday && !doneToday) {
      const status = maintenanceStatus(task, today);
      const recur = recurrenceLabel(task);
      dayItems.push({
        kind: "vehicle",
        id: task.id,
        title,
        tone: status.tone,
        statusLabel: status.label,
        meta: recur ? `${status.label} · ${recur}` : status.label,
        href,
      });
    }
  }
  return dayItems;
}

export function renderCalendar(root, state, handlers) {
  const { year, monthIndex, selectedYmd, bills, events, payments, maintenance, vehicles, vehicleTasks } =
    state;
  const today = startToday();
  const todayYmd = ymd(today);
  const cells = monthCells(year, monthIndex);
  const selected = selectedYmd || todayYmd;
  const selectedDate = parseYmd(selected);
  const dayState = { bills, events, payments, maintenance, vehicles, vehicleTasks };
  const selectedItems = itemsOnDay(
    { date: selectedDate, ymd: selected, inMonth: true },
    dayState,
    today
  );

  root.innerHTML = `
    <div class="month-head">
      <button class="icon-btn" data-act="prev" aria-label="Previous month">‹</button>
      <h2>${escapeHtml(monthLabel(year, monthIndex))}</h2>
      <button class="icon-btn" data-act="next" aria-label="Next month">›</button>
    </div>
    <div class="dow">${DOW.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="cal-grid">
      ${cells
        .map((cell) => {
          const items = itemsOnDay(cell, dayState, today);
          const fill = pickDayFill(items);
          const classes = ["day"];
          if (!cell.inMonth) classes.push("is-out");
          if (cell.ymd === todayYmd) classes.push("is-today");
          if (cell.ymd === selected) classes.push("is-selected");
          if (fill.fillClass) classes.push(fill.fillClass);
          const dots = fill.secondary
            .slice(0, 3)
            .map((it) => `<span class="dot ${markClasses(it)}"></span>`)
            .join("");
          return `<button class="${classes.join(" ")}" data-ymd="${cell.ymd}"${
            fill.fillKind ? ` data-fill="${fill.fillKind}"` : ""
          }>
            <span class="n">${cell.date.getDate()}</span>
            ${dots ? `<span class="dots">${dots}</span>` : ""}
          </button>`;
        })
        .join("")}
    </div>
    <div class="legend">
      <span class="legend-lead">Day color = category</span>
      <span><i class="swatch fill-bill"></i>Bills</span>
      <span><i class="swatch fill-maintenance"></i>Home</span>
      <span><i class="swatch fill-vehicle"></i>Vehicle</span>
      <span><i class="swatch fill-event"></i>Events</span>
      <span class="legend-note">Most urgent wins when a day has more than one · tiny dots show the rest</span>
    </div>
    <section class="day-sheet card">
      <h3>${escapeHtml(weekdayLong(selectedDate))}</h3>
      ${
        selectedItems.length
          ? `<div class="item-list">${selectedItems
              .map(
                (it) => `<a class="item" href="${it.href}">
                  <span class="rail ${markClasses(it)}"></span>
                  <span><b>${escapeHtml(it.title)}</b><small>${escapeHtml(it.meta)}</small></span>
                  <span class="chip ${chipClass(it)}">${escapeHtml(chipLabel(it))}</span>
                </a>`
              )
              .join("")}</div>`
          : `<div class="empty"><b>Nothing on this day</b>That’s fine — Nestor doesn’t need to be complete.</div>`
      }
      <div class="fab-row">
        <a class="btn btn-ghost" href="#/event/new?date=${selected}">Add event</a>
        <a class="btn btn-ghost" href="#/bills/new">Add bill</a>
        <a class="btn btn-ghost" href="#/maintenance/new?date=${selected}">Add task</a>
        <a class="btn btn-ghost" href="${vehicleFabHref(selected, vehicles)}">Vehicle</a>
      </div>
    </section>
  `;

  root.querySelector('[data-act="prev"]').onclick = () => handlers.shiftMonth(-1);
  root.querySelector('[data-act="next"]').onclick = () => handlers.shiftMonth(1);
  root.querySelectorAll(".day").forEach((btn) => {
    btn.onclick = () => handlers.selectDay(btn.dataset.ymd);
  });
}

function kindLabel(kind) {
  if (kind === "bill") return "Bill";
  if (kind === "maintenance") return "Home";
  if (kind === "vehicle") return "Vehicle";
  return "Event";
}

function categoryClass(kind) {
  if (kind === "bill") return "cat-bill";
  if (kind === "maintenance") return "cat-maintenance";
  if (kind === "vehicle") return "cat-vehicle";
  return "cat-event";
}

function statusMod(tone) {
  if (tone === "paid") return "is-done";
  if (tone === "unpaid") return "is-overdue";
  return "";
}

export function markClasses(it) {
  return [categoryClass(it.kind), statusMod(it.tone)].filter(Boolean).join(" ");
}

/** Alias for tests and older hooks — same category + status classes. */
export const markClass = markClasses;

/**
 * Urgency for the day-square fill. Highest wins; do not blend categories.
 * overdue unpaid bill > overdue home > other overdue > due soon > upcoming/event > done/paid
 */
export function urgencyRank(it) {
  if (it.tone === "unpaid" && it.kind === "bill") return 400;
  if (it.tone === "unpaid" && it.kind === "maintenance") return 300;
  if (it.tone === "unpaid") return 250;
  if (it.tone === "due") return 200;
  if (it.tone === "paid") return 50;
  return 100;
}

function categoryTiebreak(kind) {
  if (kind === "bill") return 4;
  if (kind === "maintenance") return 3;
  if (kind === "vehicle") return 2;
  return 1;
}

/**
 * Pick the category that paints the whole day cell, plus other categories as secondary dots.
 */
export function pickDayFill(items) {
  const list = items || [];
  if (!list.length) {
    return { fillKind: null, fillClass: "", winner: null, secondary: [] };
  }
  let winner = list[0];
  let best = urgencyRank(winner) * 10 + categoryTiebreak(winner.kind);
  for (let i = 1; i < list.length; i++) {
    const it = list[i];
    const score = urgencyRank(it) * 10 + categoryTiebreak(it.kind);
    if (score > best) {
      winner = it;
      best = score;
    }
  }
  const seen = new Set();
  const secondary = [];
  for (const it of list) {
    if (it.kind === winner.kind || seen.has(it.kind)) continue;
    seen.add(it.kind);
    secondary.push(it);
  }
  return {
    fillKind: winner.kind,
    fillClass: `fill-${winner.kind}`,
    winner,
    secondary,
  };
}

function chipClass(it) {
  if (it.kind === "event") return "cat-event";
  return it.tone || "";
}

function chipLabel(it) {
  if (it.kind === "event") return kindLabel(it.kind);
  return it.statusLabel || kindLabel(it.kind);
}

function vehicleFabHref(selected, vehicles) {
  const list = vehicles || [];
  if (list.length === 1) return `#/vehicles/${list[0].id}/tasks/new?date=${selected}`;
  return "#/vehicles";
}

function startToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
