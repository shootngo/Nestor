import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { itemsOnDay, markClass, pickDayFill, renderCalendar } from "./calendar.js";
import { parseYmd, ymd } from "./util.js";

function cellFor(dateStr) {
  const date = parseYmd(dateStr);
  return { date, ymd: dateStr, inMonth: true };
}

describe("itemsOnDay vehicle tasks", () => {
  const today = parseYmd("2026-09-10");
  const vehicles = [{ id: "crv", name: "CR-V", year: "2018", make: "Honda", model: "CR-V" }];
  const vehicleTasks = [
    {
      id: "oil-1",
      vehicleId: "crv",
      name: "Oil change",
      kind: "oil",
      nextDue: "2026-09-14",
      lastCompleted: "2026-03-14",
      intervalCount: 6,
      intervalUnit: "months",
    },
    {
      id: "tag-1",
      vehicleId: "crv",
      name: "Tag renewal",
      kind: "tag",
      nextDue: "2026-09-10",
      lastCompleted: "",
      intervalCount: 1,
      intervalUnit: "years",
    },
  ];

  it("shows oil change and tag renewal on their due dates", () => {
    const oilDay = itemsOnDay(cellFor("2026-09-14"), { vehicles, vehicleTasks }, today);
    const oil = oilDay.find((it) => it.kind === "vehicle" && it.id === "oil-1");
    assert.ok(oil);
    assert.equal(oil.title, "CR-V · Oil change");
    assert.equal(oil.href, "#/vehicles/crv/tasks/oil-1");
    assert.equal(oil.statusLabel, "Due soon");
    assert.match(markClass(oil), /cat-vehicle/);

    const tagDay = itemsOnDay(cellFor("2026-09-10"), { vehicles, vehicleTasks }, today);
    const tag = tagDay.find((it) => it.id === "tag-1");
    assert.ok(tag);
    assert.equal(tag.title, "CR-V · Tag renewal");
    assert.equal(tag.tone, "due");
  });

  it("does not show a vehicle task on an unrelated day", () => {
    const items = itemsOnDay(cellFor("2026-09-11"), { vehicles, vehicleTasks }, today);
    assert.equal(
      items.filter((it) => it.kind === "vehicle").length,
      0
    );
  });

  it("marks a completed vehicle task as done on that day", () => {
    const done = [
      {
        ...vehicleTasks[0],
        lastCompleted: "2026-09-10",
        nextDue: "2027-03-10",
      },
    ];
    const items = itemsOnDay(cellFor("2026-09-10"), { vehicles, vehicleTasks: done }, today);
    assert.equal(items[0].statusLabel, "Done");
    assert.equal(items[0].tone, "paid");
    assert.match(markClass(items[0]), /is-done/);
  });

  it("shows tasks for two different vehicles on the same day", () => {
    const twoCars = [
      { id: "crv", name: "CR-V" },
      { id: "truck", name: "F-150" },
    ];
    const twoTasks = [
      { id: "oil-crv", vehicleId: "crv", name: "Oil change", kind: "oil", nextDue: "2026-09-10" },
      { id: "tag-truck", vehicleId: "truck", name: "Tag renewal", kind: "tag", nextDue: "2026-09-10" },
    ];
    const items = itemsOnDay(cellFor("2026-09-10"), { vehicles: twoCars, vehicleTasks: twoTasks }, today);
    const vehicleItems = items.filter((it) => it.kind === "vehicle");
    assert.equal(vehicleItems.length, 2);
    assert.equal(
      vehicleItems.find((it) => it.id === "oil-crv").title,
      "CR-V · Oil change"
    );
    assert.equal(
      vehicleItems.find((it) => it.id === "tag-truck").title,
      "F-150 · Tag renewal"
    );
    assert.match(markClass(vehicleItems[0]), /cat-vehicle/);
    assert.match(markClass(vehicleItems[1]), /cat-vehicle/);
  });
});

