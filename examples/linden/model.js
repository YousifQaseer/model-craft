// The Linden: a four-storey townhouse hotel in section (archetype C).
// layout(state, view) is pure; kinds draw the building, lobby, garage, rooms,
// the street and the linden tree. Furniture is merged per material inside each
// item, so eight furnished rooms stay well under the draw-call budget.

import { createModel, fx, THREE, GEO } from "./engine/model.js";
import { BAY, DEPTH, STOREY, SLAB, BAYS, LEVELS, ROOMS, TYPES, fitsGuests, activeRoom } from "./data.js";

const W = BAY * BAYS;            // inner width, wall to wall
const T = 0.28;                  // exterior wall thickness
const RH = STOREY - SLAB;        // room height (floor to ceiling)
const H = LEVELS * STOREY;       // top of the roof slab
const bayX = (bay, span = 1) => -W / 2 + BAY * (bay + span / 2);

// ------------------------------------------------------------- layout --
export function layout(state) {
  const guests = state.guests ?? 2;
  const tray = state.breakfast ? activeRoom(state)?.id : null;
  const items = [
    { id: "walk", kind: "walk", box: { x: 0.9, z: DEPTH / 2 + 0.85, w: W + 2 * T + 4.6, d: 1.7, y: -0.3, h: 0.3 }, pickable: false },
    { id: "building", kind: "building", box: { x: 0, z: 0, w: W + 2 * T, d: DEPTH + T, h: H + 0.5 }, pickable: false },
    // The tree stands in front of the veil plane, so it dims itself while a room is out.
    { id: "tree", kind: "tree", box: { x: W / 2 + T + 1.45, z: DEPTH / 2 + 0.95, w: 2.4, d: 2.4, h: 6.2 }, pickable: false, frame: false, tone: state.pick ? "dim" : "" },
    { id: "lobby", kind: "lobby", parent: "building", box: { x: bayX(0, 2), z: 0, w: BAY * 2, d: DEPTH, h: RH }, pickable: false },
    { id: "garage", kind: "garage", parent: "building", box: { x: bayX(2), z: 0, w: BAY, d: DEPTH, h: RH }, pickable: false, data: { car: Boolean(state.parking) } },
  ];
  for (const r of ROOMS) {
    const fits = fitsGuests(r, guests);
    const on = r.type === state.type && fits;
    const mine = state.room === r.id && on;
    items.push({
      id: r.id, kind: "room", parent: "building",
      box: { x: bayX(r.bay, r.span), z: 0, y: r.level * STOREY, w: BAY * r.span, d: DEPTH, h: RH },
      label: r.no, sub: mine ? "Yours" : "",
      ariaLabel: `Room ${r.no}, ${TYPES[r.type].name}, sleeps ${r.max}${mine ? ", your room" : ""}`,
      labelAt: [0, RH - 0.1, DEPTH / 2],
      tone: on ? "on" : "dim",
      glowY: 0.05,
      lift: { axis: "z", dir: 1 }, focus: true, focusPad: 0.25,
      data: { type: r.type, span: r.span, extra: on && guests >= 3 && r.extra ? r.extra : null, tray: tray === r.id },
    });
  }
  return items;
}

// --------------------------------------------- merged-geometry builder --
// Collect parts per material, then make ONE mesh per material.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function mergeGeos(list) {
  const parts = list.map(([g, m]) => (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m));
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    o += p.attributes.position.count;
    p.dispose();
  }
  for (const [g] of list) if (g.userData.temp) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
const temp = (g) => { g.userData.temp = true; return g; };
function builder() {
  const by = new Map();
  const stack = [new THREE.Matrix4()];
  const push = (mat, geo, x = 0, y = 0, z = 0, r = [0, 0, 0], s = [1, 1, 1]) => {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(s[0], s[1], s[2]));
    const m = stack[stack.length - 1].clone().multiply(_m);
    if (!by.has(mat)) by.set(mat, []);
    by.get(mat).push([geo, m]);
  };
  const B = {
    // Unit box: centre x/z, base y, size w x h x d.
    box: (mat, x, z, w, d, y, h, ry = 0) => push(mat, GEO.box, x, y, z, [0, ry, 0], [w, h, d]),
    rbox: (mat, w, h, d, r, x, y, z, ry = 0) => push(mat, temp(fx.roundedBox(w, h, d, r, 2)), x, y, z, [0, ry, 0]),
    cyl: (mat, rt, rb, h, x, y, z, seg = 20) => push(mat, temp(new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0)), x, y, z),
    // A cylinder centred on (x, y, z), turned by rot (wheels, rollers, round windows).
    cylC: (mat, r, h, x, y, z, rot, seg = 20) => push(mat, temp(new THREE.CylinderGeometry(r, r, h, seg)), x, y, z, rot),
    ball: (mat, r, x, y, z, s = [1, 1, 1], detail = 1) => push(mat, temp(new THREE.IcosahedronGeometry(r, detail)), x, y, z, [0, 0, 0], s),
    geo: (mat, g, x, y, z, rot, s) => push(mat, temp(g), x, y, z, rot, s),
    // Parts inside fn are placed relative to (x, y, z) turned by ry.
    at(x, y, z, ry, fn) {
      _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1));
      stack.push(stack[stack.length - 1].clone().multiply(_m));
      fn();
      stack.pop();
    },
    build(ctx, { parent, edges = [], noCast = [] } = {}) {
      const out = {};
      for (const [mat, list] of by) {
        out[mat] = ctx.mesh(mergeGeos(list), mat, { parent, edges: edges.includes(mat), cast: !noCast.includes(mat) });
      }
      return out;
    },
  };
  return B;
}

