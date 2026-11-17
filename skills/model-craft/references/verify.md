# Verify

## The scripts

```bash
node <skill>/scripts/doctor.mjs                         # node, Chrome, playwright-core, ffmpeg, kie key + balance
node <skill>/scripts/serve.mjs --root <site> --port <port> &
node <skill>/scripts/poster.mjs --url http://127.0.0.1:<port>/ --out <site>/assets/poster.webp --width 900 --height 900
node <skill>/scripts/shoot.mjs --url http://127.0.0.1:<port>/ --out <site>/lab/shots --cases <site>/cases.json --matrix
node <skill>/scripts/shoot.mjs ... --frames <case-name>  # the case at 0..1100 ms, to see an animation
(cd <site> && node --test tests/*.test.mjs)         # the pure price function
diff -r <skill>/engine <site>/engine                    # if it differs, the skill moved on (check
                                                        # VERSION in engine/model.js): new-site.mjs <site> --engine-only
```

Run `poster.mjs` before the first `shoot.mjs` (a missing poster is a 404 and
fails the run; the starter ships a placeholder).

`cases.json` walks through the site like a visitor. Each case is applied on
top of the previous one:

```json
[
  { "name": "party-4", "set": { "party": 4 } },
  { "name": "tap-t6", "set": { "pick": "t6" }, "wait": 1600 },
  { "name": "dinner", "set": { "time": "dinner" } },
  { "name": "birthday", "set": { "occasion": "birthday" }, "page": true },
  { "name": "dress", "play": "dress", "arg": "t6" }
]
```

Mark the price and summary elements with `data-check="price"` and
`data-check="summary"`. The `--matrix` run replays every case except scenes in
{3D on, off} × {motion, reduced} and compares their text. A `select` case acts
like a tap on the model (it fires `onSelect`), so it does nothing when 3D is off:
put every choice the matrix compares in `set` cases (`"set": { "pick": "t2" }`),
the way the form does, and keep `select` for checking tap feedback. Use `eval` for states that depend on sample
data or today's date.

## What fails a run

- A console error or page error.
- The page or the stage wider than the viewport (sideways scroll).
- The model not going live (no `.mk-live`).
- Frames still being drawn 2 s after everything settled.
- More than 350 draw calls.
- On phones, a pickable item under 44 px.
- Overlapping labels.
- Arrow keys and Enter not selecting, or Escape not deselecting.
- No poster on a lost graphics context, or no recovery after it.
- `data-check` text that differs across the matrix.

## What you check by eye (every build, every round)

Open the contact sheets (`lab/shots/sheet-phone.jpg`, `sheet-desktop.jpg`) and
the matrix shots. For each one:

- [ ] Anything you did not put there: stray coloured blocks, floating parts,
      z-fighting stripes, a part poking through the veil.
- [ ] The selected thing is obvious within a second at phone size.
- [ ] Labels sit next to, or above, what they label, never on top of the lifted
      thing; none are cut off at the edge.
- [ ] The dim items are still visible (night themes especially).
- [ ] The sheet does not cover the selected item.
- [ ] Reduced motion: the end state alone tells the story.
- [ ] No-WebGL: the poster plus the form still lets you book. (The poster is
      always the default view; the form and summary carry the state.)
- [ ] Every pickable item's label shows at rest on a phone. `shoot.mjs` lists
      hidden ones in report.json (`hiddenLabels`); drop `sub` on narrow screens
      (`view.w < 560`) or move labels apart with `labelAt`.
- [ ] The page as a whole: the hero headline fits on one or two lines at
      390 px, nothing scrolls sideways, buttons are at least 44 px.
- [ ] Compare against the concept and the kie.ai target render: is it in the
      same family? If not, why not, and is that better?

Then click through the whole booking flow in a browser at 390 px and 1440 px.
A short playwright-core script is the reliable way (fill the fields, press each
step's button, read the confirmation and `document.documentElement.scrollWidth`):
keep it in `lab/` so it can be re-run after every change. Click sheet buttons by
selector, not coordinates.

## Report

Tell the client:
- What the model does.
- Which checks passed (paste the summary line).
- What you checked by eye.
- The kie.ai credits spent and left.
- What was **not** verified. A real iPhone and a real Android phone are never
  verified from here; say so.