describe("pickDayFill most urgent wins", () => {
  const billUnpaid = { kind: "bill", tone: "unpaid", title: "Power" };
  const homeOverdue = { kind: "maintenance", tone: "unpaid", title: "Pest" };
  const vehicleOverdue = { kind: "vehicle", tone: "unpaid", title: "Oil" };
  const billDue = { kind: "bill", tone: "due", title: "Water" };
  const homeDue = { kind: "maintenance", tone: "due", title: "Filter" };
  const event = { kind: "event", tone: "event", title: "Recycling" };
  const billPaid = { kind: "bill", tone: "paid", title: "Internet" };
  const homeDone = { kind: "maintenance", tone: "paid", title: "Gutters" };

  it("leaves empty days without a fill", () => {
    const fill = pickDayFill([]);
    assert.equal(fill.fillKind, null);
    assert.equal(fill.fillClass, "");
    assert.deepEqual(fill.secondary, []);
  });

  it("fills a single-category day with that category", () => {
    assert.equal(pickDayFill([event]).fillClass, "fill-event");
    assert.equal(pickDayFill([homeDue]).fillClass, "fill-maintenance");
    assert.equal(pickDayFill([vehicleOverdue]).fillClass, "fill-vehicle");
    assert.equal(pickDayFill([billPaid]).fillKind, "bill");
    assert.deepEqual(pickDayFill([billPaid]).secondary, []);
  });

  it("lets an overdue unpaid bill beat overdue home", () => {
    const fill = pickDayFill([homeOverdue, billUnpaid, event]);
    assert.equal(fill.fillKind, "bill");
    assert.equal(fill.secondary.map((it) => it.kind).sort().join(","), "event,maintenance");
  });

  it("lets overdue home beat due-soon and done items", () => {
    const fill = pickDayFill([billPaid, homeDue, homeOverdue, event]);
    assert.equal(fill.fillKind, "maintenance");
    assert.ok(fill.secondary.some((it) => it.kind === "bill"));
    assert.ok(fill.secondary.some((it) => it.kind === "event"));
    assert.equal(fill.secondary.filter((it) => it.kind === "maintenance").length, 0);
  });

  it("lets due-soon beat done/paid and events", () => {
    const fill = pickDayFill([event, billPaid, homeDue]);
    assert.equal(fill.fillKind, "maintenance");
  });

  it("lets an event beat a done-only item", () => {
    assert.equal(pickDayFill([homeDone, event]).fillKind, "event");
  });

  it("does not blend two due-soon categories — bill wins the tiebreak", () => {
    const fill = pickDayFill([homeDue, billDue]);
    assert.equal(fill.fillKind, "bill");
    assert.equal(fill.secondary[0].kind, "maintenance");
  });
});

describe("calendar legend and empty cells", () => {
  function mockRoot() {
    return {
      innerHTML: "",
      querySelector() {
        return { onclick: null };
      },
      querySelectorAll() {
        return [];
      },
    };
  }

  it("says day color = category and uses fill swatches", () => {
    const root = mockRoot();
    renderCalendar(
      root,
      {
        year: 2026,
        monthIndex: 8,
        selectedYmd: "2026-09-10",
        bills: [],
        events: [],
        payments: [],
        maintenance: [],
        vehicles: [],
        vehicleTasks: [],
      },
      { shiftMonth() {}, selectDay() {} }
    );
    assert.match(root.innerHTML, /Day color = category/);
    assert.match(root.innerHTML, /swatch fill-bill/);
    assert.match(root.innerHTML, /swatch fill-maintenance/);
    assert.match(root.innerHTML, /swatch fill-vehicle/);
    assert.match(root.innerHTML, /swatch fill-event/);
    assert.doesNotMatch(root.innerHTML, /class="[^"]*\bday\b[^"]*\bfill-/);
  });

  it("fills the day square and keeps a secondary category as a dot", () => {
    const root = mockRoot();
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const day = Math.max(1, now.getDate() - 3);
    const ymdStr = ymd(new Date(year, monthIndex, day));
    renderCalendar(
      root,
      {
        year,
        monthIndex,
        selectedYmd: ymdStr,
        bills: [{ id: "power", name: "Power", dueDay: day, typicalAmount: 100, archived: false }],
        events: [{ id: "ev", title: "Recycling", date: ymdStr, notes: "" }],
        payments: [],
        maintenance: [],
        vehicles: [],
        vehicleTasks: [],
      },
      { shiftMonth() {}, selectDay() {} }
    );
    assert.match(root.innerHTML, new RegExp(`data-ymd="${ymdStr}"[^>]*data-fill="bill"|data-fill="bill"[^>]*data-ymd="${ymdStr}"`));
    assert.match(root.innerHTML, /fill-bill/);
    assert.match(root.innerHTML, /dot cat-event/);
    assert.match(root.innerHTML, /class="rail cat-bill/);
    assert.match(root.innerHTML, /class="rail cat-event/);
  });
});

describe("shopping stays off the calendar", () => {
  it("does not show list-only shopping items on a day", () => {
    const today = parseYmd("2026-09-10");
    const items = itemsOnDay(
      cellFor("2026-09-10"),
      {
        shopping: [
          { id: "milk", text: "Milk", aisle: "Dairy", checked: false },
          { id: "call", text: "Call plumber", checked: false },
        ],
      },
      today
    );
    assert.equal(
      items.filter((it) => it.kind === "shopping").length,
      0
    );
  });
});

describe("ymd helper stays local-date safe", () => {
  it("formats a local date without UTC shift", () => {
    assert.equal(ymd(parseYmd("2026-09-10")), "2026-09-10");
  });
});
