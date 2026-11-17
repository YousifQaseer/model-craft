# The look

The dollhouse's look was a **soft daylight architectural miniature**. A
high-end maquette, or a beautiful toy. The client chose it over a dark
blueprint look. Start there unless the brand says otherwise.

## Ingredients

- **Proportion before detail.** Real sizes in metres: table top 0.75 m, chair seat
  0.45 m, bed 2.0 × 1.6 m, door 0.9 × 2.1 m. Make walls low (1.0 to 1.4 m on a
  model room) so the inside reads from above. A believable silhouette at
  300 px matters more than polygons.
- **Rounded boxes** (`ctx.rbox`) for anything a hand would touch: furniture,
  counters, cushions, car body parts. The radius is about 10–15% of the smallest side.
- **Few materials.** One wood, one fabric, one metal, wall, floor, an accent
  per site. Matte (roughness 0.7–0.95) for most things; 0.3–0.45 for porcelain,
  lacquer and countertops.
- **Faint edges.** `edge: ["#1A1E22", 0.08–0.14]` in daylight. These are the
  linework that makes it read as a drawing. Skip edges on curved parts (`rbox` already does).
- **Soft shadows.** PCF soft shadows from one sun, plus the shadow catcher
  (`shadow: 0.25–0.35`).
- **Textures** only where they help: floors (planks, tile, concrete), maybe one
  fabric. Tint them through the material colour so the theme can shift them.
- **Brand colour** on the UI and the selection guides (accent). Inside the
  model, use it at most on one small object (a sign, a stool).

## Theme starting points

```js
// Daylight (default)
{ bg: "#F3EFE8", tone: "neutral", exposure: 1.0, env: 0.35,
  hemi: [0.6, "#FFF7EC", "#5A5148"], sun: { i: 2.2, color: "#FFFFFF", dir: [-0.45, 0.85, 0.35] },
  shadow: 0.28, edge: ["#1A1E22", 0.1], veil: ["#F3EFE8", 0.55], dim: ["#E8E3DA", 0.6] }

// Evening / dinner: warm and readable, never black
{ bg: "#22252E", tone: "neutral", exposure: 1.1, env: 0.22,
  hemi: [0.75, "#B8C0E0", "#3A3530"], sun: { i: 1.1, color: "#FFC98A", dir: [-0.3, 0.9, 0.3] },
  shadow: 0.4, edge: ["#000000", 0.18], veil: ["#14161C", 0.55], dim: ["#3A3D46", 0.55], night: 1,
  colors: { bulb: { color: "#FFE2A8", emissive: "#FFD9A0", emissiveIntensity: 2.2 } } }

// Studio (objects on a stage: cars, products)
{ bg: "#E9EBEE", tone: "neutral", exposure: 1.05, env: 0.9,
  hemi: [0.45, "#FFFFFF", "#8A8F96"], sun: { i: 1.6, color: "#FFFFFF", dir: [-0.3, 0.9, 0.5] },
  shadow: 0.35, edge: ["#000000", 0.0], veil: ["#E9EBEE", 0.6], dim: ["#D5D8DC", 0.6] }

// Dark brand (graphite showroom)
{ bg: "#16181C", tone: "neutral", exposure: 1.1, env: 0.75,
  hemi: [0.5, "#DDE3EA", "#202328"], sun: { i: 1.8, color: "#FFFFFF", dir: [-0.35, 0.9, 0.45] },
  shadow: 0.5, edge: ["#000000", 0.0], veil: ["#0E1013", 0.55], dim: ["#2A2D33", 0.6] }
```

- **Night in a section or cutaway: the outside goes cool, the inside stays
  warm.** Section cuts, roofs and pavement go blue-grey, the sun becomes a cool,
  low "moon", and wall, floor and shade colours stay warm, with emissive lamps
  and windows. (From the kie.ai night render on The Linden.)
- Night themes go wrong in one way: too dark to read. Keep `hemi` near 0.7 and
  light the scene with emissive bulbs, candles and windows. Check the dimmed
  items are still visible.
- Metallic paint and chrome need `env` around 0.8–1.0 (the room environment is
  what they reflect). Interiors want 0.25–0.4.
- `tone: "neutral"` keeps saturated colours honest. "aces" shifts reds.

## Tuning against a kie.ai render (two rounds)

1. `poster.mjs` → a clean screenshot of the default state.
2. kie.ai `--ref` with the target-render prompt (kie.md).
3. Put the two side by side (`ffmpeg -i a.png -i b.png -filter_complex hstack`)
   and compare four things: **overall brightness**, **shadow softness and
   darkness**, **wall-top whiteness against the floor**, **material contrast**
   (wood vs. fabric vs. metal). Move exposure, hemi, sun, shadow and the theme
   colours toward the render. Do not chase reflections or detail you cannot model.
4. Write the before/after into BRIEF.md.

## Textures

```bash
node <skill>/scripts/kie.mjs image "<seamless texture prompt>" lab/kie/tex-oak.png --model pro --ar 1:1
node <skill>/scripts/tex.mjs lab/kie/tex-oak.png assets/oak.jpg --size 1024
node <skill>/scripts/tex.mjs lab/kie/fx-steam.png assets/steam.webp --key black --size 512
```

In the model: `textures: { oak: { url: "assets/oak.jpg", canvas: () => fx.plankCanvas() } }`,
`materials: { floor: { map: "oak" } }`. Set repeat per item:
`ctx.setMat(...)` is not needed for that. Call `ctx.texture("oak", { repeat: [w / 1.6, d / 1.6] })`
in make, then keep `t.repeat.set(L.w / 1.6, L.d / 1.6)` up to date in draw.
The `shell` kind tints a shared floor material. For per-room repeat, give each
room its own material from `ctx.newMat({ map: ctx.texture("oak") })`.
