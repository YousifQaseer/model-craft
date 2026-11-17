// Northside Barber Co.: the shop in cutaway. layout + kinds + materials + theme.
// Loaded lazily by mount.js, so Three.js never blocks the first paint.
//
// layout(m) is PURE: it reads modelState(state) from data.js (stations on/dim,
// the service on each chair, towel, client, wash) and returns items with stable ids.

import { createModel, fx, THREE } from "./engine/model.js";
import { plant } from "./kit/interior.js";
import { BARBERS } from "./data.js";

// The room. 7.2 x 5.4 m so the 8x8 checker texture (0.45 m tiles) repeats cleanly.
export const ROOM = { w: 7.2, d: 5.4, h: 2.2, wall: 0.12 };
const IN_BACK = -ROOM.d / 2 + ROOM.wall; // inner face of the back wall
const IN_LEFT = -ROOM.w / 2 + ROOM.wall; // inner face of the left wall
const ST = { w: 1.8, d: 1.8, h: 2.0 };
const STATION_X = { s1: -1.32, s2: 0.64, s3: 2.6 };

// Toy looks for the three barbers (simple shapes, nobody real).
const LOOKS = {
  s1: { skin: "skin2", hair: "hair", shirt: "shirt", style: "crop" },
  s2: { skin: "skin3", hair: "hairGrey", shirt: "shirtB", style: "beard" },
  s3: { skin: "skin1", hair: "hairBrown", shirt: "shirt", style: "beanie" },
};
const CLIENT = { s1: "skin1", s2: "skin2", s3: "skin3" };

export function layout(m, view = {}) {
  const narrow = (view.w || 999) < 560;
  const st = m?.stations || {};
  const items = [
    { id: "shop", kind: "shell", box: { w: ROOM.w, d: ROOM.d, h: ROOM.h }, pickable: false,
      data: { wall: ROOM.wall, walls: { back: "full", left: "full", front: "low", right: "none" }, low: 0.32,
        openings: [{ wall: "left", at: 0.72, w: 1.4, sill: 0.8, head: 1.85 }] } },
    { id: "tile", kind: "tiles", parent: "shop", pickable: false,
      box: { x: (IN_LEFT + ROOM.w / 2) / 2, z: IN_BACK + 0.012, w: ROOM.w / 2 - IN_LEFT, d: 0.024, h: 1.2 } },
    { id: "basin", kind: "basin", parent: "shop", pickable: false, rot: Math.PI / 2,
      box: { x: IN_LEFT + 0.62, z: -1.62, w: 1.0, d: 1.24, h: 1.6 }, data: { on: Boolean(m?.wash) } },
    { id: "pole", kind: "pole", parent: "shop", pickable: false, box: { x: IN_LEFT + 0.12, z: -0.3, w: 0.24, d: 0.24, h: 1.9 } },
    { id: "bench", kind: "bench", parent: "shop", pickable: false, rot: Math.PI / 2, box: { x: IN_LEFT + 0.32, z: 1.2, w: 1.7, d: 0.6, h: 0.9 } },
    { id: "desk", kind: "desk", parent: "shop", pickable: false, box: { x: 2.35, z: 1.72, w: 1.7, d: 0.66, h: 1.05 } },
    { id: "plant", kind: "plant", parent: "shop", pickable: false, box: { x: 3.22, z: -0.1, w: 0.4, d: 0.4, h: 1.2 }, data: { size: 1.25 } },
  ];
  for (const b of BARBERS) {
    const s = st[b.station] || { on: true, service: null };
    items.push({
      id: b.station, kind: "station", parent: "shop",
      box: { x: STATION_X[b.station], z: IN_BACK + ST.d / 2, w: ST.w, d: ST.d, h: ST.h },
      label: b.name, sub: narrow ? "" : b.known.split(" and ")[0], ariaLabel: `${b.name}'s chair, known for ${b.known.toLowerCase()}`,
      labelAt: [0, 2.05, 0.1],
      tone: s.on ? "on" : "faded", glow: false, // faded: not chosen, still tappable to switch barber
      view: { az: 0.42, el: 0.58 }, focusPad: 0.25,
      data: { look: LOOKS[b.station], client: CLIENT[b.station], service: s.service, towel: Boolean(s.towel), seated: Boolean(s.client) },
    });
  }
  return items;
}

