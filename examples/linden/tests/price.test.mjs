import test from "node:test";
import assert from "node:assert/strict";
import { price, nightsBetween, typeForGuests, roomsFor, activeRoom, bookingRef, money } from "../data.js";

test("room only, two nights of Classic Queen", () => {
  const p = price({ type: "queen", guests: 2, nights: 2 });
  assert.equal(p.subtotal, 378);
  assert.equal(p.hst, 49.14);
  assert.equal(p.total, 427.14);
  assert.equal(p.lines.length, 1);
});

test("every extra on a Garden King for 3 guests, 3 nights", () => {
  const p = price({ type: "king", guests: 3, nights: 3, breakfast: true, parking: true, late: true });
  // 229*3 + 24*3*3 + 20*3 + 35 = 687 + 216 + 60 + 35 = 998
  assert.equal(p.subtotal, 998);
  assert.equal(p.hst, 129.74);
  assert.equal(p.total, 1127.74);
  assert.deepEqual(p.lines.map((l) => l.key), ["room", "breakfast", "parking", "late"]);
});

test("suite, one night, breakfast for one", () => {
  const p = price({ type: "suite", guests: 1, nights: 1, breakfast: true });
  assert.equal(p.subtotal, 353);
  assert.equal(p.total, 398.89);
});

test("late checkout is charged once, not per night", () => {
  const a = price({ type: "queen", guests: 1, nights: 1, late: true });
  const b = price({ type: "queen", guests: 1, nights: 4, late: true });
  assert.equal(b.subtotal - a.subtotal, 189 * 3);
});

test("guests are clamped to 1..4 and nights to whole numbers", () => {
  assert.equal(price({ type: "queen", guests: 9, nights: 1, breakfast: true }).subtotal, 189 + 24 * 4);
  assert.equal(price({ type: "queen", guests: 0, nights: 2.7 }).nights, 2);
});

test("unknown type throws", () => {
  assert.throws(() => price({ type: "penthouse", guests: 1, nights: 1 }));
});

test("nights between dates", () => {
  assert.equal(nightsBetween("2026-12-04", "2026-12-06"), 2);
  assert.equal(nightsBetween("2026-12-31", "2027-01-02"), 2);
  assert.equal(nightsBetween("2026-12-06", "2026-12-04"), 0);
  assert.equal(nightsBetween("", "2026-12-04"), 0);
});

test("type switches when it cannot sleep the guests", () => {
  assert.equal(typeForGuests("queen", 2), "queen");
  assert.equal(typeForGuests("queen", 3), "queen"); // room 103 has a twin daybed
  assert.equal(typeForGuests("queen", 4), "king");  // 203 sleeps four
  assert.equal(typeForGuests("suite", 4), "suite");
  assert.deepEqual(roomsFor("king", 4).map((r) => r.no), ["203"]);
});

test("active room follows the choice, then the tap, then the first fit", () => {
  assert.equal(activeRoom({ type: "king", guests: 2, room: null, pick: null }).no, "102");
  assert.equal(activeRoom({ type: "king", guests: 2, room: null, pick: "r201" }).no, "201");
  assert.equal(activeRoom({ type: "king", guests: 2, room: "r203", pick: "r201" }).no, "203");
  assert.equal(activeRoom({ type: "king", guests: 4, room: "r201", pick: null }).no, "203");
});

test("booking reference format", () => {
  assert.match(bookingRef(), /^LN-[A-HJ-NP-Z2-9]{6}$/);
});

test("money is CAD", () => {
  assert.match(money(427.14), /427\.14/);
});
