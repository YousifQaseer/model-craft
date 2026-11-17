// Plain data shared by the page (app.js) and the model (model.js). No Three.js
// here, so the page can render its controls before the 3D model loads.

export const ROOM = { w: 7, d: 5.2, h: 1.25 }; // cutaway walls stay low: lifted tables float above them

export const TABLES = [
  { id: "t1", x: -2.2, z: -1.2, seats: 2, spot: "Window" },
  { id: "t2", x: -0.4, z: -1.2, seats: 4, spot: "Window" },
  { id: "t3", x: -2.2, z: 1.1, seats: 4, spot: "Centre" },
  { id: "t4", x: -0.1, z: 1.1, seats: 6, spot: "Centre" },
];
export const fits = (t, party) => t.seats >= party && t.seats - party <= 2;

// The price is a pure function of state, tested in tests/price.test.mjs.
export const PRICES = { deposit: 10 }; // per guest; sample pricing
export function price(s) {
  const deposit = PRICES.deposit * (s.party || 1);
  return { lines: [{ label: `Deposit for ${s.party} (comes off the bill)`, amount: deposit }], total: deposit };
}