// ------------------------------------------------------------ helpers --
// A prop that pops in and out when state adds or removes it (snaps under reduced motion).
function prop(p, name, want, L) {
  const s = p.props[name] || (p.props[name] = { on: want, t0: -1e9 });
  if (s.on !== want) { s.on = want; s.t0 = L.now; }
  const k = fx.reducedMotion() ? 1 : fx.clamp01((L.now - s.t0) / 380);
  const v = want ? (k >= 1 ? 1 : 0.2 + 0.8 * fx.easeBack(k)) : 1 - fx.easeOut(k);
  return { s: Math.max(0.001, v), on: v > 0.01, busy: k < 1 };
}
function show(g, r) { g.visible = r.on; g.scale.setScalar(r.s); return r.busy; }

// A soft round accent glow on the floor (the "on" and selected state). The
// engine's square footprint covered the whole station and muddied the checker.
let GLOW_TEX = null;
function softGlow(ctx, size) {
  GLOW_TEX = GLOW_TEX || fx.canvasTexture(fx.radialCanvas({ size: 128, stops: [[0, 1], [0.5, 0.75], [1, 0]] }), { repeat: false });
  const m = ctx.newMat({ type: "basic", map: GLOW_TEX, color: ACCENT.value, transparent: true, opacity: 0, depthWrite: false });
  m.userData.noDim = true;
  const g = ctx.plane(m, { receive: false });
  g.scale.set(size, 1, size);
  g.renderOrder = 2;
  g.visible = false;
  // A crisp ring inside the glow, so "on" reads on black tiles too. Same material.
  const ring = ctx.mesh(new THREE.RingGeometry(0.29, 0.32, 48).rotateX(-Math.PI / 2), m, { edges: false, cast: false, receive: false });
  ring.position.y = 0.002;
  ring.renderOrder = 3;
  g.add(ring);
  return g;
}
function glowTo(g, target, L) {
  const m = g.material.userData.dimOf || g.material;
  const cur = m.opacity;
  const next = fx.reducedMotion() ? target : cur + (target - cur) * fx.approach(L.dt || 0.016, 10);
  m.opacity = Math.abs(next - target) < 0.004 ? target : next;
  g.material.opacity = m.opacity;
  g.visible = m.opacity > 0.004;
  return m.opacity !== target;
}
const ACCENT = { value: "#B3261E" };

const cyl = (ctx, rt, rb, h, mat, opts = {}) =>
  ctx.mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg ?? 28).translate(0, h / 2, 0), mat, { edges: false, ...opts });

// ------------------------------------------------------------- shell --
// The kit's cutaway room, with its own checker floor material (repeat from size).
const shell = {
  enter: "rise",
  glow: false,
  make(ctx, item) {
    const tex = ctx.texture("checker", { repeat: [item.box.w / 3.6, item.box.d / 3.6] });
    const floorMat = ctx.newMat({ map: tex, roughness: 0.42, color: "#FFFFFF" });
    // The slab sides stay plain; only the top plane carries the checker.
    const p = { floor: ctx.box("trim", { edges: true }), top: ctx.plane(floorMat), walls: [], glass: [] };
    p.floor.castShadow = false;
    return p;
  },
  draw(p, L, item, state, ctx) {
    const d = item.data || {};
    const T = d.wall ?? 0.12, slab = 0.16, low = d.low ?? 0.35, H = L.h;
    ctx.put(p.floor, 0, 0, L.w, L.d, -slab, slab);
    ctx.put(p.top, 0, 0, L.w, L.d, 0.001, 1);
    const walls = d.walls;
    const segs = [];
    for (const side of ["back", "left", "front", "right"]) {
      const kind = walls[side];
      if (!kind || kind === "none") continue;
      const h = kind === "low" ? low : H;
      const along = side === "back" || side === "front" ? L.w : L.d;
      const ops = (d.openings || []).filter((o) => o.wall === side && kind === "full");
      let u = -along / 2;
      const push = (u0, u1, y0, y1) => { if (u1 - u0 > 0.01 && y1 - y0 > 0.01) segs.push({ side, u0, u1, y0, y1 }); };
      for (const o of ops) {
        const c = -along / 2 + o.at * along, a = c - o.w / 2, b = c + o.w / 2;
        push(u, a, 0, H); push(a, b, 0, o.sill); push(a, b, o.head, H);
        segs.push({ side, u0: a, u1: b, y0: o.sill, y1: o.head, glass: true });
        u = b;
      }
      push(u, along / 2, 0, h);
    }
    let wi = 0, gi = 0;
    const rise = fx.easeOut(fx.clamp01(L.t / 420));
    for (const s of segs) {
      const list = s.glass ? p.glass : p.walls, idx = s.glass ? gi++ : wi++;
      if (!list[idx]) list[idx] = s.glass ? ctx.box("glass", { edges: false, cast: false }) : ctx.box("wall");
      const m = list[idx];
      const len = s.u1 - s.u0, mid = (s.u0 + s.u1) / 2, th = s.glass ? 0.03 : T;
      const y0 = s.y0 * rise, h = (s.y1 - s.y0) * rise;
      // Back wall runs the full width; the left wall stops at the back wall (no overlap, no z-fight).
      if (s.side === "back") ctx.put(m, mid, -L.d / 2 + T / 2, len, th, y0, h);
      if (s.side === "front") ctx.put(m, mid + T / 2, L.d / 2 - T / 2, len - T, th, y0, h);
      if (s.side === "left") ctx.put(m, -L.w / 2 + T / 2, mid + (s.u0 <= -L.d / 2 + 0.001 ? T / 2 : 0), th, len - (s.u0 <= -L.d / 2 + 0.001 ? T : 0), y0, h);
    }
    for (let i = wi; i < p.walls.length; i++) p.walls[i].visible = false;
    for (let i = gi; i < p.glass.length; i++) p.glass[i].visible = false;
  },
};

