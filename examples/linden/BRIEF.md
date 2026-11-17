# The Linden: brief

Placeholder brand: a small boutique hotel in Hamilton, Ontario. Archetype C,
the stacked building. Decided by the client brief; items marked (ours) were
decided during the build.

## The model, in five lines

1. **What is the visitor choosing?** A room for a few nights: room type, guests, extras.
2. **What physical thing shows it?** The hotel itself: a four-storey townhouse in
   section, front wall off, like a dollhouse. Lobby with reception and a garage
   bay on the ground floor, three floors of rooms above.
3. **Which choices change what is drawn?**
   - Room type (Classic Queen / Garden King / Linden Suite): rooms of that type
     light up ("on"), the others dim. The suite is one room spanning two bays.
   - Guests 1 to 4: rooms that cannot sleep that many dim; a twin daybed or a
     sofa bed appears in the lit rooms at 3+ guests.
   - Day / night: theme change; lamps and the side windows glow at night.
   - Breakfast tray: a tray on the bed of your room. Parking: a car drives into
     the garage. Late checkout: sheet and summary only.
   - Nights, dates and contact details: form only.
4. **What does a tap do?** The room slides out toward the camera like a drawer
   (`lift: { axis: "z", dir: 1 }`), the rest of the building is veiled.
5. **The one moment:** "breakfast arrives": the tray slides onto the bed and
   steam rises (skipped under reduced motion; the tray is drawn from state).

## Inventory (ours)

| Room | Floor | Type | Sleeps | View |
|---|---|---|---|---|
| 101 | 1 | Classic Queen | 2 | The linden tree |
| 102 | 1 | Garden King | 3 (sofa bed) | Garden |
| 103 | 1 | Classic Queen | 3 (twin daybed) | Street |
| 201 | 2 | Garden King | 3 (sofa bed) | Garden |
| 202 | 2 | Classic Queen | 2 | The linden tree |
| 203 | 2 | Garden King | 4 (sofa bed) | Garden and escarpment |
| 301 | 3 | Linden Suite (two bays) | 4 (sofa bed) | Escarpment and rooftops |
| 302 | 3 | Classic Queen | 2 | Rooftops |

If the chosen type has no room for the guest count, the type switches to the
cheapest type that does, and the page says so (ours).

## Prices (sample pricing, CAD)

Classic Queen $189, Garden King $229, Linden Suite $329 a night. Breakfast tray
$24 per guest per night. Parking $20 a night. Late checkout $35 once. 13% HST
on the whole stay. All labelled "Sample pricing".

## Look

Deep ink navy, brass and sand. Display: Cormorant Garamond (ours); text: Figtree
(ours). The model sits on the navy stage like the concept: white plaster
interiors, oak floors, brass lamps, warm light. Brass is the selection accent.

## Look tuning against kie.ai

Two target renders (lab/kie/render-1.png day, lab/kie/render-2-night.png
night), compared side by side in lab/compare-1.jpg and lab/compare-3-night.jpg.

- Day, before: grey-looking back walls, orange oak, orange-red brick, mauve
  furniture, blob plants. After: hemi 0.7 to 0.9 with a warmer ground colour,
  env 0.35 to 0.45, exposure 1.06, sun lower and from the front so the slabs
  do not shade the rooms; walls #FBF7F0, oak tint #F6E3C6, brick #9A6252,
  walnut #7A5238; plants rebuilt as olive standards (trunk + small leaf head).
- Night, before: everything warm beige including the roof and cuts. After:
  the outside goes cool (section cuts #B4BED6, pavement blue-grey, a cool
  "moon" sun at 0.95), the inside stays warm (walls #F6DDBA, lamp shades
  emissive 2.4, side windows emissive 1.6).
- Not chased: real point-light pools, the render's finer foliage and the
  rolled-shutter garage door.

## kie.ai spend (from kie-ledger.jsonl)

True per-task costs (kie.ai creditsConsumed, backfilled into the ledger when
the skill's kie.mjs was updated mid-build): oak texture 18, day render 18,
lobby, breakfast and room photos 14 each, night render 18, street photo 14:
**110 credits**. The balance moved by more during several calls (another
agent shares the key); `balance_diff` in each record keeps that. No brick
texture: the brick is a drawn canvas texture.
