#!/usr/bin/env node
// Capture the poster: the model's default view, saved as the image that shows
// before Three.js loads and stays when WebGL is not available.
//   node poster.mjs --url http://127.0.0.1:4550/ --out assets/poster.webp [--width 900 --height 900] [--set '{"party":2}']
//                   [--view '{"az":0.8,"el":0.9}']   camera angle (concept variants without an image model)
// Make one per stage shape and pass both to mountModel({ poster: { portrait, landscape } }):
//   --width 900 --height 760 --out assets/poster.webp   and   --width 390 --height 460 --out assets/poster-portrait.webp
import fs from "node:fs";
import path from "node:path";
import { loadPlaywright, launch } from "./lib.mjs";
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : d; };
const pw = loadPlaywright();
const b = await launch(pw.chromium);
const W = +flag("--width", 900), H = +flag("--height", 900);
const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, reducedMotion: "reduce" });
await page.goto(flag("--url"));
await page.waitForSelector(".mk-live", { timeout: 30000 });
if (flag("--set")) await page.evaluate((p) => window.__set(p), JSON.parse(flag("--set")));
// Size the stage to the poster box, wait for textures, then snapshot the canvas.
const sel = flag("--stage", ".mk-stage");
await page.evaluate(([s, w, h]) => { const e = document.querySelector(s); Object.assign(e.style, { width: w + "px", height: h + "px", position: "fixed", top: "0", left: "0", zIndex: 99 }); }, [sel, W, H]);
if (flag("--view")) await page.evaluate((v) => window.__model.view(v), JSON.parse(flag("--view")));
await page.waitForTimeout(2500);
const out = path.resolve(flag("--out", "assets/poster.webp"));
const type = out.endsWith(".png") ? "image/png" : out.endsWith(".jpg") ? "image/jpeg" : "image/webp";
const url = await page.evaluate((t) => window.__model.snapshot(t, 0.86), type);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(url.split(",")[1], "base64"));
console.log(out, Math.round(fs.statSync(out).size / 1024) + " KB");
await b.close();
