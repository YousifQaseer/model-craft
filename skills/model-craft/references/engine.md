# The engine

`engine/model.js` (createModel), `engine/mount.js` (poster + lazy load),
`engine/sheet.js` (the sheet), `engine/fx.js` (helpers), `engine/model.css`.
Three.js r169 is vendored in `engine/vendor/`. ES modules, no build step.
The starter (`templates/starter`) is the smallest complete use of all of it:
read its `model.js` and `app.js` before writing your own.

## Contents
1. Wiring (mount, model, page)
2. createModel options
3. Items and layout
4. Kinds: make, draw, ctx, L
5. Nesting, lift, focus, tone
6. Themes and materials
7. Scenes and bursts
8. The returned model
9. Units, camera, coordinates
10. Gotchas

## 1. Wiring

```js
// app.js (page): no Three.js on first paint
import { mountModel } from "./engine/mount.js";
import { createSheet } from "./engine/sheet.js";
const model = mountModel(stage, {
  poster: "assets/poster.webp", posterAlt: "…",
  create: async (host) => (await import("./model.js")).build(host, { theme: state.theme, onSelect: (it) => set({ pick: it?.id ?? null }) }),
});
const sheet = createSheet(stage, { onClose: () => set({ pick: null }) });
function render() {
  model.update(state);          // cheap: identical layouts are skipped
  model.select(state.pick);     // no-op if unchanged
  sheet.show(state.pick ? { title, meta, body } : null);
  model.setInsets(sheet.inset());
}
Object.assign(window, { __model: model, __state: state, __set: set }); // test hooks
```

`mountModel` returns a facade usable immediately; calls are replayed when the
real model is ready. `?no3d` in the URL forces the poster path (tests).

```js
// model.js (lazy)
import { createModel, fx, THREE } from "./engine/model.js";
export function build(host, { onSelect, theme }) {
  return createModel(host, { label: "the dining room", layout, kinds, materials, themes, theme,
    textures, accent, camera, scenes, onSelect });
}
```

## 2. createModel(host, options)

| Option | Meaning |
|---|---|
| `layout(state, view)` | **Required.** Pure. Returns items. `view = { portrait, w, h }`. Re-run on orientation flips. |
| `kinds` | **Required.** `{ name: Kind }`. |
| `materials` | `{ name: { type: "std"|"physical"|"basic"|"lambert", map: "textureKey", roughness, metalness, ... } }`. Colours come from the theme. |
| `themes`, `theme` | `{ name: Theme }` and the starting one. At least one. |
| `textures` | `{ key: "url" }` or `{ key: { url, canvas: () => HTMLCanvasElement, color: false } }`. The canvas shows until the url loads. |
| `accent` | Selection colour (glow, ghost, posts). Use the brand accent. |
| `camera` | `{ landscape: {az, el}, portrait: {az, el}, azRange, elRange: [min, max], orbit: true, pad: 1.05, frame: [ids] }`. |
| `scenes` | `{ name: (api, arg) => Scene }`. |
| `label` | Spoken name: "3D model of {label}". |
| `onSelect(item or null)` | Fired by the visitor only: taps, labels, keyboard, Escape. Never by your own `update()` or `model.select()` (a layout that dims the picked item deselects it silently), so it is safe to call `set()` from it. `model.select(id, { notify: true })` behaves like a tap (tests). |
| `interactive`, `transparent`, `edges`, `shadows` | Defaults true, false, true, true. `transparent` drops the scene background (page shows through). |
| `tween` | ms for layout changes (460). |
| `labelMin` | Hide labels of items smaller than this many px (36). |
| `ground` | false removes the shadow catcher. `groundY` moves it. |
| `dev` | Warn about tiny tap targets. On automatically with `?dev`. |

## 3. Items and layout

