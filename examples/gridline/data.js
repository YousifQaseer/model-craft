// Gridline Motors: the lineup, options and the price. Plain data, no Three.js.
// Every price here is a SAMPLE (placeholder brand); the page says so.

export const BODIES = {
  sedan:  { name: "Arc",   label: "Sedan",  base: 38900, blurb: "Low, quiet, 5 seats." },
  suv:    { name: "Ridge", label: "SUV",    base: 46500, blurb: "Tall, roomy, 5 seats, big boot." },
  coupe:  { name: "Volt",  label: "Coupe",  base: 52900, blurb: "Two doors, fastback, quick." },
  pickup: { name: "Haul",  label: "Pickup", base: 49900, blurb: "Crew cab, 1.8 m bed." },
};
export const BODY_ORDER = ["sedan", "suv", "coupe", "pickup"];

export const PAINTS = [
  { id: "electric", name: "Electric Blue", hex: "#1E4FD8", finish: "metallic", price: 795 },
  { id: "glacier",  name: "Glacier White", hex: "#E6E9EC", finish: "solid",    price: 0 },
  { id: "graphite", name: "Graphite",      hex: "#3A3F46", finish: "solid",    price: 0 },
  { id: "signal",   name: "Signal Red",    hex: "#B3141C", finish: "metallic", price: 795 },
  { id: "forest",   name: "Forest",        hex: "#22473A", finish: "metallic", price: 795 },
  { id: "slate",    name: "Matte Slate",   hex: "#5E666E", finish: "matte",    price: 1900 },
  { id: "pearl",    name: "Pearl",         hex: "#F1EEE6", finish: "pearl",    price: 1200 },
];
export const FINISH_LABEL = { solid: "Solid", metallic: "Metallic", matte: "Matte", pearl: "Pearl" };

export const WHEEL_OPTIONS = {
  aero:  { label: "18 in Aero",        price: 0 },
  spoke: { label: "20 in Five-spoke",  price: 1400 },
  mesh:  { label: "21 in Split-spoke", price: 2600 },
};
export const WHEEL_ORDER = ["aero", "spoke", "mesh"];

export const PACKS = {
  base:    { label: "Base",    price: 0,    note: "Cloth seats, 18 in wheels standard, body-colour roof." },
  sport:   { label: "Sport",   price: 3200, note: "Black roof, rear spoiler, sport seats." },
  touring: { label: "Touring", price: 4100, note: "Roof rails, chrome belt line, heated seats." },
};
export const PACK_ORDER = ["base", "sport", "touring"];

export const FEES = { freight: 1995, hst: 0.13, apr: 0.0599 };
export const TERMS = [36, 48, 60, 72];

const paintOf = (id) => PAINTS.find((p) => p.id === id) || PAINTS[0];

// Pure: the same state always gives the same numbers. Tested in tests/price.test.mjs.
export function price(s) {
  const body = BODIES[s.body], paint = paintOf(s.paint);
  const lines = [
    { label: `${body.name} ${body.label}`, amount: body.base },
    { label: `${paint.name} (${FINISH_LABEL[paint.finish].toLowerCase()})`, amount: paint.price },
    { label: WHEEL_OPTIONS[s.wheel].label + " wheels", amount: WHEEL_OPTIONS[s.wheel].price },
    { label: PACKS[s.pack].label + " package", amount: PACKS[s.pack].price },
    { label: "Freight and delivery prep", amount: FEES.freight },
  ];
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const hst = Math.round(subtotal * FEES.hst);
  const total = subtotal + hst;
  const down = Math.max(0, Math.min(s.down || 0, total));
  const n = s.term || 60, r = FEES.apr / 12, P = total - down;
  const monthly = P <= 0 ? 0 : Math.round((P * r) / (1 - Math.pow(1 + r, -n)));
  return { lines, subtotal, hst, total, down, term: n, monthly };
}

export const money = (v) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
