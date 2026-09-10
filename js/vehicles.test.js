import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderVehicleDetail, renderVehicleForm, renderVehicleList } from "./vehicles.js";

function mockRoot() {
  const root = {
    html: "",
    querySelector() {
      return { onclick: null, onsubmit: null, onchange: null };
    },
  };
  Object.defineProperty(root, "innerHTML", {
    get() {
      return this.html;
    },
    set(v) {
      this.html = v;
    },
  });
  return root;
}

describe("renderVehicleList", () => {
  it("always offers Add vehicle when one car already exists", () => {
    const root = mockRoot();
    renderVehicleList(root, {
      vehicles: [{ id: "crv", name: "CR-V", createdBy: { displayName: "Frank" }, createdAt: "2026-09-01" }],
      vehicleTasks: [],
      ready: { vehicles: true, vehicleTasks: true },
    });
    assert.match(root.innerHTML, /href="#\/vehicles\/new"/);
    assert.match(root.innerHTML, /Add vehicle/);
    assert.match(root.innerHTML, /CR-V/);
  });

  it("shows every household vehicle, not only the first", () => {
    const root = mockRoot();
    renderVehicleList(root, {
      vehicles: [
        { id: "crv", name: "CR-V", createdBy: { displayName: "Frank" }, createdAt: "2026-09-01" },
        { id: "truck", name: "F-150", createdBy: { displayName: "Frank" }, createdAt: "2026-09-02" },
        { id: "van", name: "Odyssey", createdBy: { displayName: "Jeannie" }, createdAt: "2026-09-03" },
      ],
      vehicleTasks: [],
      ready: { vehicles: true, vehicleTasks: true },
    });
    assert.match(root.innerHTML, /CR-V/);
    assert.match(root.innerHTML, /F-150/);
    assert.match(root.innerHTML, /Odyssey/);
    assert.match(root.innerHTML, /href="#\/vehicles\/crv"/);
    assert.match(root.innerHTML, /href="#\/vehicles\/truck"/);
    assert.match(root.innerHTML, /href="#\/vehicles\/van"/);
    assert.match(root.innerHTML, /Add vehicle/);
  });
});

describe("renderVehicleDetail", () => {
  it("keeps Add vehicle and a path back to the list", () => {
    const root = mockRoot();
    renderVehicleDetail(
      root,
      { id: "crv", name: "CR-V", createdBy: { displayName: "Frank" }, createdAt: "2026-09-01" },
      [],
      { remove() {} }
    );
    assert.match(root.innerHTML, /href="#\/vehicles\/new"/);
    assert.match(root.innerHTML, /Add vehicle/);
    assert.match(root.innerHTML, /href="#\/vehicles"/);
    assert.match(root.innerHTML, /Oil change/);
    assert.match(root.innerHTML, /Tag renewal/);
  });
});

describe("renderVehicleForm", () => {
  it("treats a reserved id as a blank new-vehicle form", () => {
    const root = mockRoot();
    renderVehicleForm(root, { id: "new", name: "Should not stick" }, { save() {} });
    assert.match(root.innerHTML, /New vehicle/);
    assert.match(root.innerHTML, /Add vehicle/);
    assert.doesNotMatch(root.innerHTML, /Should not stick/);
    assert.match(root.innerHTML, /href="#\/vehicles"/);
  });

  it("prefills when editing a real vehicle", () => {
    const root = mockRoot();
    renderVehicleForm(root, { id: "crv", name: "CR-V", year: "2018" }, { save() {} });
    assert.match(root.innerHTML, /Edit vehicle/);
    assert.match(root.innerHTML, /value="CR-V"/);
  });
});
