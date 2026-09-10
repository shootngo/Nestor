import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { assignVehicleDocId, saveVehicle, snapshot, startStore, stopStore } from "./store.js";

function memoryStorage() {
  const data = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

if (!globalThis.window) globalThis.window = globalThis;
globalThis.localStorage = memoryStorage();

describe("assignVehicleDocId", () => {
  it("mints a new id when the input is blank", () => {
    assert.equal(assignVehicleDocId("", () => "fresh"), "fresh");
    assert.equal(assignVehicleDocId(null, () => "fresh"), "fresh");
    assert.equal(assignVehicleDocId(undefined, () => "fresh"), "fresh");
  });

  it("does not write to reserved path ids like new", () => {
    assert.equal(assignVehicleDocId("new", () => "fresh"), "fresh");
    assert.equal(assignVehicleDocId("edit", () => "fresh"), "fresh");
    assert.equal(assignVehicleDocId("tasks", () => "fresh"), "fresh");
  });

  it("keeps a real vehicle id for edits", () => {
    assert.equal(assignVehicleDocId("crv-uuid"), "crv-uuid");
  });
});

describe("saveVehicle creates multiple household cars", () => {
  beforeEach(async () => {
    stopStore();
    globalThis.localStorage = memoryStorage();
    await startStore();
  });

  it("keeps two separately added vehicles", async () => {
    const first = await saveVehicle({ name: "CR-V" });
    const second = await saveVehicle({ name: "F-150" });
    assert.notEqual(first.id, second.id);
    assert.notEqual(first.id, "new");
    assert.notEqual(second.id, "new");
    const names = snapshot()
      .vehicles.filter((v) => v.id === first.id || v.id === second.id)
      .map((v) => v.name)
      .sort();
    assert.deepEqual(names, ["CR-V", "F-150"]);
  });

  it("does not overwrite the only car when add is saved with id new", async () => {
    const first = await saveVehicle({ name: "CR-V" });
    const second = await saveVehicle({ id: "new", name: "F-150" });
    const third = await saveVehicle({ id: "new", name: "Odyssey" });
    assert.notEqual(second.id, "new");
    assert.notEqual(third.id, "new");
    assert.equal(new Set([first.id, second.id, third.id]).size, 3);
    const names = snapshot()
      .vehicles.filter((v) => [first.id, second.id, third.id].includes(v.id))
      .map((v) => v.name)
      .sort();
    assert.deepEqual(names, ["CR-V", "F-150", "Odyssey"]);
  });

  it("still updates an existing vehicle when a real id is passed", async () => {
    const first = await saveVehicle({ name: "CR-V" });
    const updated = await saveVehicle({ id: first.id, name: "Honda CR-V", year: "2018" });
    assert.equal(updated.id, first.id);
    const rec = snapshot().vehicles.find((v) => v.id === first.id);
    assert.equal(rec.name, "Honda CR-V");
    assert.equal(rec.year, "2018");
  });
});
