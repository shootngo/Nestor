import { byline, escapeHtml, ymd } from "./util.js";

export function renderEventDetail(root, event, { bills }, handlers) {
  if (!event) {
    root.innerHTML = `<div class="empty card"><b>Event not found</b><a href="#/">Back to calendar</a></div>`;
    return;
  }
  const linked = bills.find((b) => b.id === event.billId);
  root.innerHTML = `
    <div class="section-title"><h2>${escapeHtml(event.title)}</h2></div>
    <div class="card kv" style="margin-bottom:12px">
      <div><dt>Date</dt><dd>${escapeHtml(event.date)}</dd></div>
      ${event.notes ? `<div><dt>Notes</dt><dd>${escapeHtml(event.notes)}</dd></div>` : ""}
      ${linked ? `<div><dt>Linked bill</dt><dd><a href="#/bills/${linked.id}">${escapeHtml(linked.name)}</a></dd></div>` : ""}
      <p class="byline" style="margin:8px 0 0">${escapeHtml(byline(event))}</p>
    </div>
    <div class="btn-row">
      <a class="btn btn-ghost" href="#/event/${event.id}/edit">Edit</a>
      <button class="btn btn-danger" data-act="delete">Delete</button>
    </div>
  `;
  root.querySelector('[data-act="delete"]').onclick = () => handlers.remove();
}

export function renderEventForm(root, event, { bills }, handlers, presetDate) {
  const isNew = !event;
  const value = event || { title: "", date: presetDate || ymd(new Date()), notes: "", billId: "" };
  const options = [`<option value="">None</option>`]
    .concat(
      bills
        .filter((b) => !b.archived)
        .map(
          (b) =>
            `<option value="${b.id}" ${b.id === value.billId ? "selected" : ""}>${escapeHtml(b.name)}</option>`
        )
    )
    .join("");
  root.innerHTML = `
    <div class="section-title"><h2>${isNew ? "New event" : "Edit event"}</h2></div>
    <form class="card" data-form="event">
      <div class="field">
        <label for="ev-title">Title</label>
        <input id="ev-title" name="title" required maxlength="80" value="${escapeHtml(value.title)}" />
      </div>
      <div class="field">
        <label for="ev-date">Date</label>
        <input id="ev-date" name="date" type="date" required value="${escapeHtml(value.date)}" />
      </div>
      <div class="field">
        <label for="ev-notes">Notes</label>
        <textarea id="ev-notes" name="notes" maxlength="1000">${escapeHtml(value.notes || "")}</textarea>
      </div>
      <div class="field">
        <label for="ev-bill">Link a bill (optional)</label>
        <select id="ev-bill" name="billId">${options}</select>
      </div>
      <button class="btn btn-primary" type="submit">${isNew ? "Add event" : "Save"}</button>
    </form>
  `;
  root.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.save({
      id: event && event.id,
      title: fd.get("title"),
      date: fd.get("date"),
      notes: fd.get("notes"),
      billId: fd.get("billId"),
    });
  };
}