// ------------------------------------------------------ furniture parts --
// Facing +z by default (the seat front); turn with B.at(..., ry).
function armchair(B, mat = "fabric") {
  B.rbox(mat, 0.78, 0.42, 0.74, 0.08, 0, 0, 0.02);
  B.rbox(mat, 0.78, 0.78, 0.18, 0.07, 0, 0, -0.3);
  B.rbox(mat, 0.15, 0.6, 0.72, 0.06, -0.33, 0, 0.02);
  B.rbox(mat, 0.15, 0.6, 0.72, 0.06, 0.33, 0, 0.02);
}
function sofa(B, len = 1.9, mat = "fabric") {
  B.rbox(mat, len, 0.42, 0.86, 0.08, 0, 0, 0.02);
  B.rbox(mat, len, 0.8, 0.2, 0.08, 0, 0, -0.34);
  B.rbox(mat, 0.18, 0.6, 0.86, 0.07, -len / 2 + 0.09, 0, 0.02);
  B.rbox(mat, 0.18, 0.6, 0.86, 0.07, len / 2 - 0.09, 0, 0.02);
}
// A bed with its headboard on the -x side: centre (cx, cz), length along x.
function bed(B, cx, cz, len, wid, panel) {
  B.rbox("wood", len, 0.28, wid, 0.04, cx, 0, cz);
  B.rbox("bedding", len - 0.06, 0.22, wid - 0.04, 0.06, cx + 0.01, 0.26, cz);
  B.rbox("throw", 0.55, 0.06, wid + 0.03, 0.03, cx + len / 2 - 0.38, 0.44, cz);
  for (const s of [-1, 1]) B.rbox("bedding", 0.36, 0.15, wid / 2 - 0.12, 0.06, cx - len / 2 + 0.3, 0.47, cz + s * wid / 4);
  B.rbox(panel, 0.09, 1.15, wid + 0.18, 0.04, cx - len / 2 - 0.045, 0, cz);
}
function nightstand(B, x, z) {
  B.rbox("wood", 0.42, 0.5, 0.38, 0.04, x, 0, z);
  B.cyl("brass", 0.04, 0.06, 0.28, x, 0.5, z, 12);
  B.cyl("bulb", 0.09, 0.14, 0.2, x, 0.74, z, 18);
}
// A small olive standard: terracotta pot, thin trunk, a loose head of leaves.
function plant(B, x, z, s = 1) {
  B.cyl("pot", 0.16 * s, 0.12 * s, 0.3 * s, x, 0, z, 16);
  B.cyl("bark", 0.018 * s, 0.024 * s, 0.6 * s, x, 0.28 * s, z, 6);
  const rnd = fx.seeded(`${x},${z}`);
  for (let i = 0; i < 9; i++) B.ball("leaf", (0.07 + rnd() * 0.05) * s, x + (rnd() - 0.5) * 0.36 * s, (0.78 + rnd() * 0.38) * s, z + (rnd() - 0.5) * 0.36 * s, [1, 0.85, 1], 0);
}
function windowOn(B, x, y, w, h, z) { // a window set into a back wall whose inner face is at z
  B.box("glass", x, z + 0.012, w, 0.02, y, h);
  B.box("trim", x, z + 0.03, w + 0.12, 0.04, y - 0.06, 0.06);
  B.box("trim", x, z + 0.03, w + 0.12, 0.04, y + h, 0.06);
  B.box("trim", x - w / 2 - 0.03, z + 0.03, 0.06, 0.04, y, h);
  B.box("trim", x + w / 2 + 0.03, z + 0.03, 0.06, 0.04, y, h);
  B.box("trim", x, z + 0.03, 0.04, 0.03, y, h); // mullion
  for (const s of [-1, 1]) B.rbox("curtain", 0.22, h + 0.35, 0.08, 0.035, x + s * (w / 2 + 0.2), y - 0.25, z + 0.07);
}
function tub(B, x, z, ry) {
  const pts = [[0, 0.1], [0.3, 0.1], [0.4, 0.18], [0.43, 0.56], [0.4, 0.58], [0.36, 0.22], [0.25, 0.16], [0, 0.16]].map(([a, b]) => new THREE.Vector2(a, b));
  B.geo("porcelain", new THREE.LatheGeometry(pts, 28), x, 0, z, [0, ry, 0], [1.85, 1, 1]);
  for (const [u, v] of [[-0.55, -0.22], [0.55, -0.22], [-0.55, 0.22], [0.55, 0.22]]) {
    const c = Math.cos(ry), s = Math.sin(ry);
    B.ball("brass", 0.05, x + u * c + v * s, 0.05, z - u * s + v * c, [1, 1, 1], 0);
  }
}

