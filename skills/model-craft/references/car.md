# The procedural car (kit/car.js)

A chunky die-cast toy car, generated in code: four body styles (sedan, SUV,
coupe, pickup), paint colour and finish, three wheel designs, and trim packages.
Tested on a turnaround contact sheet at phone size before any page was built.
Do the same for any object-on-a-stage build. If the object looks like a box at
300 px, change the proportions before adding detail.

## Items

```js
const style = state.body;                       // "sedan" | "suv" | "coupe" | "pickup"
[
  { id: "stage", kind: "showroom", box: { w: 12, d: 9, h: 3 }, pickable: false, frame: false },
  { id: "turntable", kind: "turntable", box: { w: 6.2, d: 6.2, h: 0.1 }, rot: state.spin, pickable: false },
  { id: "car", kind: "carBody", parent: "turntable", key: style, box: carBox(style), pickable: false,
    data: { style, paint: "#1E4FD8", finish: "metallic", pkg: "touring" } },
  { id: "cabin", kind: "carCabin", parent: "car", key: style, box: carBox(style), label: "Cabin",
    lift: { axis: "y", dist: 0.9, veil: false }, data: { style, pkg } },
  { id: "wheels", kind: "carWheels", parent: "car", key: style + wheel, box: carBox(style), label: "Wheels",
    lift: "custom", data: { style, wheel } },
]
camera: { frame: ["turntable"], landscape: { az: 0.85, el: 0.5 }, portrait: { az: 0.95, el: 0.55 }, azRange: 0.9, elRange: [0.3, 0.9] }
```

- `key: style` rebuilds the body on a style change: the old car pops out and
  the new one pops in. Turn the turntable half a turn at the same time
  (`spin += Math.PI`) for the "showroom reveal".
- `cabin` lifts off (glass and roof) to show the seats. `wheels` pull straight
  out of the arches (`lift: "custom"`; the kind reads `L.lift`).
- Labels sit on the parts (`labelAt`); there are only 2 or 3 targets on a phone.
- Paint colour changes ease in the kind (no rebuild). Finish switches the
  physical material's metalness, roughness, clearcoat and iridescence in place.

## How the body is made

1. **Spec table** (`SPECS`): length, width, height, wheel radius, wheelbase,
   sill, belt line, cowl, roof start and end, roof height, rear of the
   glasshouse, deck height, bed. Toy proportions: equal short overhangs, big wheels.
2. **Side profile** as points with a corner radius each, wheel arches cut into
   the bottom edge as arcs (radius 1.16 × wheel). `fx.fillet()` turns the points
   into a dense polyline.
3. **ExtrudeGeometry** across the width, with a bevel of 0.09 and
   `bevelOffset: -bevel`, so the silhouette stays the same size.
4. **Plan taper**: z is scaled down near the nose and tail (`smoothstep`).
5. **`fx.smoothNormals(geo, 38°)`**: the biggest quality lever. Extrusions come out
   flat-shaded, and clearcoat bands without it.
6. **Glasshouse**: a second extrusion at 0.84 × width in dark opaque glass. The
   roof is a paint-coloured rounded slab, flush with the glass (an overhang reads
   as a visor). There are no pillars: a floating roof is robust and gives two-tone for free.
7. **Wheels**: the tyre is a lathe of a rounded-rectangle section. The rim is a
   disc plus spokes (rounded boxes rotated around the hub). Rim size is the
   rim-to-tyre ratio.
8. **Details that read at 300 px**: headlight and tail-light strips (emissive),
   a dark grille band, a dark underbody, a black sill strip, a soft contact
   shadow (radial canvas texture). Mirrors were removed: at toy scale they read
   as floating dots.

## Materials and finishes

| Name | Type | Notes |
|---|---|---|
| paint | physical | Mutated in place by the finish (FINISHES table) |
| glass | physical | `#1B2630`, roughness 0.08, clearcoat 1, opaque |
| tyre | std | `#1C1C1E`, roughness 0.9 |
| rim | std | metalness 1, roughness 0.25; silver, gloss black or bronze through the theme or a per-site material |
| chrome, trim, lamp, tail, seat, stage | std | lamp and tail are emissive |

Studio theme: `env` 0.9 (the paint reflects the room environment), tone
"neutral" (ACES shifts reds). See look.md.

## Avoid

- Transparent glass: sorting artefacts, and you see the empty inside.
- Edges (`EdgesGeometry`) on curved bodies.
- Metalness 1 on paint (it goes black without a rich environment).
- The "rise" entrance on a car (it squashes flat); use "pop".
- Real-car proportions, door shut-lines, CSG, lofting.
