import {
  byline,
  escapeHtml,
  formatWhen,
  maintenanceStatus,
  recurrenceLabel,
  vehicleLabel,
  vehicleSubtitle,
  ymd,
} from "./util.js";

export const VEHICLE_TASK_KINDS = [
  { id: "oil", label: "Oil change", intervalCount: 6, intervalUnit: "months" },
  { id: "tag", label: "Tag renewal", intervalCount: 1, intervalUnit: "years" },
  { id: "inspection", label: "Inspection", intervalCount: 1, intervalUnit: "years" },
  { id: "tires", label: "Tires / rotation", intervalCount: 6, intervalUnit: "months" },
  { id: "other", label: "Other", intervalCount: "", intervalUnit: "months" },
];

export function kindLabel(kind) {
  return (VEHICLE_TASK_KINDS.find((k) => k.id === kind) || { label: "Reminder" }).label;
}

export function kindPreset(kind) {
  return VEHICLE_TASK_KINDS.find((k) => k.id === kind) || VEHICLE_TASK_KINDS[VEHICLE_TASK_KINDS.length - 1];
}

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

function nextTaskLine(tasks, today) {
  const sorted = sortTasks(tasks, today);
  const open = sorted.find((t) => {
    const st = maintenanceStatus(t, today);
    return st.tone !== "paid";
  });
  if (!open) return tasks.length ? "All caught up" : "No reminders yet";
  const st = maintenanceStatus(open, today);
  return `${open.name} · ${st.label}${open.nextDue ? ` ${formatWhen(open.nextDue)}` : ""}`;
}

export function renderVehicleList(root, { vehicles, vehicleTasks, ready, errors }, today = new Date()) {
  const loaded = !ready || (ready.vehicles && ready.vehicleTasks);
  const err = (errors && (errors.vehicles || errors.vehicleTasks)) || "";
  if (err) {
    root.innerHTML = `
      <div class="section-title">
        <h2>Vehicles</h2>
        <a class="btn btn-ghost" href="#/vehicles/new">Add vehicle</a>
      </div>
      <div class="empty card"><b>Could not load vehicles</b>${escapeHtml(err)}</div>
    `;
    return;
  }
  if (!loaded) {
    root.innerHTML = `
      <div class="section-title">
        <h2>Vehicles</h2>
        <a class="btn btn-ghost" href="#/vehicles/new">Add vehicle</a>
      </div>
      <div class="empty card"><b>Loading…</b>Checking household vehicles.</div>
    `;
    return;
  }
  const list = (vehicles || []).slice().sort((a, b) => vehicleLabel(a).localeCompare(vehicleLabel(b)));
  const tasks = vehicleTasks || [];
  root.innerHTML = `
    <div class="section-title">
      <h2>Vehicles</h2>
      <a class="btn btn-ghost" href="#/vehicles/new">Add vehicle</a>
    </div>
    <p class="fine">Oil changes, tag renewals, whatever you want on the calendar. Skip anything you don’t need.</p>
    ${
      list.length
        ? `<div class="stack">${list
            .map((vehicle) => {
              const mine = tasks.filter((t) => t.vehicleId === vehicle.id);
              const sub = vehicleSubtitle(vehicle);
              return `<a class="bill-card" href="#/vehicles/${vehicle.id}">
                <div class="row">
                  <h3>${escapeHtml(vehicleLabel(vehicle))}</h3>
                  <span class="chip vehicle">${mine.length}</span>
                </div>
                ${sub ? `<div class="row"><span class="fine">${escapeHtml(sub)}</span></div>` : ""}
                <div class="row"><span class="fine">${escapeHtml(nextTaskLine(mine, today))}</span></div>
                <div class="byline">${escapeHtml(byline(vehicle))}</div>
              </a>`;
            })
            .join("")}</div>`
        : `<div class="empty card"><b>No vehicles yet</b>Add a car and an oil-change or tag reminder — they will show up on the calendar.</div>`
    }
  `;
}