// Pop/ease helper for parts a kind shows and hides (snaps under reduced motion).
function ease(p, key, goal, dt, rate = 9) {
  const v = p[key] ?? goal;
  const n = fx.reducedMotion() ? goal : v + (goal - v) * fx.approach(dt, rate);
  p[key] = Math.abs(goal - n) < 0.002 ? goal : n;
  return p[key] !== goal;
}

// ---------------------------------------------------------------- room --
const PT = 0.07, BT = 0.08;
const room = {
  enter: "rise",
  make(ctx, item) {
    const { w, d, h } = item.box, type = item.data.type, span = item.data.span;
    const x0 = -w / 2 + PT, x1 = w / 2 - PT, zb = -d / 2 + BT;
    const p = {};
    const fm = span > 1 ? "floorWide" : "floor";
    ctx.mat(fm).map?.repeat.set(w / 1.6, d / 1.6);
    p.floor = ctx.box(fm, { edges: false, cast: false });
    ctx.put(p.floor, 0, 0, w, d, 0, 0.04);
    const B = builder();
    // Shell: back wall and the two partitions, plus a white cut on their front edges.
    B.box("wall", 0, -d / 2 + BT / 2, w, BT, 0.04, h - 0.04);
    B.box("wall", -w / 2 + PT / 2, 0, PT, d, 0.04, h - 0.04);
    // The right partition is its own mesh: it lowers as the room slides out,
    // or it would hide the room from the camera (which sits to the right).
    p.rwall = ctx.box("wall");
    p.rwallAt = [w / 2 - PT / 2, PT, d, h - 0.04];
    const panel = type === "queen" ? "panelQueen" : type === "king" ? "panelKing" : "panelSuite";
    const kingLen = 2.1, kingWid = 1.95, qLen = 2.05, qWid = 1.6;
    const ex = ctx.group(); // the extra bed (3+ guests)
    const E = builder();
    p.chair = null;
    if (type === "queen") {
      const cx = x0 + 0.09 + qLen / 2, cz = zb + 1.3;
      bed(B, cx, cz, qLen, qWid, panel);
      nightstand(B, x0 + 0.22, cz - qWid / 2 - 0.27);
      nightstand(B, x0 + 0.22, cz + qWid / 2 + 0.27);
      B.rbox("rug", 2.2, 0.012, 1.9, 0.005, cx + 0.55, 0.04, cz + 0.35);
      windowOn(B, x1 - 0.95, 0.95, 1.0, 1.25, zb);
      p.tray = { x: cx + 0.2, y: 0.49, z: cz };
      const C = builder();
      C.at(x1 - 0.5, 0.04, 1.05, -Math.PI / 2, () => armchair(C));
      p.chair = C.build(ctx, { parent: ctx.group() });
      E.at(x1 - 0.52, 0.04, 0.95, 0, () => {
        E.rbox("wood", 0.95, 0.32, 1.95, 0.04, 0, 0, 0);
        E.rbox("bedding", 0.89, 0.18, 1.9, 0.05, 0, 0.3, 0);
        E.rbox("bedding", 0.6, 0.13, 0.32, 0.05, 0, 0.47, -0.72);
        E.rbox("throw", 0.93, 0.05, 0.5, 0.025, 0, 0.47, 0.6);
      });
    } else if (type === "king") {
      const cx = x0 + 0.09 + kingLen / 2, cz = zb + 1.45;
      bed(B, cx, cz, kingLen, kingWid, panel);
      nightstand(B, x0 + 0.22, cz - kingWid / 2 - 0.27);
      nightstand(B, x0 + 0.22, cz + kingWid / 2 + 0.27);
      B.rbox("rug", 2.3, 0.012, 2.1, 0.005, cx + 0.5, 0.04, cz + 0.4);
      windowOn(B, x1 - 0.9, 0.95, 1.0, 1.25, zb);
      plant(B, x0 + 0.32, d / 2 - 0.4, 1.2);
      p.tray = { x: cx + 0.2, y: 0.49, z: cz };
      const C = builder();
      C.at(x1 - 0.5, 0.04, 1.15, -Math.PI / 2, () => armchair(C));
      p.chair = C.build(ctx, { parent: ctx.group() });
      E.at(x1 - 0.47, 0.04, 0.95, -Math.PI / 2, () => {
        sofa(E, 1.95);
        E.rbox("bedding", 1.62, 0.12, 0.8, 0.05, 0, 0.42, 0.05);
        E.rbox("bedding", 0.34, 0.13, 0.55, 0.05, -0.62, 0.53, 0.05);
      });
    } else {
      // Linden Suite: bedroom on the left, sitting room and tub on the right.
      const cx = x0 + 0.09 + kingLen / 2, cz = zb + 1.45;
      bed(B, cx, cz, kingLen, kingWid, panel);
      nightstand(B, x0 + 0.22, cz - kingWid / 2 - 0.27);
      nightstand(B, x0 + 0.22, cz + kingWid / 2 + 0.27);
      B.rbox("rug", 2.4, 0.012, 2.2, 0.005, cx + 0.5, 0.04, cz + 0.4);
      windowOn(B, -0.9, 0.95, 1.0, 1.25, zb);
      windowOn(B, x1 - 1.0, 0.95, 1.0, 1.25, zb);
      B.box("wall", 0.05, zb + 1.1, 0.1, 2.2, 0.04, 1.35); // half partition
      B.at(0.58, 0.04, 1.0, Math.PI / 2, () => sofa(B, 2.0));
      B.rbox("wood", 0.6, 0.36, 1.0, 0.05, 1.55, 0.04, 1.0);
      B.rbox("rug", 2.0, 0.012, 2.3, 0.005, 1.5, 0.04, 1.0);
      tub(B, x1 - 1.0, zb + 0.75, 0);
      B.at(x1 - 0.5, 0.04, 1.45, -Math.PI / 2, () => armchair(B));
      plant(B, x1 - 0.32, d / 2 - 0.35, 1.25);
      p.tray = { x: cx + 0.2, y: 0.49, z: cz };
      E.at(0.58, 0.04, 1.0, Math.PI / 2, () => {
        E.rbox("bedding", 1.66, 0.12, 0.8, 0.05, 0, 0.42, 0.05);
        E.rbox("bedding", 0.34, 0.13, 0.55, 0.05, -0.64, 0.53, 0.05);
      });
    }
    p.body = B.build(ctx, { edges: ["wall"], noCast: ["rug", "glass", "trim", "curtain"] });
    p.extra = ex;
    E.build(ctx, { parent: ex });
    // The breakfast tray, on the bed.
    const tr = ctx.group();
    const TB = builder();
    TB.rbox("wood", 0.72, 0.05, 0.5, 0.02, 0, 0, 0);
    TB.rbox("wood", 0.72, 0.06, 0.04, 0.015, 0, 0.04, -0.23);
    TB.rbox("wood", 0.72, 0.06, 0.04, 0.015, 0, 0.04, 0.23);
    TB.cyl("porcelain", 0.075, 0.06, 0.1, -0.2, 0.05, -0.11, 14);
    TB.cyl("porcelain", 0.075, 0.06, 0.1, -0.2, 0.05, 0.11, 14);
    TB.cyl("porcelain", 0.16, 0.14, 0.02, 0.13, 0.05, 0, 20);
    TB.ball("throw", 0.075, 0.13, 0.1, 0, [1.7, 0.75, 1.05], 1);
    TB.cyl("brass", 0.03, 0.035, 0.17, 0.3, 0.05, -0.17, 8);
    TB.ball("leaf", 0.045, 0.3, 0.24, -0.17, [1, 1, 1], 0);
    TB.build(ctx, { parent: tr, noCast: ["porcelain", "throw", "brass", "leaf"] });
    p.trayG = tr;
    return p;
  },
  draw(p, L, item, state, ctx) {
    let busy = false;
    const [rx, rw, rd, rh] = p.rwallAt;
    ctx.put(p.rwall, rx, 0, rw, rd, 0.04, rh * (1 - 0.86 * fx.easeInOut(L.lift)));
    // Extra bed pops in; the plain chair steps aside.
    if (ease(p, "exK", item.data.extra ? 1 : 0, L.dt, 10)) busy = true;
    const k = p.exK;
    p.extra.visible = k > 0.01;
    p.extra.scale.set(1, Math.max(0.01, fx.easeBack(Math.min(1, k))), 1);
    if (p.chair) for (const m of Object.values(p.chair)) m.visible = k < 0.5;
    // Tray.
    if (ease(p, "trK", item.data.tray ? 1 : 0, L.dt, 9)) busy = true;
    p.trayG.visible = p.trK > 0.01;
    p.trayG.position.set(p.tray.x, p.tray.y + (1 - p.trK) * 0.35, p.tray.z);
    p.trayG.scale.setScalar(Math.max(0.01, p.trK));
    return busy;
  },
};

