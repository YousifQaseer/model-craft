// Salt Table: the dining room in cutaway. Archetype A. Party size lights the
// tables that fit; the picked table lifts out with a place set for every guest;
// lunch or dinner relights the room; the occasion dresses the table.

import { createModel, fx, THREE } from "./engine/model.js";
import { interior } from "./kit/interior.js";
import { ROOM, TABLES, fits } from "./data.js";

// A table that also dresses itself: plates for the guests, a cloth, candles,
// a cake or flowers. Everything here is drawn from state (item.data).
const table = {
  ...interior.table,
  make(ctx, item, state) {
    const p = interior.table.make(ctx, item, state);
    const top = 0.77;
    p.cloth = ctx.rbox(p.tw + 0.08, 0.012, p.td + 0.08, 0.006, "linen", { cast: false });
    p.cloth.position.y = 0.765;
    p.plates = p.chairs.map(() => {
      const g = ctx.group();
      ctx.mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 24), "plate", { parent: g, edges: false, cast: false }).position.y = 0.0075;
      ctx.mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.12, 12).translate(0, 0.06, 0), "glass", { parent: g, edges: false, cast: false }).position.set(0.12, 0, -0.08);
      g.position.y = top;
      return g;
    });
    // Candle: a short glass with a warm flame (glows at night).
    p.candle = ctx.group();
    ctx.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 16).translate(0, 0.035, 0), "glass", { parent: p.candle, edges: false });
    ctx.mesh(new THREE.SphereGeometry(0.018, 10, 8), "flame", { parent: p.candle, edges: false, cast: false }).position.y = 0.09;
    p.candle.position.y = top;
    // Cake: two tiers and a candle.
    p.cake = ctx.group();
    ctx.mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.11, 28).translate(0, 0.055, 0), "cake", { parent: p.cake, edges: false });
    ctx.mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24).translate(0, 0.15, 0), "icing", { parent: p.cake, edges: false });
    ctx.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6).translate(0, 0.22, 0), "icing", { parent: p.cake, edges: false });
    ctx.mesh(new THREE.SphereGeometry(0.014, 8, 6), "flame", { parent: p.cake, edges: false, cast: false }).position.y = 0.27;
    p.cake.position.y = top;
    // Flowers: a vase with a loose bunch.
    p.flowers = ctx.group();
    ctx.mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.16, 18).translate(0, 0.08, 0), "glass", { parent: p.flowers, edges: false });
    const rnd = fx.seeded(item.id + "fl");
    for (let i = 0; i < 7; i++) {
      const m = ctx.mesh(new THREE.IcosahedronGeometry(0.035 + rnd() * 0.015, 0), i % 3 ? "bloom" : "leaf", { parent: p.flowers, edges: false });
      m.position.set((rnd() - 0.5) * 0.12, 0.2 + rnd() * 0.08, (rnd() - 0.5) * 0.12);
    }
    p.flowers.position.y = top;
    p.flowers.scale.setScalar(1.3);
    // A small sign for a business booking: a folded card.
    p.card = ctx.rbox(0.12, 0.07, 0.03, 0.008, "linen");
    p.card.position.y = top;
    p.k = { cake: 0, flowers: 0, cloth: 0 };
    return p;
  },
  draw(p, L, item, state, ctx) {
    interior.table.draw(p, L, item, state, ctx);
    const d = item.data;
    const guests = d.guests || 0, occ = d.occasion || "none";
    // Plates in front of each guest: chairs pulled toward the centre.
    p.plates.forEach((g, i) => {
      const c = p.chairs[i];
      g.visible = i < guests;
      if (!g.visible) return;
      const len = Math.hypot(c.position.x, c.position.z) || 1;
      const inset = p.shape === "rect" ? 0.32 : Math.min(p.tw / 2 - 0.13, len - 0.32);
      const s = inset / len;
      g.position.x = c.position.x * (p.shape === "rect" ? 1 : s);
      g.position.z = p.shape === "rect" ? Math.sign(c.position.z) * (p.td / 2 - 0.15) : c.position.z * s;
    });
    // Dressing eases in so a change reads as "the table set itself".
    const goal = { cloth: guests ? 1 : 0, cake: occ === "birthday" && guests ? 1 : 0, flowers: occ === "anniversary" && guests ? 1 : 0 };
    let moving = false;
    for (const k of Object.keys(goal)) {
      p.k[k] += (goal[k] - p.k[k]) * (L.t > 1e8 ? 1 : Math.min(1, L.dt * 9));
      if (Math.abs(goal[k] - p.k[k]) < 0.003) p.k[k] = goal[k]; else moving = true;
    }
    p.cloth.visible = p.k.cloth > 0.01;
    p.cloth.scale.set(Math.max(0.01, p.k.cloth), 1, Math.max(0.01, p.k.cloth));
    const pop = (o, k, x, z) => { o.visible = k > 0.01; const e = fx.easeBack(k); o.scale.setScalar(Math.max(0.01, e)); o.position.x = x; o.position.z = z; };
    pop(p.cake, p.k.cake, 0, 0);
    pop(p.flowers, p.k.flowers * 1.3, p.shape === "rect" ? 0.35 : 0, 0);
    p.candle.visible = guests > 0 && occ !== "birthday";
    p.candle.position.x = p.shape === "rect" ? -0.35 : occ === "anniversary" ? 0.16 : 0;
    p.card.visible = occ === "business" && guests > 0;
    p.card.position.x = p.shape === "rect" ? 0.25 : 0.14;
    return moving;
  },
};

