// Gridline Motors: the car on a turntable in a cutaway showroom.
// Archetype B (object on a stage). Tap the paint, the cabin or the wheels.

import { createModel, fx, THREE } from "./engine/model.js";
import { carBody, carCabin, carWheels, turntable as baseTurntable, SPECS, carBox } from "./kit/car.js";
import { PAINTS } from "./data.js";

const SHOW = { w: 13, d: 10, h: 3.2 };

// The turntable turns once, a full turn, whenever the body style changes.
const turntable = {
  ...baseTurntable,
  draw(p, L, item, state, ctx) {
    baseTurntable.draw(p, L, item, state, ctx);
    const at = item.data?.spinAt || 0;
    if (!at || fx.reducedMotion()) return false;
    const k = fx.clamp01((L.now - at) / 1300);
    ctx.item.group.rotation.y += fx.easeInOut(k) * Math.PI * 2;
    return k < 1;
  },
};

// The showroom: a polished concrete floor, a back wall and a side wall. (Light strips
// on the walls were tried and removed: they read as stray white bands across the shot.)
const showroom = {
  enter: "rise",
  glow: false,
  make(ctx) {
    const floor = ctx.box("floor", { edges: false });
    floor.castShadow = false;
    const back = ctx.box("wall", { edges: false }), side = ctx.box("wall", { edges: false });
    const plinthEdge = ctx.box("trim", { edges: false, cast: false });
    return { floor, back, side, plinthEdge };
  },
  draw(p, L, item, state, ctx) {
    ctx.put(p.floor, 0, 0, L.w, L.d, -0.12, 0.12);
    ctx.put(p.plinthEdge, 0, L.d / 2 + 0.01, L.w, 0.02, -0.12, 0.12);
    ctx.put(p.back, 0, -L.d / 2 + 0.08, L.w, 0.16, 0, L.h);
    ctx.put(p.side, -L.w / 2 + 0.08, 0, 0.16, L.d, 0, L.h);
  },
};

const paintOf = (id) => PAINTS.find((p) => p.id === id) || PAINTS[0];

export function layout(state, view) {
  const style = state.body, s = SPECS[style];
  const paint = paintOf(state.paint);
  const front = s.L / 2 - (s.L - s.wb) / 2;
  const items = [
    { id: "showroom", kind: "showroom", box: { x: -1.2, z: -1.0, w: SHOW.w, d: SHOW.d, h: SHOW.h }, pickable: false, frame: false },
    // The turntable box is tall on purpose: the camera frames it, so it frames the car at any angle.
    { id: "turntable", kind: "turntable", box: { w: 5.0, d: 5.0, h: 1.9 }, rot: 0, pickable: false, data: { spinAt: state.spinAt || 0 } },
    { id: "car", kind: "carBody", parent: "turntable", key: style, box: carBox(style), rot: -0.35,
      label: "Paint", sub: paint.name, ariaLabel: `Paint: ${paint.name}`, labelAt: [s.L / 2 - 0.55, s.belt * 0.62, s.W / 2 + 0.05],
      data: { style, paint: paint.hex, finish: paint.finish, pkg: state.pack }, focusPad: 0.5 },
    { id: "cabin", kind: "carCabin", parent: "car", key: style, box: carBox(style), label: "Package", sub: cap(state.pack),
      ariaLabel: `Package: ${cap(state.pack)}`, labelAt: [s.L / 2 - (s.roof[0] + s.roof[1]) / 2, s.roofY + 0.12, 0],
      lift: { axis: "y", dist: 1.0, veil: false }, focus: true, focusPad: 0.3, data: { style, pkg: state.pack } },
    { id: "wheels", kind: "carWheels", parent: "car", key: style + state.wheel, box: carBox(style), label: "Wheels",
      ariaLabel: "Wheels", labelAt: [-front, s.r * 2 + 0.1, s.W / 2], lift: "custom", focus: true, focusPad: 0.7, data: { style, wheel: state.wheel } },
  ];
  return items;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export const materials = {
  paint: { type: "physical", roughness: 0.36, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.05 },
  // Glass: low env reflection, or the windscreen reads as a solid white panel.
  glass: { roughness: 0.42, metalness: 0, envMapIntensity: 0.2 },
  tyre: { roughness: 0.9 }, rim: { roughness: 0.25, metalness: 1 }, trim: { roughness: 0.6 },
  chrome: { roughness: 0.15, metalness: 1 },
  lamp: { emissive: "#ffffff", emissiveIntensity: 0.7 }, tail: { emissive: "#ff2a2a", emissiveIntensity: 0.7 },
  seat: { roughness: 0.8 }, stage: { roughness: 0.5, metalness: 0.1 },
  floor: { map: "concrete", roughness: 0.42 }, wall: { roughness: 0.9 },
  };

export const themes = {
  showroom: {
    label: "Showroom", bg: "#15171B", tone: "neutral", exposure: 0.95, env: 0.95,
    hemi: [0.38, "#E4E9F0", "#22252A"], sun: { i: 1.9, color: "#FFFFFF", dir: [-0.35, 0.9, 0.5] },
    shadow: 0.55, edge: ["#000000", 0], veil: ["#15171B", 0.5], dim: ["#2A2D33", 0.6],
    colors: {
      glass: "#0B1015", tyre: "#1A1B1D", rim: "#C9CDD2", trim: "#24262A", chrome: "#E2E5E9",
      lamp: "#F4F7FA", tail: "#B3121B", seat: "#2E2B29", stage: "#7A7F86",
      floor: "#A4A9B0", wall: "#262A30",
    },
  },
};

export function build(host, { onSelect }) {
  return createModel(host, {
    label: "your Gridline",
    layout, materials, themes, theme: "showroom",
    kinds: { showroom, turntable, carBody, carCabin, carWheels },
    textures: { concrete: { url: "assets/concrete.jpg", repeat: [3, 2.3], canvas: () => fx.tileCanvas({ base: "#E4E6E9", line: "#DADDE1", n: 2 }) } },
    accent: "#2F6BFF",
    camera: { frame: ["turntable"], landscape: { az: 0.78, el: 0.42 }, portrait: { az: 0.8, el: 0.55 }, azRange: 1.0, elRange: [0.22, 0.95], pad: 0.98 },
    labelMin: 30,
    onSelect,
  });
}
