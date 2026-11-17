# Gridline Motors · BRIEF

Placeholder car dealership, Hamilton, Ontario. Built with the `model-craft` skill (archetype B, object on a stage). Creative direction self-authored; the concept picture (lab/kie/concept.png) was shown to the client first.

## The model
1. **Choosing:** a car spec (body, paint, wheels, package) and a test-drive time.
2. **Model:** a chunky die-cast toy car on a turntable in a cutaway graphite showroom. The car is fully procedural (kit/car.js); there are no model files.
3. **What redraws it:**
   - **Body style:** the car pops out and the new one pops in while the turntable makes one full turn.
   - **Paint:** the colour eases to the new one and the finish switches (solid, metallic, matte, pearl), with a small sparkle.
   - **Wheels:** the rims rebuild.
   - **Package:** Sport adds a black roof and a spoiler; Touring adds roof rails and a chrome belt line.
4. **Tap:**
   - Paint: the camera focuses on the car and the sheet shows swatches.
   - Package: the cabin (glass and roof) lifts off to show the seats.
   - Wheels: the wheels pull straight out of the arches.
5. **Moment:** the full turn on a body change. No other scene.

## Page
- **Live surface:** build controls beside the pinned model, with a live total and monthly payment.
- **Finance:** a down-payment slider, term chips and the breakdown.
- **Showroom:** three kie.ai photos and visit facts.
- **Booking:** 4 steps (time, details, review, booked), ending in a reference `GM-XXXXXX` and a plain "demo, nothing sent" note.
- **Look:** graphite `#15171B`, white, one electric blue `#2F6BFF`. Space Grotesk display, IBM Plex Sans and Mono.
- **Pricing:** all prices and the 5.99% APR are samples and labelled as such.

## Look tuning (two rounds against kie.ai render lab/kie/render-1.png)
- **Before:** a near-white floor, a white windscreen, a light turntable, flat paint.
- **After:** a mid-grey concrete floor (kie texture, tinted `#A4A9B0`), dark glass (roughness 0.42, envMapIntensity 0.2), a satin grey turntable, metallic roughness 0.3, hemi lowered to 0.38 and shadows raised to 0.55.
- **Removed:** the wall light strips, which read as stray white bands; the turntable's own shadow, which caused radial acne; and the mirrors, which read as floating dots.

## kie.ai (from lab/kie/*.kie.json; balance figures are shared with two agents working in parallel)
| What | Credits |
|---|---|
| Concept | 18 |
| Concrete texture (pro) | 18 |
| Showroom, wheel and keys photos (seedream, 14 each) | 42 |
| Wheel photo reroll (the first one balanced a wheel on a car body) | 14 |
| Target render | 18 |
| **Total** | **110** |

## Verified (2026-11-17)
- **shoot.mjs:** all checks passed at phone and desktop size and across the matrix (3D on/off × motion/reduced, with identical price text). It ran 156 to 230 draw calls and drew nothing when idle.
- **node --test:** 6/6.
- **Booking flow:** clicked through at 390 and 1440 px, with validation errors shown, no sideways scroll and 0 console errors.
- **Not verified:** a real iPhone or Android phone.
