// model-craft kit: interior kinds. Copy this file into a site and edit freely;
// it is a starting point, not part of the engine.
//
// Units are metres. Every kind draws inside its item box: centre (0, 0) in x/z,
// floor at y = 0. Camera convention: the camera sits on the +x/+z side, so the
// back (-z) and left (-x) walls are the far walls you look into.
//
// Materials each kind asks for (define them in createModel({ materials })):
//   shell:   floor, wall, trim, glass        table: wood, seat, cloth?
//   plant:   pot, leaf                       counter: wood, top, metal
//   pendant: metal, bulb                     bench: seat, wood
//   rug:     rug                             shelf: wood, accent
// Override per item with item.data.mats = { floor: "tile", wood: "oak" }.

import { THREE, fx } from "../engine/model.js";

const M = (item, name) => item.data?.mats?.[name] || name;

// ------------------------------------------------------------ shell --
// A cutaway room: slab floor, full far walls, optional low near walls,
// window and door gaps. item.data:
//   walls: { back: "full", left: "full", front: "low"|"none", right: "low"|"none" }
//   openings: [{ wall: "back", at: 0.5, w: 1.2, kind: "window"|"door", sill: 0.9, head: 2.1 }]
//   slab: 0.14 (thickness under y=0), wall: 0.12 (thickness), low: 0.35 (low wall height)
export const shell = {
  enter: "rise",
  glow: false,
  make(ctx, item) {
    const p = { floor: ctx.box(M(item, "floor"), { edges: true }), walls: [], glass: [], trims: [] };
    p.floor.castShadow = false;
    return p;
  },
  draw(p, L, item, state, ctx) {
    const d = item.data || {};
    const T = d.wall ?? 0.12, slab = d.slab ?? 0.14, low = d.low ?? 0.35, H = L.h;
    ctx.put(p.floor, 0, 0, L.w, L.d, -slab, slab);
    const walls = { back: "full", left: "full", front: "none", right: "none", ...(d.walls || {}) };
    const segs = [];
    const run = (side) => {
      const kind = walls[side];
      if (!kind || kind === "none") return;
      const h = kind === "low" ? low : H;
      const along = side === "back" || side === "front" ? L.w : L.d;
      const ops = (d.openings || []).filter((o) => o.wall === side && kind === "full").sort((a, b) => a.at - b.at);
      let u = -along / 2;
      const pushWall = (u0, u1, y0, y1) => { if (u1 - u0 > 0.01 && y1 - y0 > 0.01) segs.push({ side, u0, u1, y0, y1 }); };
      for (const o of ops) {
        const c = -along / 2 + o.at * along, a = c - o.w / 2, b = c + o.w / 2;
        pushWall(u, a, 0, H);
        const sill = o.kind === "door" ? 0 : o.sill ?? 0.9, head = Math.min(H, o.head ?? 2.1);
        pushWall(a, b, 0, sill);
        pushWall(a, b, head, H);
        if (o.kind !== "door") segs.push({ side, u0: a, u1: b, y0: sill, y1: head, glass: true });
        u = b;
      }
      pushWall(u, along / 2, 0, h);
    };
    for (const s of ["back", "left", "front", "right"]) run(s);
    let wi = 0, gi = 0;
    for (const s of segs) {
      const list = s.glass ? p.glass : p.walls;
      const idx = s.glass ? gi++ : wi++;
      if (!list[idx]) list[idx] = s.glass ? ctx.box(M(item, "glass"), { edges: false, cast: false }) : ctx.box(M(item, "wall"));
      const m = list[idx];
      m.visible = true;
      const len = s.u1 - s.u0, mid = (s.u0 + s.u1) / 2, th = s.glass ? 0.03 : T;
      const age = L.t, rise = fx.easeOut(fx.clamp01(age / 420)); // walls grow up as the room arrives
      const y0 = s.y0 * rise, h = (s.y1 - s.y0) * rise;
      if (s.side === "back") ctx.put(m, mid, -L.d / 2 + T / 2, len, th, y0, h);
      if (s.side === "front") ctx.put(m, mid, L.d / 2 - T / 2, len, th, y0, h);
      if (s.side === "left") ctx.put(m, -L.w / 2 + T / 2, mid, th, len, y0, h);
      if (s.side === "right") ctx.put(m, L.w / 2 - T / 2, mid, th, len, y0, h);
    }
    for (let i = wi; i < p.walls.length; i++) p.walls[i].visible = false;
    for (let i = gi; i < p.glass.length; i++) p.glass[i].visible = false;
  },
};