```js
{
  id: "t4",                 // stable across updates; selection and tweens follow it
  kind: "table",            // a key of kinds
  parent: "room",           // optional; box is then in the parent's frame
  key: "suv",               // optional; a change rebuilds the item (old pops out, new pops in)
  box: { x, z, w, d, y = 0, h },   // metres; x/z = centre of footprint; y = base
  rot: 0,                   // radians around the vertical axis (tweens the short way)
  label: "6", sub: "Centre", ariaLabel: "Table for 6, centre",   // label button on the model
  labelAt: [0, 1.1, 0],     // label anchor in the item's frame (default top centre)
  labelClass: "is-chair",   // extra class on the label button
  alwaysLabel: false,       // keep the label visible while another item is selected
  tone: "on" | "faded" | "dim" | "",  // on = highlight; faded = not chosen, still tappable;
                            // dim = unavailable, not tappable. Inherited by children.
  lift: { axis: "y"|"x"|"z", dist, dir: 1|-1, veil: true } | "custom" | null,
  focus: false,             // with a lift: also move the camera in
  view: { az, el },         // camera angle while this item is selected
  focusPad: 0.35,           // margin around a focused item (m)
  pickable: true,           // false: clicks pass to the parent, no label, no glow
  glow: true, glowY: 0.012, // accent footprint under the item when on/selected/hovered
  glowShape: "round", glowSize: [0.9, 0.9],  // a round glow under one chair instead of the whole box
                            // flat items (mats, rugs) hide the glow: make glowSize larger than the box
  frame: true,              // root items only: include in the camera framing
  enter: "pop"|"rise"|"drop"|"none",  // overrides the kind's entrance
  data: { ... },            // anything your kind needs
}
```

- Items appear (enter animation), tween to new boxes, and sink when they leave
  the layout. Return the same id for the same thing.
- Order matters only for keyboard order and label priority: list pickable
  items in reading order.
- Parents must exist in the same layout. Children move, lift and dim with them.

## 4. Kinds

```js
const table = {
  enter: "pop",        // default entrance for this kind
  glow: true,          // false: never draw the accent footprint
  make(ctx, item, state) { /* build meshes ONCE; return parts */ return { top, chairs }; },
  draw(parts, L, item, state, ctx) { /* every awake frame: transforms and visibility only */ },
  dispose(parts, ctx) {}, // optional; ctx-made things are disposed for you
};
```

**make** runs when the item is built (or rebuilt by a key change). Create every
mesh here. **draw** runs every frame the model is awake; never allocate geometry
or materials in it.

**Put everything a kind draws into `item.data` (or `key`); never read `state`
inside draw.** `update()` skips layouts whose JSON is unchanged, so the layout is
what wakes the model. A tray drawn from `state.breakfast` would not appear until
something else woke the model; one drawn from `item.data.tray` appears at once. Return `true` from draw to keep the model awake (e.g. while
your own easing is still moving).

