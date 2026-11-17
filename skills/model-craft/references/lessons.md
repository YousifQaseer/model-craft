# Lessons from the dollhouse

The original build was a cleaning company's booking site (October and November
2026). It took three long working sessions with the client, six phone concepts,
two redesigns and about 2,500 kie.ai credits. This is what it taught, so the
next build does not pay for it again.

## How the dollhouse was arrived at

1. A flat SVG floor plan built from the visitor's answers (bedrooms, baths,
   add-ons) was the first signature. The client liked it but wanted it "way
   cleaner and more detailed". It was redrawn as a proper architectural plan
   **in code**. kie.ai was the wrong tool for a plan that redraws live.
2. The client asked for animated ideas "with the click of the rooms", and
   then: "make this look mainly for the phone because that's what people are
   gonna be looking at it the most". Six concepts were made as phone screens:
   tap-and-sheet, zoom into the room, **3D dollhouse**, swipe room cards, tick
   off rooms, build your home. One base screen was generated, and every concept
   was an image edit of it, so all six shared one layout. They were shown side by
   side in phone frames, with animation and final-frame toggles.
3. Claude recommended tap-and-sheet. The client picked the 3D dollhouse:
   "I like that 3d look of it. I want it to be able to change while I would like
   click on them... if I add a bedroom it would add another bedroom". **Show
   pictures; let the client choose; the bold option can win.**
4. The prototype built the flat plan's own `layout()` as a Three.js cutaway.
   - Rooms rise out of the floor when added and sink when removed.
   - A tapped room lifts over a dimmed house.
   - The clean types read in 3D.
   - kie.ai then made photoreal renders of model screenshots, used as lighting
     targets, and seamless floor textures.
5. The client chose Daylight over the dark Blueprint look. Next came
   "can we do it where the render would be like dirty then as they scroll it
   cleans?". This produced a kie.ai grime texture, seeded clutter, and a clipping
   plane that wipes it away exactly under the blade.
6. Later rounds added showcases for each extra: camera fly-ins, oven and fridge
   close-ups, and cartoon effect sprites.

## What the client rejected (and what replaced it)

| Rejected | Replaced by |
|---|---|
| Pointer tilt on the plan (skewed it into a trapezoid) | Drag to orbit, sideways only on touch |
| A photographic squeegee riding the wipe | The plain accent blade |
| Lime/brand green inside the house | Brand colour only on selection guides; soft aqua for "cleaned" |
| Photoreal effect pictures (steam, grease) next to the model | Cartoon sprites matched to the model's toy look |
| Cartoon appliance fronts ("too cartoonish without enough detail") | Real 3D geometry (hollow oven, racks, shelves, handles) plus cartoon effects |
| A squeegee passing through the fridge glass | A line clearing spills shelf by shelf |
| A spinning dial ring to pick the clean ("too hard") | Four plain buttons |
| A zoom into one kitchen to compare cleans | The whole house from above, changes made more noticeable |
| A busy redesign with dial tours and sentence booking ("clients are going to be very confused") | Simple steps, the 3D house kept small in booking, "like hellamaid" |

The pattern: **real geometry for things, simple pictures for effects, the
whole model in view, plain controls, the brand colour kept for UI.**

## Bugs that took several rounds

- **A lift nobody noticed.** The room lifted 8% of the house height. Fix: lift
  well clear of the walls, a dark veil over the rest, a footprint and guide
  posts. (Built into the engine.)
- **A stray accent block at the centre of the house.** `tint.visible = sel ||
  hov || clean` evaluated to `undefined`. Fix: `Boolean(...)`. The client found it.
- **The wipe did not clip.** `material.clone()` copies `clippingPlanes`, so each
  room had a frozen copy. Fix: re-assign the shared live plane after cloning.
- **The model stopped drawing mid-animation on a fast scroll.** The
  IntersectionObserver lagged. Fix: check the element's own box before sleeping
  (built in).
- **Furniture blocking a close-up**, and later furniture that lingered 150 ms.
  Fix: hide it on the very first frame of the scene; do not animate it away.
- **The camera position for a close-up from the first page.** Fix: per-scene
  `view` and `focus`, plus hiding the row across the hall.

## kie.ai lessons

- `google/nano-banana-edit` (4 credits) ignored instructions and put typos in
  prices. `nano-banana-pro` (18) followed "keep this exact layout" edits. Use pro
  for concepts, renders and textures.
- seedream (14) made the sprites and page photos. Its before/after pairs moved
  the camera between shots: generate the second from the first with `--ref`,
  and expect to align them.
- Colour words in prompts are unreliable ("no green" came back sage). Recolour
  in code.
- Sprites: generate on **pure white** (dirt, spills, grease, hair) or **pure
  black** (steam, sparkle, suds), then key locally.
- The old cost table said 28 per still and 160 per clip. Real debits were
  14 / 18 per still and 50 per 5 s clip. Trust the ledger, not the docs.
- A site's own `.env` without the key hid the workspace key from the old script.
  The new `kie.mjs` skips `.env` files that lack it and prints which file it used.
- The client tops up when asked ("my credits should be updated now go ahead"),
  but rejected generation nobody asked for. **Say what you will generate and
  roughly what it costs.**

## Things only the client caught

The trapezoid tilt; a lime towel block ("do you see the green thing?");
missing film frames; lime looking bad; appliances not matching the house; a
camera position; a table that lingered before a close-up; first and last
sections looking alike. Every one passed the automated checks. Hence the last
step of verify: **look at every screenshot for anything you did not put there.**

## What clients tend to say

The client on that build, and the four builds since, pointed the same way:
- Phone first, always. Most visitors book on a phone, and clients judge on
  their own phone, often with Reduce Motion on.
- They like 3D, detail, a soft toy-like look and daylight, and want to "see the
  real difference instead of just text".
- They reject clutter, repeated sections and anything "too much for people".
- They want previews or mockups before big code changes, with options side by side.
- Many write casually and prefer plain language and multiple-choice decisions.