// ------------------------------------------------------------ table --
// item.data: { seats: 2|4|6|8, shape: "round"|"square"|"rect", dressed: [] }
// The table top sits at 0.75 m. Chairs tuck around it. Box should be the
// footprint including chairs (about 1.6 x 1.6 for a 4-top).
export const table = {
  enter: "pop",
  make(ctx, item) {
    const d = item.data || {};
    const seats = d.seats || 4, shape = d.shape || (seats <= 2 ? "round" : seats >= 6 ? "rect" : "square");
    const p = { seats, shape, chairs: [] };
    const tw = shape === "rect" ? 0.8 + 0.42 * Math.ceil(seats / 2) : seats <= 2 ? 0.7 : 0.9;
    const td = shape === "rect" ? 0.85 : tw;
    p.tw = tw; p.td = td;
    if (shape === "round") {
      p.top = ctx.mesh(new THREE.CylinderGeometry(tw / 2, tw / 2, 0.05, 40).translate(0, 0.025, 0), M(item, "wood"), { edges: false });
    } else p.top = ctx.rbox(tw, 0.05, td, 0.02, M(item, "wood"));
    p.top.position.y = 0.72;
    p.leg = ctx.rbox(0.08, 0.72, 0.08, 0.02, M(item, "metal"));
    p.foot = ctx.mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 32), M(item, "metal"), { edges: false });
    p.foot.position.y = 0.015;
    if (shape === "rect") { // two legs
      p.leg2 = ctx.rbox(0.08, 0.72, 0.08, 0.02, M(item, "metal"));
      p.foot2 = ctx.mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 32), M(item, "metal"), { edges: false });
      p.foot2.position.y = 0.015;
    }
    for (let i = 0; i < seats; i++) {
      const g = ctx.group();
      ctx.rbox(0.42, 0.06, 0.42, 0.025, M(item, "seat"), { parent: g }).position.y = 0.44;
      const back = ctx.rbox(0.42, 0.4, 0.05, 0.022, M(item, "seat"), { parent: g });
      back.position.set(0, 0.47, 0.2);
      for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
        ctx.rbox(0.035, 0.44, 0.035, 0.012, M(item, "metal"), { parent: g }).position.set(x, 0, z);
      }
      p.chairs.push(g);
    }
    return p;
  },
  draw(p, L, item) {
    const n = p.seats, gap = 0.5;
    const spots = [];
    if (p.shape === "rect") {
      const per = Math.ceil(n / 2), step = (p.tw - 0.3) / per;
      for (let i = 0; i < per; i++) {
        const x = -p.tw / 2 + 0.15 + step * (i + 0.5);
        spots.push([x, -p.td / 2 - gap + 0.15, 0], [x, p.td / 2 + gap - 0.15, Math.PI]);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (n === 4 ? 0 : Math.PI / 2);
        const r = (p.tw / 2) + gap - 0.12;
        spots.push([Math.sin(a) * r, Math.cos(a) * r, a + Math.PI]);
      }
    }
    p.chairs.forEach((g, i) => {
      const [x, z, ry] = spots[i] || [0, 0, 0];
      const k = L.k(i + 1);
      g.visible = k > 0.001;
      g.position.set(x, (1 - k) * 0.5, z);
      g.rotation.y = ry;
      g.scale.set(1, Math.max(0.05, Math.min(1, k)), 1);
    });
    if (p.shape === "rect") {
      p.leg.position.set(-p.tw / 2 + 0.25, 0, 0); p.foot.position.x = -p.tw / 2 + 0.25;
      p.leg2.position.set(p.tw / 2 - 0.25, 0, 0); p.foot2.position.x = p.tw / 2 - 0.25;
    }
  },
};

// ------------------------------------------------------------ plant --
export const plant = {
  enter: "pop",
  glow: false,
  make(ctx, item) {
    const s = item.data?.size ?? 1;
    const pot = ctx.mesh(new THREE.CylinderGeometry(0.17 * s, 0.13 * s, 0.32 * s, 24).translate(0, 0.16 * s, 0), M(item, "pot"), { edges: false });
    const rnd = fx.seeded(item.id);
    const leaves = [];
    for (let i = 0; i < 7; i++) {
      const r = (0.13 + rnd() * 0.08) * s;
      const m = ctx.mesh(new THREE.IcosahedronGeometry(r, 1), M(item, "leaf"), { edges: false });
      m.position.set((rnd() - 0.5) * 0.28 * s, (0.42 + rnd() * 0.45) * s, (rnd() - 0.5) * 0.28 * s);
      leaves.push(m);
    }
    return { pot, leaves };
  },
};

