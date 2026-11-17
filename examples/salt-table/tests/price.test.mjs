import { test } from "node:test";
import assert from "node:assert/strict";
import { price, TABLES, fits, TASTING, DEPOSIT } from "../data.js";

test("no extras: only the deposit, $10 a guest", () => {
  const p = price({ party: 4, occasion: "none", tasting: false });
  assert.equal(p.extras, 0); assert.equal(p.deposit, 4 * DEPOSIT); assert.deepEqual(p.lines, []);
});
test("birthday adds the cake, anniversary adds flowers, business adds nothing", () => {
  assert.equal(price({ party: 2, occasion: "birthday" }).extras, 28);
  assert.equal(price({ party: 2, occasion: "anniversary" }).extras, 35);
  assert.equal(price({ party: 2, occasion: "business" }).extras, 0);
});
test("tasting menu is per guest", () => {
  assert.equal(price({ party: 6, occasion: "none", tasting: true }).extras, 6 * TASTING);
});
test("every party size from 1 to 8 has at least one table that fits", () => {
  for (let n = 1; n <= 8; n++) assert.ok(TABLES.some((t) => fits(t, n)), `party of ${n}`);
});
test("a table never fits a party bigger than its seats, or more than 2 seats too big", () => {
  for (const t of TABLES) for (let n = 1; n <= 8; n++) assert.equal(fits(t, n), t.seats >= n && t.seats - n <= 2);
});