// ------------------------------------------------------------ building --
const building = {
  enter: "rise",
  glow: false,
  make(ctx, item) {
    const D = DEPTH, B = builder();
    // Plinth and slabs (the white section cuts).
    B.box("cut", 0, 0, W + 2 * T + 0.3, D + T + 0.3, -0.3, 0.3);
    for (let l = 1; l <= LEVELS; l++) B.box("cut", 0, 0, W, D, l * STOREY - SLAB, SLAB);
    // Parapet and cornice.
    B.box("cut", 0, -T / 2, W + 2 * T + 0.24, D + T + 0.24, H, 0.16);
    B.box("cut", 0, -T / 2, W + 2 * T, D + T, H + 0.16, 0.34);
    // Back wall (inner face plaster, shows in an empty slot).
    B.box("shell", 0, -D / 2 - T / 2, W, T, 0, H);
    // White cut faces on the side walls' front edges.
    for (const s of [-1, 1]) B.box("cut", s * (W / 2 + T / 2), D / 2 - 0.01, T + 0.02, 0.04, -0.02, H + 0.02);
    // Windows on the right wall's outside face, lit at night.
    const wx = W / 2 + T + 0.005;
    for (let l = 0; l < LEVELS; l++) {
      for (const z of l === 0 ? [-0.95] : [-1.05, 0.85]) {
        const y = l * STOREY + 0.75, h = 1.35;
        B.box("window", wx, z, 0.02, 0.85, y, h);
        B.box("trim", wx + 0.01, z, 0.04, 1.0, y - 0.1, 0.1);
        B.box("trim", wx + 0.01, z, 0.04, 1.0, y + h, 0.12);
      }
      if (l > 0) B.box("trim", wx + 0.01, -T / 2, 0.05, D + T, l * STOREY - SLAB, 0.1); // string course
    }
    const out = B.build(ctx, { edges: ["cut", "shell"], noCast: ["window", "trim"] });
    // Brick side walls. Both are the same size, so one named material (and one
    // texture repeat) serves both and the theme can still tint it.
    ctx.mat("brick").map?.repeat.set((D + T) / 1.1, H / 1.1);
    for (const s of [-1, 1]) ctx.put(ctx.box("brick"), s * (W / 2 + T / 2), -T / 2, T, D + T, -0.02, H + 0.02);
    // Two chimney stacks on the party walls.
    for (const [x, z] of [[-W / 2 + 0.2, -D / 2 + 0.5], [W / 2 - 0.2, -D / 2 + 0.7]]) {
      ctx.put(ctx.box("brick"), x, z, 0.62, 0.9, H + 0.5, 0.95);
      const cap = ctx.box("cut");
      ctx.put(cap, x, z, 0.72, 1.0, H + 1.45, 0.08);
      for (const dx of [-0.13, 0.13]) { const pot = ctx.cyl("pot"); ctx.put(pot, x + dx, z, 0.13, 0.13, H + 1.53, 0.26); }
    }
    // The hotel's name on the parapet: brass letters on a navy plate.
    const c = document.createElement("canvas"); c.width = 1024; c.height = 150;
    const g = c.getContext("2d");
    g.fillStyle = "#1D2740"; g.fillRect(0, 0, 1024, 150);
    g.fillStyle = "#D9B27A"; g.font = "600 92px 'Cormorant Garamond', Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
    if ("letterSpacing" in g) g.letterSpacing = "18px";
    g.fillText("THE LINDEN", 512, 80);
    const sign = ctx.mesh(ctx.own(new THREE.PlaneGeometry(2.6, 0.38)), ctx.newMat({ map: ctx.own(fx.canvasTexture(c, { repeat: false })), roughness: 0.5 }), { cast: false, edges: false });
    sign.position.set(0, H + 0.33, DEPTH / 2 + 0.006);
    return out;
  },
};