// ---------------------------------------------------------- counter --
// A bar or counter along its x axis. item.data: { stools: 0..6 }
export const counter = {
  enter: "rise",
  make(ctx, item) {
    const p = { body: ctx.box(M(item, "wood")), top: ctx.box(M(item, "top")), stools: [] };
    for (let i = 0; i < (item.data?.stools || 0); i++) {
      const g = ctx.group();
      ctx.mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 28), M(item, "seat"), { parent: g, edges: false }).position.y = 0.72;
      ctx.rbox(0.05, 0.72, 0.05, 0.015, M(item, "metal"), { parent: g });
      ctx.mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 28).rotateX(Math.PI / 2), M(item, "metal"), { parent: g, edges: false }).position.y = 0.3;
      p.stools.push(g);
    }
    return p;
  },
  draw(p, L, item, state, ctx) {
    const h = Math.min(L.h, 1.05), depth = Math.min(L.d, 0.65);
    ctx.put(p.body, 0, -L.d / 2 + depth / 2, L.w, depth - 0.04, 0, h - 0.05);
    ctx.put(p.top, 0, -L.d / 2 + depth / 2, L.w + 0.04, depth + 0.04, h - 0.05, 0.05);
    const n = p.stools.length;
    p.stools.forEach((g, i) => { g.position.set(-L.w / 2 + (L.w / n) * (i + 0.5), 0, -L.d / 2 + depth + 0.3); });
  },
};

// ----------------------------------------------------------- pendant --
// A hanging lamp; glows with the theme's night value. Keep its height under
// the lift veil (below the wall tops) or it pokes through when a thing lifts.
export const pendant = {
  glow: false,
  make(ctx, item) {
    const shade = ctx.mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.18, 28).translate(0, 0.09, 0), M(item, "metal"), { edges: false, cast: false });
    const bulb = ctx.mesh(new THREE.SphereGeometry(0.06, 16, 12), M(item, "bulb"), { edges: false, cast: false });
    const cord = ctx.box(M(item, "metal"), { edges: false, cast: false });
    return { shade, bulb, cord };
  },
  draw(p, L, item, state, ctx) {
    ctx.at(p.shade, 0, L.h - 0.18 - 0.25, 0);
    ctx.at(p.bulb, 0, L.h - 0.18 - 0.25 + 0.04, 0);
    ctx.put(p.cord, 0, 0, 0.01, 0.01, L.h - 0.25, 0.25);
  },
};

// -------------------------------------------------------------- rug --
export const rug = {
  enter: "pop",
  glow: false,
  make(ctx, item) { return { m: ctx.rbox(1, 0.012, 1, 0.004, M(item, "rug"), { cast: false }) }; },
  draw(p, L) { p.m.scale.set(L.w, 1, L.d); },
};

// ------------------------------------------------------------ bench --
export const bench = {
  enter: "pop",
  make(ctx, item) {
    return { seat: ctx.box(M(item, "seat")), back: ctx.box(M(item, "seat")), base: ctx.box(M(item, "wood")) };
  },
  draw(p, L, item, state, ctx) {
    ctx.put(p.base, 0, 0, L.w, L.d * 0.9, 0, 0.36);
    ctx.put(p.seat, 0, 0.03, L.w, L.d * 0.85, 0.36, 0.1);
    ctx.put(p.back, 0, -L.d / 2 + 0.07, L.w, 0.14, 0.36, 0.5);
  },
};

// ------------------------------------------------------------ shelf --
export const shelf = {
  enter: "rise",
  glow: false,
  make(ctx, item) {
    const p = { boards: [], things: [] };
    const rnd = fx.seeded(item.id);
    for (let i = 0; i < 4; i++) p.boards.push(ctx.box(M(item, "wood")));
    for (let i = 0; i < 9; i++) {
      const t = ctx.rbox(0.07 + rnd() * 0.05, 0.12 + rnd() * 0.16, 0.07, 0.02, rnd() > 0.5 ? M(item, "accent") : M(item, "glass"));
      t.userData.u = rnd(); t.userData.row = i % 3;
      p.things.push(t);
    }
    return p;
  },
  draw(p, L, item, state, ctx) {
    p.boards.forEach((b, i) => ctx.put(b, 0, 0, L.w, L.d, 0.35 + i * ((L.h - 0.4) / 3), 0.03));
    p.things.forEach((t) => ctx.at(t, -L.w / 2 + 0.1 + t.userData.u * (L.w - 0.2), 0.38 + t.userData.row * ((L.h - 0.4) / 3), 0));
  },
};

export const interior = { shell, table, plant, counter, pendant, rug, bench, shelf };
