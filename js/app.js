import {
  currentUser,
  enterPreview,
  isPreview,
  onAuth,
  setDisplayName,
  signIn,
  signOut,
  startAuth,
} from "./auth.js";
import {
  deleteBill,
  deleteEvent,
  deleteMaintenance,
  deletePayment,
  markMaintenanceDone,
  saveBill,
  saveEvent,
  saveMaintenance,
  savePayment,
  startStore,
  stopStore,
  subscribe,
} from "./store.js";
import { escapeHtml, firebaseConfigured, householdEmails, ymd } from "./util.js";
import { renderCalendar } from "./calendar.js";
import { renderBillDetail, renderBillForm, renderBillList } from "./bills.js";
import { renderEventDetail, renderEventForm } from "./events.js";
import {
  renderMaintenanceDetail,
  renderMaintenanceForm,
  renderMaintenanceList,
} from "./maintenance.js";

const view = document.getElementById("view");
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const splash = document.getElementById("splash");
const toastEl = document.getElementById("toast");
const whoEl = document.getElementById("who");
const tabbar = document.getElementById("tabbar");

let data = { bills: [], events: [], payments: [], maintenance: [] };
let cal = {
  year: new Date().getFullYear(),
  monthIndex: new Date().getMonth(),
  selectedYmd: ymd(new Date()),
};

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function routeParts() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query || "");
  return { parts, params };
}

function setTab(name) {
  tabbar.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.tab === name);
  });
}

function showApp(show) {
  appShell.classList.toggle("hidden", !show);
  authScreen.classList.toggle("hidden", show);
}

async function render() {
  const user = currentUser();
  if (!user) {
    stopStore();
    showApp(false);
    renderAuth();
    return;
  }
  showApp(true);
  whoEl.textContent = user.displayName || (user.email || "").split("@")[0];
  const { parts, params } = routeParts();
  const section = parts[0] || "calendar";
  if (section === "bills") setTab("bills");
  else if (section === "maintenance") setTab("maintenance");
  else if (section === "more") setTab("more");
  else setTab("calendar");

  if (section === "bills" && parts[1] === "new") {
    renderBillForm(view, null, {
      save: async (input) => {
        const rec = await saveBill(input);
        toast("Bill added");
        location.hash = `#/bills/${rec.id}`;
      },
    });
    return;
  }
  if (section === "bills" && parts[1] && parts[2] === "edit") {
    const bill = data.bills.find((b) => b.id === parts[1]);
    renderBillForm(view, bill, {
      save: async (input) => {
        await saveBill(input);
        toast("Saved");
        location.hash = `#/bills/${bill.id}`;
      },
    });
    return;
  }
  if (section === "bills" && parts[1]) {
    const bill = data.bills.find((b) => b.id === parts[1]);
    renderBillDetail(view, bill, data, {
      remove: async () => {
        if (!confirm("Delete this bill and its payment history?")) return;
        await deleteBill(bill.id);
        toast("Bill removed");
        location.hash = "#/bills";
      },
      logPayment: async (input) => {
        await savePayment(input);
        toast("Payment logged");
        render();
      },
      removePayment: async (id) => {
        await deletePayment(id);
        toast("Payment removed");
        render();
      },
    });
    return;
  }
  if (section === "bills") {
    renderBillList(view, data);
    return;
  }
  if (section === "maintenance" && parts[1] === "new") {
    renderMaintenanceForm(
      view,
      null,
      {
        save: async (input) => {
          try {
            const rec = await saveMaintenance(input);
            toast("Task added");
            location.hash = `#/maintenance/${rec.id}`;
          } catch (err) {
            toast(err.message || "Could not save");
          }
        },
      },
      params.get("date")
    );
    return;
  }
  if (section === "maintenance" && parts[1] && parts[2] === "edit") {
    const task = (data.maintenance || []).find((t) => t.id === parts[1]);
    renderMaintenanceForm(view, task, {
      save: async (input) => {
        try {
          await saveMaintenance(input);
          toast("Saved");
          location.hash = `#/maintenance/${task.id}`;
        } catch (err) {
          toast(err.message || "Could not save");
        }
      },
    });
    return;
  }
  if (section === "maintenance" && parts[1]) {
    const task = (data.maintenance || []).find((t) => t.id === parts[1]);
    renderMaintenanceDetail(view, task, {
      remove: async () => {
        if (!confirm("Delete this task?")) return;
        await deleteMaintenance(task.id);
        toast("Task removed");
        location.hash = "#/maintenance";
      },
      markDone: async (completedOn) => {
        try {
          await markMaintenanceDone(task.id, completedOn);
          toast("Marked done");
          render();
        } catch (err) {
          toast(err.message || "Could not update");
        }
      },
    });
    return;
  }
  if (section === "maintenance") {
    renderMaintenanceList(view, data);
    return;
  }
  if (section === "event" && parts[1] === "new") {
    renderEventForm(
      view,
      null,
      data,
      {
        save: async (input) => {
          const rec = await saveEvent(input);
          toast("Event added");
          location.hash = `#/event/${rec.id}`;
        },
      },
      params.get("date")
    );
    return;
  }
  if (section === "event" && parts[1] && parts[2] === "edit") {
    const event = data.events.find((e) => e.id === parts[1]);
    renderEventForm(view, event, data, {
      save: async (input) => {
        await saveEvent(input);
        toast("Saved");
        location.hash = `#/event/${event.id}`;
      },
    });
    return;
  }
  if (section === "event" && parts[1]) {
    const event = data.events.find((e) => e.id === parts[1]);
    renderEventDetail(view, event, data, {
      remove: async () => {
        if (!confirm("Delete this event?")) return;
        await deleteEvent(event.id);
        toast("Event removed");
        location.hash = "#/";
      },
    });
    return;
  }
  if (section === "more") {
    renderMore();
    return;
  }
  renderCalendar(
    view,
    { ...cal, ...data },
    {
      shiftMonth: (delta) => {
        const d = new Date(cal.year, cal.monthIndex + delta, 1);
        cal.year = d.getFullYear();
        cal.monthIndex = d.getMonth();
        render();
      },
      selectDay: (ymdStr) => {
        cal.selectedYmd = ymdStr;
        const d = new Date(ymdStr + "T12:00:00");
        cal.year = d.getFullYear();
        cal.monthIndex = d.getMonth();
        render();
      },
    }
  );
}

