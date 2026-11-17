// model-craft kit: a procedural toy car (die-cast proportions), four body
// styles, paint finishes, wheel designs and trim packages. Copy into a site.
//
// Items (see the dealership example in references/car.md):
//   { id: "car",    kind: "carBody",  parent: "turntable", key: style, box: carBox(style), data: { style, paint, finish, pkg } }
//   { id: "cabin",  kind: "carCabin", parent: "car", key: style, box: carBox(style), lift: { axis: "y", dist: 0.9, veil: false } }
//   { id: "wheels", kind: "carWheels", parent: "car", key: style + wheel, box: carBox(style), lift: "custom", data: { style, wheel } }
// Car frame: x = length (front at +x), y = up, z = width, centred, ground at y = 0.
//
// Materials: paint (physical), glass, tyre, rim, trim, chrome, lamp, tail, seat.

import { THREE, fx } from "../engine/model.js";

// Proportions are a toy's, not a real car's: chunky wheels, short overhangs.
export const SPECS = {
  sedan:  { L: 4.6, W: 1.86, H: 1.42, r: 0.37, wb: 2.75, sill: 0.22, belt: 0.92, cowl: 1.55, roof: [2.05, 3.25], roofY: 1.42, back: 3.95, deck: 0.98, tail: 4.6, label: "Sedan" },
  suv:    { L: 4.65, W: 1.94, H: 1.74, r: 0.41, wb: 2.8, sill: 0.3, belt: 1.06, cowl: 1.35, roof: [1.85, 4.15], roofY: 1.74, back: 4.4, deck: 1.06, tail: 4.65, label: "SUV" },
  coupe:  { L: 4.5, W: 1.88, H: 1.3, r: 0.37, wb: 2.65, sill: 0.19, belt: 0.86, cowl: 1.75, roof: [2.3, 2.95], roofY: 1.3, back: 4.25, deck: 0.92, tail: 4.5, label: "Coupe" },
  pickup: { L: 5.3, W: 1.98, H: 1.82, r: 0.43, wb: 3.35, sill: 0.34, belt: 1.12, cowl: 1.4, roof: [1.9, 2.85], roofY: 1.82, back: 3.1, deck: 1.12, tail: 5.3, bed: [3.2, 5.2], label: "Pickup" },
};
export const carBox = (style, lift = 0) => { const s = SPECS[style]; return { w: s.L, d: s.W, h: s.H + lift }; };

const OVER = (s) => (s.L - s.wb) / 2; // front and rear overhang (equal: toy-like)
const axles = (s) => [s.L / 2 - OVER(s), -(s.L / 2 - OVER(s))]; // front, rear (x)

// Side profile of the lower body (sill to belt, hood and deck), with arch notches.
// Points run in "s" from the front (0) to the rear (L); x = L/2 - s.
function lowerProfile(s) {
  const o = OVER(s), Ra = s.r * 1.16, axY = s.r;
  const pts = [];
  const P = (sv, y, r = 0) => pts.push([s.L / 2 - sv, y, r]);
  const noseY = s.belt - (s.label === "SUV" || s.label === "Pickup" ? 0.04 : 0.1);
  P(0.04, s.sill + 0.1, 0.06);
  P(0, s.belt * 0.72, 0.14);
  P(0.22, noseY, 0.22);
  P(s.cowl, s.belt, 0.08);
  if (s.bed) {
    P(s.back, s.belt, 0.04);
    P(s.L - 0.02, s.belt, 0.06);
  } else {
    P(s.back, s.deck, 0.12);
    P(s.L - 0.18, s.deck - 0.02, 0.16);
  }
  P(s.L, s.deck - 0.24, 0.12);
  P(s.L - 0.04, s.sill + 0.1, 0.06);
  // Bottom edge from the rear to the front, with the two wheel arches.
  for (const ax of [s.L - o, o]) {
    const dy = axY - s.sill;
    const dx = Math.sqrt(Math.max(0.01, Ra * Ra - dy * dy));
    P(ax + dx, s.sill, 0.03);
    const a0 = Math.atan2(s.sill - axY, dx), a1 = Math.atan2(s.sill - axY, -dx);
    const steps = 14;
    for (let i = 1; i < steps; i++) {
      const a = a0 + ((a1 + 2 * Math.PI - a0) % (2 * Math.PI)) * (i / steps);
      P(ax + Math.cos(a) * Ra, axY + Math.sin(a) * Ra, 0);
    }
    P(ax - dx, s.sill, 0.03);
  }
  return pts;
}