// -------------------------------------------------------------- lobby --
const lobby = {
  enter: "rise",
  glow: false,
  make(ctx, item) {
    const { w, d, h } = item.box;
    const x0 = -w / 2, x1 = w / 2 - PT, zb = -d / 2 + BT;
    ctx.mat("floorLobby").map?.repeat.set(w / 1.6, d / 1.6);
    const fl = ctx.box("floorLobby", { edges: false, cast: false });
    ctx.put(fl, 0, 0, w, d, 0, 0.04);
    const B = builder();
    B.box("wall", 0, -d / 2 + BT / 2, w, BT, 0.04, h - 0.04);
    B.box("wall", w / 2 - PT / 2, 0, PT, d, 0.04, h - 0.04); // between lobby and garage
    // Reception: desk, key wall, lamp, bell.
    const rx = x0 + 1.7, rz = zb + 1.35;
    B.rbox("wood", 2.3, 1.02, 0.62, 0.08, rx, 0.04, rz);
    B.rbox("stone", 2.4, 0.05, 0.72, 0.02, rx, 1.06, rz);
    B.rbox("wood", 2.0, 1.75, 0.3, 0.04, rx, 0.04 + 0.45, zb + 0.16);
    for (let i = 0; i < 12; i++) B.rbox("brass", 0.08, 0.1, 0.02, 0.01, rx - 0.75 + (i % 6) * 0.3, 0.95 + Math.floor(i / 6) * 0.45, zb + 0.32);
    B.ball("brass", 0.06, rx + 0.75, 1.13, rz, [1, 0.8, 1]);
    B.cyl("brass", 0.035, 0.05, 0.3, rx - 0.8, 1.11, rz, 10);
    B.cyl("bulb", 0.09, 0.13, 0.17, rx - 0.8, 1.38, rz, 16);
    // Lounge: two chairs, a round table, a rug, a plant, a floor lamp.
    const lx = x1 - 1.6, lz = 0.75;
    B.rbox("rug", 2.6, 0.012, 2.0, 0.005, lx, 0.04, lz);
    B.at(lx - 0.75, 0.04, lz, Math.PI / 2 - 0.3, () => armchair(B, "fabric"));
    B.at(lx + 0.75, 0.04, lz, -Math.PI / 2 + 0.3, () => armchair(B, "fabric"));
    B.cyl("brass", 0.04, 0.12, 0.42, lx, 0.04, lz, 12);
    B.cyl("stone", 0.38, 0.38, 0.04, lx, 0.46, lz, 32);
    plant(B, x0 + 0.45, d / 2 - 0.45, 1.5);
    plant(B, x1 - 0.4, zb + 0.4, 1.35);
    B.cyl("brass", 0.015, 0.015, 1.5, x1 - 0.35, 0.04, 1.9, 8);
    B.cyl("bulb", 0.12, 0.18, 0.24, x1 - 0.35, 1.5, 1.9, 18);
    // Pendants under the ceiling (kept below the slab).
    for (const px of [rx - 0.5, rx + 0.5]) {
      B.cyl("brass", 0.006, 0.006, 0.7, px, h - 0.7, rz, 6);
      B.cyl("bulb", 0.07, 0.17, 0.18, px, h - 0.88, rz, 18);
    }
    // A tall arched window to the garden (a rectangle with a round head).
    const wx = x1 - 1.6;
    B.box("glass", wx, zb + 0.012, 1.3, 0.02, 0.5, 1.55);
    B.cylC("glass", 0.65, 0.02, wx, 2.05, zb + 0.012, [Math.PI / 2, 0, 0], 24);
    B.box("trim", wx, zb + 0.03, 0.04, 0.03, 0.5, 2.15);
    B.box("trim", wx, zb + 0.03, 1.42, 0.04, 0.44, 0.06);
    return B.build(ctx, { edges: ["wall"], noCast: ["rug", "glass", "trim"] });
  },
};

