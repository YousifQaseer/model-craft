# Archetypes and recipes

Pick the archetype first. It decides the camera, the lift axis and the layout.

## The three archetypes

### A. Cutaway space (dollhouse, dining room, shop, clinic, gym, salon)

- **Model:** one room or a floor plate on a slab. Full walls at the back
  (−z) and left (−x), low or no walls at the front and right, windows as gaps
  with glass.
- **Items:** the room is the root (`shell`, not pickable). Pickable things
  inside it are children: tables, chairs, rooms, stations, equipment.
- **Tap:** `lift: { axis: "y" }` for things you take out (tables, rooms).
  `lift: null` (focus) for things that stay put (chairs, machines).
  **Small items (mats, single seats, chairs) need the camera too:** add
  `focus: true` with `focusPad` about 1.4 m on phones and 2.4 m on desktop
  (`focusPad: view.portrait ? 1.4 : 2.4`), or a lifted mat is a 30 px speck.
- **Camera:** `az ≈ 0.5–0.8`, `el ≈ 0.85–0.95`. Wall height about 1.0–1.4 m on
  a 6–8 m room, so a lifted item clears the walls. It is a model, not a real room.
- **Phone:** at most about 8 pickable things in a 7 × 6 m room. Fewer, larger
  is better. Labels are short (a number, a name).

### B. Object on a stage (car, bike, boat, sofa, kitchen island, watch)

- **Model:** the object on a turntable or plinth, inside a minimal cutaway
  showroom (floor + back wall). The showroom has `frame: false`, or
  `camera.frame` is the turntable, so the camera fits the object.
- **Items:** stage (root) → turntable → object → parts (children: wheels,
  roof, bed, cushions). Body variants use `key` (sedan → SUV rebuilds).
- **Tap:** `lift: "custom"` for exploded parts (wheels pull outward on both
  sides), or `{ axis: "y" }` for a part that lifts off (roof, lid, cushion).
- **Camera:** lower, `el ≈ 0.45–0.6`, `az ≈ 0.7–0.9`, narrow orbit. Turn the
  turntable item's `rot` from state for a "spin to show the change".
- **Phone:** three or four parts as tap targets. Merge overlapping parts
  (roof + cabin). The options sheet holds one row of swatches.

### C. Stacked building (hotel, apartments, office, venue, school)

- **Model:** the building in section: the front wall removed, floors stacked.
  Floors are items with `box.y = level * storey`. Rooms are children of floors.
- **Tap:** `lift: { axis: "z", dir: 1 }` with `focus: view.portrait` (or always).
  The room slides toward the camera like a drawer and the camera moves in; without
  focus, on a phone, the drawer is about 60 px wide. Lower the room's camera-side
  wall as `L.lift` rises, or it hides the bed once the room is out.
- **Camera:** low and frontal: `az ≈ 0.45–0.6`, `el ≈ 0.3–0.45`, `elRange
  [0.25, 0.6]`. Higher, and you see slab tops instead of rooms.
- **Phone:** three floors plus a ground floor at most, two or three rooms per
  floor. A suite is one item spanning two bays (the box tweens wider).
- **C checklist** (all found only at phone size on The Linden):
  1. `focus: true` on the drawer.
  2. Lower the drawer's camera-side wall as `L.lift` rises.
  3. Dim things in front of the veil (trees, signs).
  4. Check 360 × 640: the sheet must leave the drawer half the stage.
  5. Batch furniture (`ctx.batch()`) to stay under 350 draw calls.

## Recipes

Each row is: model · choices that redraw it · tap · the one moment.

| Business | Archetype | Model | Choices that redraw it | Tap | Moment |
|---|---|---|---|---|---|
| Cleaning | A | The visitor's home, built from bedrooms/baths | Rooms appear/sink; deep clean traces baseboards; move-out empties furniture | Room lifts | Dirt wiped room by room |
| Restaurant | A | Dining room, 6–8 tables, bar | Party size lights tables that fit; lunch/dinner relights; occasion dresses the table | Table lifts | Table dresses itself (cake, candles, flowers) |
| Barbershop / salon | A | Shop with 3 stations, wash, bench | Barber chosen (others `faded`, still tappable); services add cape, tools, wash; time seats a client | Chair focus | Chair turns, cape on, clippings burst |
| Hotel | C | Townhouse in section, 3 floors + lobby | Room type (suite merges bays); guests (beds); day/night; breakfast tray; car in garage | Room slides out | Breakfast tray arrives |
| Car dealer | B | Car on a turntable in a showroom | Body style (rebuild on half turn); paint; wheels; package (rails, spoiler) | Part explodes | Paint sweep across the body |
| Yoga studio / class / cinema seats | A | The room with mats or seats in rows | Class re-sets the room; the time slot fills booked seats (`dim`); your 1–3 spots `on` | Free seat lifts and joins your spots | Props appear on the mats |
| Gym / studio | A | Studio floor with zones (rack, bikes, mats) | Class type lights its zone; time sets bike count; membership tier unlocks zones | Zone focus | Bikes fill one by one |
| Dentist / clinic | A | Clinic with rooms (hygiene, x-ray, treatment) | Treatment lights the rooms visited, in order; new patient adds the consult room | Room lifts | A path walks room to room |
| Event venue | A | Hall with tables or rows | Guest count fills tables; style (banquet/theatre/cocktail) re-lays furniture | Table lifts | The room re-sets itself |
| Movers | A then B | The visitor's rooms, then a truck | Rooms add boxes; boxes load into the truck; truck size follows volume | Room lifts | Boxes stack into the truck |
| Landscaping | A (outdoor) | The yard as a plot | Services draw lawn stripes, beds, a patio; size scales the plot | Zone focus | Mower pass stripes the lawn |
| Coworking / office | C | Floor plate with desks and rooms | Team size lights desks; meeting room add-on; private office | Room lifts | A desk sets up (laptop, lamp) |
| Car wash / detailing | B | Car on a stand | Package adds layers (foam, polish, interior); size (sedan/SUV) | Part focus | Foam then rinse across the body |

## Choosing what not to model

- Time, date, contact details and payment are **not** model choices. Put them
  in the form; the sheet can echo them.
- If two choices fight for the same visual (colour of the walls vs. colour of
  the accent), drop one from the model.
- Late checkout, cancellation terms and warranties have no honest visual. Put
  them in the sheet as text.
