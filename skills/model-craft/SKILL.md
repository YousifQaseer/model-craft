---
name: model-craft
description: >
  Build a website whose centrepiece is an interactive 3D model of the thing the
  visitor is choosing, the way a cleaning company's booking site turned the
  visitor's home into a live "dollhouse": rooms appear as they add bedrooms, a
  tapped room lifts out with its options, and the price follows. Works for any
  business: a restaurant's dining room (party size lights the tables that
  fit), a hotel in section (tap a room, it slides out), a barbershop (tap a
  chair), a car on a turntable (paint, wheels, body), a gym, a salon, a venue,
  movers, a dentist. The model is procedural Three.js; an image model (kie.ai
  built in, or any other, or none) makes concept pictures, target renders,
  textures and photos. Ships an engine, starter site, image script and a
  screenshot check that drives a real browser. Use for "make it like the
  dollhouse", "interactive 3D model on the website", "tap a room / table / chair /
  part", "3D configurator", "cutaway model", "isometric model you can click",
  "build your own X in 3D", or a booking site that should show the choice instead
  of listing it.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# model-craft

A site built around **one interactive 3D model that mirrors the visitor's
choice**. Every choice the visitor makes (size, party, room, barber, paint)
visibly changes the model; tapping a part of the model lifts it out and opens
its options; the price and the booking follow. The model is the argument.

The method came from three long rounds of client feedback on a cleaning
company's booking site (the "dollhouse"). What worked, what was thrown away and why is in
[references/lessons.md](references/lessons.md). Read it before your first build.

`<skill>` below means this skill's folder, wherever your agent installed it:
`.claude/skills/model-craft` inside a project (the default for `npx skills
add`), `~/.claude/skills/model-craft` with `-g`, or `~/.codex/skills/model-craft`.
`<workspace>` means the folder that holds your sites (for example `sites/`);
each site is a folder inside it.

**First run:** `cd <skill> && npm install` (Playwright for the checks), then
`node <skill>/scripts/doctor.mjs`. Needs Node 20+ and Chrome or Chromium.
kie.ai and ffmpeg are optional. In a project install, add
`.claude/skills/*/node_modules` to the project's `.gitignore`.

## What this is not

- **Not a 3D model generator.** kie.ai makes *pictures* (concepts, target
  renders, textures, sprites, page photos). The model is built in code from
  boxes, rounded boxes, cylinders, lathes and extrusions. No .glb files, no
  image-to-3D. Generated meshes were never needed and never matched.
- **Not decoration.** A spinning hero object that does not respond to the
  visitor's choices is not this skill. If a choice does not change the model,
  either make it change the model or keep it out of the model.
- **Not a scroll film.** Scroll-scrubbed video heroes are a different job.
  This skill is a live tool the visitor plays with.

## The method, in order

### 1. Find the model (before anything else)

Answer, in one line each, and write them in `BRIEF.md`:

1. **What is the visitor choosing?** (a table for 4 at 7:30; a room for 2 nights; a barber and a fade; a car spec.)
2. **What physical thing shows that choice?** (the dining room; the building in section; the shop; the car.) This is the model.
3. **Which choices change what is drawn?** List each control and the visible change it makes. Aim for 3 to 5. A choice with no visible change goes in the form only.
4. **What does a tap do?** Lift (a table rises, a hotel room slides out like a drawer), focus (the camera moves in on a chair), or explode (car wheels pull outward). One behaviour per model.
5. **What is the one short moment?** At most one scripted scene per choice (a table dresses itself for a birthday; breakfast arrives). Optional.

[references/archetypes.md](references/archetypes.md) has worked answers for a
dozen businesses and the three model archetypes: **cutaway space**, **object on
a stage**, **stacked building**. Pick the archetype first; it decides camera,
lift axis and layout.

Ask the client only what you cannot decide: brand, real prices, real names,
must-have choices. If they say "you decide", decide and write it in BRIEF.md
marked as yours.

### 2. Concepts first, as phone screens

Before any 3D code, generate concept pictures (kie.ai, or any image model;
without one, see "Without kie.ai" in references/kie.md) and let the client
pick. Phone first: most visitors book on a phone, and the client will judge on one.