// ------------------------------------------------------------- garage --
const garage = {
  enter: "rise",
  glow: false,
  make(ctx, item) {
    const { w, d, h } = item.box;
    const p = {};
    const fl = ctx.box("concrete", { edges: false, cast: false });
    ctx.put(fl, 0, 0, w, d, 0, 0.04);
    const B = builder();
    B.box("wall", 0, -d / 2 + BT / 2, w, BT, 0.04, h - 0.04);
    for (const s of [-1, 1]) B.box("paint", s * 1.12, 0.3, 0.07, 3.2, 0.04, 0.006); // bay lines
    B.cylC("metal", 0.17, w - 0.2, 0, h - 0.2, d / 2 - 0.25, [0, 0, Math.PI / 2]);
    B.box("metal", -w / 2 + 0.12, d / 2 - 0.12, 0.06, 0.08, 0.04, h - 0.1);
    B.box("metal", w / 2 - 0.12, d / 2 - 0.12, 0.06, 0.08, 0.04, h - 0.1);
    B.rbox("brass", 0.42, 0.42, 0.03, 0.04, 0, 1.55, -d / 2 + BT + 0.01); // "P" plate
    B.box("tyre", 0, -d / 2 + BT + 0.03, 0.06, 0.012, 1.63, 0.26);
    B.box("tyre", 0.04, -d / 2 + BT + 0.03, 0.1, 0.012, 1.81, 0.08);
    B.box("tyre", 0.04, -d / 2 + BT + 0.03, 0.1, 0.012, 1.69, 0.06);
    p.body = B.build(ctx, { edges: ["wall"], noCast: ["paint"] });
    // A small toy car, nose to the street.
    const car = ctx.group();
    const C = builder();
    C.rbox("car", 1.72, 0.55, 3.55, 0.2, 0, 0.22, 0);
    C.rbox("car", 1.5, 0.48, 1.85, 0.2, 0, 0.66, -0.2);
    C.rbox("carGlass", 1.53, 0.34, 1.62, 0.12, 0, 0.74, -0.2);
    for (const [x, z] of [[-0.8, 1.15], [0.8, 1.15], [-0.8, -1.15], [0.8, -1.15]]) {
      C.cylC("tyre", 0.33, 0.24, x, 0.33, z, [0, 0, Math.PI / 2]);
    }
    for (const s of [-1, 1]) C.ball("bulb", 0.1, s * 0.6, 0.55, 1.75, [1.2, 0.7, 0.4], 1);
    C.build(ctx, { parent: car, noCast: ["carGlass", "bulb"] });
    p.car = car;
    return p;
  },
  draw(p, L, item) {
    const busy = ease(p, "carK", item.data.car ? 1 : 0, L.dt, 3.2);
    const k = p.carK;
    p.car.visible = k > 0.01;
    p.car.position.set(0, 0.04, (1 - fx.easeOut(k)) * 6.5 - 0.1);
    return busy;
  },
};

