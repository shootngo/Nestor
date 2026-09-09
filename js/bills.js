import {
  billStatus,
  byline,
  escapeHtml,
  formatMoney,
  formatWhen,
  periodKey,
  ymd,
} from "./util.js";

let chart;

export function renderBillList(root, { bills, payments }, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const live = bills.filter((b) => !b.archived);
  root.innerHTML = `
    <div class="section-title">
      <h2>Bills</h2>
      <a class="btn btn-ghost" href="#/bills/new">Add bill</a>
    </div>
    <p class="fine">Typical amounts and due days are a convenience — skip anything you don’t need.</p>
    ${
      live.length
        ? `<div class="stack">${live
            .map((bill) => {
              const st = billStatus(bill, payments, year, month, today);
              return `<a class="bill-card" href="#/bills/${bill.id}">
                <div class="row">
                  <h3>${escapeHtml(bill.name)}</h3>
                  <span class="chip ${st.tone}">${escapeHtml(st.label)}</span>
                </div>
                <div class="row">
                  <span class="amount">${formatMoney(bill.typicalAmount)}</span>
                  <span class="fine">Due day ${bill.dueDay}</span>
                </div>
                <div class="byline">${escapeHtml(byline(bill))}</div>
              </a>`;
            })
            .join("")}</div>`
        : `<div class="empty card"><b>No bills yet</b>Add power, internet, or whatever you want to glance at on the calendar.</div>`
    }
  `;
}

export function renderBillDetail(root, bill, { payments, bills }, handlers) {
  if (!bill) {
    root.innerHTML = `<div class="empty card"><b>Bill not found</b><a href="#/bills">Back to bills</a></div>`;
    return;
  }
  const today = new Date();
  const st = billStatus(bill, payments, today.getFullYear(), today.getMonth(), today);
  const history = payments
    .filter((p) => p.billId === bill.id)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const period = periodKey(today);

  root.innerHTML = `
    <div class="section-title">
      <h2>${escapeHtml(bill.name)}</h2>
      <span class="chip ${st.tone}">${escapeHtml(st.label)}</span>
    </div>
    <div class="card kv" style="margin-bottom:12px">
      <div><dt>Typical amount</dt><dd class="amount">${formatMoney(bill.typicalAmount)}</dd></div>
      <div><dt>Due day</dt><dd>${bill.dueDay}</dd></div>
      ${bill.notes ? `<div><dt>Notes</dt><dd>${escapeHtml(bill.notes)}</dd></div>` : ""}
      <p class="byline" style="margin:8px 0 0">${escapeHtml(byline(bill))}</p>
    </div>
    <div class="btn-row" style="margin-bottom:14px">
      <a class="btn btn-ghost" href="#/bills/${bill.id}/edit">Edit</a>
      <button class="btn btn-danger" data-act="delete">Delete</button>
    </div>

    <h3 style="font-family:Fraunces,Georgia,serif">Log a payment</h3>
    <form class="card" data-form="pay" style="margin-bottom:14px">
      <div class="field">
        <label for="pay-period">Month</label>
        <input id="pay-period" name="period" type="month" value="${period}" required />
      </div>
      <div class="field">
        <label for="pay-amount">Amount paid</label>
        <input id="pay-amount" name="amount" type="number" min="0" step="0.01" value="${bill.typicalAmount || ""}" required />
      </div>
      <div class="field">
        <label for="pay-on">Paid on</label>
        <input id="pay-on" name="paidOn" type="date" value="${ymd(today)}" />
      </div>
      <div class="field">
        <label for="pay-notes">Note (optional)</label>
        <input id="pay-notes" name="notes" maxlength="200" />
      </div>
      <button class="btn btn-primary" type="submit">Save payment</button>
    </form>

    <h3 style="font-family:Fraunces,Georgia,serif">Amount over time</h3>
    ${
      history.length
        ? `<div class="chart-wrap"><canvas id="bill-chart"></canvas></div>`
        : `<div class="empty card"><b>No payments logged yet</b>Log a month and a simple trend will show here.</div>`
    }

    <h3 style="font-family:Fraunces,Georgia,serif;margin-top:16px">History</h3>
    <div class="card">
      ${
        history.length
          ? history
              .slice()
              .reverse()
              .map(
                (p) => `<div class="pay-row">
                  <div>
                    <b>${escapeHtml(p.period)}</b>
                    <div class="byline">${escapeHtml(byline(p, "Logged"))}${p.paidOn ? ` · paid ${escapeHtml(formatWhen(p.paidOn))}` : ""}</div>
                  </div>
                  <div>
                    <div class="amount">${formatMoney(p.amount)}</div>
                    <button class="btn btn-ghost" data-del-pay="${p.id}" style="min-height:34px;padding:6px 10px;margin-top:4px">Remove</button>
                  </div>
                </div>`
              )
              .join("")
          : `<p class="muted">Nothing logged.</p>`
      }
    </div>
  `;

  root.querySelector('[data-act="delete"]').onclick = () => handlers.remove();
  root.querySelector('[data-form="pay"]').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.logPayment({
      billId: bill.id,
      period: fd.get("period"),
      amount: fd.get("amount"),
      paidOn: fd.get("paidOn"),
      notes: fd.get("notes"),
    });
  };
  root.querySelectorAll("[data-del-pay]").forEach((btn) => {
    btn.onclick = () => handlers.removePayment(btn.dataset.delPay);
  });

  const canvas = root.querySelector("#bill-chart");
  if (canvas && window.Chart) {
    if (chart) chart.destroy();
    chart = new window.Chart(canvas, {
      type: "line",
      data: {
        labels: history.map((p) => p.period),
        datasets: [
          {
            label: bill.name,
            data: history.map((p) => Number(p.amount)),
            borderColor: "#7d8b74",
            backgroundColor: "rgba(125,139,116,0.18)",
            tension: 0.25,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: "#6b4a32",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (v) => "$" + v,
            },
            beginAtZero: true,
          },
        },
      },
    });
  }
}

export function renderBillForm(root, bill, handlers) {
  const isNew = !bill;
  const value = bill || { name: "", typicalAmount: "", dueDay: 1, notes: "" };
  root.innerHTML = `
    <div class="section-title"><h2>${isNew ? "New bill" : "Edit bill"}</h2></div>
    <form class="card" data-form="bill">
      <div class="field">
        <label for="bill-name">Name</label>
        <input id="bill-name" name="name" required maxlength="80" value="${escapeHtml(value.name)}" placeholder="Power, internet…" />
      </div>
      <div class="field">
        <label for="bill-amt">Typical monthly amount</label>
        <input id="bill-amt" name="typicalAmount" type="number" min="0" step="0.01" value="${escapeHtml(value.typicalAmount)}" />
      </div>
      <div class="field">
        <label for="bill-due">Due day of month</label>
        <input id="bill-due" name="dueDay" type="number" min="1" max="31" required value="${escapeHtml(value.dueDay)}" />
      </div>
      <div class="field">
        <label for="bill-notes">Notes</label>
        <textarea id="bill-notes" name="notes" maxlength="500">${escapeHtml(value.notes || "")}</textarea>
      </div>
      <button class="btn btn-primary" type="submit">${isNew ? "Add bill" : "Save"}</button>
    </form>
  `;
  root.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    handlers.save({
      id: bill && bill.id,
      name: fd.get("name"),
      typicalAmount: fd.get("typicalAmount"),
      dueDay: fd.get("dueDay"),
      notes: fd.get("notes"),
    });
  };
}