// A herb wall on the garden side: a planter box with greenery.
const herbs = {
  enter: "rise",
  glow: false,
  make(ctx, item) {
    const box = ctx.box("wood");
    const rnd = fx.seeded(item.id);
    const leaves = [];
    for (let i = 0; i < 14; i++) leaves.push(ctx.mesh(new THREE.IcosahedronGeometry(0.1 + rnd() * 0.06, 1), "leaf", { edges: false }));
    leaves.forEach((m) => { m.userData.u = rnd(); m.userData.v = rnd(); });
    return { box, leaves };
  },
  draw(p, L, item, state, ctx) {
    ctx.put(p.box, 0, 0, L.w, L.d, 0, 0.45);
    p.leaves.forEach((m) => ctx.at(m, (m.userData.u - 0.5) * (L.w - 0.2), 0.48 + m.userData.v * 0.25, (m.userData.v - 0.5) * (L.d - 0.1)));
  },
};

export function layout(state, view) {
  const items = [
    { id: "room", kind: "shell", box: { w: ROOM.w, d: ROOM.d, h: ROOM.h }, pickable: false,
      data: { walls: { back: "full", left: "full", front: "low", right: "low" }, low: 0.3,
        openings: [
          { wall: "back", at: 0.14, w: 1.5, sill: 0.4, head: 1.3 }, { wall: "back", at: 0.36, w: 1.5, sill: 0.4, head: 1.3 },
          { wall: "back", at: 0.58, w: 1.5, sill: 0.4, head: 1.3 }, { wall: "left", at: 0.76, w: 1.1, kind: "door" } ] } },
    { id: "bar", kind: "counter", parent: "room", box: { x: 3.0, z: -1.5, w: 2.6, d: 1.4, h: 1.05 }, pickable: false, data: { stools: 4 } },
    { id: "shelf", kind: "shelf", parent: "room", box: { x: 3.0, z: -3.25, w: 2.4, d: 0.3, h: 1.25 }, pickable: false, data: { mats: { accent: "terracotta", glass: "bottle" } } },
    ...[2.2, 3.0, 3.8].map((x, i) => ({ id: "lamp" + i, kind: "pendant", parent: "room", box: { x, z: -1.75, w: 0.4, d: 0.4, h: 1.26 }, pickable: false })),
    { id: "olive", kind: "plant", parent: "room", box: { x: -4.05, z: -0.9, w: 0.5, d: 0.5, h: 1.2 }, pickable: false, data: { size: 1.5 } },
    { id: "plant2", kind: "plant", parent: "room", box: { x: 1.4, z: -3.05, w: 0.4, d: 0.4, h: 1 }, pickable: false },
    { id: "plant3", kind: "plant", parent: "room", box: { x: 4.05, z: 0.4, w: 0.4, d: 0.4, h: 1 }, pickable: false, data: { size: 1.2 } },
    { id: "herbs", kind: "herbs", parent: "room", box: { x: -1.3, z: 3.25, w: 2.6, d: 0.4, h: 0.8 }, pickable: false },
  ];
  for (const t of TABLES) {
    const ok = fits(t, state.party);
    const picked = state.pick === t.id;
    const size = t.seats >= 8 ? [3.6, 1.9] : t.seats >= 6 ? [2.6, 1.9] : t.seats >= 4 ? [1.75, 1.75] : [1.75, 1.75]; // two-tops get a full-size footprint: 44px targets at 360px
    items.push({
      id: t.id, kind: "table", parent: "room",
      box: { x: t.x, z: t.z, w: size[0], d: size[1], h: 1.0 },
      label: String(t.seats), // One-line labels on phones, or they collide.
      sub: view.w < 560 ? "" : t.spot, ariaLabel: `Table ${t.n}, seats ${t.seats}, ${t.spot}`,
      tone: ok ? "on" : "dim",
      lift: { axis: "y", dist: 1.7 },
      // Phones: the camera also moves in, so the lifted table is not a speck above the sheet.
      focus: view.portrait, focusPad: 1.6,
      data: { seats: t.seats, shape: t.seats === 2 ? "round" : undefined, guests: picked ? state.party : 0, occasion: picked ? state.occasion : "none", mats: { seat: "chair" } },
    });
  }
  return items;
}

