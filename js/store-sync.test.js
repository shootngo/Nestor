import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeServerDocs,
  rememberDelete,
  rememberSet,
  upsertInto,
} from "./store-sync.js";

describe("upsertInto", () => {
  it("appends a new record", () => {
    const list = upsertInto([{ id: "a" }], { id: "b", name: "HVAC" });
    assert.deepEqual(
      list.map((x) => x.id),
      ["a", "b"]
    );
  });

  it("replaces an existing record by id", () => {
    const list = upsertInto(
      [
        { id: "a", name: "old" },
        { id: "b", name: "keep" },
      ],
      { id: "a", name: "new" }
    );
    assert.equal(list.find((x) => x.id === "a").name, "new");
    assert.equal(list.length, 2);
  });
});

describe("mergeServerDocs", () => {
  it("keeps a just-saved task when the snapshot has not caught up", () => {
    const pending = new Map();
    const rec = { id: "new-1", name: "HVAC filter", nextDue: "2026-10-03" };
    rememberSet(pending, "maintenance", rec);
    const merged = mergeServerDocs([], pending, "maintenance");
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, "new-1");
    assert.equal(pending.size, 1);
  });

  it("drops the pending set once the server list includes the id", () => {
    const pending = new Map();
    const rec = { id: "new-1", name: "HVAC filter" };
    rememberSet(pending, "maintenance", rec);
    const server = [{ id: "new-1", name: "HVAC filter", nextDue: "2026-10-03" }];
    const merged = mergeServerDocs(server, pending, "maintenance");
    assert.equal(merged.length, 1);
    assert.equal(merged[0].nextDue, "2026-10-03");
    assert.equal(pending.size, 0);
  });

  it("does not apply another collection's pending write", () => {
    const pending = new Map();
    rememberSet(pending, "bills", { id: "bill-1", name: "Power" });
    const merged = mergeServerDocs([], pending, "maintenance");
    assert.equal(merged.length, 0);
    assert.equal(pending.size, 1);
  });

  it("keeps a just-saved vehicle task when the snapshot has not caught up", () => {
    const pending = new Map();
    const rec = { id: "oil-1", vehicleId: "crv", name: "Oil change", nextDue: "2026-09-14" };
    rememberSet(pending, "vehicleTasks", rec);
    const merged = mergeServerDocs([], pending, "vehicleTasks");
    assert.equal(merged.length, 1);
    assert.equal(merged[0].name, "Oil change");
    const other = mergeServerDocs([], pending, "vehicles");
    assert.equal(other.length, 0);
  });

  it("hides a just-deleted id until the snapshot drops it", () => {
    const pending = new Map();
    rememberDelete(pending, "maintenance", "gone");
    const merged = mergeServerDocs([{ id: "gone" }, { id: "keep" }], pending, "maintenance");
    assert.deepEqual(
      merged.map((x) => x.id),
      ["keep"]
    );
    assert.equal(pending.size, 1);
  });

  it("keeps two just-saved vehicles when the snapshot has not caught up", () => {
    const pending = new Map();
    rememberSet(pending, "vehicles", { id: "crv", name: "CR-V" });
    rememberSet(pending, "vehicles", { id: "truck", name: "F-150" });
    const merged = mergeServerDocs([], pending, "vehicles");
    assert.deepEqual(
      merged.map((v) => v.id).sort(),
      ["crv", "truck"]
    );
  });

  it("clears a pending delete after the server list no longer has the id", () => {
    const pending = new Map();
    rememberDelete(pending, "maintenance", "gone");
    const merged = mergeServerDocs([{ id: "keep" }], pending, "maintenance");
    assert.deepEqual(
      merged.map((x) => x.id),
      ["keep"]
    );
    assert.equal(pending.size, 0);
  });

  it("keeps a just-saved shopping item when the snapshot has not caught up", () => {
    const pending = new Map();
    const rec = { id: "milk-1", text: "Milk", aisle: "Dairy", checked: false };
    rememberSet(pending, "shopping", rec);
    const merged = mergeServerDocs([], pending, "shopping");
    assert.equal(merged.length, 1);
    assert.equal(merged[0].text, "Milk");
    const other = mergeServerDocs([], pending, "vehicleTasks");
    assert.equal(other.length, 0);
  });
});
