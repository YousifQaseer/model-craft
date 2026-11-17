import { test } from "node:test";
import assert from "node:assert/strict";
import { price, money, mainBarber, friendBarber, modelState, slots, reference, SERVICES } from "../data.js";

const base = { barber: "any", service: "classic", wash: false, towel: false, friend: false, friendService: "classic", step: 1, time: null };

test("each service on its own, with 13% HST", () => {
  const want = { classic: 3800, fade: 4500, beard: 2200, shave: 4000, kids: 2800 };
  for (const s of SERVICES) {
    const p = price({ ...base, service: s.id });
    assert.equal(p.subtotal, want[s.id]);
    assert.equal(p.tax, Math.round(want[s.id] * 0.13));
    assert.equal(p.total, p.subtotal + p.tax);
  }
});

test("skin fade + wash + hot towel", () => {
  const p = price({ ...base, service: "fade", wash: true, towel: true });
  assert.deepEqual(p.lines.map((l) => l.cents), [4500, 1000, 800]);
  assert.equal(p.subtotal, 6300);
  assert.equal(p.tax, 819);
  assert.equal(p.total, 7119);
});

test("hot towel is free with a shave", () => {
  const p = price({ ...base, service: "shave", towel: true });
  assert.equal(p.subtotal, 4000);
  assert.equal(p.lines.length, 1);
});

test("bring a friend adds their service", () => {
  const p = price({ ...base, service: "fade", friend: true, friendService: "kids" });
  assert.equal(p.subtotal, 7300);
  assert.equal(p.tax, 949);
  assert.equal(p.total, 8249);
  assert.equal(p.lines[1].label, "Friend: Kids cut");
});

test("HST rounds to the cent", () => {
  const p = price({ ...base, service: "beard", towel: true }); // 30.00 -> 3.90
  assert.equal(p.tax, 390);
  const q = price({ ...base, service: "kids", wash: true, towel: true }); // 46.00 -> 5.98
  assert.equal(q.tax, 598);
});

test("money is CAD", () => {
  assert.match(money(7119), /71\.19/);
  assert.match(money(7119), /\$/);
});

test("any barber goes to the one known for the service; friend gets another", () => {
  assert.equal(mainBarber({ ...base, service: "fade" }), "marco");
  assert.equal(mainBarber({ ...base, service: "kids" }), "sam");
  assert.equal(mainBarber({ ...base, barber: "dee", service: "fade" }), "dee");
  assert.equal(friendBarber({ ...base, barber: "marco", friend: true, friendService: "kids" }), "sam");
  assert.equal(friendBarber({ ...base, barber: "sam", friend: true, friendService: "kids" }), "marco");
  assert.equal(friendBarber(base), null);
});

test("model state: chosen station on, others off; client only at review with a time", () => {
  const m = modelState({ ...base, barber: "marco", service: "fade" });
  assert.equal(m.stations.s1.on, true);
  assert.equal(m.stations.s2.on, false);
  assert.equal(m.stations.s1.client, false);
  const r = modelState({ ...base, barber: "marco", service: "fade", step: 3, time: "15:30", friend: true, friendService: "kids" });
  assert.equal(r.stations.s1.client, true);
  assert.equal(r.stations.s3.on, true);
  assert.equal(r.stations.s3.service, "kids");
  assert.equal(r.stations.s3.client, true);
  assert.equal(modelState(base).stations.s2.on, true);
});

test("slots: closed Monday, none in the past", () => {
  const now = new Date(2026, 10, 17, 14, 0); // Tue 17 Nov 2026, 2 pm
  assert.deepEqual(slots("marco", "2026-11-16", now), []);
  for (const t of slots("marco", "2026-11-17", now)) assert.ok(t >= "14:30");
});

test("reference looks like NB-4F7K2Q", () => {
  assert.match(reference(), /^NB-[A-HJ-NP-Z2-9]{6}$/);
});
