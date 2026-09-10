import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aisleLabel, groupOpenByAisle, sortShopping } from "./shopping.js";

describe("aisleLabel", () => {
  it("falls back to Other when blank", () => {
    assert.equal(aisleLabel(""), "Other");
    assert.equal(aisleLabel(null), "Other");
  });
});

describe("sortShopping", () => {
  it("lists unchecked items first", () => {
    const sorted = sortShopping([
      { id: "a", text: "Coffee", checked: true, aisle: "Dairy", createdAt: "2026-09-01" },
      { id: "b", text: "Milk", checked: false, aisle: "Dairy", createdAt: "2026-09-02" },
      { id: "c", text: "Bananas", checked: false, aisle: "Produce", createdAt: "2026-09-03" },
    ]);
    assert.deepEqual(
      sorted.map((x) => x.id),
      ["b", "c", "a"]
    );
  });

  it("groups unchecked by aisle, then createdAt", () => {
    const sorted = sortShopping([
      { id: "late", text: "Yogurt", checked: false, aisle: "Dairy", createdAt: "2026-09-04" },
      { id: "early", text: "Milk", checked: false, aisle: "Dairy", createdAt: "2026-09-01" },
      { id: "fruit", text: "Apples", checked: false, aisle: "Produce", createdAt: "2026-09-02" },
    ]);
    assert.deepEqual(
      sorted.map((x) => x.id),
      ["early", "late", "fruit"]
    );
  });
});

describe("groupOpenByAisle", () => {
  it("skips checked items and labels blank aisles Other", () => {
    const groups = groupOpenByAisle([
      { id: "1", text: "Milk", checked: false, aisle: "Dairy" },
      { id: "2", text: "Call plumber", checked: false, aisle: "" },
      { id: "3", text: "Coffee", checked: true, aisle: "Dairy" },
    ]);
    assert.deepEqual(
      groups.map((g) => g.aisle),
      ["Dairy", "Other"]
    );
    assert.deepEqual(
      groups.find((g) => g.aisle === "Dairy").items.map((i) => i.id),
      ["1"]
    );
    assert.equal(groups.find((g) => g.aisle === "Other").items[0].id, "2");
  });

  it("puts Other after named aisles", () => {
    const groups = groupOpenByAisle([
      { id: "1", text: "Call plumber", checked: false, aisle: "" },
      { id: "2", text: "Apples", checked: false, aisle: "Produce" },
    ]);
    assert.deepEqual(
      groups.map((g) => g.aisle),
      ["Produce", "Other"]
    );
  });
});
