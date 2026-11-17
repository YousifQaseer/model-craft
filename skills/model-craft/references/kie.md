# Pictures: kie.ai, another image model, or none

## Without kie.ai

kie.ai is optional. The script is just the most-tested path. Everything else
works without it:

| Need | With no image API |
|---|---|
| Concepts | Build two or three quick variants of the model itself (different camera, look, tap behaviour) and show screenshots side by side: `poster.mjs --view '{"az":0.6,"el":0.9}'` shoots any angle. Or sketch the options as a plain HTML mockup. |
| Textures | `fx.plankCanvas`, `fx.tileCanvas`, `fx.checkerCanvas` and tinted materials. The examples look finished with drawn textures. |
| Target render | Tune against the client's own photos of the place, or skip it: the look.md starting themes are tuned already. |
| Page photos | The client's photos (best), or leave them out and let the model carry the page. Never use stock photos that pretend to be the business. |

## With another image model (OpenAI, Gemini, Flux, ...)

The prompts below are model-agnostic. Any model that does text-to-image and
image editing with a reference can fill the same five roles. If your agent has
its own image tool (for example an OpenAI image model), use it with these
prompts. Save outputs under `lab/`, then run `scripts/tex.mjs` on them the same
way. Record what you spent.

# kie.ai for model-craft

kie.ai makes **pictures**. Five uses, in the order a build meets them:

| Use | Model | Aspect | Credits (kie.ai creditsConsumed) |
|---|---|---|---|
| Concept phone screens | pro (nano-banana-pro, 2K) | 9:16 | 18 |
| Photoreal target render of a model screenshot | pro with `--ref` | match the shot | 18 |
| Seamless textures (floor, tile, concrete, fabric, leather) | pro | 1:1 | 18 |
| Effect sprites and decals on flat white or black | seedream | 1:1 | 14 |
| Page photos (food, interiors, people at work, details) | seedream (`--ref` for style match) | 16:9, 3:4, 9:16 | 14 |

Budget per site: **about 180**: 1 to 3 concepts, 2 renders, 4 textures or
sprites, 4 photos. **Spend in this order: concepts, target renders, textures,
then photos with what is left.** If no render budget is left, tune against the
concept. Tell the client the balance before and after.

**Draw regular patterns in code** (checker, stripes, grids, subway tile):
`fx.checkerCanvas`, `fx.tileCanvas`, `fx.plankCanvas`. kie.ai returns an
irregular pattern for "8 by 8 checkerboard" (one build lost 18 credits to it).
Use kie.ai for organic surfaces: wood grain, stone, concrete, glaze, fabric.

## The script

```bash
node <skill>/scripts/kie.mjs probe
node <skill>/scripts/kie.mjs image "<prompt>" out.png --model pro --ar 9:16 [--ref a.png ...] [--budget 120]
node <skill>/scripts/kie.mjs still "<prompt>" out.png --ar 16:9          # = --model seedream
```

- `--ref` uploads local files and switches to image-to-image. Several are allowed.
- `--budget N` refuses to start below N credits (account balance).
- `--cap N` refuses if this folder's `kie-ledger.jsonl` plus this call would
  pass N: a per-site budget that other builds on the same key cannot eat.