// Subway tile wainscot on the back wall.
const tiles = {
  enter: "rise", glow: false,
  make(ctx, item) {
    const t = ctx.texture("subway", { repeat: [item.box.w / 1.2, item.box.h / 1.2] });
    const m = ctx.newMat({ map: t, roughness: 0.35, color: "#FFFFFF" });
    const slab = ctx.box(m, { edges: false, cast: false });
    const cap = ctx.rbox(item.box.w, 0.04, 0.05, 0.012, "trim", { cast: false });
    return { slab, cap };
  },
  draw(p, L, item, state, ctx) {
    ctx.put(p.slab, 0, 0, L.w, L.d, 0, L.h);
    p.cap.position.set(0, L.h, 0.012);
  },
};

// ----------------------------------------------------------- station --
// Counter, round mirror with a light bar, the barber chair (on a pivot so the
// scene can turn it), the toy barber, and props that follow the service.
// Local frame: the wall is at -z, the chair faces the mirror (-z).
function barberFigure(ctx, parent, look) {
  const g = ctx.group(parent);
  for (const x of [-0.08, 0.08]) ctx.rbox(0.13, 0.78, 0.15, 0.05, "trousers", { parent: g }).position.set(x, 0, 0);
  ctx.rbox(0.42, 0.58, 0.26, 0.1, look.shirt, { parent: g }).position.set(0, 0.74, 0);
  ctx.rbox(0.38, 0.6, 0.04, 0.015, "apron", { parent: g }).position.set(0, 0.6, 0.13);
  // Arms on shoulder pivots: the near one reaches toward the chair.
  const arms = [];
  for (const [x, rx] of [[-0.26, -0.15], [0.26, -1.05]]) {
    const a = ctx.group(g);
    a.position.set(x, 1.26, 0);
    a.rotation.x = rx;
    ctx.rbox(0.11, 0.5, 0.12, 0.05, look.shirt, { parent: a }).position.set(0, -0.5, 0);
    ctx.mesh(new THREE.SphereGeometry(0.06, 14, 10), look.skin, { parent: a, edges: false }).position.set(0, -0.52, 0);
    arms.push(a);
  }
  ctx.mesh(new THREE.SphereGeometry(0.18, 24, 16), look.skin, { parent: g, edges: false }).position.set(0, 1.5, 0);
  if (look.style === "beanie") {
    cyl(ctx, 0.17, 0.19, 0.16, "beanie", { parent: g }).position.set(0, 1.55, 0);
  } else {
    const hair = ctx.mesh(new THREE.SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), look.hair, { parent: g, edges: false });
    hair.position.set(0, 1.51, -0.01);
  }
  if (look.style === "beard") ctx.rbox(0.26, 0.14, 0.14, 0.06, look.hair, { parent: g }).position.set(0, 1.33, 0.08);
  return g;
}