export function renderVehicleDetail(root, vehicle, tasks, handlers, today = new Date()) {
  if (!vehicle) {
    root.innerHTML = `<div class="empty card"><b>Vehicle not found</b><a href="#/vehicles">Back to vehicles</a></div>`;
    return;
  }
  const sub = vehicleSubtitle(vehicle);
  const sorted = sortTasks(tasks || [], today);
  root.innerHTML = `
    <div class="section-title">
      <h2>${escapeHtml(vehicleLabel(vehicle))}</h2>
      <a class="btn btn-ghost" href="#/vehicles/new">Add vehicle</a>
    </div>
    <div class="card kv" style="margin-bottom:12px">
      ${sub ? `<div><dt>Vehicle</dt><dd>${escapeHtml(sub)}</dd></div>` : ""}
      ${vehicle.plate && !sub.includes(vehicle.plate) ? `<div><dt>Plate</dt><dd>${escapeHtml(vehicle.plate)}</dd></div>` : ""}
      ${vehicle.notes ? `<div><dt>Notes</dt><dd>${escapeHtml(vehicle.notes)}</dd></div>` : ""}
      <p class="byline" style="margin:8px 0 0">${escapeHtml(byline(vehicle))}</p>
    </div>
    <div class="btn-row" style="margin-bottom:14px">
      <a class="btn btn-ghost" href="#/vehicles">All vehicles</a>
      <a class="btn btn-ghost" href="#/vehicles/${vehicle.id}/edit">Edit</a>
      <button class="btn btn-danger" data-act="delete">Delete</button>
    </div>

    <div class="section-title">
      <h2 style="font-size:1.15rem">Reminders</h2>
      <a class="btn btn-ghost" href="#/vehicles/${vehicle.id}/tasks/new">Add reminder</a>
    </div>
    <div class="btn-row" style="margin-bottom:12px">
      <a class="btn btn-ghost" href="#/vehicles/${vehicle.id}/tasks/new?kind=oil">Oil change</a>
      <a class="btn btn-ghost" href="#/vehicles/${vehicle.id}/tasks/new?kind=tag">Tag renewal</a>
    </div>
    ${
      sorted.length
        ? `<div class="stack">${sorted
            .map((task) => {
              const st = maintenanceStatus(task, today);
              return `<a class="bill-card" href="#/vehicles/${vehicle.id}/tasks/${task.id}">
                <div class="row">
                  <h3>${escapeHtml(task.name)}</h3>
                  <span class="chip ${st.tone}">${escapeHtml(st.label)}</span>
                </div>
                <div class="row"><span class="fine">${escapeHtml(dueLine(task))}</span></div>
                <div class="byline">${escapeHtml(byline(task))}</div>
              </a>`;
            })
            .join("")}</div>`
        : `<div class="empty card"><b>No reminders yet</b>Add an oil change or tag renewal — optional, whenever you want the nudge.</div>`
    }
    <p class="fine" style="margin-top:12px"><a href="#/vehicles">Back to vehicles</a></p>
  `;
  root.querySelector('[data-act="delete"]').onclick = () => handlers.remove();
}

export function renderVehicleForm(root, vehicle, handlers) {
  const isNew = !vehicle || !vehicle.id || vehicle.id === "new";
  const value = isNew ? { name: "", year: "", make: "", model: "", plate: "", notes: "" } : vehicle;
  root.innerHTML = `
    <div class="section-title">
      <h2>${isNew ? "New vehicle" : "Edit vehicle"}</h2>
      <a class="btn btn-ghost" href="#/vehicles">All vehicles</a>
    </div>
    <form class="card" data-form="vehicle">
      <div class="field">
        <label for="veh-name">Name</label>
        <input id="veh-name" name="name" required maxlength="80" value="${escapeHtml(value.name)}" placeholder="the truck, Jeannie’s car…" />
      </div>
      <div class="field">
        <label for="veh-year">Year (optional)</label>
        <input id="veh-year" name="year" inputmode="numeric" maxlength="4" value="${escapeHtml(value.year || "")}" placeholder="2016" />
      </div>
      <div class="field-split" style="margin-bottom:12px">
        <div class="field" style="margin:0">
          <label for="veh-make">Make</label>
          <input id="veh-make" name="make" maxlength="40" value="${escapeHtml(value.make || "")}" placeholder="Toyota" />
        </div>
        <div class="field" style="margin:0">
          <label for="veh-model">Model</label>
          <input id="veh-model" name="model" maxlength="40" value="${escapeHtml(value.model || "")}" placeholder="Camry" />
        </div>
      </div>
      <div class="field">
        <label for="veh-plate">Plate (optional)</label>
        <input id="veh-plate" name="plate" maxlength="20" value="${escapeHtml(value.plate || "")}" />
      </div>
      <div class="field">
        <label for="veh-notes">Notes</label>
        <textarea id="veh-notes" name="notes" maxlength="500">${escapeHtml(value.notes || "")}</textarea>
      </div>
      <button class="btn btn-primary" type="submit">${isNew ? "Add vehicle" : "Save"}</button>
    </form>
    <p class="fine" style="margin-top:12px"><a href="#/vehicles">Back to vehicles</a></p>
  `;
  root.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.save({
      id: isNew ? "" : vehicle.id,
      name: fd.get("name"),
      year: fd.get("year"),
      make: fd.get("make"),
      model: fd.get("model"),
      plate: fd.get("plate"),
      notes: fd.get("notes"),
    });
  };
}

