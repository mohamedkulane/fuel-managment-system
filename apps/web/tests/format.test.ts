import assert from "node:assert/strict";
import test from "node:test";
import { decimal, sum, dateTime } from "../src/lib/format";

test("money formatting preserves precision beyond Number.MAX_SAFE_INTEGER", () => {
  assert.equal(decimal("9007199254740993.125", 2), "9,007,199,254,740,993.13");
});
test("decimal totals retain fractional cents without floating point drift", () => {
  assert.equal(sum(["0.1", "0.2", "-0.05"]), "0.25");
  assert.equal(sum(["9007199254740993", "0.0001"]), "9007199254740993.0001");
});
test("missing balances are visibly different from a real zero", () => {
  assert.equal(decimal(undefined), "—");
  assert.equal(decimal(null), "—");
  assert.equal(decimal("0"), "0.00");
});
test("formatting handles negative adjustments and six-place conversion snapshots", () => {
  assert.equal(decimal("-1234.567", 2), "-1,234.57");
  assert.equal(decimal("20.123456", 6), "20.123456");
});
test("dates display at the Somalia day boundary independently of host timezone", () => {
  assert.match(dateTime("2026-10-09T22:30:00Z"), /10 Oktoobar 2026/);
  assert.match(dateTime("2026-10-09T22:30:00Z"), /01:30/);
});