function chairParts(ctx, pivot) {
  ctx.mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.05, 32).translate(0, 0.025, 0), "chrome", { parent: pivot, edges: false });
  cyl(ctx, 0.06, 0.07, 0.36, "chrome", { parent: pivot, seg: 18 }).position.y = 0.05;
  ctx.rbox(0.58, 0.15, 0.54, 0.06, "leather", { parent: pivot }).position.set(0, 0.4, 0);
  const back = ctx.rbox(0.54, 0.64, 0.13, 0.06, "leather", { parent: pivot });
  back.position.set(0, 0.5, 0.24); back.rotation.x = 0.16;
  ctx.rbox(0.28, 0.15, 0.11, 0.05, "leather", { parent: pivot }).position.set(0, 1.12, 0.36);
  for (const x of [-0.32, 0.32]) ctx.rbox(0.08, 0.26, 0.46, 0.035, "leather", { parent: pivot }).position.set(x, 0.44, 0.0);
  const bar = ctx.rbox(0.05, 0.05, 0.3, 0.02, "chrome", { parent: pivot });
  bar.position.set(0, 0.3, -0.33); bar.rotation.x = -0.5;
  ctx.rbox(0.42, 0.04, 0.16, 0.015, "chrome", { parent: pivot }).position.set(0, 0.16, -0.46);
}

function clientFigure(ctx, parent, skin) {
  const g = ctx.group(parent);
  ctx.rbox(0.36, 0.13, 0.42, 0.05, "denim", { parent: g }).position.set(0, 0.55, -0.16);
  ctx.rbox(0.32, 0.4, 0.13, 0.05, "denim", { parent: g }).position.set(0, 0.2, -0.38);
  ctx.rbox(0.32, 0.08, 0.2, 0.03, "black", { parent: g }).position.set(0, 0.17, -0.48);
  ctx.mesh(new THREE.CylinderGeometry(0.11, 0.38, 0.64, 28).translate(0, 0.32, 0), "cape", { parent: g, edges: false }).position.set(0, 0.55, 0.03);
  ctx.mesh(new THREE.SphereGeometry(0.16, 22, 14), skin, { parent: g, edges: false }).position.set(0, 1.3, 0.04);
  const hair = ctx.mesh(new THREE.SphereGeometry(0.165, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), "hairBrown", { parent: g, edges: false });
  hair.position.set(0, 1.31, 0.06);
  return g;
}

// One group of tools per service, laid on the counter top (y = 0.87).
function toolSets(ctx, parent) {
  const sets = {};
  const set = (id) => (sets[id] = ctx.group(parent));
  const Y = 0.87, Z = -0.62;
  const comb = (g, x) => { const c = ctx.rbox(0.05, 0.02, 0.26, 0.008, "black", { parent: g }); c.position.set(x, Y, Z); c.rotation.y = 0.3; };
  const clipper = (g, x, len = 0.3) => {
    const c = ctx.rbox(0.11, 0.07, len, 0.035, "black", { parent: g }); c.position.set(x, Y, Z); c.rotation.y = -0.25;
    const b = ctx.rbox(0.1, 0.03, 0.04, 0.01, "steel", { parent: g }); b.position.set(x - Math.sin(-0.25) * len * 0.52, Y + 0.02, Z - Math.cos(0.25) * len * 0.52);
  };
  const scissors = (g, x) => {
    for (const r of [0.35, -0.35]) { const s = ctx.rbox(0.025, 0.012, 0.3, 0.006, "steel", { parent: g }); s.position.set(x, Y + 0.003, Z); s.rotation.y = r; }
    for (const dx of [-0.05, 0.05]) { const ring = ctx.mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 20).rotateX(Math.PI / 2), "black", { parent: g, edges: false }); ring.position.set(x + dx, Y + 0.012, Z + 0.14); }
  };
  const spray = (g, x) => { cyl(ctx, 0.045, 0.05, 0.2, "bottle", { parent: g }).position.set(x, Y, Z - 0.05); cyl(ctx, 0.02, 0.025, 0.06, "black", { parent: g }).position.set(x, Y + 0.2, Z - 0.05); };
  let g = set("fade"); clipper(g, -0.32); comb(g, 0.02); clipper(g, 0.3, 0.22);
  g = set("classic"); scissors(g, -0.3); comb(g, 0.02); spray(g, 0.36);
  g = set("kids"); scissors(g, -0.3); comb(g, 0.02); spray(g, 0.36);
  g = set("beard"); clipper(g, -0.3, 0.2); comb(g, 0.0); cyl(ctx, 0.035, 0.035, 0.12, "brass", { parent: g }).position.set(0.32, Y, Z);
  g = set("shave");
  { const h = ctx.rbox(0.06, 0.04, 0.24, 0.02, "black", { parent: g }); h.position.set(-0.32, Y, Z); h.rotation.y = 0.4;
    const bl = ctx.rbox(0.06, 0.012, 0.18, 0.006, "steel", { parent: g }); bl.position.set(-0.32 - 0.13 * Math.sin(0.4) * 1.5, Y + 0.005, Z - 0.13 * Math.cos(0.4) * 1.5); bl.rotation.y = 0.4;
    ctx.rbox(0.32, 0.08, 0.22, 0.03, "towel", { parent: g }).position.set(0.02, Y, Z);
    cyl(ctx, 0.07, 0.065, 0.12, "porcelain", { parent: g }).position.set(0.38, Y, Z); }
  return sets;
}