```bash
node <skill>/scripts/kie.mjs image "<prompt>" lab/kie/concept.png --model pro --ar 9:16 --budget 100
```

- One shared base screen, then each variant as an **edit of it** (`--ref`), so
  layouts stay consistent. Show them side by side (one contact sheet).
- The concept prompt describes the model the way the dollhouse was described:
  *cutaway architectural model seen from above at 35 degrees, like a high-end
  real-estate maquette or a beautiful toy diorama, soft warm daylight, gentle
  ambient occlusion, matte white wall tops*. Prompts that worked are in
  [references/kie.md](references/kie.md).
- Concepts are art direction, not a spec. Generated UI garbles text and
  drops rooms; say so when you show them.

### 3. Data before geometry

Start the site from the starter:

```bash
node <skill>/scripts/new-site.mjs <workspace>/builds/<name>
```

It copies `templates/starter` (a working café: party size lights tables, tap
lifts a table, lunch/dinner theme, sheet, keyboard, poster fallback),
`engine/` and `kit/`. Then:

- `data.js`: plain data shared by page and model (tables, rooms, prices). No Three.js.
- `model.js`: `layout(state, view)` + kinds + materials + themes, built lazily.
- `app.js`: **one state object, one `render()`.** Form controls, the model, the
  sheet and the price all read state. Tapping the model calls `set()` exactly
  like a button. Scenes never hold state.

`layout(state, view)` is pure and returns items with **stable ids**:
`{ id, kind, parent?, key?, box: {x, z, w, d, y?, h}, rot?, label?, sub?, tone?, lift?, data? }`.
Units are metres, boxes are parent-local, `x/z` is the centre of the footprint.
Full contract: [references/engine.md](references/engine.md).

### 4. Build the model with the engine

- Never edit `engine/` in a site. Site code goes in kinds, scenes and layout.
  If the engine is missing something, fix it in `<skill>/engine/` and refresh
  with `new-site.mjs <dir> --engine-only`.
- Start from `kit/interior.js` (room shell with cutaway walls and windows,
  tables with chairs, plants, counter, pendant, bench, shelf, rug) and
  `kit/car.js` (procedural toy car). Copy kinds into the site and edit freely.
- Toy-like detail beats realism: rounded boxes (`ctx.rbox`), real proportions
  in metres, 1 to 3 materials per object, faint edges. Real 3D geometry for
  objects; flat pictures only for effects.
- Keep it light: under 350 draw calls; prefer fewer, larger meshes.

### 5. Tune the look against kie.ai

1. Screenshot the model in its default state (`scripts/shoot.mjs`).
2. Send it to kie.ai as a reference with the "photoreal architectural
   miniature, keep exactly the same camera, layout and furniture" prompt.
3. Move lights, materials, colours and exposure toward that render until the
   model sits comfortably beside it. Two rounds is usually enough.
4. Generate seamless textures (floor, tile, concrete, fabric) and any effect
   sprites on flat white or black; key them with `scripts/tex.mjs`.

Details, the theme fields and starting values: [references/look.md](references/look.md).

### 6. Interaction

[references/interaction.md](references/interaction.md). The rules that matter most:

- **A lift must be unmistakable**: lift high (clear of the walls), dim the rest
  with the veil, leave the ghost outline and guide posts (all built in).
- Tap targets: every pickable item at least 44 px on a 390 px phone. If they
  are smaller, make them bigger or fewer, or let the labels be the targets.
- Every choice on the model also exists as a normal control in the form. The
  model is a second way in, never the only way.
- Plain buttons beat clever controls (a dial ring was rejected as "too hard").
- Whole-model changes seen from the default camera beat zooming into a corner.

### 7. The page

[references/page.md](references/page.md): page grammar, pinned stage on phones,
the sheet, live price, the click-through booking flow, poster fallback, copy.

- The model is the hero and stays pinned under the header on phones while the
  controls scroll, so every tap is seen.
- Prices that are not the client's are labelled **sample pricing**. No invented
  reviews, awards or customer counts.
- Each site gets its own type, palette and layout. No two builds may share a
  look; `new-site.mjs` creates `<workspace>/FINGERPRINTS.md`, so add a row there.

### 8. Verify, then look