function cabinProfile(s) {
  const pts = [];
  const P = (sv, y, r = 0) => pts.push([s.L / 2 - sv, y, r]);
  const gB = s.belt - 0.02;
  P(s.cowl + 0.02, gB, 0.02);
  P(s.roof[0], s.roofY - 0.04, 0.16);
  P(s.roof[1], s.roofY - 0.04, s.label === "SUV" ? 0.1 : 0.2);
  P(s.back - (s.bed ? 0.02 : 0.05), gB, 0.02);
  return pts;
}

function extrude(points, width, bevel = 0.08, taper = 0.1, L = 4.5) {
  const outline = fx.fillet(points, { step: 0.08, segs: 7 });
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = Math.max(0.01, width - 2 * bevel);
  let g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  // Plan taper: the nose and tail pull in a little, like a real body in plan.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const k = 1 - taper * fx.smoothstep(0.7, 1, Math.abs(x) / (L / 2));
    p.setZ(i, p.getZ(i) * k);
  }
  g = fx.smoothNormals(g, 38);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// Paint finishes: one physical material, mutated in place.
export const FINISHES = {
  solid:    { metalness: 0.0, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0 },
  metallic: { metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0 },
  matte:    { metalness: 0.15, roughness: 0.8, clearcoat: 0, clearcoatRoughness: 0.5, iridescence: 0 },
  pearl:    { metalness: 0.5, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.4 },
};

