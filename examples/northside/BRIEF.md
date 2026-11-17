# Northside Barber Co.: brief

Placeholder brand: a neighbourhood barbershop in Hamilton, Ontario. Archetype A
(cutaway space). Decided in the brief from the agency; items marked *(mine)*
were decided during the build.

## The model, in five lines

1. **Choosing:** a barber, a service (plus a wash, a hot towel, maybe a friend), and a time.
2. **The model:** the shop in cutaway: three stations on the back wall (chair, round mirror, toy barber), black-and-white checker floor, wash basin, waiting bench, front counter, wall-mounted barber pole (never spins).
3. **Choices that redraw it:**
   - Barber: the chosen station is on (accent footprint), the other two dim. "Any barber" lights all three.
   - Service: a cape on the chair; tools on that station's counter. Fade = clippers + comb; classic = scissors + comb + spray; beard = trimmer + comb; shave = razor + folded towel + mug, towel on the headrest; kids = scissors + comb, and a booster seat on the chair *(mine)*.
   - Wash: the basin lights (footprint, water in the bowl, lamp on). Hot towel: a rolled towel on the headrest.
   - Bring a friend: a second station lights with its own cape and tools.
   - Review step with a time chosen: a client figure sits in the chair (and the friend in theirs).
4. **Tap:** focus. The camera moves in on the station and swings lower (`view`); no lift. The sheet: name, known for, next three open times as chips, "Book with {name}".
5. **The moment:** "The cut" when the service changes: the chair turns a half turn, a burst of clippings, then it turns back to the mirror.

Date and time are form-only (chips for the next open days).

## Decisions *(mine)*

- "Any barber" assigns the barber known for the service (fade: Marco; classic, beard, shave: Dee; kids: Sam). The cape and tools go on that station; all three stay lit.
- The friend gets a different barber: the one known for the friend's service if free, else the next one.
- The hot towel add-on is free with a hot towel shave (it already has one), and the form says so.
- Hours (sample): Tue-Thu 10-7, Fri 10-8, Sat 9-5, Sun 10-3, closed Monday. Availability is deterministic sample data.
- Walk-ins welcome when a chair is free; bookings hold the chair for 10 minutes.
- Type: Anton (display) + Instrument Sans (text). Palette: off-white #F4F1EA, ink #111111, barber red #B3261E (UI and selection only; inside the model only the pole).

## Look tuning

No kie.ai target renders were made: the six pictures below already used
170 credits by the ledger (over the 160 cap), so tuning was done against the
client's concept picture (`lab/kie/concept.png`) instead.

- Started from the skill's daylight theme. Matched the concept's family: matte
  white wall tops, brass round mirrors, cognac leather chairs, dark walnut
  counters, a strong black-and-white checker.
- Changed: background #F4F1EA to match the page; hemi 0.62; glow 0.85. The
  engine's square "on" footprint muddied the checker, so stations and the basin
  draw their own soft round red glow plus a thin ring (closer to the concept's
  halo around the chosen chair).
- The checker is drawn in code: kie.ai's "8 by 8 checkerboard" texture came back
  irregular and unusable. The subway tile wainscot is the kie.ai texture.
- Not matched: the concept's deeper ambient occlusion and taller walls.

## kie.ai spend (from kie-ledger.jsonl)

| Picture | Model | Credits |
|---|---|---|
| tex-checker (unused, irregular) | nano-banana-pro | 18 |
| tex-subway | nano-banana-pro | 36 |
| photo-fade | seedream 5 pro | 32 |
| photo-tools | seedream 5 pro | 28 |
| photo-front | seedream 5 pro | 28 |
| photo-towel | seedream 5 pro | 28 |
| **Total** | | **170** |

Balance 798 before, 628 after my last call. The account is shared with other
builds running at the same time (it was 504 by the end of this build), so a
cost recorded as a balance difference can include someone else's call: subway
(36) and fade (32) are probably inflated. seedream's 28 a picture was steady.
The concept picture (72 recorded) was made before this build.

## Follow-up after the build (lead, 2026-11-17)
- **True kie.ai spend for this site was 92 credits, not 170.** `kie.mjs` now records each task's own `creditsConsumed`; the earlier figures included other builds' spending on the shared key. The ledger was corrected from kie.ai's task records.
- **Target render made** (lab/kie/render-1.png, 18 credits) and the model tuned toward it. The front counter is now warm wood (`counter`, `#9A6A43`): in black lacquer it disappeared into the black tiles. The bench cushions are now cognac (`#9C5F38`).
- **Barbers who aren't chosen are now `tone: "faded"`** (a new engine tone). They read as faded but stay tappable, so tapping Dee's chair switches barber.
- **Engine refreshed** to the current skill engine. The full shoot matrix passes.
