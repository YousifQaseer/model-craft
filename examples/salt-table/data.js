// Salt Table: the room, the tables, the times and the price. Plain data, no Three.js.
// Prices are SAMPLES (placeholder brand); the page says so.

export const ROOM = { w: 9, d: 7, h: 1.3 };

// x/z are table centres in the room (metres); the camera looks in from the front-right.
export const TABLES = [
  { id: "t1", n: 1, x: -3.2, z: -2.3, seats: 2, spot: "Window", note: "By the front window, looking onto James Street." },
  { id: "t2", n: 2, x: -1.4, z: -2.3, seats: 2, spot: "Window", note: "By the front window, a little more private." },
  { id: "t3", n: 3, x: 0.6, z: -2.2, seats: 4, spot: "Window", note: "The corner window table." },
  { id: "t4", n: 4, x: -3.0, z: 0.3, seats: 4, spot: "Centre", note: "Under the olive tree." },
  { id: "t5", n: 5, x: -0.4, z: 0.4, seats: 6, spot: "Centre", note: "The round-the-room table: you see the whole place." },
  { id: "t6", n: 6, x: -3.0, z: 2.5, seats: 4, spot: "Garden side", note: "Near the door, quick in and out." },
  { id: "t7", n: 7, x: -0.9, z: 2.6, seats: 2, spot: "Garden side", note: "A quiet two by the herb wall." },
  { id: "t8", n: 8, x: 2.4, z: 2.1, seats: 8, spot: "Long table", note: "The long table, for groups of up to eight." },
];
export const fits = (t, party) => t.seats >= party && t.seats - party <= 2;

export const SERVICES = {
  lunch: { label: "Lunch", times: ["11:30", "12:00", "12:30", "13:00", "13:30"] },
  dinner: { label: "Dinner", times: ["17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"] },
};

export const OCCASIONS = {
  none: { label: "Just dinner", extra: null },
  birthday: { label: "Birthday", extra: { label: "Celebration cake", price: 28 } },
  anniversary: { label: "Anniversary", extra: { label: "Flowers on the table", price: 35 } },
  business: { label: "Business", extra: null },
};
export const TASTING = 85; // per guest, optional pre-order
export const DEPOSIT = 10; // per guest, comes off the bill

export function price(s) {
  const lines = [];
  const occ = OCCASIONS[s.occasion]?.extra;
  if (occ) lines.push({ label: occ.label, amount: occ.price });
  if (s.tasting) lines.push({ label: `Tasting menu × ${s.party}`, amount: TASTING * s.party });
  const extras = lines.reduce((a, l) => a + l.amount, 0);
  const deposit = DEPOSIT * s.party;
  return { lines, extras, deposit };
}
export const money = (v) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