// ------------------------------------------------------- street, tree --
const walk = {
  enter: "rise",
  glow: false,
  make(ctx, item) {
    const { w, d, h } = item.box;
    const B = builder();
    B.box("stone", 0, 0, w, d, 0, h);
    B.box("curb", 0, d / 2 - 0.09, w, 0.18, h, 0.04);
    return B.build(ctx, { edges: ["stone"] });
  },
};
const tree = {
  enter: "pop",
  glow: false,
  make(ctx, item) {
    const B = builder();
    B.box("curb", 0, 0, 1.1, 1.1, -0.01, 0.04);
    B.cyl("bark", 0.1, 0.16, 3.0, 0, 0, 0, 10);
    B.cyl("bark", 0.04, 0.07, 1.0, 0.25, 2.4, 0, 8, [0, 0, -0.5]);
    const rnd = fx.seeded("linden");
    const blobs = [[0, 3.9, 0, 1.15], [0.55, 3.45, 0.3, 0.8], [-0.55, 3.5, -0.2, 0.85], [0.1, 4.6, -0.1, 0.85], [-0.3, 3.2, 0.5, 0.7], [0.35, 4.2, -0.5, 0.75]];
    for (const [x, y, z, r] of blobs) B.ball("leaf", r * (0.95 + rnd() * 0.1), x, y, z, [1, 0.92, 1], 1);
    return B.build(ctx, { noCast: [] });
  },
};

// ---------------------------------------------------------- materials --
export const materials = {
  floor: { map: "oak", roughness: 0.7 },
  floorWide: { map: "oak", roughness: 0.7 },
  floorLobby: { map: "oak", roughness: 0.7 },
  wall: { roughness: 0.95 },
  shell: { roughness: 0.95 },
  cut: { roughness: 0.9 },
  stone: { roughness: 0.85 },
  curb: { roughness: 0.9 },
  concrete: { roughness: 0.95 },
  paint: { roughness: 0.6 },
  glass: { roughness: 0.08, metalness: 0.1, emissive: "#000000", emissiveIntensity: 0 },
  window: { roughness: 0.15, emissive: "#FFC27A", emissiveIntensity: 0 },
  trim: { roughness: 0.6 },
  curtain: { roughness: 0.95 },
  wood: { roughness: 0.6 },
  bedding: { roughness: 0.9 },
  throw: { roughness: 0.85 },
  fabric: { roughness: 0.9 },
  panelQueen: { roughness: 0.85 },
  panelKing: { roughness: 0.85 },
  panelSuite: { roughness: 0.8 },
  rug: { roughness: 1 },
  brass: { roughness: 0.32, metalness: 0.85 },
  metal: { roughness: 0.45, metalness: 0.5 },
  porcelain: { roughness: 0.25 },
  bulb: { emissive: "#FFC27A", emissiveIntensity: 0, roughness: 0.7 },
  pot: { roughness: 0.9 },
  leaf: { roughness: 0.85 },
  bark: { roughness: 0.95 },
  car: { roughness: 0.35, metalness: 0.2 },
  carGlass: { roughness: 0.1, metalness: 0.3 },
  tyre: { roughness: 0.8 },
  brick: { map: "brick", roughness: 0.92 },
};

const DAY = {
  floor: "#F6E3C6", floorWide: "#F6E3C6", floorLobby: "#F0D9B8", wall: "#FBF7F0", shell: "#E9E2D6", cut: "#FBF8F2",
  stone: "#D9D0C1", curb: "#BDB3A3", concrete: "#C9C4BB", paint: "#F2EEE6",
  glass: { color: "#BFD8E6", emissive: "#000000", emissiveIntensity: 0 }, window: { color: "#9FB6C8", emissiveIntensity: 0 },
  trim: "#F7F3EC", curtain: "#ECE3D2", wood: "#7A5238", bedding: "#FBF8F2", throw: "#C9A06A", fabric: "#E2D6C0",
  panelQueen: "#C9B79A", panelKing: "#7C8B6E", panelSuite: "#2E3A5A", rug: "#D8C9AE", brass: "#C9A36A", metal: "#5A5F66",
  porcelain: "#FBFAF7", bulb: { color: "#F3E6CC", emissive: "#FFC27A", emissiveIntensity: 0.15 }, pot: "#C07A5A", leaf: "#7E9460", bark: "#5E4A3C",
  car: "#3F5E50", carGlass: "#2A3440", tyre: "#26282C", brick: "#9A6252",
};
const NIGHT = {
  floor: "#DDBB92", floorWide: "#DDBB92", floorLobby: "#D4AE84", wall: "#F6DDBA", shell: "#7D8396", cut: "#B4BED6",
  stone: "#5E6680", curb: "#4A5068", concrete: "#8C877F", paint: "#CFC8BC",
  glass: { color: "#1D2A4A", emissive: "#203366", emissiveIntensity: 0.35 }, window: { color: "#FFD9A0", emissiveIntensity: 1.6 },
  trim: "#DCD3C4", curtain: "#E2CDAA", wood: "#6E4630", bedding: "#F6EADA", throw: "#C08E4A", fabric: "#CDBB9C",
  panelQueen: "#BBA383", panelKing: "#6E7C60", panelSuite: "#2A3553", rug: "#CDB894", brass: "#D6AE6E", metal: "#4A4E55",
  porcelain: "#F5EDE2", bulb: { color: "#FFE7B8", emissiveIntensity: 2.4 }, pot: "#A86A4E", leaf: "#5E7448", bark: "#4C3C32",
  car: "#34503F", carGlass: "#151B26", tyre: "#1C1D20", brick: "#6E4438",
};