function renderAuth() {
  const configured = firebaseConfigured();
  const emails = householdEmails();
  authScreen.innerHTML = `
    <div class="auth-hero">
      <img src="icon-192.png" alt="Nestor" />
      <h1>Nestor</h1>
      <p>A private nest for the household calendar.</p>
    </div>
    ${
      configured
        ? ""
        : `<div class="banner banner-warn">
            Firebase keys are still placeholders in <code>js/config.js</code>.
            Paste the web app config from Firebase Console, then refresh.
            Until then you can look around with local preview (data stays on this device).
          </div>`
    }
    <form class="card" id="login-form" ${configured ? "" : "hidden"}>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
      </div>
      <p class="error" id="login-error"></p>
      <button class="btn btn-primary" type="submit">Sign in</button>
      <p class="fine" style="margin:10px 0 0">Accounts are created in Firebase Console — there is no public sign-up.</p>
    </form>
    ${
      emails.length
        ? `<p class="fine" style="margin-top:12px">Household logins: ${emails.join(" · ")}</p>`
        : `<p class="fine" style="margin-top:12px">Add both household emails to <code>js/config.js</code> and <code>firestore.rules</code>.</p>`
    }
    <p style="margin-top:16px"><button class="btn btn-ghost" style="width:100%" id="preview-btn" type="button">Local preview</button></p>
    <p class="fine" style="margin-top:8px;text-align:center">Preview stays on this device and does not sync.</p>
  `;
  const form = authScreen.querySelector("#login-form");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const err = authScreen.querySelector("#login-error");
      err.textContent = "";
      const fd = new FormData(form);
      try {
        await signIn(fd.get("email"), fd.get("password"));
      } catch (ex) {
        err.textContent = friendlyAuth(ex);
      }
    };
  }
  const preview = authScreen.querySelector("#preview-btn");
  if (preview) preview.onclick = () => enterPreview();
}

function friendlyAuth(ex) {
  const code = ex && ex.code;
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Email or password didn’t match.";
  }
  if (code === "auth/too-many-requests") return "Too many tries. Wait a minute and try again.";
  return (ex && ex.message) || "Could not sign in.";
}

function renderMore() {
  const user = currentUser();
  view.innerHTML = `
    <div class="section-title"><h2>More</h2></div>
    ${isPreview() ? `<div class="banner banner-info">Local preview — nothing is synced to Firebase.</div>` : ""}
    <a class="bill-card" href="#/maintenance" style="margin-bottom:14px">
      <div class="row">
        <h3>Home Maintenance</h3>
        <span class="chip">${(data.maintenance || []).length}</span>
      </div>
      <p class="fine" style="margin:0">Filters, pest spray, and other recurring upkeep.</p>
    </a>
    <div class="card" style="margin-bottom:14px">
      <p style="margin:0 0 8px"><b>Signed in as</b><br>${escapeHtml(user.displayName || "—")}<br><span class="fine">${escapeHtml(user.email || "")}</span></p>
      <form id="name-form" class="field" style="margin:0">
        <label for="disp">What should we call you?</label>
        <input id="disp" name="name" maxlength="40" value="${escapeHtml(user.displayName || "")}" />
        <button class="btn btn-ghost" type="submit" style="margin-top:8px">Save name</button>
      </form>
      <p class="fine">This name is stored on entries you add (<code>createdBy</code>).</p>
      <button class="btn btn-danger" id="out" style="width:100%;margin-top:8px">Sign out</button>
    </div>
    <h3 style="font-family:Fraunces,Georgia,serif">Coming soon</h3>
    <div class="coming">
      <ul>
        <li>Private notes</li>
        <li>Documents / warranties</li>
        <li>Vehicles</li>
        <li>Shopping / to-do</li>
        <li>Emergency info</li>
      </ul>
    </div>
  `;
  view.querySelector("#out").onclick = () => signOut();
  view.querySelector("#name-form").onsubmit = async (e) => {
    e.preventDefault();
    await setDisplayName(new FormData(e.target).get("name"));
    toast("Name saved");
    render();
  };
}

function hideSplash() {
  if (!splash || splash.classList.contains("is-gone")) return;
  splash.classList.add("is-gone");
  setTimeout(() => splash.remove(), 600);
}

async function boot() {
  const seen = sessionStorage.getItem("nestor-splash");
  if (seen) {
    splash?.remove();
  } else {
    sessionStorage.setItem("nestor-splash", "1");
    setTimeout(hideSplash, 1600);
    splash?.addEventListener("click", hideSplash);
  }

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (err) {
      console.warn("SW register failed", err);
    }
  }

  subscribe((snap) => {
    data = snap;
    if (currentUser()) render();
  });

  onAuth(async (user) => {
    if (user) await startStore();
    else stopStore();
    render();
  });

  try {
    await startAuth();
  } catch (err) {
    console.warn(err);
    render();
  }
}

window.addEventListener("hashchange", () => {
  if (currentUser()) render();
});

boot();