const station = {
  enter: "pop",
  make(ctx, item) {
    const p = { props: {} };
    const W = ST.w, D = ST.d;
    ctx.rbox(1.5, 0.82, 0.42, 0.04, "wood", {}).position.set(0, 0, -D / 2 + 0.23);
    ctx.rbox(1.58, 0.05, 0.48, 0.02, "stone", {}).position.set(0, 0.82, -D / 2 + 0.25);
    // Round mirror with a brass frame, and a light bar above it (stays lit; dims with the station).
    const mz = -D / 2 + 0.05;
    const glass = ctx.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 48).rotateX(Math.PI / 2), "mirror", { edges: false, cast: false });
    glass.position.set(0, 1.46, mz);
    const frame = ctx.mesh(new THREE.TorusGeometry(0.43, 0.035, 10, 48), "brass", { edges: false });
    frame.position.set(0, 1.46, mz + 0.01);
    ctx.rbox(0.6, 0.06, 0.07, 0.025, "bulb", { cast: false }).position.set(0, 1.97, mz + 0.03);
    // Jar of combs: always on the counter.
    cyl(ctx, 0.06, 0.06, 0.2, "jar", { cast: false }).position.set(0.62, 0.87, -D / 2 + 0.2);
    p.tools = toolSets(ctx, ctx.group());
    // The chair on a pivot; everything that sits on it turns with it.
    p.pivot = ctx.group();
    p.pivot.position.set(0, 0, 0.12);
    chairParts(ctx, p.pivot);
    p.booster = ctx.group(p.pivot);
    ctx.rbox(0.44, 0.13, 0.4, 0.05, "booster", { parent: p.booster }).position.set(0, 0.55, -0.02);
    p.towel = ctx.group(p.pivot);
    ctx.rbox(0.36, 0.08, 0.17, 0.035, "towel", { parent: p.towel }).position.set(0, 1.24, 0.36);
    p.drape = ctx.group(p.pivot);
    // The cape hangs over the back of the chair, on the side the camera sees.
    { const a = ctx.rbox(0.6, 0.6, 0.035, 0.012, "cape", { parent: p.drape }); a.position.set(0, 0.46, 0.355); a.rotation.x = 0.16;
      const f = ctx.rbox(0.6, 0.035, 0.17, 0.012, "cape", { parent: p.drape }); f.position.set(0, 1.03, 0.33); f.rotation.x = 0.16; }
    p.client = clientFigure(ctx, p.pivot, item.data.client);
    p.glow = softGlow(ctx, 2.0);
    p.glow.position.set(0, 0.012, 0.05);
    p.barber = barberFigure(ctx, ctx.group(), item.data.look);
    p.barber.position.set(0.66, 0, 0.12);
    p.barber.rotation.y = -Math.PI / 2;
    return p;
  },
  draw(p, L, item) {
    const d = item.data || {};
    let busy = false;
    for (const [id, g] of Object.entries(p.tools)) busy = show(g, prop(p, "t:" + id, d.service === id, L)) || busy;
    busy = show(p.drape, prop(p, "drape", Boolean(d.service) && !d.seated, L)) || busy;
    busy = show(p.client, prop(p, "client", Boolean(d.seated), L)) || busy;
    busy = show(p.booster, prop(p, "booster", d.service === "kids", L)) || busy;
    busy = show(p.towel, prop(p, "towel", Boolean(d.towel), L)) || busy;
    // Kids sit higher on the booster.
    p.client.position.y = d.service === "kids" ? 0.1 : 0;
    p.client.scale.multiplyScalar(d.service === "kids" ? 0.82 : 1);
    p.pivot.rotation.y = 0; // the scene may turn it after this
    busy = glowTo(p.glow, L.tone === "dim" || L.tone === "faded" ? 0 : L.sel ? 1 : L.hover ? 0.9 : L.tone === "on" ? 0.8 : 0, L) || busy;
    return busy;
  },
};

