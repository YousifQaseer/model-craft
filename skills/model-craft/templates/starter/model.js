// The site's model: layout + kinds + materials + themes. Loaded lazily by
// mount.js, so Three.js never blocks the first paint.
//
// layout(state, view) is PURE: same state, same items. Stable ids are what let
// an item tween, rise, sink and keep its selection across updates.

import { createModel, fx } from "./engine/model.js";
import { interior } from "./kit/interior.js";
import { ROOM, TABLES, fits } from "./data.js";


export function layout(state, view) {
  const items = [
    { id: "room", kind: "shell", box: { w: ROOM.w, d: ROOM.d, h: ROOM.h }, pickable: false,
      data: { walls: { back: "full", left: "full", front: "low", right: "none" },
        openings: [{ wall: "back", at: 0.3, w: 1.6, sill: 0.45, head: 1.25 }] } },
    { id: "bar", kind: "counter", parent: "room", box: { x: 2.4, z: -1.6, w: 1.9, d: 1.2, h: 1.05 }, pickable: false, data: { stools: 3 } },
    { id: "plant1", kind: "plant", parent: "room", box: { x: -3.15, z: -2.2, w: 0.4, d: 0.4, h: 1 }, pickable: false },
    { id: "plant2", kind: "plant", parent: "room", box: { x: 3.1, z: 2.1, w: 0.4, d: 0.4, h: 1 }, pickable: false, data: { size: 1.3 } },
  ];
  for (const t of TABLES) {
    const ok = fits(t, state.party);
    const size = t.seats >= 6 ? [2.4, 1.9] : [1.7, 1.7];
    items.push({
      id: t.id, kind: "table", parent: "room",
      box: { x: t.x, z: t.z, w: size[0], d: size[1], h: 1.0 },
      label: `${t.seats}`, sub: t.spot, ariaLabel: `Table for ${t.seats}, ${t.spot}`,
      tone: ok ? "on" : "dim",
      lift: { axis: "y", dist: 1.9 },
      data: { seats: t.seats },
    });
  }
  return items;
}

export const materials = {
  floor: { map: "oak", roughness: 0.75 },
  wall: { roughness: 0.95 },
  trim: {},
  glass: { roughness: 0.05, transparent: true, opacity: 0.35 },
  wood: { roughness: 0.55 },
  seat: { roughness: 0.8 },
  metal: { roughness: 0.35, metalness: 0.6 },
  top: { roughness: 0.3 },
  pot: { roughness: 0.9 },
  leaf: { roughness: 0.85 },
  bulb: { emissive: "#ffd9a0", emissiveIntensity: 0 },
};

export const themes = {
  day: {
    label: "Daytime", bg: "#F3EFE8", tone: "neutral", exposure: 1.0, env: 0.35,
    hemi: [0.6, "#FFF7EC", "#5A5148"], sun: { i: 2.2, color: "#FFFFFF", dir: [-0.45, 0.85, 0.35] },
    shadow: 0.28, edge: ["#1A1E22", 0.1], veil: ["#F3EFE8", 0.55], dim: ["#E8E3DA", 0.6], night: 0,
    colors: { floor: "#F0D6B4", wall: "#F7F5F0", wood: "#B07A4E", seat: "#3E4A3D", metal: "#2B2B2B", top: "#EDE7DD",
      pot: "#C9784F", leaf: "#5E8A55", glass: "#CFE8F2", bulb: { color: "#FFF6DD", emissiveIntensity: 0 } },
  },
  night: {
    label: "Evening", bg: "#22252E", tone: "neutral", exposure: 1.1, env: 0.22,
    hemi: [0.75, "#B8C0E0", "#3A3530"], sun: { i: 1.1, color: "#FFC98A", dir: [-0.3, 0.9, 0.3] },
    shadow: 0.4, edge: ["#000000", 0.18], veil: ["#14161C", 0.55], dim: ["#3A3D46", 0.55], night: 1,
    colors: { floor: "#B08A64", wall: "#CFC9BF", wood: "#8A5A36", seat: "#2E382D", metal: "#1F1F1F", top: "#CFC6B8",
      pot: "#9C5A3B", leaf: "#3F6339", glass: "#3A4A60", bulb: { color: "#FFE2A8", emissiveIntensity: 2.2 } },
  },
};

export function build(host, { onSelect, theme = "day" } = {}) {
  return createModel(host, {
    label: "the café",
    layout, materials, themes, theme,
    kinds: interior,
    // A drawn texture now; add url: "assets/oak.jpg" once kie.ai has made one (it replaces the drawing when it loads).
    textures: { oak: { canvas: () => fx.plankCanvas({ base: "#FFFFFF", line: "#D8D2C8", vary: 0.05 }) } },
    accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C2552D",
    camera: { landscape: { az: 0.6, el: 0.85 }, portrait: { az: 0.75, el: 0.95 } },
    onSelect,
    scenes: {
      // A short moment that never carries state: a sparkle over the table.
      celebrate(api, id) {
        api.burst(id, { count: 9, color: "#FFE7A3" });
        return { dur: 1100, focus: () => api.box(id), step() {} };
      },
    },
  });
}
