import { test } from "node:test";
import assert from "node:assert/strict";
import { price, TABLES, fits } from "../data.js";

test("deposit is per guest", () => {
  assert.equal(price({ party: 4 }).total, 40);
});
test("every party size the page offers has a table that fits", () => {
  for (const n of [2, 4, 6]) assert.ok(TABLES.some((t) => fits(t, n)), `party of ${n}`);
});
