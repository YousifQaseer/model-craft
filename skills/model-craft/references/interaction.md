# Interaction

## The loop

1. The visitor changes a control (or taps the model).
2. `set(patch)` updates the one state object, then calls `render()`.
3. `render()` calls `model.update(state)`. The engine tweens, raises, sinks
   and re-tones items. Then it calls `model.select(state.pick)`, fills the sheet,
   and calls `model.setInsets(sheet.inset())`. Finally it rewrites the price
   and the form.

A tap on the model fires `onSelect(item)`, which calls `set({ pick: item?.id ?? null })`.
It is the same path as a button.

## What a tap does

| Behaviour | Item setting | Use for |
|---|---|---|
| Lift up | `lift: { axis: "y", dist }` | Things you take out: tables, rooms, a roof |
| Slide out | `lift: { axis: "z", dir: 1 }` | Rooms in a building section (toward the camera) |
| Explode | `lift: "custom"` + the kind reads `L.lift` | Parts that come apart in two directions (wheels) |
| Focus | no `lift`; optional `view` | Things that stay put: chairs, stations, machines |

- **Make it unmistakable.** The lift distance should clear the walls by at
  least half a metre. The engine draws the veil, the ghost outline and the
  posts. Check the "selected" screenshot at phone size: if you have to look
  for it, lift higher.
- **The sheet** shows the tapped thing's name, one line of facts and at most
  4–6 options (chips) plus one primary button. On phones it is capped at 46% of
  the stage and scrolls; keep it to one row of chips so the model keeps the top
  half. Hide the long description under 600 px. On phones it covers the bottom
  third; `setInsets` keeps the lifted item above it. With `data-sheet="side"`
  on the stage it sits on the right from 900 px wide.
- **Close** with the × (44 px), Escape, tapping empty space on the model, or
  tapping the item again.

## Picking several (seats, mats, tickets)

The engine has one selection. For "pick up to N":
- Chosen spots are `tone: "on"`, taken ones `tone: "dim"`, free ones normal.
- `onSelect(item)` adds the tapped id to `state.spots` (dropping the oldest when
  full) and sets `state.pick` to it, so the last tapped spot is the selection.
- The form mirrors `state.spots` as chips you can remove.

## Labels on the model

- Every pickable item with a `label` gets a real `<button>` on the model:
  - It is the tap target on phones.
  - Arrow keys move between labels, Enter selects, Escape deselects.
  - Screen readers hear `ariaLabel`.
- Keep labels to 1–2 words: a seat count, a name, a room type. Use `sub` for a
  second short line.
- Labels hide while another item is selected (unless `alwaysLabel`), when the
  item is under `labelMin` px, or when they would overlap a higher-priority label.

## Tap targets on a 390 px phone

- `shoot.mjs` fails the phone run if any pickable item is under 44 px wide on screen.
- Fixes, in order:
  - Fewer items.
  - Bigger items (it is a model: tables can be generous).
  - A tighter camera (`camera.frame`).
  - Letting labels carry the taps (they have a 44 px hit area).

## Camera

- Horizontal drag orbits within `baseAz ± azRange`. Vertical drag changes the
  elevation (mouse only), so a phone swipe still scrolls the page.
- An item's `view: {az, el}` swings the camera while it is selected. Use it
  sparingly: one or two signature angles, e.g. a low angle for a barber chair.
- Do not auto-rotate, and do not spin idle. The model sleeps when nothing moves.
  A turntable may turn **once**, for a reason (a body style changed).

## Motion budget

| Change | Duration | Ease |
|---|---|---|
| Layout tween (move, resize) | 460 ms | ease-out cubic |
| Rise / sink (rooms, walls) | 420 / 300 ms | ease-out |
| Pop / drop in (furniture, parts) | 360–380 ms, 18 ms stagger per part | easeBack (slight overshoot) |
| Lift / slide | ~500 ms | exponential approach |
| Theme blend | 650 ms | ease-in-out |
| Scene (the one moment) | 900–1800 ms | your choice |

Under reduced motion every one of these snaps to its end state, scenes and
bursts are skipped, and the result must still read. Check the reduced-motion
screenshots for that.

## Scenes

- One short moment per choice at most, e.g. the table dresses itself when
  "Birthday" is picked.
- Play it after `set()`, never instead of it. The kind already draws the end
  state from `state`; the scene is the flourish on the way there.
- A tap ends it.

## Phones

- The stage is pinned under the header (`position: sticky`, about 50–56svh)
  while the controls scroll under it. A box-shadow in the page colour masks
  the controls as they pass underneath.
- `touch-action: pan-y` on the canvas is built in: vertical swipes scroll the page.
- Test at 390 × 844 and 360 × 640. Reduced motion on.