- `out.png.kie.json` records the prompt, model, refs and **the task's true cost**
  (`creditsConsumed` from kie.ai's task record), plus the balance difference
  for reference. The balance difference is wrong whenever anyone else uses the
  key at the same time (two agents once saw 28 and 46 for 14- and 18-credit calls);
  the recorded `cost` is not.
- Jobs take 30 to 90 s. Run several in the background and look at them together.
- seedream rejects `4:5`. Use 3:4.
- API: `POST https://api.kie.ai/api/v1/jobs/createTask {model, input}`, poll
  `GET /api/v1/jobs/recordInfo?taskId=`, balance `GET /api/v1/chat/credit`.
  - nano-banana-pro input: `{prompt, output_format: "png", aspect_ratio, resolution: "2K", image_input: [urls]}`.
  - seedream input: `{prompt, aspect_ratio, quality: "high", output_format: "png", nsfw_checker: false, image_urls: [urls]}`.

## Prompts that worked

### Concepts (phone screens)

Shared style lead, then the business-specific part:

> Portrait iPhone screen, 9:16, a premium mobile website. The hero is an interactive 3D miniature: a cutaway architectural model seen from above at about 35 degrees, like a high-end real-estate maquette or a beautiful toy diorama: soft warm daylight, gentle ambient occlusion and contact shadows, crisp matte white wall tops with clean cuts, real materials (oak, tile, fabric, brass), simple rounded furniture. Crisp, legible, minimal UI. Very little text; only the words given in quotes.

Business part (restaurant example):

> Brand 'SALT TABLE', a modern neighbourhood bistro; cream background, terracotta and olive accents, elegant serif headline. The model is the dining room in cutaway: eight tables of 2, 4 and 6 seats on oak floors, a bar along one wall, pendant lights, plants. The visitor chose a party of 4: the tables that fit glow softly, the others are faded. One 4-seat table has lifted up out of the room, floating with a soft shadow under it and a thin outline where it stood. A bottom card reads 'Table 6 · Window · 7:30 pm' and a dark button 'Reserve'.

For variants of one concept, append this "keep" suffix and pass the base as `--ref`:

> Keep this exact layout, room labels and drawing style. Portrait iPhone screen 9:16. Crisp, legible, premium UI. Do not add any text other than what is specified.

### Target render of the model (lighting reference)

Screenshot the model in its default state with no labels (`poster.mjs`
output works), then:

> Turn this simple 3D model into a beautiful photoreal architectural miniature: a cutaway model of {the space}, seen from above. Soft warm daylight, gentle ambient occlusion and soft contact shadows, crisp white matte walls with clean cut tops, {floor and material list}, {furniture list}. High-end real-estate 3D render, Octane quality, calm and clean. Keep EXACTLY the same camera angle, framing, footprint, layout, wall positions, openings and furniture placement as the reference image. Same background colour. No text, no labels, no people.

Use it as a target for colour, contrast, shadow softness and material
roughness. Do not paste it into the page next to the live model.

### Seamless textures

> Seamless tileable texture, perfectly flat orthographic top-down view of a light natural white-oak plank floor, planks running horizontally, 8 rows of planks, staggered butt joints, subtle grain, matte finish, even lighting with no shadows, no vignette, no perspective. Edges must tile seamlessly.

Swap the subject: "polished grey concrete with faint aggregate", "black and
white checkerboard ceramic tile, 8 by 8", "warm terrazzo", "herringbone walnut
parquet", "dark green velvet fabric weave", "brushed brass", "rough natural
linen". Then make it smaller with `scripts/tex.mjs`. Tint it in code through
the material colour, and set its repeat from the room size.

### Sprites and decals

Generate on **pure white** for things that darken (dirt, spills, crumbs, hair,
shadows) and on **pure black** for things that glow (steam, sparkle, candle
glow, suds). Key them with `tex.mjs --key white|black`.

> Top-down flat cartoon illustration, {subject} on a pure white background, spread evenly across the square with white space between them. Thick soft dark outlines, matte flat colours, the same toy-like style as the reference. No floor, no shadows, no text, nothing touching the edges.

Cartoon style suffix used on the dollhouse:

> flat 2D cartoon illustration, cozy miniature dollhouse game art style, soft muted warm pastel palette, gentle cel shading, clean rounded shapes, thin soft dark-grey outlines, no text

### Page photos

Write one shared style preamble per site (light, lens, palette, mood). Put it
first in every photo prompt, so the set reads as one shoot:

> Editorial interior photograph, 35mm lens, soft late-afternoon window light, warm neutral palette with terracotta accents, shallow depth of field, natural textures, no people looking at camera, no text, no logos.

Then the subject. Use `--ref` to a chosen photo when a second one must match.
No real brands, no recognisable real people, no text in the image.

## Failures to expect

- Typos and garbled text in any UI the model draws. Keep UI text minimal and say so.
- A room or a seat silently dropped in a concept. It is art direction, not a spec.
- The camera moves between two generations meant to align. Generate the second
  from the first with `--ref`, then check alignment.
- Colour instructions ignored. Recolour in code or with a CSS filter.
- Occasionally a ghost figure or extra limb in photos. Reroll; it costs one call.