`ctx` helpers (meshes are added to the item's group):

| Helper | Does |
|---|---|
| `ctx.box(mat, opts)`, `cyl`, `cone`, `sph` | Unit geometry (base at y = 0); size it with `ctx.put`. Faint edges on box/cyl. |
| `ctx.plane(mat)`, `ctx.disc(mat)` | Flat, facing up (decals, rugs, glows). |
| `ctx.rbox(w, h, d, r, mat, opts)` | Rounded box at an exact size. Cached. The toy look. Don't scale it non-uniformly. |
| `ctx.mesh(geometry, mat, opts)` | Any geometry. `opts: { parent, edges, cast, receive, name }`. |
| `ctx.group(parent?)` | A sub-group (a chair, a door pivot). |
| `ctx.batch()` | Merge many static parts into one mesh per material; shadow-casting meshes count twice toward the 350 draw calls. Signatures (note the orders differ): `B.box(mat, x, z, w, d, y, h, ry?)` (unit box: centre x/z, base y); `B.rbox(mat, w, h, d, r, x, y, z, ry?)` (size first, then position); `B.cyl(mat, rTop, rBottom, h, x, y, z, seg?)`; `B.ball(mat, r, x, y, z, scale?, detail?)`; `B.geo(mat, geometry, x, y, z, rot?, scale?)`; `B.at(x, y, z, ry, () => { ... })` nests a frame; `B.build({ edges?, noCast? })` returns `{ mat: mesh }`. |
| `ctx.put(m, x, z, w, d, y, h)` | Place unit geometry: centre x/z, base y, size. Hides it when a size is ~0. |
| `ctx.at(m, x, y, z, ry?)` | Position (and turn) fixed-size geometry. |
| `ctx.setMat(m, mat)` | Change a mesh's material. **Never assign `mesh.material` yourself** (dimming would break). |
| `ctx.mat(name)`, `ctx.newMat(def)` | Shared named material / a private one (disposed with the item). |
| `ctx.texture(key, { repeat })` | A texture clone with its own repeat. |
| `ctx.own(x)` | Dispose x with the item. |
| `ctx.night` | 0..1 from the theme (lamps, candles, windows). |
| `ctx.THREE`, `ctx.fx`, `ctx.GEO` | Three.js, helpers, shared unit geometries. |

`L` (draw's second argument): `w, d, h, x, y, z, rot` (current, tweened),
`t` (ms since born; huge under reduced motion), `k(i)` (staggered 0..1 drop-in
progress for part i, overshoots slightly), `lift` (0..1), `sel`, `hover`,
`tone`, `night`, `now`, `dt`, `dying` (0..1).

Furniture drop-in, as on the dollhouse:
```js
p.chairs.forEach((g, i) => { const k = L.k(i + 1); g.visible = k > 0.001;
  g.position.y = (1 - k) * 0.5; g.scale.y = Math.max(0.05, Math.min(1, k)); });
```

## 5. Nesting, lift, focus, tone

- **Nesting**: `parent: "floor2"`. The child's box is in the parent's frame.
  Floors stack with `box.y = level * storey`; rooms are children of floors; car
  parts are children of the car; tables are children of the room.
- **lift** (on select):
  - `{ axis: "y" }` rises (tables, rooms). Default distance clears the item
    plus half a metre; set `dist` so it clears the walls with room to spare.
  - `{ axis: "z", dir: 1 }` slides toward +z (hotel rooms come out of the
    building's front, which faces the camera). `"x"` likewise.
  - The engine draws the **veil** (a dark pane between the camera and
    everything else), the **ghost** (outline of where it came from) and four
    **guide posts**. `veil: false` turns the veil off.
  - `"custom"`: no movement; your kind reads `L.lift` (0..1) and moves its own
    parts (car wheels pulling outward on both sides).
  - `null` / absent: **focus** instead: the camera moves in on the item
    (barber chairs). Add `view: {az, el}` to swing the camera too.
- **tone**: `"on"` draws the accent footprint (fits your party). `"faded"` swaps
  every material to a faded copy (colour pulled toward `theme.dim`) and keeps the
  item tappable: use it for "not chosen" (the other barbers). `"dim"` is the same
  look and makes the item unpickable: use it for "unavailable" (tables too small).
  Inherited by children unless they set their own.
- **The veil only covers what is behind its plane.** Something that stands in
  front of the building (a street tree) is not veiled: tone it `"dim"` while a
  room is selected, or make it a framed root item so the plane moves past it.
- **z drawers (archetype C)**: once a room slides out, its side wall on the
  camera side faces the camera and hides the room. Draw that wall as its own
  mesh and lower it as `L.lift` rises. On phones use `focus: true` too, or the
  drawer is a speck in front of the building.

## 6. Themes and materials

```js
const themes = { day: {
  label: "Daytime", bg: "#F3EFE8", tone: "neutral", exposure: 1.0, env: 0.35,
  hemi: [0.6, "#FFF7EC", "#5A5148"], sun: { i: 2.2, color: "#FFFFFF", dir: [-0.45, 0.85, 0.35] },
  shadow: 0.28, edge: ["#1A1E22", 0.1], veil: ["#F3EFE8", 0.55], dim: ["#E8E3DA", 0.6],
  glow: 1, night: 0,
  colors: { floor: "#F0D6B4", wall: "#F7F5F0", bulb: { color: "#FFF6DD", emissive: "#FFD9A0", emissiveIntensity: 0 } },
} };
```

`setTheme(name)` blends every listed value over 650 ms (instant under reduced
motion). Lighting is two lights (hemisphere + sun with soft shadows) plus a
room environment; there are no point lights. Night is done with emissive
materials (`bulb`, `candle`, `window`) driven by the theme, and `ctx.night`.
`tone`: "neutral" (default, keeps saturated paint honest), "aces", "agx",
"none". Starting values for daylight, evening and studio looks: look.md.

## 7. Scenes and bursts

```js
scenes: {
  dress(api, id) {
    const t = api.item(id);                   // { group, parts, item, box, ctx }
    const cake = api.add(new api.THREE.Mesh(...), id);  // removed when the scene ends
    return {
      dur: 1600, focus: () => api.box(id), view: { az: 0.9, el: 0.7 }, hideLabels: true, release: 0.85,
      step(k) { cake.scale.setScalar(api.fx.easeBack(api.fx.span(k, 0.1, 0.4))); },
      end() {},
    };
  },
}
model.play("dress", "t4");   // returns ms; 0 under reduced motion (skip, state already shows the result)
model.burst("t4", { color: "#FFE7A3" });   // sparkles over an item; nothing under reduced motion
```

`keepLift: true` keeps a lifted item out while the scene plays (otherwise it
settles back so close-ups see it in place). Each frame the kinds draw first, then
`scene.step` runs, so a scene may move a part the kind also positions (turn a
chair) and it is restored by the next draw after the scene ends.

A scene **never carries state**. Anything that must stay visible afterwards
(the cake on the table) is drawn by the kind from state. A tap on the model
ends a running scene.

## 8. The returned model

`update(state)`, `select(id|null, { notify })` (silent unless notify; an id that can't be picked is ignored and the current selection stays), `selected`, `focus(id|null)` (camera only),
`setTheme(name, {ms})`, `theme`, `setInsets({top,right,bottom,left} | bottomPx)`,
`resetView()`, `view({az, el})`, `play(name, arg)`, `stop()`, `busy()`,
`burst(target, opts)`, `items()`, `item(id)`, `wake(ms)`, `stats()`
(`frames, calls, triangles, items, small, selected, theme, lost`),
`snapshot(type, quality)` (data URL), `dispose()`, `scene`, `camera`, `renderer`.

## 9. Units, camera, coordinates

- 1 unit = 1 metre. y is up. Item boxes: centre of footprint at (x, z), base at y.
- Orthographic camera at azimuth `az`, elevation `el` (radians), looking at the
  framed bounds. The camera sits on the **+x / +z side** at the default
  `az ≈ 0.5`: build cutaways with full walls on the **back (−z)** and **left
  (−x)** sides, low or no walls at front and right.
- The camera fits the root items (or `camera.frame` ids), plus the lifted
  item, minus the insets you set (the sheet). It refits smoothly on every change.
- `view.portrait` (and the `portrait` camera) is true when the stage is under
  600 px wide or taller than it is wide.
- Horizontal drag orbits within `baseAz ± azRange`; vertical drag (mouse only)
  changes elevation within `elRange`. Touch never fights page scroll.

## 10. Gotchas

- Changing `mesh.material` directly breaks dimming: use `ctx.setMat`.
- `a || b || c` for `visible` can be `undefined`: wrap in `Boolean()` (a stray
  block appeared on the dollhouse from exactly this).
- `material.clone()` copies `clippingPlanes`; re-assign a shared live plane after cloning.
- Something tall in the room (pendants, shelving above wall height) pokes through
  the veil when a thing lifts: keep it under the wall tops, or lift higher.
- A label shows only if its item is at least `labelMin` px wide on screen;
  overlapping labels are dropped by priority (focused, selected, on, order).
- Shared materials are shared: changing `ctx.mat("metal").side` changes every
  metal part. Use `ctx.newMat` for one-offs.
- Asset paths are relative to the page (`assets/oak.jpg`). Serve the site; never test from file://.
- `kit/` is yours: `new-site.mjs --engine-only` refreshes `engine/` only. Fixes
  to the skill's kit reach a site only if you copy them.
- Do not run a continuous animation (spinning pole, idle turntable). The model
  sleeps when nothing moves; that is the battery budget.
