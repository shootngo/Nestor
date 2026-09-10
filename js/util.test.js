import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addInterval, parseYmd, recurrenceLabel, vehicleLabel, vehicleSubtitle, ymd } from "./util.js";

describe("addInterval years", () => {
  it("advances a tag renewal by one year", () => {
    assert.equal(ymd(addInterval(parseYmd("2026-09-10"), 1, "years")), "2027-09-10");
  });

  it("clamps Feb 29 on a non-leap year", () => {
    assert.equal(ymd(addInterval(parseYmd("2024-02-29"), 1, "years")), "2025-02-28");
  });
});

describe("recurrenceLabel", () => {
  it("labels a yearly tag renewal", () => {
    assert.equal(recurrenceLabel({ intervalCount: 1, intervalUnit: "years" }), "Every year");
  });
});

describe("vehicleLabel", () => {
  it("prefers the nickname", () => {
    assert.equal(vehicleLabel({ name: "CR-V", year: "2018", make: "Honda", model: "CR-V" }), "CR-V");
  });

  it("falls back to year make model", () => {
    assert.equal(vehicleLabel({ name: "", year: "2016", make: "Ford", model: "F-150" }), "2016 Ford F-150");
  });
});

describe("vehicleSubtitle", () => {
  it("joins year make model and plate", () => {
    assert.equal(
      vehicleSubtitle({ year: "2018", make: "Honda", model: "CR-V", plate: "ABC-123" }),
      "2018 Honda CR-V · ABC-123"
    );
  });
});