```bash
node <skill>/scripts/serve.mjs --root <site> --port <port>
node <skill>/scripts/poster.mjs --url http://127.0.0.1:<port>/ --out <site>/assets/poster.webp
node <skill>/scripts/shoot.mjs --url http://127.0.0.1:<port>/ --out <site>/lab/shots --cases <site>/cases.json --matrix
```

`shoot.mjs` fails the run on: console errors, the model still drawing when
idle, over 350 draw calls, tiny tap targets on phones, overlapping labels,
keyboard selection broken, no recovery from a lost graphics context, or price
text that differs between {3D on, off} x {motion, reduced motion}.

Then **look at every screenshot yourself** for anything you did not put there:
stray colour blocks, things floating, labels on top of what they label, a lift
nobody would notice, unreadable night themes. The client caught exactly these
on the dollhouse after every check had passed. [references/verify.md](references/verify.md)
has the full checklist. Say plainly what was not verified (a real phone).

## Hard rules

| Rule | Why |
|---|---|
| kie.ai makes pictures, never the model | Generated meshes and pasted-on art never matched; procedural geometry can change live with the choice |
| One state object, one render() | Model, form, sheet and price can never disagree |
| Stable ids in layout | Tweens, rise/sink and selection survive updates |
| Every model choice also in the form | Keyboard, screen readers, no-WebGL and reduced motion all still book |
| Poster image shown first | Fast first paint; stays if 3D is unavailable or the context is lost |
| Never edit engine/ in a site | Fixes go into the skill so every site gets them |
| Under 350 draw calls, nothing drawn when idle | Phones, battery |
| Lift clears the walls, veil + ghost on | "Did anything happen?" was the first dollhouse complaint |
| Brand colour stays out of the model except selection | Lime inside the house was rejected; accents read as UI |
| Reduced motion is a real path | The client's own phone had it on; everything must still read without animation |
| Sample prices labelled; no invented reviews | Honesty |
| Show concepts before code | The 3D dollhouse was picked from pictures, against the first recommendation |
| Record image spend | kie.mjs keeps a ledger beside each output; tell the client what was spent |

## kie.ai in one paragraph (optional)

`scripts/kie.mjs probe` prints the balance. `image "<prompt>" out.png --model
pro|seedream [--ar 9:16] [--ref a.png] [--cap N]`. `pro` (nano-banana-pro,
about 18 credits) for concepts, target renders and textures; `seedream`
(14) for sprites and page photos. Each output gets `out.png.kie.json` with the
prompt and the task's true cost from kie.ai; `kie-ledger.jsonl` collects them.
Use `--cap 180` per site so the ledger enforces the budget. Draw regular
patterns (checker, tile grids) with `fx`, not kie.ai. The key is `KIE_AI_API_KEY` in the environment or a `.env`
(walking up from the current folder, then `~/.config/model-craft/.env`). Budget per site: about 180 credits.
More: [references/kie.md](references/kie.md).

## Worked examples (read the one closest to your business)

Four sites built with this skill, each with a `BRIEF.md` that says what was
tuned and why. They are in the `examples/` folder of the skill's repository
(https://github.com/YousifQaseer/model-craft/tree/main/examples), with live demos
linked from its README.

| Example | Archetype | Read it for |
|---|---|---|
| `salt-table` (restaurant) | A, cutaway space | Tone by party size, the y-lift with focus on phones, a kind that dresses itself from `item.data`, a lunch/dinner theme blend |
| `northside` (barbershop) | A, cutaway space | Focus (no lift) with `view`, `faded` vs `dim`, toy figures from primitives, props that pop in from state, a scene that turns a chair |
| `linden` (hotel) | C, stacked building | Floors with nested rooms, the z drawer and its camera-side wall, a suite spanning two bays, day/night, `ctx.batch()` |
| `gridline` (car dealer) | B, object on a stage | `kit/car.js`, `key` rebuilds on a turntable turn, a custom exploding lift, paint easing in a kind, studio tuning against a render |

## Output

A static site folder: `index.html`, `site.css`, `app.js`, `model.js`,
`data.js`, `engine/`, `kit/`, `assets/` (poster, textures, photos), `BRIEF.md`,
`cases.json`, `lab/` (shots, kie outputs; not deployed). Served by any static
host. Tell the client: what the model does, the kie.ai credits spent and left,
what was verified and what was not.
