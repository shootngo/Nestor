import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { itemsOnDay, markClass } from "./calendar.js";
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
    assert.match(markClass(oil), /vehicle/);

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
});

describe("ymd helper stays local-date safe", () => {
  it("formats a local date without UTC shift", () => {
    assert.equal(ymd(parseYmd("2026-09-10")), "2026-09-10");
  });
});
