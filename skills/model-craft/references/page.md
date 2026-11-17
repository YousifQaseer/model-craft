# The page around the model

## Grammar

A one-page site that **behaves like the booking tool it is**. Order of sections:

1. **Header**, sticky and slim: the wordmark, 2–3 anchor links and one primary button.
2. **Hero = the model + the first choice.** A short headline (one line on a
   phone), one sentence, and the first control right there (party size, room
   type, body style). The visitor changes the model within five seconds of
   arriving.
3. **The offer**, as cards that also set state: menu highlights, room types,
   services, trims. Tapping a card selects it, and the model shows it.
4. **Proof, kept quiet.** What is included, policies in plain words, the
   neighbourhood, hours, a few kie.ai photos. Never invented reviews, star
   counts or awards. Sample prices are labelled "Sample pricing".
5. **Booking**, three or four short steps at most:
   - Choice (already made above).
   - Time slot.
   - Details (name, email, phone).
   - Review and confirm.

   It ends in a confirmation screen with a reference number (`XX-4F7K2Q`). It
   says plainly that this is a demo and nothing was sent.
6. **Footer**: address, hours, contact, a line saying the prices are a sample.

Grids that hold the stage need `grid-template-columns: minmax(0, 1fr)` and `min-width: 0` on their children: a nowrap chip row otherwise widens the column, the page scrolls sideways and the camera frames for the wrong width.

On desktop the model can stay pinned beside the controls (two columns). On a
phone it stays pinned under the header while the controls scroll.

## State, price, booking

- One `state` object holds every choice, including `step` for the booking flow.
- `price(state)` is a **pure function** in `data.js`, with `node --test` tests.
  The page shows it live, with a line-item breakdown in the review step.
- Show money with `Intl.NumberFormat(locale, { style: "currency", currency })`.
- Form inputs: real `<label>`s, `autocomplete` attributes, `inputmode="tel"`,
  minimum 44 px tall, errors shown next to the field, not in alerts.
- The confirm step does not send anything. Say so on the confirmation screen
  ("This is a demo booking; nothing was sent").

## Look and type

- Every build gets its **own** palette, typefaces and layout. `new-site.mjs`
  creates `<workspace>/FINGERPRINTS.md` (columns: build, archetype, the model,
  what a tap does, signature change, palette and type, port). Add a row; a new
  build must differ from the others in model, signature, palette and type.
- Type: one display face with character plus one clean text face, from Google
  Fonts (`display=swap`). Never default to Inter/Roboto/system for the display face.
- Colour: the model's theme background and the page background match where the
  stage meets the page, so the model sits in the page, not in a box. When a
  theme changes the background (evening), switch the page too: set a class on
  `<html>` in `render()` (e.g. `is-evening`) that swaps the CSS variables.
- Copy: plain words, short sentences, no hype. Write what the visitor gets and
  what it costs.

## Poster and fallback

- `assets/poster.webp` comes from `scripts/poster.mjs`: the default state.
  The starter ships a placeholder; replace it. For phones make a portrait one too
  and pass `poster: { portrait, landscape }` to `mountModel` (it picks by the
  stage's shape, like the camera). It shows at once, fades out when the 3D model's first
  frame is drawn, and stays when WebGL2 is missing (`?no3d` to test) or the
  graphics context is lost.
- Every choice the model offers must also exist as a normal control, so the
  fallback page can still book.

## Files

```
index.html  site.css  app.js  data.js  model.js
engine/ (never edit)  kit/ (yours)  assets/  BRIEF.md  cases.json  lab/ (not deployed)
```

Static. Serve with `scripts/serve.mjs` while building. To put it online, the
starter ships `server.mjs` (listens on `$PORT`, hides lab/, tests/ and notes) and
`.railwayignore` (keeps lab/ out of the upload). On Railway, one service per site:

```bash
railway add --service <site> --json
(cd <site> && railway up --project <id> --environment production --service <site> --detach)
railway domain --project <id> --environment production --service <site> --port 8080 --json
```

Wait for the deployment to reach SUCCESS, then run `shoot.mjs --url <live url>/
--sizes phone` against the live site before calling it done.