export function renderVehicleTaskDetail(root, task, vehicle, handlers) {
  if (!task) {
    root.innerHTML = `<div class="empty card"><b>Reminder not found</b><a href="#/vehicles">Back to vehicles</a></div>`;
    return;
  }
  const today = new Date();
  const st = maintenanceStatus(task, today);
  const recur = recurrenceLabel(task);
  const back = vehicle ? `#/vehicles/${vehicle.id}` : "#/vehicles";
  root.innerHTML = `
    <div class="section-title">
      <h2>${escapeHtml(task.name)}</h2>
      <span class="chip ${st.tone}">${escapeHtml(st.label)}</span>
    </div>
    <div class="card kv" style="margin-bottom:12px">
      <div><dt>Vehicle</dt><dd>${escapeHtml(vehicleLabel(vehicle))}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(kindLabel(task.kind))}</dd></div>
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
      <a class="btn btn-ghost" href="#/vehicles/${task.vehicleId}/tasks/${task.id}/edit">Edit</a>
      <button class="btn btn-danger" data-act="delete">Delete</button>
    </div>
    <p class="fine" style="margin-top:12px"><a href="${back}">Back to ${escapeHtml(vehicleLabel(vehicle))}</a></p>
  `;

  root.querySelector('[data-act="delete"]').onclick = () => handlers.remove();
  root.querySelector('[data-form="done"]').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.markDone(fd.get("completedOn"));
  };
}

export function renderVehicleTaskForm(root, task, vehicle, handlers, { presetDate, presetKind } = {}) {
  const isNew = !task;
  const preset = kindPreset(task ? task.kind : presetKind);
  const value = task || {
    name: preset.id === "other" ? "" : preset.label,
    kind: preset.id,
    notes: "",
    intervalCount: preset.intervalCount,
    intervalUnit: preset.intervalUnit,
    nextDue: presetDate || "",
    lastCompleted: "",
  };
  const kindOptions = VEHICLE_TASK_KINDS.map(
    (k) => `<option value="${k.id}" ${value.kind === k.id ? "selected" : ""}>${escapeHtml(k.label)}</option>`
  ).join("");
  root.innerHTML = `
    <div class="section-title"><h2>${isNew ? "New reminder" : "Edit reminder"}</h2></div>
    ${vehicle ? `<p class="fine" style="margin-top:-8px">${escapeHtml(vehicleLabel(vehicle))}</p>` : ""}
    <form class="card" data-form="vehicle-task">
      <div class="field">
        <label for="vt-kind">Type</label>
        <select id="vt-kind" name="kind">${kindOptions}</select>
      </div>
      <div class="field">
        <label for="vt-name">Name</label>
        <input id="vt-name" name="name" required maxlength="80" value="${escapeHtml(value.name)}" placeholder="Oil change, tag renewal…" />
      </div>
      <div class="field">
        <label for="vt-due">Next due</label>
        <input id="vt-due" name="nextDue" type="date" value="${escapeHtml(value.nextDue || "")}" />
      </div>
      <div class="field">
        <label for="vt-count">Repeat every (optional)</label>
        <div class="field-split">
          <input id="vt-count" name="intervalCount" type="number" min="0" max="365" step="1" value="${escapeHtml(value.intervalCount || "")}" placeholder="0" />
          <select id="vt-unit" name="intervalUnit">
            <option value="days" ${value.intervalUnit === "days" ? "selected" : ""}>days</option>
            <option value="weeks" ${value.intervalUnit === "weeks" ? "selected" : ""}>weeks</option>
            <option value="months" ${value.intervalUnit === "months" ? "selected" : ""}>months</option>
            <option value="years" ${value.intervalUnit === "years" ? "selected" : ""}>years</option>
          </select>
        </div>
        <p class="fine">Leave blank for a one-time reminder.</p>
      </div>
      <div class="field">
        <label for="vt-last">Last completed</label>
        <input id="vt-last" name="lastCompleted" type="date" value="${escapeHtml(value.lastCompleted || "")}" />
      </div>
      <div class="field">
        <label for="vt-notes">Notes</label>
        <textarea id="vt-notes" name="notes" maxlength="500">${escapeHtml(value.notes || "")}</textarea>
      </div>
      <button class="btn btn-primary" type="submit">${isNew ? "Add reminder" : "Save"}</button>
    </form>
  `;

  const kindEl = root.querySelector("#vt-kind");
  const nameEl = root.querySelector("#vt-name");
  const countEl = root.querySelector("#vt-count");
  const unitEl = root.querySelector("#vt-unit");
  kindEl.onchange = () => {
    const next = kindPreset(kindEl.value);
    const known = VEHICLE_TASK_KINDS.map((k) => k.label);
    if (!nameEl.value.trim() || known.includes(nameEl.value.trim())) {
      nameEl.value = next.id === "other" ? "" : next.label;
    }
    if (next.intervalCount !== "") {
      countEl.value = next.intervalCount;
      unitEl.value = next.intervalUnit;
    }
  };

  root.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.save({
      id: task && task.id,
      vehicleId: (task && task.vehicleId) || (vehicle && vehicle.id),
      name: fd.get("name"),
      kind: fd.get("kind"),
      notes: fd.get("notes"),
      intervalCount: fd.get("intervalCount"),
      intervalUnit: fd.get("intervalUnit"),
      nextDue: fd.get("nextDue"),
      lastCompleted: fd.get("lastCompleted"),
    });
  };
}
