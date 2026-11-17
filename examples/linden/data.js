// Plain data shared by the page (app.js) and the model (model.js). No Three.js.

export const CURRENCY = "CAD";
export const HST = 0.13;

// Building grid, metres. A model, so a little generous.
export const BAY = 3.2;        // one bay, wall to wall
export const DEPTH = 4.2;      // front (open) to back wall
export const STOREY = 2.75;    // floor to floor
export const SLAB = 0.22;      // floor slab thickness
export const BAYS = 3;
export const LEVELS = 4;       // ground + three floors of rooms

export const TYPES = {
  queen: { id: "queen", name: "Classic Queen", rate: 189, bed: "Queen bed", blurb: "A calm, well-made room with a queen bed, a reading chair and a rain shower." },
  king: { id: "king", name: "Garden King", rate: 229, bed: "King bed", blurb: "A larger room at the back, a king bed and a sofa that makes up into a bed." },
  suite: { id: "suite", name: "Linden Suite", rate: 329, bed: "King bed and sofa bed", blurb: "The top floor across two bays: a bedroom, a sitting room and a freestanding tub." },
};
export const TYPE_ORDER = ["queen", "king", "suite"];

// extra: the bed that appears for 3+ guests ("twin" daybed or "sofa" bed).
export const ROOMS = [
  { id: "r101", no: "101", level: 1, bay: 0, span: 1, type: "queen", max: 2, extra: null, view: "the linden tree" },
  { id: "r102", no: "102", level: 1, bay: 1, span: 1, type: "king", max: 3, extra: "sofa", view: "the garden" },
  { id: "r103", no: "103", level: 1, bay: 2, span: 1, type: "queen", max: 3, extra: "twin", view: "the street" },
  { id: "r201", no: "201", level: 2, bay: 0, span: 1, type: "king", max: 3, extra: "sofa", view: "the garden" },
  { id: "r202", no: "202", level: 2, bay: 1, span: 1, type: "queen", max: 2, extra: null, view: "the linden tree" },
  { id: "r203", no: "203", level: 2, bay: 2, span: 1, type: "king", max: 4, extra: "sofa", view: "the garden and the escarpment" },
  { id: "r301", no: "301", level: 3, bay: 0, span: 2, type: "suite", max: 4, extra: "sofa", view: "the escarpment and rooftops" },
  { id: "r302", no: "302", level: 3, bay: 2, span: 1, type: "queen", max: 2, extra: null, view: "the rooftops" },
];

export const EXTRAS = {
  breakfast: { name: "Breakfast tray", price: 24, per: "per guest per night" },
  parking: { name: "Parking", price: 20, per: "per night" },
  late: { name: "Late checkout (1 pm)", price: 35, per: "once" },
};

export const roomById = (id) => ROOMS.find((r) => r.id === id) || null;
export const fitsGuests = (room, guests) => room.max >= guests;
export const roomsFor = (type, guests) => ROOMS.filter((r) => r.type === type && fitsGuests(r, guests));
export const typeFits = (type, guests) => roomsFor(type, guests).length > 0;
export const maxGuests = (type) => Math.max(...ROOMS.filter((r) => r.type === type).map((r) => r.max));

// The cheapest type that sleeps this many (used when the chosen one cannot).
export function typeForGuests(type, guests) {
  if (typeFits(type, guests)) return type;
  return TYPE_ORDER.find((t) => typeFits(t, guests)) || "suite";
}

// The room the tray, the sheet and the booking talk about: the chosen room if it
// still fits, else the tapped one, else the first room of the type that fits.
export function activeRoom(s) {
  const ok = (id) => { const r = roomById(id); return r && r.type === s.type && fitsGuests(r, s.guests) ? r : null; };
  return ok(s.room) || ok(s.pick) || roomsFor(s.type, s.guests)[0] || null;
}

export function nightsBetween(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const a = Date.parse(checkin + "T12:00:00Z"), b = Date.parse(checkout + "T12:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

const cents = (v) => Math.round(v * 100) / 100;

// PURE. { type, guests, nights, breakfast, parking, late } -> line items and totals.
export function price({ type, guests = 1, nights = 1, breakfast = false, parking = false, late = false }) {
  const t = TYPES[type];
  if (!t) throw new Error(`unknown room type "${type}"`);
  const n = Math.max(0, Math.floor(nights));
  const g = Math.min(4, Math.max(1, Math.floor(guests)));
  const lines = [{ key: "room", label: `${t.name}, ${n} night${n === 1 ? "" : "s"} × $${t.rate}`, amount: t.rate * n }];
  if (breakfast) lines.push({ key: "breakfast", label: `Breakfast tray, ${g} guest${g === 1 ? "" : "s"} × ${n} night${n === 1 ? "" : "s"} × $24`, amount: 24 * g * n });
  if (parking) lines.push({ key: "parking", label: `Parking, ${n} night${n === 1 ? "" : "s"} × $20`, amount: 20 * n });
  if (late) lines.push({ key: "late", label: "Late checkout (1 pm)", amount: 35 });
  const subtotal = cents(lines.reduce((a, l) => a + l.amount, 0));
  const hst = cents(subtotal * HST);
  return { lines, subtotal, hst, total: cents(subtotal + hst), nights: n, guests: g };
}

export const money = (v) => new Intl.NumberFormat("en-CA", { style: "currency", currency: CURRENCY }).format(v);

// A demo booking reference: LN- plus six letters/digits (no 0/O/1/I).
export function bookingRef(rand = Math.random) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "LN-";
  for (let i = 0; i < 6; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}