// ------------------------------------------------------------- body --
export const carBody = {
  enter: "pop",
  glow: false,
  make(ctx, item) {
    const s = SPECS[item.data.style];
    const p = { s, paintColor: new THREE.Color(item.data.paint || "#1E4FD8") };
    p.body = ctx.mesh(extrude(lowerProfile(s), s.W, 0.09, 0.09, s.L), "paint", { edges: false });
    // Underbody shadow box between the wheels hides the gap under the sills.
    p.under = ctx.rbox(s.wb + s.r * 1.2, 0.16, s.W * 0.86, 0.05, "trim", { cast: false });
    p.under.position.y = s.sill - 0.04;
    // Lights, grille, mirrors.
    const fx0 = s.L / 2 - 0.02, rx = -s.L / 2 + 0.02;
    p.grille = ctx.rbox(0.06, s.belt * 0.22, s.W * 0.5, 0.02, "trim");
    p.grille.position.set(fx0 - 0.01, s.belt * 0.38, 0);
    p.lamps = [-1, 1].map((side) => { const m = ctx.rbox(0.1, 0.1, 0.38, 0.04, "lamp"); m.position.set(fx0 - 0.03, s.belt * 0.58, side * s.W * 0.3); return m; });
    p.tails = [-1, 1].map((side) => { const m = ctx.rbox(0.1, 0.1, 0.36, 0.035, "tail"); m.position.set(rx + 0.03, s.deck - 0.32, side * s.W * 0.3); return m; });
    // No mirrors: at toy scale they read as stray floating dots.
    // Seats, seen when the cabin lifts off.
    p.seats = [];
    const cabinMid = s.L / 2 - (s.cowl + s.back) / 2;
    const rows = s.bed || s.label === "Coupe" ? [0] : [0, 1];
    for (const row of rows) for (const side of [-1, 1]) {
      const g = ctx.group();
      ctx.rbox(0.5, 0.12, 0.5, 0.05, "seat", { parent: g });
      const back = ctx.rbox(0.12, 0.5, 0.5, 0.05, "seat", { parent: g });
      back.position.set(-0.22, 0.08, 0);
      g.position.set(cabinMid + 0.45 - row * 0.85, s.belt - 0.16, side * s.W * 0.22);
      p.seats.push(g);
    }
    p.dash = ctx.rbox(0.28, 0.14, s.W * 0.78, 0.05, "trim");
    p.dash.position.set(s.L / 2 - s.cowl - 0.2, s.belt - 0.12, 0);
    if (s.bed) { // the pickup bed: a dark liner flush with the bed rails
      p.liner = ctx.rbox(s.bed[1] - s.bed[0] - 0.12, 0.04, s.W - 0.26, 0.02, "trim", { cast: false });
      p.liner.position.set(s.L / 2 - (s.bed[0] + s.bed[1]) / 2, s.belt - 0.035, 0);
    }
    // Trim packages.
    p.spoiler = ctx.rbox(0.24, 0.05, s.W * 0.8, 0.02, "paint");
    p.spoiler.position.set(-s.L / 2 + 0.22, s.deck + 0.05, 0);
    p.belts = [-1, 1].map((side) => { const m = ctx.rbox(s.back - s.cowl, 0.025, 0.02, 0.008, "chrome"); m.position.set(s.L / 2 - (s.cowl + s.back) / 2, s.belt - 0.02, side * (s.W / 2 - 0.01)); return m; });
    p.sills = [-1, 1].map((side) => { const m = ctx.rbox(s.wb - s.r * 2.2, 0.08, 0.05, 0.02, "trim"); m.position.set(0, s.sill + 0.03, side * (s.W / 2 - 0.02)); return m; });
    // Contact shadow: a soft dark ellipse under the car.
    const tex = ctx.own(fx.canvasTexture(fx.radialCanvas({ stops: [[0, 0.55], [0.6, 0.3], [1, 0]] }), { repeat: false }));
    p.shadow = ctx.mesh(ctx.GEO.plane, ctx.newMat({ type: "basic", map: tex, color: "#000000", transparent: true, depthWrite: false }), { edges: false, cast: false, receive: false });
    p.shadow.scale.set(s.L * 1.15, 1, s.W * 1.35);
    p.shadow.position.y = 0.004;
    p.shadow.renderOrder = 1;
    return p;
  },
  draw(p, L, item, state, ctx) {
    const d = item.data;
    const pkg = d.pkg || "base";
    p.spoiler.visible = pkg === "sport" && !p.s.bed;
    for (const m of p.belts) m.visible = pkg === "touring";
    // Paint eases toward the chosen colour, and the finish switches in place.
    const paint = ctx.mat("paint");
    const target = p.paintColor.set(d.paint || "#1E4FD8");
    const done = paint.color.equals(target);
    if (!done) {
      paint.color.lerp(target, L.t > 1e8 ? 1 : Math.min(1, L.dt * 6));
      if (Math.abs(paint.color.r - target.r) + Math.abs(paint.color.g - target.g) + Math.abs(paint.color.b - target.b) < 0.004) paint.color.copy(target);
    }
    const f = FINISHES[d.finish || "metallic"];
    if (p.finish !== d.finish) { Object.assign(paint, f); paint.needsUpdate = true; p.finish = d.finish; }
    return !done;
  },
};

// ------------------------------------------------- cabin (lifts off) --
export const carCabin = {
  enter: "pop",
  glow: false,
  make(ctx, item) {
    const s = SPECS[item.data.style];
    const glass = ctx.mesh(extrude(cabinProfile(s), s.W * 0.84, 0.07, 0.06, s.L), "glass", { edges: false });
    const roofLen = s.roof[1] - s.roof[0] - 0.04; // flush with the glass: an overhang reads as a visor
    const roof = ctx.rbox(roofLen, 0.06, s.W * 0.86, 0.03, item.data.pkg === "sport" ? "trim" : "paint");
    roof.position.set(s.L / 2 - (s.roof[0] + s.roof[1]) / 2, s.roofY - 0.06, 0);
    const rails = [-1, 1].map((side) => { const m = ctx.rbox(roofLen - 0.1, 0.05, 0.05, 0.02, "chrome"); m.position.set(roof.position.x, s.roofY, side * s.W * 0.36); return m; });
    return { glass, roof, rails, s };
  },
  draw(p, L, item, state, ctx) {
    const pkg = item.data.pkg || "base";
    for (const m of p.rails) m.visible = pkg === "touring";
    ctx.setMat(p.roof, pkg === "sport" ? "trim" : "paint");
  },
};