// ------------------------------------------------------------- basin --
// Shampoo basin with a backwash chair. Local wall at -z. data.on lights it.
const basin = {
  enter: "pop",
  make(ctx, item) {
    const p = {};
    ctx.rbox(0.9, 0.78, 0.46, 0.04, "wood").position.set(0, 0, -0.38);
    ctx.mesh(new THREE.CylinderGeometry(0.27, 0.19, 0.17, 32, 1, false).translate(0, 0.085, 0), "porcelain", { edges: false }).position.set(0, 0.78, -0.36);
    p.water = ctx.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.01, 28), "water", { edges: false, cast: false });
    p.water.position.set(0, 0.952, -0.36);
    ctx.rbox(0.04, 0.2, 0.04, 0.015, "brass").position.set(0, 0.78, -0.58);
    ctx.rbox(0.03, 0.03, 0.1, 0.012, "brass").position.set(0, 0.95, -0.55);
    cyl(ctx, 0.04, 0.04, 0.16, "bottle").position.set(-0.34, 0.78, -0.5);
    cyl(ctx, 0.035, 0.035, 0.13, "towel").position.set(-0.24, 0.78, -0.52);
    // Backwash chair, reclined toward the bowl.
    ctx.rbox(0.42, 0.36, 0.4, 0.05, "black").position.set(0, 0, 0.22);
    ctx.rbox(0.56, 0.13, 0.52, 0.05, "leather").position.set(0, 0.36, 0.22);
    const back = ctx.rbox(0.54, 0.6, 0.12, 0.05, "leather");
    back.position.set(0, 0.44, -0.02); back.rotation.x = -0.55;
    // Wall lamp: lit when a wash is booked.
    ctx.rbox(0.06, 0.06, 0.18, 0.02, "brass", { cast: false }).position.set(0, 1.38, -0.56);
    p.bulbMat = ctx.newMat({ color: "#FFF4DD", emissive: "#FFD58A", emissiveIntensity: 0, roughness: 0.4 });
    p.bulb = ctx.mesh(new THREE.SphereGeometry(0.09, 18, 12), p.bulbMat, { edges: false, cast: false });
    p.bulb.position.set(0, 1.3, -0.45);
    p.props = {};
    p.glow = softGlow(ctx, 1.5);
    p.glow.position.set(0, 0.012, 0.05);
    return p;
  },
  draw(p, L, item, state, ctx) {
    const gb = glowTo(p.glow, item.data?.on ? 0.8 : 0, L);
    const r = prop(p, "water", Boolean(item.data?.on), L);
    p.water.visible = r.on;
    p.water.scale.set(r.s, 1, r.s);
    p.bulbMat.emissiveIntensity = item.data?.on ? 2.4 : 0;
    return r.busy || gb;
  },
};

// -------------------------------------------------------------- pole --
// Wall-mounted barber pole. It never spins (the model sleeps when idle).
const pole = {
  enter: "pop", glow: false,
  make(ctx) {
    const stripes = ctx.newMat({ map: ctx.texture("pole"), roughness: 0.35, color: "#FFFFFF" });
    ctx.rbox(0.16, 0.06, 0.06, 0.02, "brass").position.set(-0.04, 1.6, 0);
    ctx.rbox(0.16, 0.06, 0.06, 0.02, "brass").position.set(-0.04, 0.95, 0);
    cyl(ctx, 0.075, 0.075, 0.62, stripes, { seg: 32 }).position.set(0.04, 1.0, 0);
    cyl(ctx, 0.09, 0.08, 0.06, "brass").position.set(0.04, 0.94, 0);
    cyl(ctx, 0.08, 0.09, 0.05, "brass").position.set(0.04, 1.62, 0);
    ctx.mesh(new THREE.SphereGeometry(0.08, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), "brass", { edges: false }).position.set(0.04, 1.67, 0);
    return {};
  },
};

