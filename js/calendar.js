import {
  billStatus,
  dueDate,
  escapeHtml,
  formatMoney,
  maintenanceStatus,
  monthLabel,
  parseYmd,
  recurrenceLabel,
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

export function itemsOnDay(cell, { bills, events, payments, maintenance }, today) {
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
  return dayItems;
}

export function renderCalendar(root, state, handlers) {
  const { year, monthIndex, selectedYmd, bills, events, payments, maintenance } = state;
  const today = startToday();
  const todayYmd = ymd(today);
  const cells = monthCells(year, monthIndex);
  const selected = selectedYmd || todayYmd;
  const selectedDate = parseYmd(selected);
  const selectedItems = itemsOnDay(
    { date: selectedDate, ymd: selected, inMonth: true },
    { bills, events, payments, maintenance },
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
          const items = itemsOnDay(cell, { bills, events, payments, maintenance }, today);
          const classes = ["day"];
          if (!cell.inMonth) classes.push("is-out");
          if (cell.ymd === todayYmd) classes.push("is-today");
          if (cell.ymd === selected) classes.push("is-selected");
          const dots = items
            .slice(0, 4)
            .map((it) => `<span class="dot ${markClasses(it)}"></span>`)
            .join("");
          return `<button class="${classes.join(" ")}" data-ymd="${cell.ymd}">
            <span class="n">${cell.date.getDate()}</span>
            <span class="dots">${dots}</span>
          </button>`;
        })
        .join("")}
    </div>
    <div class="legend">
      <span><i class="dot cat-bill"></i>Bills</span>
      <span><i class="dot cat-maintenance"></i>Home</span>
      <span><i class="dot cat-event"></i>Events</span>
      <span class="legend-note">Ring = overdue · faded = done · chips show due soon</span>
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
  return "Event";
}

function categoryClass(kind) {
  if (kind === "bill") return "cat-bill";
  if (kind === "maintenance") return "cat-maintenance";
  return "cat-event";
}

function statusMod(tone) {
  if (tone === "paid") return "is-done";
  if (tone === "unpaid") return "is-overdue";
  return "";
}

function markClasses(it) {
  return [categoryClass(it.kind), statusMod(it.tone)].filter(Boolean).join(" ");
}

function chipClass(it) {
  if (it.kind === "event") return "cat-event";
  return it.tone || "";
}

function chipLabel(it) {
  if (it.kind === "event") return kindLabel(it.kind);
  return it.statusLabel || kindLabel(it.kind);
}

function startToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