// --------------------------------------------------- wheels (explode) --
// item.data.wheel: "aero" | "spoke" | "mesh"; size from WHEELS.
export const WHEELS = {
  aero:  { label: "18 in Aero", rim: 0.62, spokes: 0, disc: true },
  spoke: { label: "20 in Five-spoke", rim: 0.7, spokes: 5 },
  mesh:  { label: "21 in Split-spoke", rim: 0.76, spokes: 10 },
};
export const carWheels = {
  enter: "pop",
  glow: false,
  make(ctx, item) {
    const s = SPECS[item.data.style], w = WHEELS[item.data.wheel] || WHEELS.spoke;
    const r = s.r, tw = 0.26, rimR = r * w.rim;
    const prof = [[rimR, -tw / 2], [r - 0.06, -tw / 2], [r, -tw / 2 + 0.06], [r, tw / 2 - 0.06], [r - 0.06, tw / 2], [rimR, tw / 2]]
      .map(([a, b]) => new THREE.Vector2(a, b));
    const tyreGeo = ctx.own(new THREE.LatheGeometry(prof, 36).rotateX(Math.PI / 2));
    const rimGeo = ctx.own(new THREE.CylinderGeometry(rimR, rimR, tw * 0.7, 36).rotateX(Math.PI / 2));
    const hubGeo = ctx.own(new THREE.CylinderGeometry(rimR * 0.22, rimR * 0.22, tw * 0.74, 20).rotateX(Math.PI / 2));
    const wheels = [];
    const [xf, xr] = axles(s);
    for (const [x, side] of [[xf, 1], [xf, -1], [xr, 1], [xr, -1]]) {
      const g = ctx.group();
      ctx.mesh(tyreGeo, "tyre", { parent: g, edges: false });
      const face = ctx.group(g);
      face.position.z = side * tw * 0.36;
      ctx.mesh(rimGeo, w.disc ? "rim" : "trim", { parent: face, edges: false }).scale.set(1, 1, 0.12);
      ctx.mesh(hubGeo, "chrome", { parent: face, edges: false }).scale.set(1, 1, 0.3);
      for (let i = 0; i < w.spokes; i++) {
        const a = (i / w.spokes) * Math.PI * 2;
        const sp = ctx.rbox(0.05, rimR * 0.82, 0.03, 0.012, "rim", { parent: face, cast: false });
        sp.rotation.z = a;
        sp.position.set(0, 0, side * 0.01);
      }
      if (w.disc) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const slot = ctx.rbox(0.07, 0.03, 0.02, 0.01, "trim", { parent: face, cast: false });
          slot.position.set(Math.cos(a) * rimR * 0.62, Math.sin(a) * rimR * 0.62 - 0.015, side * 0.012);
          slot.rotation.z = a + Math.PI / 2;
        }
      }
      g.userData = { x, side, y: r };
      wheels.push(g);
    }
    return { wheels, half: s.W / 2 - 0.13 };
  },
  draw(p, L) {
    // Custom lift: the wheels pull straight out of the arches on both sides.
    const out = fx.easeInOut(L.lift) * 0.55;
    for (const g of p.wheels) g.position.set(g.userData.x, g.userData.y, g.userData.side * (p.half + out));
  },
};

// Turntable and showroom, for object-on-a-stage builds.
export const turntable = {
  enter: "rise",
  glow: false,
  make(ctx) {
    // cast: false: a turntable that shadows its own top shows radial acne streaks.
    const base = ctx.mesh(new THREE.CylinderGeometry(1, 1.03, 1, 64).translate(0, 0.5, 0), "stage", { edges: false, cast: false });
    const ring = ctx.mesh(new THREE.TorusGeometry(1, 0.012, 8, 96).rotateX(Math.PI / 2), "chrome", { edges: false, cast: false });
    return { base, ring };
  },
  draw(p, L) {
    const R = Math.min(L.w, L.d) / 2;
    p.base.scale.set(R, 0.08, R);
    p.base.position.y = -0.08;
    p.ring.scale.set(R, 1, R);
    p.ring.position.y = 0.001;
  },
};