export const themes = {
  day: {
    label: "Day", bg: "#1D2740", tone: "neutral", exposure: 1.06, env: 0.45,
    hemi: [0.9, "#FFF6EA", "#6B5E50"], sun: { i: 2.1, color: "#FFF1DC", dir: [-0.38, 0.55, 0.74] },
    shadow: 0.3, edge: ["#1A1E22", 0.1], veil: ["#1D2740", 0.62], dim: ["#4D5466", 0.6], glow: 1.8, night: 0,
    colors: DAY,
  },
  night: {
    label: "Night", bg: "#0F1526", tone: "neutral", exposure: 1.1, env: 0.25,
    hemi: [0.85, "#B4C0E6", "#4A3A2C"], sun: { i: 0.95, color: "#C9D4F2", dir: [-0.3, 0.6, 0.75] },
    shadow: 0.45, edge: ["#000000", 0.2], veil: ["#0B1020", 0.62], dim: ["#343846", 0.64], glow: 1.8, night: 1,
    colors: NIGHT,
  },
};

// A canvas brick, shown until (or instead of) a generated texture.
function brickCanvas() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d"), rnd = fx.seeded("brick");
  g.fillStyle = "#D8D2C8"; g.fillRect(0, 0, 512, 512);
  const bh = 512 / 16, bw = 512 / 4;
  for (let r = 0; r < 16; r++) for (let i = -1; i < 5; i++) {
    const x = i * bw + (r % 2 ? bw / 2 : 0), v = 225 + Math.floor((rnd() - 0.5) * 40);
    g.fillStyle = `rgb(${v},${v - 6},${v - 12})`;
    g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
  }
  return c;
}

// ------------------------------------------------------------- scenes --
function steamCanvas() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,0.9)"); r.addColorStop(0.5, "rgba(255,255,255,0.35)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return c;
}
let steamTex = null;
const scenes = {
  // Breakfast arrives: the tray slides onto the bed and steam rises. Never state:
  // the tray itself is drawn by the room from state.breakfast.
  breakfast(api, id) {
    const it = api.item(id);
    if (!it) return null;
    const p = it.parts;
    steamTex = steamTex || fx.canvasTexture(steamCanvas(), { repeat: false });
    const puffs = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.renderOrder = 6;
      puffs.push(api.add(s, id));
    }
    return {
      dur: 1900, focus: () => api.box(id), hideLabels: true, release: 0.8, keepLift: true,
      step(k) {
        const s = fx.easeOut(fx.span(k, 0.05, 0.45));
        p.trayG.visible = true;
        p.trayG.scale.setScalar(1);
        p.trayG.position.set(p.tray.x + (1 - s) * 1.4, p.tray.y + Math.sin(s * Math.PI) * 0.18, p.tray.z + (1 - s) * 0.6);
        puffs.forEach((sp, i) => {
          const q = fx.span(k, 0.42 + i * 0.1, 1);
          sp.visible = q > 0 && q < 1;
          sp.material.opacity = Math.sin(q * Math.PI) * 0.75;
          sp.scale.setScalar(0.12 + q * 0.28);
          sp.position.set(p.tray.x - 0.13 + (i - 1) * 0.05, p.tray.y + 0.12 + q * 0.6, p.tray.z + (i - 1) * 0.08);
        });
      },
      end() { for (const sp of puffs) sp.material.dispose(); },
    };
  },
};

// -------------------------------------------------------------- build --
export function build(host, { onSelect, theme = "day" } = {}) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--brass").trim() || "#C9A36A";
  return createModel(host, {
    label: "The Linden, a four-storey townhouse hotel in section",
    labelsLabel: "Rooms",
    layout, materials, themes, theme,
    kinds: { room, building, lobby, garage, walk, tree },
    textures: {
      oak: { url: "assets/oak.jpg", canvas: () => fx.plankCanvas({ base: "#FFFFFF", line: "#D8D2C8", vary: 0.05 }) },
      brick: { canvas: brickCanvas },
    },
    accent,
    camera: { landscape: { az: 0.52, el: 0.4 }, portrait: { az: 0.42, el: 0.36 }, azRange: 0.55, elRange: [0.25, 0.6], pad: 1.04 },
    onSelect,
    scenes,
  });
}
