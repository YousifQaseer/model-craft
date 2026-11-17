# Salt Table · BRIEF

Placeholder neighbourhood bistro, James Street North, Hamilton. Built with `model-craft` (archetype A, cutaway space). The creative direction is self-authored. The concept picture (lab/kie/concept.png) was shown to the client first.

## The model
1. **What the visitor chooses:** a table for their party, at a time, for an occasion.
2. **The model:** the dining room in cutaway, 9 × 7 m, with low walls, three windows and a door. It has eight tables of 2, 4, 6 and 8 seats, a bar with stools and pendants, a bottle shelf, olive trees and a herb planter.
3. **What redraws it:**
   - Party size: tables that fit glow, the rest fade and can't be tapped.
   - Lunch or dinner: the whole room relights over 650 ms. Pendants and candles glow at night.
   - Occasion, on the picked table: a birthday adds a cake, an anniversary adds flowers and a candle, business adds a place card.
   - The picked table sets itself with a cloth and a terracotta plate and glass for every guest.
4. **Tap:** the table lifts 1.7 m out of the room, with veil, ghost and posts. On phones the camera also moves in (`focus` when portrait).
5. **Moment:** "dress" plays a sparkle over the table when an occasion is chosen.

## Page
- Hero: the pinned model plus the whole choice (party stepper, lunch/dinner, day, time, the tables that fit, occasion, tasting pre-order), with a live summary.
- Menu, the room (kie photos), visit facts.
- Reservation in 3 steps (details, review, booked) ending in `ST-XXXXXX`, with a plain demo note.
- Prices are samples: a $10-a-guest deposit taken off the bill, a $28 cake, $35 flowers, an $85 tasting menu.
- Look: cream `#F4EEE4`, terracotta `#B4532A`, olive `#5C6B3C`. Type is Fraunces with Instrument Sans.

## Look tuning (one round against lab/kie/render-1.png)
The model shot was already close to the render. Changes:
- Oak floor made warmer and a little darker.
- Bar top changed from white to wood.
- Shadow raised from 0.26 to 0.32.
- Plates changed to terracotta, because white plates vanished on the white cloth.
- Table dressing scaled up to toy size.

## Bugs found here, and fixed in the skill
- **Engine:** a layout change that dimmed the selected table fired `onSelect(null)` in the middle of `render()`, which wiped out the newly picked table. Deselects caused by a layout update are now silent.
- **Page:** a nowrap row of day chips widened the hero grid, so on a 390 px phone the stage was 525 px wide and the camera framed for the wrong width. Fixed with `minmax(0, 1fr)` and `min-width: 0`. `shoot.mjs` now fails any run where the page or the stage is wider than the viewport.

## kie.ai credits

| Item | Credits |
|---|---|
| Concept | 18 |
| Oak texture | 18 |
| Pasta, room and table photos (14 each) | 42 |
| Target render | 18 |
| **Total** | **96** |

## Verified (2026-11-17)
- `shoot.mjs` passed every check, on phone and desktop and across the full matrix, with identical text in all four runs.
- `node --test` passed 5 of 5.
- The reservation flow was clicked through at 390 and 1440 px: validation shown, no sideways scroll, 0 errors.
- Not verified: a real phone.