// ------------------------------------------------------------- bench --
const bench = {
  enter: "pop", glow: false,
  make(ctx, item) {
    const w = item.box.w;
    ctx.rbox(w, 0.34, 0.5, 0.04, "wood").position.set(0, 0, 0);
    for (const x of [-w / 4, w / 4]) ctx.rbox(w / 2 - 0.04, 0.11, 0.48, 0.045, "cushion").position.set(x, 0.34, 0.01);
    ctx.rbox(w - 0.04, 0.42, 0.11, 0.045, "cushion").position.set(0, 0.42, -0.22);
    ctx.rbox(0.36, 0.03, 0.26, 0.01, "paper", { cast: false }).position.set(w / 2 - 0.3, 0.45, 0.06);
    return {};
  },
};

// -------------------------------------------------------------- desk --
const desk = {
  enter: "pop", glow: false,
  make(ctx, item) {
    const { w, d } = item.box;
    // Warm wood (kie.ai target render): a black counter vanished into the black tiles.
    ctx.rbox(w, 1.0, d, 0.05, "counter").position.set(0, 0, 0);
    ctx.rbox(w + 0.06, 0.05, d + 0.06, 0.02, "stone").position.set(0, 1.0, 0);
    const scr = ctx.rbox(0.34, 0.24, 0.03, 0.015, "black", {});
    scr.position.set(0.35, 1.05, -0.06); scr.rotation.x = -0.35;
    ctx.rbox(0.12, 0.06, 0.12, 0.02, "steel").position.set(0.35, 1.05, -0.02);
    cyl(ctx, 0.06, 0.05, 0.14, "brass").position.set(-0.4, 1.05, 0);
    ctx.rbox(0.28, 0.09, 0.2, 0.02, "towel").position.set(-0.05, 1.05, 0.02);
    return {};
  },
};

// -------------------------------------------------------- materials --
export const materials = {
  wall: { color: "#F6F3EC", roughness: 0.95 },
  trim: { color: "#EDE8DE", roughness: 0.8 },
  glass: { color: "#CFE3EA", roughness: 0.05, transparent: true, opacity: 0.32 },
  wood: { color: "#5C3E2A", roughness: 0.6 },
  counter: { color: "#9A6A43", roughness: 0.55 },
  stone: { color: "#ECE7DE", roughness: 0.35 },
  chrome: { color: "#D6D9DD", roughness: 0.22, metalness: 0.85 },
  steel: { color: "#C3C8CE", roughness: 0.3, metalness: 0.7 },
  brass: { color: "#B8914E", roughness: 0.35, metalness: 0.75 },
  mirror: { color: "#E3E9EC", roughness: 0.04, metalness: 1 },
  leather: { color: "#8C5635", roughness: 0.55 },
  cushion: { color: "#9C5F38", roughness: 0.6 },
  cape: { color: "#232428", roughness: 0.85 },
  towel: { color: "#FBF9F4", roughness: 0.95 },
  porcelain: { color: "#F8F7F3", roughness: 0.28 },
  water: { color: "#8EC3D6", roughness: 0.08, metalness: 0.1 },
  jar: { color: "#6FB0B8", roughness: 0.15, transparent: true, opacity: 0.75 },
  bottle: { color: "#2C2C30", roughness: 0.4 },
  booster: { color: "#D8C29E", roughness: 0.7 },
  paper: { color: "#FFFFFF", roughness: 0.9 },
  black: { color: "#1A1A1C", roughness: 0.55 },
  trousers: { color: "#2B2F36", roughness: 0.85 },
  denim: { color: "#45597A", roughness: 0.85 },
  apron: { color: "#141416", roughness: 0.8 },
  shirt: { color: "#EEEAE2", roughness: 0.9 },
  shirtB: { color: "#4A5866", roughness: 0.9 },
  beanie: { color: "#2E3A33", roughness: 0.9 },
  skin1: { color: "#EDC3A0", roughness: 0.7 },
  skin2: { color: "#C08A62", roughness: 0.7 },
  skin3: { color: "#8B5B3D", roughness: 0.7 },
  hair: { color: "#231B16", roughness: 0.8 },
  hairGrey: { color: "#8E8A85", roughness: 0.8 },
  hairBrown: { color: "#5A4434", roughness: 0.8 },
  pot: { color: "#1E1E20", roughness: 0.6 },
  leaf: { color: "#4F7A4A", roughness: 0.85 },
  bulb: { color: "#FFF6E3", emissive: "#FFE2B0", emissiveIntensity: 1.1, roughness: 0.5 },
};

