import { test } from "node:test";
import assert from "node:assert/strict";
import { price, BODIES, PAINTS, WHEEL_OPTIONS, PACKS, FEES } from "../data.js";

const base = { body: "suv", paint: "glacier", wheel: "aero", pack: "base", down: 0, term: 60 };

test("base SUV: body + freight + HST, nothing else", () => {
  const p = price(base);
  assert.equal(p.subtotal, BODIES.suv.base + FEES.freight);
  assert.equal(p.hst, Math.round(p.subtotal * 0.13));
  assert.equal(p.total, p.subtotal + p.hst);
});
test("options add their prices", () => {
  const p = price({ ...base, paint: "electric", wheel: "mesh", pack: "touring" });
  assert.equal(p.subtotal, BODIES.suv.base + FEES.freight + 795 + WHEEL_OPTIONS.mesh.price + PACKS.touring.price);
});
test("monthly payment: standard amortisation, and falls as the down payment rises", () => {
  const a = price({ ...base, down: 0 }), b = price({ ...base, down: 10000 });
  const r = FEES.apr / 12, n = 60;
  assert.equal(a.monthly, Math.round((a.total * r) / (1 - Math.pow(1 + r, -n))));
  assert.ok(b.monthly < a.monthly);
});
test("down payment never exceeds the total; zero balance is zero a month", () => {
  const p = price({ ...base, down: 10_000_000 });
  assert.equal(p.down, p.total);
  assert.equal(p.monthly, 0);
});
test("longer term, lower payment", () => {
  assert.ok(price({ ...base, term: 72 }).monthly < price({ ...base, term: 36 }).monthly);
});
test("every paint has a finish and a hex colour", () => {
  for (const p of PAINTS) { assert.match(p.hex, /^#[0-9A-F]{6}$/i); assert.ok(["solid", "metallic", "matte", "pearl"].includes(p.finish)); }
});
