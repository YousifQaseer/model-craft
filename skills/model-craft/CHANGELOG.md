# model-craft changelog

## 1.2.0 · 2026-11-17 (ready for other people's machines)
- Scripts find Chrome or Chromium on macOS, Linux and Windows, with
  MODELCRAFT_CHROME as an override and Playwright's own Chromium as a fallback.
  GPU flags are set per platform (swiftshader off macOS).
- `playwright-core` is a dependency of the skill itself (`npm install` in the skill folder).
- kie.ai is optional everywhere. "Without kie.ai" and "With another image model"
  are in references/kie.md, and doctor treats kie.ai and ffmpeg as optional.
- The kie key is found in the environment, a `.env` walking up, `~/.config/model-craft/.env` or `~/.kie.env`.
- `server.mjs` and `.railwayignore` are in the starter, and page.md documents deploying.
- The docs no longer name the original client or the author's machine.

From a stranger test (a fresh agent installed the skill with `npx skills add`
and built a yoga studio with no image API):
- **Public `model.select()` is now silent.** The docs promised that `onSelect`
  only reports the visitor, but `select()` fired it. `select(id, { notify: true })`
  acts like a tap.
- `select()` on an item that can't be picked is ignored; it used to clear the
  current selection.
- The starter ships a placeholder poster, a pure `price()` with tests,
  `cases.json` and a `BRIEF.md` template. A fresh site passes `shoot.mjs` on its
  first run.
- `new-site.mjs` creates `FINGERPRINTS.md` in the workspace and prints the next commands.
- `mountModel({ poster: { portrait, landscape } })` picks the poster by stage shape.
- `poster.mjs --view` shoots any camera angle (concept variants without an image model).
- `shoot.mjs`:
  - names the URL of a failed request and hints at `poster.mjs`;
  - sizes contact-sheet tiles from the shots;
  - `--only` replays the earlier cases;
  - the matrix replays every case except scenes;
  - `select` cases act like a tap.
- `kie.mjs` exits with one clear line when there is no key; doctor shows that line.
- The closed sheet no longer leaves a shadow at the stage edge.
- Docs:
  - install paths (project vs global) and the gitignore tip;
  - `<workspace>` defined;
  - `ctx.batch()` signatures;
  - glow under flat items;
  - focus for small items in archetype A;
  - a "pick several seats" recipe;
  - matching the page background to a theme change;
  - a booking-walk script in verify.md.

## 1.1.0 · 2026-11-17 (after the first four builds)
Two fresh agents built The Linden (hotel) and Northside (barbershop) from the
skill alone, and the lead built Gridline (cars) and Salt Table (restaurant).
Everything below came from those builds.

**Engine**
- A layout change that dims or removes the selected item now deselects silently,
  so `onSelect` only reports the visitor. It used to fire mid-`render()` and
  cancel a choice the page was making (both agents and the lead hit this).
- `tone: "faded"`: looks dimmed, stays tappable (not chosen, as opposed to unavailable).
- The glow exists for every item; `glowShape: "round"` and `glowSize: [w, d]`.
- Phones count as portrait under 600 px wide, even with a square stage.
- Sheet capped at 46% of the stage on phones; `sheet.inset()` matches.
- `ctx.batch()` merges static parts into one mesh per material (from The Linden).
- `textures.key.repeat` sets a texture's default repeat.
- `VERSION` export in model.js.

**Kit**
- `kit/car.js`: procedural toy car (4 bodies, finishes, wheels, packages), turntable.
- `shell`: slab sides in `trim`, floor texture on a top plane only, no overlapping corner.

**Scripts**
- `kie.mjs`: records each task's true cost (`creditsConsumed`) instead of the
  balance difference, which counted other builds on a shared key; `--cap N` per
  site from the ledger; finds the key in a `.env` that actually has it.
- `shoot.mjs`: fails on sideways scroll and on a stage wider than the viewport;
  tests 360 × 640 by default; reports labels hidden at rest; `eval` in cases.
- `poster.mjs`: writes PNG or JPEG when the extension says so.
- `new-site.mjs`: never overwrites files already in the site.
- `templates/starter/package.json` with `"type": "module"` (tests failed without it).

**Docs**
- Archetype C checklist, the veil-and-foreground note, kinds must draw from
  `item.data` (never `state`), scene `keepLift` and draw/step order, night look
  (cool outside, warm inside), draw regular patterns in code, real kie.ai costs,
  render before photos, FINGERPRINTS columns for model-craft builds.

## 1.0.0 · 2026-11-17
First version, generalised from the original dollhouse: a cleaning company's booking site where the visitor's home was a live 3D cutaway.
