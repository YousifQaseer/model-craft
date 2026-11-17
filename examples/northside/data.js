// Plain data shared by the page (app.js) and the model (model.js). No Three.js
// here, so the page can render its controls before the 3D model loads.
// Prices, names and times are SAMPLE data for a placeholder brand.

export const CURRENCY = "CAD";
export const LOCALE = "en-CA";
export const HST = 0.13; // Ontario HST

export const SHOP = {
  name: "Northside Barber Co.",
  street: "James St N (placeholder address)",
  city: "Hamilton, Ontario",
  phone: "(905) 555-0142", // 555 number: placeholder
};

// Opening hours by weekday (0 = Sunday). null = closed.
export const HOURS = [
  [10, 15], // Sun
  null, // Mon
  [10, 19], [10, 19], [10, 20], [10, 20], // Tue-Fri
  [9, 17], // Sat
];

export const BARBERS = [
  { id: "marco", name: "Marco", station: "s1", known: "Fades", line: "Skin fades, tapers and sharp line-ups. Brings the clippers out early.", best: ["fade"] },
  { id: "dee", name: "Dee", station: "s2", known: "Classic cuts and beards", line: "Side parts, pompadours and beard shaping, finished with a hot towel if you want one.", best: ["classic", "beard", "shave"] },
  { id: "sam", name: "Sam", station: "s3", known: "Scissor work and kids", line: "Longer hair, textured crops and patient first haircuts. Keeps a booster seat handy.", best: ["kids"] },
];
export const barberById = (id) => BARBERS.find((b) => b.id === id) || null;
export const barberAt = (station) => BARBERS.find((b) => b.station === station) || null;

export const SERVICES = [
  { id: "classic", name: "Classic cut", price: 38, mins: 30, blurb: "Scissors and clippers, washed hair optional, styled to finish." },
  { id: "fade", name: "Skin fade", price: 45, mins: 45, blurb: "Blended down to the skin, line-up included." },
  { id: "beard", name: "Beard trim", price: 22, mins: 20, blurb: "Shape, line and oil. No haircut." },
  { id: "shave", name: "Hot towel shave", price: 40, mins: 40, blurb: "Straight razor, two hot towels, cold finish." },
  { id: "kids", name: "Kids cut", price: 28, mins: 25, blurb: "Twelve and under. Booster seat on the chair." },
];
export const serviceById = (id) => SERVICES.find((s) => s.id === id) || SERVICES[0];

export const ADDONS = [
  { id: "wash", name: "Wash", price: 10, blurb: "Shampoo and rinse at the basin." },
  { id: "towel", name: "Hot towel", price: 8, blurb: "A hot towel before the cut. Included with a shave." },
];

// Who does the cut: the chosen barber, or for "Any barber" the one known for that service.
export function mainBarber(state) {
  if (state.barber && state.barber !== "any") return state.barber;
  return (BARBERS.find((b) => b.best.includes(state.service)) || BARBERS[1]).id;
}
// "Bring a friend": the friend gets a different station; the barber known for
// their service if free, else the next one along.
export function friendBarber(state) {
  if (!state.friend) return null;
  const main = mainBarber(state);
  const others = BARBERS.filter((b) => b.id !== main);
  return (others.find((b) => b.best.includes(state.friendService)) || others[0]).id;
}

// What the model draws, derived from state. The model never reads the form.
export function modelState(state) {
  const main = mainBarber(state);
  const friend = friendBarber(state);
  const lit = state.barber === "any" ? BARBERS.map((b) => b.id) : [main, friend].filter(Boolean);
  const seated = state.step >= 3 && Boolean(state.time);
  const stations = {};
  for (const b of BARBERS) {
    const isMain = b.id === main, isFriend = b.id === friend;
    stations[b.station] = {
      on: lit.includes(b.id),
      service: isMain ? state.service : isFriend ? state.friendService : null,
      towel: isMain && (state.towel || state.service === "shave") || (isFriend && state.friendService === "shave"),
      client: seated && (isMain || isFriend),
    };
  }
  return { stations, wash: Boolean(state.wash), pick: state.pick ?? null };
}

// ------------------------------------------------------------- price --
// Pure. Money in cents to avoid float drift. The hot towel add-on is free with
// a shave (the shave already has one). Add-ons are for the main booking.
export function price(state) {
  const lines = [];
  const s = serviceById(state.service);
  lines.push({ id: "service", label: s.name, cents: s.price * 100 });
  if (state.wash) lines.push({ id: "wash", label: "Wash", cents: 1000 });
  if (state.towel && state.service !== "shave") lines.push({ id: "towel", label: "Hot towel", cents: 800 });
  if (state.friend) {
    const f = serviceById(state.friendService);
    lines.push({ id: "friend", label: `Friend: ${f.name}`, cents: f.price * 100 });
  }
  const subtotal = lines.reduce((a, l) => a + l.cents, 0);
  const tax = Math.round(subtotal * HST);
  return { lines, subtotal, tax, total: subtotal + tax };
}

export const money = (cents) => new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(cents / 100);

// ------------------------------------------------------------- times --
// Sample availability, deterministic per barber and day, so every run of the
// page (3D or not, motion or not) shows the same chips.
function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function dayFromIso(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }

// Open slots ("HH:MM") for one barber on one day; past times today are gone.
export function slots(barberId, iso, now = new Date()) {
  const day = dayFromIso(iso);
  const h = HOURS[day.getDay()];
  if (!h) return [];
  const out = [];
  const today = isoDay(now) === iso;
  for (let m = h[0] * 60; m <= h[1] * 60 - 45; m += 30) {
    const taken = hash(`${barberId}|${iso}|${m}`) % 100 < 58; // most of the book is full
    if (taken) continue;
    if (today && m < now.getHours() * 60 + now.getMinutes() + 30) continue;
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

// The next `n` open days (closed days skipped; today only if it has slots left).
export function openDays(barberId, n = 5, now = new Date()) {
  const out = [];
  for (let i = 0; out.length < n && i < 21; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = isoDay(d);
    if (slots(barberId, iso, now).length) out.push(iso);
  }
  return out;
}

// The next few open times for a barber, across days (for the sheet's chips).
export function nextOpen(barberId, n = 3, now = new Date()) {
  const out = [];
  for (const iso of openDays(barberId, 4, now)) for (const t of slots(barberId, iso, now)) { if (out.length < n) out.push({ iso, t }); }
  return out;
}

export function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
export function fmtDay(iso, now = new Date(), long = false) {
  const d = dayFromIso(iso);
  if (iso === isoDay(now)) return "Today";
  const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (iso === isoDay(tmr) && !long) return "Tomorrow";
  return d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: long ? "short" : undefined });
}

// A demo reference like NB-4F7K2Q (no I, O, 0 or 1).
export function reference(rand = Math.random) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "NB-";
  for (let i = 0; i < 6; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}