export const materials = {
  floor: { map: "oak", roughness: 0.7 }, wall: { roughness: 0.95 }, trim: {},
  glass: { roughness: 0.08, transparent: true, opacity: 0.4 },
  wood: { roughness: 0.55 }, chair: { roughness: 0.75 }, seat: { roughness: 0.8 }, metal: { roughness: 0.35, metalness: 0.5 },
  top: { roughness: 0.35 }, pot: { roughness: 0.9 }, leaf: { roughness: 0.85 }, terracotta: { roughness: 0.85 }, bottle: { roughness: 0.2 },
  bulb: { emissive: "#FFD9A0", emissiveIntensity: 0 }, flame: { emissive: "#FFB648", emissiveIntensity: 1.2 },
  linen: { roughness: 1 }, plate: { roughness: 0.3 }, cake: { roughness: 0.9 }, icing: { roughness: 0.6 }, bloom: { roughness: 0.8 },
};

export const themes = {
  lunch: {
    label: "Lunch", bg: "#F4EEE4", tone: "neutral", exposure: 1.0, env: 0.35,
    hemi: [0.62, "#FFF7EC", "#5A5148"], sun: { i: 2.3, color: "#FFFFFF", dir: [-0.5, 0.85, 0.3] },
    shadow: 0.32, edge: ["#2A211C", 0.1], veil: ["#F4EEE4", 0.6], dim: ["#ECE4D8", 0.62], glow: 1, night: 0,
    colors: { floor: "#EACB9F", wall: "#FAF6EF", wood: "#B7835A", chair: "#5C6B3C", seat: "#5C6B3C", metal: "#2A2622", top: "#C9966A",
      pot: "#C2683E", leaf: "#6B8A4E", terracotta: "#B4532A", bottle: "#9DB7A5", glass: "#D6EAF2",
      bulb: { color: "#FFF6DD", emissiveIntensity: 0 }, flame: { color: "#FFE2A8", emissiveIntensity: 0.4 },
      linen: "#FBF8F2", plate: "#D9875E", cake: "#F4E3C7", icing: "#F7B7A3", bloom: "#E86A6A" },
  },
  dinner: {
    label: "Dinner", bg: "#2A2421", tone: "neutral", exposure: 1.12, env: 0.2,
    hemi: [0.78, "#C9B8A8", "#3B302A"], sun: { i: 0.9, color: "#FFC48A", dir: [-0.3, 0.92, 0.25] },
    shadow: 0.4, edge: ["#000000", 0.16], veil: ["#1D1916", 0.38], dim: ["#5A4E46", 0.45], glow: 1.15, night: 1,
    colors: { floor: "#C9A27A", wall: "#E8DCCB", wood: "#93623E", chair: "#46532D", seat: "#46532D", metal: "#1E1A17", top: "#A87A52",
      pot: "#A5532F", leaf: "#4C6838", terracotta: "#9C4422", bottle: "#7A9483", glass: { color: "#3A4A60", opacity: 0.55 },
      bulb: { color: "#FFE2A8", emissiveIntensity: 2.4 }, flame: { color: "#FFD58A", emissiveIntensity: 3 },
      linen: "#F3ECE1", plate: "#C9754C", cake: "#EBD6B5", icing: "#E8A492", bloom: "#D6555A" },
  },
};

export function build(host, { onSelect, theme = "lunch" }) {
  return createModel(host, {
    label: "the Salt Table dining room",
    layout, materials, themes, theme,
    kinds: { ...interior, table, herbs },
    textures: { oak: { url: "assets/oak.jpg", repeat: [4.5, 3.5], canvas: () => fx.plankCanvas({ base: "#FFFFFF", line: "#E2D8CB", vary: 0.05 }) } },
    accent: "#B4532A",
    camera: { landscape: { az: 0.62, el: 0.86 }, portrait: { az: 0.7, el: 0.95 }, azRange: 0.9 },
    onSelect,
    scenes: {
      // The table sets itself; the kind already draws the end state from state.
      dress(api, id) {
        api.burst(id, { count: 9, color: "#FFE7A3", height: 0.15 });
        return { dur: 1300, focus: () => api.box(id), step() {} };
      },
    },
  });
}
