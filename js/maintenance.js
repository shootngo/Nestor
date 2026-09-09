import {
  byline,
  escapeHtml,
  formatWhen,
  maintenanceStatus,
  recurrenceLabel,
  ymd,
} from "./util.js";

function sortTasks(tasks, today) {
  const rank = { unpaid: 0, due: 1, upcoming: 2, paid: 3 };
  return tasks.slice().sort((a, b) => {
    const sa = maintenanceStatus(a, today);
    const sb = maintenanceStatus(b, today);
    const ra = rank[sa.tone] ?? 9;
    const rb = rank[sb.tone] ?? 9;
    if (ra !== rb) return ra - rb;
    return String(a.nextDue || "9999").localeCompare(String(b.nextDue || "9999"));
  });
}

function dueLine(task) {
  const recur = recurrenceLabel(task);
  if (task.nextDue && recur) return `${recur} · next ${formatWhen(task.nextDue)}`;
  if (task.nextDue) return `Next due ${formatWhen(task.nextDue)}`;
  if (recur) return recur;
  return "No due date";
}

export function renderMaintenanceList(root, { maintenance }, today = new Date()) {
  const tasks = sortTasks(maintenance || [], today);
  root.innerHTML = `
    <div class="section-title">
      <h2>Home Maintenance</h2>
      <a class="btn btn-ghost" href="#/maintenance/new">Add task</a>
    </div>
    <p class="fine">Recurring upkeep — filters, pest spray, whatever you want on the calendar. Skip anything you don’t need.</p>
    ${
      tasks.length
        ? `<div class="stack">${tasks
            .map((task) => {
              const st = maintenanceStatus(task, today);
              return `<a class="bill-card" href="#/maintenance/${task.id}">
                <div class="row">
                  <h3>${escapeHtml(task.name)}</h3>
                  <span class="chip ${st.tone}">${escapeHtml(st.label)}</span>
                </div>
                <div class="row">
                  <span class="fine">${escapeHtml(dueLine(task))}</span>
                </div>
                <div class="byline">${escapeHtml(byline(task))}</div>
              </a>`;
            })
            .join("")}</div>`
        : `<div class="empty card"><b>No upkeep yet</b>Add a filter change or pest spray and it will show up on the calendar.</div>`
    }
  `;
}

export function renderMaintenanceDetail(root, task, handlers) {
  if (!task) {
    root.innerHTML = `<div class="empty card"><b>Task not found</b><a href="#/maintenance">Back to home maintenance</a></div>`;
    return;
  }
  const today = new Date();
  const st = maintenanceStatus(task, today);
  const recur = recurrenceLabel(task);

  root.innerHTML = `
    <div class="section-title">
      <h2>${escapeHtml(task.name)}</h2>
      <span class="chip ${st.tone}">${escapeHtml(st.label)}</span>
    </div>
    <div class="card kv" style="margin-bottom:12px">
      <div><dt>Next due</dt><dd>${task.nextDue ? escapeHtml(formatWhen(task.nextDue)) : "—"}</dd></div>
      <div><dt>Repeats</dt><dd>${recur ? escapeHtml(recur) : "One-time"}</dd></div>
      <div><dt>Last done</dt><dd>${task.lastCompleted ? escapeHtml(formatWhen(task.lastCompleted)) : "—"}</dd></div>
      ${task.notes ? `<div><dt>Notes</dt><dd>${escapeHtml(task.notes)}</dd></div>` : ""}
      <p class="byline" style="margin:8px 0 0">${escapeHtml(byline(task))}</p>
    </div>

    <form class="card" data-form="done" style="margin-bottom:14px">
      <div class="field">
        <label for="done-on">Mark done</label>
        <input id="done-on" name="completedOn" type="date" value="${ymd(today)}" required />
      </div>
      <p class="fine" style="margin:-4px 0 10px">
        ${
          task.intervalCount > 0
            ? "Saves the completion date and moves the next due forward by the interval."
            : "Records completion. Add an interval if you want the next due to advance."
        }
      </p>
      <button class="btn btn-primary" type="submit">Mark done</button>
    </form>

    <div class="btn-row">
      <a class="btn btn-ghost" href="#/maintenance/${task.id}/edit">Edit</a>
      <button class="btn btn-danger" data-act="delete">Delete</button>
    </div>
  `;

  root.querySelector('[data-act="delete"]').onclick = () => handlers.remove();
  root.querySelector('[data-form="done"]').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.markDone(fd.get("completedOn"));
  };
}

export function renderMaintenanceForm(root, task, handlers, presetDate) {
  const isNew = !task;
  const value = task || {
    name: "",
    notes: "",
    intervalCount: "",
    intervalUnit: "days",
    nextDue: presetDate || "",
    lastCompleted: "",
  };
  root.innerHTML = `
    <div class="section-title"><h2>${isNew ? "New task" : "Edit task"}</h2></div>
    <form class="card" data-form="maintenance">
      <div class="field">
        <label for="mnt-name">Name</label>
        <input id="mnt-name" name="name" required maxlength="80" value="${escapeHtml(value.name)}" placeholder="HVAC filter, pest spray…" />
      </div>
      <div class="field">
        <label for="mnt-due">Next due</label>
        <input id="mnt-due" name="nextDue" type="date" value="${escapeHtml(value.nextDue || "")}" />
      </div>
      <div class="field">
        <label for="mnt-count">Repeat every (optional)</label>
        <div class="field-split">
          <input id="mnt-count" name="intervalCount" type="number" min="0" max="365" step="1" value="${escapeHtml(value.intervalCount || "")}" placeholder="0" />
          <select id="mnt-unit" name="intervalUnit">
            <option value="days" ${value.intervalUnit === "days" ? "selected" : ""}>days</option>
            <option value="weeks" ${value.intervalUnit === "weeks" ? "selected" : ""}>weeks</option>
            <option value="months" ${value.intervalUnit === "months" ? "selected" : ""}>months</option>
          </select>
        </div>
        <p class="fine">Leave blank for a one-time reminder.</p>
      </div>
      <div class="field">
        <label for="mnt-last">Last completed</label>
        <input id="mnt-last" name="lastCompleted" type="date" value="${escapeHtml(value.lastCompleted || "")}" />
      </div>
      <div class="field">
        <label for="mnt-notes">Notes</label>
        <textarea id="mnt-notes" name="notes" maxlength="500">${escapeHtml(value.notes || "")}</textarea>
      </div>
      <button class="btn btn-primary" type="submit">${isNew ? "Add task" : "Save"}</button>
    </form>
  `;
  root.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.save({
      id: task && task.id,
      name: fd.get("name"),
      notes: fd.get("notes"),
      intervalCount: fd.get("intervalCount"),
      intervalUnit: fd.get("intervalUnit"),
      nextDue: fd.get("nextDue"),
      lastCompleted: fd.get("lastCompleted"),
    });
  };
}