export const themes = {
  day: {
    label: "Daylight", bg: "#F4F1EA", tone: "neutral", exposure: 1.0, env: 0.35,
    hemi: [0.62, "#FFF8EE", "#5A5148"], sun: { i: 2.2, color: "#FFFFFF", dir: [-0.45, 0.85, 0.35] },
    shadow: 0.28, edge: ["#1A1E22", 0.1], veil: ["#F4F1EA", 0.55], dim: ["#E9E5DD", 0.62], night: 0, glow: 0.85,
  },
};

// Diagonal red / white / navy stripes for the pole (no picture needed).
function poleCanvas() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  const bands = [["#B3261E", 40], ["#FFFFFF", 24], ["#1F3A6B", 40], ["#FFFFFF", 24]];
  for (let y = 0; y < 256; y++) {
    let x = -y;
    while (x < 256) for (const [col, w] of bands) { g.fillStyle = col; g.fillRect(((x % 256) + 256) % 256, y, w, 1); g.fillRect((((x % 256) + 256) % 256) - 256, y, w, 1); x += w; }
  }
  return c;
}

// 8 x 8 checker tiles with thin grout and a little per-tile variation.
function checkerCanvas() {
  const S = 1024, n = 8, s = S / n;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  const rnd = fx.seeded("checker");
  g.fillStyle = "#CFC9BE"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const dark = (i + j) % 2 === 1, v = (rnd() - 0.5) * 10;
    const L = dark ? 24 + v * 0.6 : 238 + v * 0.5;
    g.fillStyle = dark ? `rgb(${L},${L},${L + 2})` : `rgb(${L + 2},${L},${L - 8})`;
    g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  return c;
}

export function build(host, { onSelect } = {}) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--red").trim() || "#B3261E";
  ACCENT.value = accent;
  return createModel(host, {
    label: "the barbershop",
    layout, materials, themes, theme: "day",
    kinds: { shell, tiles, station, basin, pole, bench, desk, plant },
    textures: {
      // Drawn, not generated: kie.ai's "8 by 8 checkerboard" came back as an irregular pattern.
      checker: { canvas: checkerCanvas },
      subway: { url: "assets/subway.jpg", canvas: () => fx.tileCanvas({ base: "#F7F6F2", line: "#D9D6CF", n: 6 }) },
      pole: { canvas: poleCanvas },
    },
    accent,
    camera: { landscape: { az: 0.58, el: 0.86 }, portrait: { az: 0.6, el: 0.95 }, azRange: 0.55, elRange: [0.5, 1.2] },
    onSelect,
    scenes: {
      // "The cut": the chair turns a half turn, clippings burst, it turns back to the mirror.
      cut(api, id) {
        const S = api.item(id);
        if (!S) return null;
        const N = 56;
        const geo = new api.THREE.BoxGeometry(0.06, 0.012, 0.02);
        const m = api.newMat({ color: "#2A211B", roughness: 0.9 });
        const bits = api.add(new api.THREE.InstancedMesh(geo, m, N), id);
        bits.frustumCulled = false;
        bits.visible = false;
        const rnd = fx.seeded(id + Date.now());
        const seeds = Array.from({ length: N }, () => ({ a: rnd() * Math.PI * 2, v: 0.5 + rnd() * 0.9, up: 0.6 + rnd() * 1.0, spin: rnd() * 6 }));
        const o = new api.THREE.Object3D();
        const base = new api.THREE.Vector3(0, 1.3, 0.12);
        return {
          dur: 1700, focus: () => api.box(id), view: { az: 0.42, el: 0.58 }, hideLabels: true, release: 0.9,
          step(k) {
            const pv = S.parts.pivot;
            const turn = api.fx.easeInOut(api.fx.span(k, 0.0, 0.32)) + api.fx.easeInOut(api.fx.span(k, 0.62, 0.95));
            pv.rotation.y = turn * Math.PI;
            const b = api.fx.span(k, 0.34, 0.9);
            bits.visible = b > 0 && b < 1;
            if (!bits.visible) return;
            seeds.forEach((s, i) => {
              const t = b * 0.9;
              const y = Math.max(0.01, base.y + s.up * t - 2.6 * t * t);
              o.position.set(base.x + Math.cos(s.a) * s.v * t, y, base.z + Math.sin(s.a) * s.v * t);
              o.rotation.set(s.spin * t, s.spin * 2 * t, 0);
              o.scale.setScalar(y <= 0.011 ? 1 - api.fx.span(b, 0.7, 1) : 1);
              o.updateMatrix();
              bits.setMatrixAt(i, o.matrix);
            });
            bits.instanceMatrix.needsUpdate = true;
          },
        };
      },
    },
  });
}
