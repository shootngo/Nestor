import { byline, escapeHtml } from "./util.js";

export const AISLE_SUGGESTIONS = [
  "Produce",
  "Dairy",
  "Meat",
  "Bakery",
  "Frozen",
  "Pantry",
  "Household",
  "Other",
];

export function aisleLabel(aisle) {
  const value = String(aisle || "").trim();
  return value || "Other";
}

/** Unchecked first, then aisle (Other last), then createdAt. */
export function sortShopping(items) {
  return (items || []).slice().sort((a, b) => {
    const ac = a.checked ? 1 : 0;
    const bc = b.checked ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const aisleA = aisleLabel(a.aisle).toLowerCase();
    const aisleB = aisleLabel(b.aisle).toLowerCase();
    if (aisleA !== aisleB) {
      if (aisleA === "other") return 1;
      if (aisleB === "other") return -1;
      return aisleA.localeCompare(aisleB);
    }
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

export function groupOpenByAisle(items) {
  const groups = [];
  const map = new Map();
  for (const item of sortShopping(items).filter((i) => !i.checked)) {
    const key = aisleLabel(item.aisle);
    if (!map.has(key)) {
      const g = { aisle: key, items: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key).items.push(item);
  }
  return groups;
}

function shopRow(item) {
  const checked = Boolean(item.checked);
  const aisle = String(item.aisle || "").trim();
  return `<div class="shop-item${checked ? " is-checked" : ""}">
    <button class="shop-check" type="button" data-toggle="${escapeHtml(item.id)}" aria-pressed="${checked ? "true" : "false"}" aria-label="${checked ? "Mark not done" : "Mark done"}">
      ${checked ? "✓" : ""}
    </button>
    <a class="shop-body" href="#/shopping/${item.id}">
      <b class="shop-text">${escapeHtml(item.text)}</b>
      ${aisle ? `<span class="chip shopping">${escapeHtml(aisle)}</span>` : ""}
      ${item.notes ? `<span class="fine">${escapeHtml(item.notes)}</span>` : ""}
    </a>
  </div>`;
}

export function renderShoppingList(root, { shopping, ready, errors }, handlers) {
  const loaded = !ready || ready.shopping;
  const err = errors && errors.shopping;
  if (err) {
    root.innerHTML = `
      <div class="section-title">
        <h2>Shopping / To-do</h2>
        <a class="btn btn-ghost" href="#/shopping/new">Add item</a>
      </div>
      <div class="empty card"><b>Could not load the list</b>${escapeHtml(err)}</div>
    `;
    return;
  }
  if (!loaded) {
    root.innerHTML = `
      <div class="section-title">
        <h2>Shopping / To-do</h2>
        <a class="btn btn-ghost" href="#/shopping/new">Add item</a>
      </div>
      <div class="empty card"><b>Loading…</b>Checking the household list.</div>
    `;
    return;
  }

  const items = shopping || [];
  const open = groupOpenByAisle(items);
  const done = sortShopping(items).filter((i) => i.checked);
  const openCount = items.filter((i) => !i.checked).length;

  root.innerHTML = `
    <div class="section-title">
      <h2>Shopping / To-do</h2>
      <a class="btn btn-ghost" href="#/shopping/new">Add item</a>
    </div>
    <p class="fine">Shared list — both of you can add, check off, and delete. Stays off the calendar.</p>

    <form class="card shop-add" data-form="quick-add">
      <div class="shop-add-row">
        <input id="shop-quick" name="text" maxlength="120" required placeholder="Milk, bananas, call the plumber…" autocomplete="off" />
        <button class="btn btn-primary" type="submit">Add</button>
      </div>
      <div class="field" style="margin:8px 0 0">
        <label for="shop-quick-aisle">Aisle (optional)</label>
        <input id="shop-quick-aisle" name="aisle" list="shop-aisles" maxlength="40" placeholder="Produce, Dairy…" />
        <datalist id="shop-aisles">${AISLE_SUGGESTIONS.map((a) => `<option value="${escapeHtml(a)}"></option>`).join("")}</datalist>
      </div>
    </form>

    ${
      items.length
        ? `<div class="shop-list">
            ${
              open.length
                ? open
                    .map(
                      (g) => `<section class="shop-group">
                        <h3>${escapeHtml(g.aisle)} <span class="fine">${g.items.length}</span></h3>
                        <div class="stack">${g.items.map(shopRow).join("")}</div>
                      </section>`
                    )
                    .join("")
                : `<div class="empty card"><b>All caught up</b>Nothing left on the list.</div>`
            }
            ${
              done.length
                ? `<section class="shop-group shop-done">
                    <div class="section-title" style="margin-top:8px">
                      <h3 style="font-size:1.05rem;margin:0">Done <span class="fine">${done.length}</span></h3>
                      <button class="btn btn-ghost" type="button" data-act="clear">Clear completed</button>
                    </div>
                    <div class="stack">${done.map(shopRow).join("")}</div>
                  </section>`
                : ""
            }
          </div>`
        : `<div class="empty card"><b>List is empty</b>Add groceries or a to-do — both of you will see it.</div>`
    }
    ${items.length ? `<p class="fine" style="margin-top:12px">${openCount} open · ${done.length} done</p>` : ""}
  `;

  root.querySelector('[data-form="quick-add"]').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.add({
      text: fd.get("text"),
      aisle: fd.get("aisle"),
      notes: "",
      checked: false,
    });
  };
  root.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.onclick = () => handlers.toggle(btn.dataset.toggle);
  });
  const clearBtn = root.querySelector('[data-act="clear"]');
  if (clearBtn) clearBtn.onclick = () => handlers.clearCompleted();
}

export function renderShoppingDetail(root, item, handlers) {
  if (!item) {
    root.innerHTML = `<div class="empty card"><b>Item not found</b><a href="#/shopping">Back to the list</a></div>`;
    return;
  }
  const checked = Boolean(item.checked);
  const aisle = String(item.aisle || "").trim();
  root.innerHTML = `
    <div class="section-title">
      <h2>${escapeHtml(item.text)}</h2>
      <span class="chip ${checked ? "paid" : "shopping"}">${checked ? "Done" : "Open"}</span>
    </div>
    <div class="card kv" style="margin-bottom:12px">
      <div><dt>Aisle</dt><dd>${aisle ? escapeHtml(aisle) : "—"}</dd></div>
      ${item.notes ? `<div><dt>Notes</dt><dd>${escapeHtml(item.notes)}</dd></div>` : ""}
      <p class="byline" style="margin:8px 0 0">${escapeHtml(byline(item))}</p>
    </div>
    <div class="btn-row" style="margin-bottom:14px">
      <button class="btn btn-primary" type="button" data-act="toggle">${checked ? "Mark open" : "Mark done"}</button>
    </div>
    <div class="btn-row">
      <a class="btn btn-ghost" href="#/shopping/${item.id}/edit">Edit</a>
      <button class="btn btn-danger" data-act="delete">Delete</button>
    </div>
    <p class="fine" style="margin-top:12px"><a href="#/shopping">Back to the list</a></p>
  `;
  root.querySelector('[data-act="toggle"]').onclick = () => handlers.toggle();
  root.querySelector('[data-act="delete"]').onclick = () => handlers.remove();
}

export function renderShoppingForm(root, item, handlers) {
  const isNew = !item;
  const value = item || { text: "", aisle: "", notes: "", checked: false };
  const aisle = String(value.aisle || "").trim();
  root.innerHTML = `
    <div class="section-title"><h2>${isNew ? "New item" : "Edit item"}</h2></div>
    <form class="card" data-form="shopping">
      <div class="field">
        <label for="shop-text">Item</label>
        <input id="shop-text" name="text" required maxlength="120" value="${escapeHtml(value.text || "")}" placeholder="Milk, bananas, call the plumber…" />
      </div>
      <div class="field">
        <label for="shop-aisle">Aisle / category (optional)</label>
        <input id="shop-aisle" name="aisle" list="shop-form-aisles" maxlength="40" value="${escapeHtml(aisle)}" placeholder="Produce, Dairy…" />
        <datalist id="shop-form-aisles">${AISLE_SUGGESTIONS.map((a) => `<option value="${escapeHtml(a)}"></option>`).join("")}</datalist>
      </div>
      <div class="field">
        <label for="shop-notes">Notes</label>
        <textarea id="shop-notes" name="notes" maxlength="500">${escapeHtml(value.notes || "")}</textarea>
      </div>
      <button class="btn btn-primary" type="submit">${isNew ? "Add item" : "Save"}</button>
    </form>
    <p class="fine" style="margin-top:12px"><a href="#/shopping">Back to the list</a></p>
  `;
  root.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.save({
      id: item && item.id,
      text: fd.get("text"),
      aisle: fd.get("aisle"),
      notes: fd.get("notes"),
      checked: Boolean(item && item.checked),
    });
  };
}
