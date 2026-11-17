#!/usr/bin/env node
/**
 * model-craft check: drives system Chrome (real GPU) over a model-craft page.
 *
 *   node shoot.mjs --url http://localhost:4550/ --out lab/shots [--cases cases.json]
 *                  [--sizes phone,desktop] [--matrix] [--frames add-room] [--only name]
 *
 * The page must expose the starter's hooks: window.__set(patch), window.__state,
 * window.__model (the mount facade). Elements with a data-check attribute
 * (price, summary) are compared across runs.
 *
 * cases.json: [{ "name": "party-6", "set": { "party": 6 }, "wait": 1600 }, ...]
 *   set     state patch passed to __set
 *   select  item id to select through the model (as a tap would)
 *   play    scene name to play; shot taken at "at" ms (default half way)
 *   click   CSS selector to click before the shot
 *   eval    JS run in the page (for states that depend on today's date)
 *
 * Writes <out>/<size>/<NN-name>.png (the stage) and full-page shots, a
 * contact sheet per size (needs ffmpeg), and <out>/report.json. Exit code 1
 * if any check failed. Every run: console errors, idle frames, draw calls,
 * tiny targets, label overlap, keyboard selection, context loss and recovery.
 * --matrix replays every case except scenes in {3D on, off} x {motion, reduced}
 * and compares data-check text. --only <case> shoots one case after replaying
 * the cases before it.
 * --frames <case> shoots that case at 0..1100 ms to see an animation.
 */
import fs from "node:fs";
import path from "node:path";
import { loadPlaywright, launch } from "./lib.mjs";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const URL0 = flag("--url");
if (!URL0) { console.error("usage: shoot.mjs --url http://localhost:PORT/ --out lab/shots [--cases cases.json] [--matrix]"); process.exit(1); }
const OUT = path.resolve(flag("--out", "lab/shots"));
const SIZES = flag("--sizes", "phone,small,desktop").split(","); // small = 360x640, where sheets crowd the model
const CASES = flag("--cases") ? JSON.parse(fs.readFileSync(flag("--cases"), "utf8")) : [];
const ONLY = flag("--only");
const FRAMES = flag("--frames");

const { chromium } = loadPlaywright();

const SIZE = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  small: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const report = { url: URL0, at: new Date().toISOString(), runs: [], failures: [] };
const fail = (where, msg) => { report.failures.push(`${where}: ${msg}`); console.log(`  FAIL ${where}: ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let warnedSelect = false;

const browser = await launch(chromium);

async function open(sizeName, { no3d = false, reduced = false } = {}) {
  const ctx = await browser.newContext({ ...SIZE[sizeName], reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  // Failed requests are reported with their URL (the browser's console line has none).
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("response", (r) => {
    if (r.status() < 400) return;
    const u = r.url();
    errors.push(`${r.status()} ${u}` + (/poster/.test(u) ? "  (no poster yet: run scripts/poster.mjs first)" : ""));
  });
  const u = new URL(URL0);
  if (no3d) u.searchParams.set("no3d", "");
  await page.goto(u.toString(), { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector(".mk-live, .mk-fallback"), null, { timeout: 20000 }).catch(() => {});
  await sleep(900);
  return { ctx, page, errors };
}
const checks = (page) => page.evaluate(() => [...document.querySelectorAll("[data-check]")].map((e) => `${e.dataset.check}=${e.textContent.trim().replace(/\s+/g, " ")}`));

async function applyCase(page, c) {
  if (c.set) await page.evaluate((p) => window.__set(p), c.set);
  if (c.select) { // like a tap on the model: there is nothing to tap when 3D is off
    const live = await page.evaluate((id) => { window.__model.select(id, { notify: true }); return window.__model.live; }, c.select);
    if (!live && !warnedSelect) { warnedSelect = true; console.log(`  note: case "${c.name}" uses select, which does nothing without 3D; use "set" for state the matrix compares`); }
  }
  if (c.eval) await page.evaluate(c.eval); // e.g. "__set({ time: firstOpenSlot() })" for date-dependent states
  if (c.click) await page.click(c.click);
  if (c.play) {
    const dur = await page.evaluate(([n, a]) => window.__model.play(n, a), [c.play, c.arg ?? null]);
    await sleep(c.at ?? dur / 2);
  } else await sleep(c.wait ?? 1500);
}

async function stageShot(page, file) {
  const stage = await page.$(".mk-stage");
  if (stage) await stage.screenshot({ path: file }).catch(() => page.screenshot({ path: file }));
  else await page.screenshot({ path: file });
}

for (const sizeName of SIZES) {
  const dir = path.join(OUT, sizeName);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n${sizeName}`);
  const { ctx, page, errors } = await open(sizeName);
  const run = { size: sizeName, cases: [], checks: {} };
  const live = await page.evaluate(() => Boolean(document.querySelector(".mk-live")));
  if (!live) fail(sizeName, "3D model did not go live (no .mk-live); WebGL or a script error");
  await page.screenshot({ path: path.join(dir, "00-page.png"), fullPage: false });
  // Nothing may scroll sideways (a nowrap chip row widening a grid column did, once).
  const wide = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth, stage: document.querySelector(".mk-stage")?.clientWidth || 0 }));
  if (wide.doc > wide.vw + 1) fail(sizeName, `page scrolls sideways: ${wide.doc}px wide in a ${wide.vw}px viewport`);
  if (wide.stage > wide.vw + 1) fail(sizeName, `the stage is wider (${wide.stage}px) than the viewport (${wide.vw}px)`);
  await stageShot(page, path.join(dir, "00-default.png"));
  run.checks.default = await checks(page);
  // Labels of tappable items that are hidden at rest (too small, or dropped for overlap). A warning, not a failure.
  run.hiddenLabels = await page.evaluate(() => [...document.querySelectorAll(".mk-label")].filter((b) => !b.disabled && !b.classList.contains("is-on")).map((b) => b.dataset.id));
  if (run.hiddenLabels.length) console.log(`  note: labels hidden at rest: ${run.hiddenLabels.join(", ")}`);

  // Idle: nothing should be drawing once the model has settled.
  await sleep(1800);
  const f0 = await page.evaluate(() => window.__model.stats().frames);
  await sleep(2200);
  const st = await page.evaluate(() => window.__model.stats());
  run.stats = st;
  if (live && st.frames !== f0) fail(sizeName, `still drawing when idle (${st.frames - f0} frames in 2.2s)`);
  if (st.calls > 350) fail(sizeName, `${st.calls} draw calls (keep under 350)`);
  if (st.small?.length && sizeName !== "desktop") fail(sizeName, `pickable items under 44px: ${st.small.join(", ")}`);

  let i = 1;
  for (const c of CASES) {
    // --only <name>: earlier cases still run (cases build on each other), unshot.
    if (ONLY && c.name !== ONLY) { if (CASES.indexOf(c) < CASES.findIndex((x) => x.name === ONLY) && !c.play) await applyCase(page, { ...c, wait: 300 }); i++; continue; }
    await applyCase(page, c);
    const n = String(i++).padStart(2, "0");
    await stageShot(page, path.join(dir, `${n}-${c.name}.png`));
    if (c.page) await page.screenshot({ path: path.join(dir, `${n}-${c.name}-page.png`) });
    const overlap = await page.evaluate(() => {
      const r = [...document.querySelectorAll(".mk-label.is-on")].map((e) => e.getBoundingClientRect());
      let n = 0;
      for (let a = 0; a < r.length; a++) for (let b = a + 1; b < r.length; b++) if (r[a].left < r[b].right && r[a].right > r[b].left && r[a].top < r[b].bottom && r[a].bottom > r[b].top) n++;
      return n;
    });
    if (overlap) fail(`${sizeName}/${c.name}`, `${overlap} overlapping label(s)`);
    const chk = await checks(page);
    run.cases.push({ name: c.name, checks: chk, overlap, selected: await page.evaluate(() => window.__model.selected) });
    console.log(`  ${n} ${c.name}  ${chk.join("  ")}`);
  }

  // Animation frames for one case.
  if (FRAMES) {
    const c = CASES.find((x) => x.name === FRAMES);
    if (c) for (const t of [0, 120, 260, 420, 640, 1100]) {
      await page.reload(); await page.waitForSelector(".mk-live", { timeout: 20000 }).catch(() => {}); await sleep(1500);
      if (c.set) page.evaluate((p) => window.__set(p), c.set);
      if (c.select) page.evaluate((id) => window.__model.select(id), c.select);
      await sleep(t);
      await stageShot(page, path.join(dir, `anim-${c.name}-${String(t).padStart(4, "0")}.png`));
    }
  }

  // Keyboard: the roving tab stop, arrows, Enter, Escape.
  if (live) {
    // Fresh page: the keyboard and context-loss checks start from the default state.
    await page.reload();
    await page.waitForSelector(".mk-live", { timeout: 20000 }).catch(() => {});
    await sleep(1500);
    let kb = "ok";
    const first = await page.$('.mk-label[tabindex="0"]');
    if (!first) kb = "no label is a tab stop";
    else {
      await first.focus();
      await page.keyboard.press("ArrowRight");
      const id = await page.evaluate(() => document.activeElement?.dataset?.id);
      await page.keyboard.press("Enter");
      await sleep(400);
      const sel = await page.evaluate(() => window.__model.selected);
      if (!id || sel !== id) kb = `Enter on a label did not select it (focused ${id}, selected ${sel})`;
      else {
        await page.keyboard.press("Escape");
        await sleep(400);
        if (await page.evaluate(() => window.__model.selected)) kb = "Escape did not deselect";
      }
    }
    run.keyboard = kb;
    if (kb !== "ok") fail(sizeName, "keyboard: " + kb);

    // Lost graphics context: the poster comes back, then the model recovers.
    const loss = await page.evaluate(async () => {
      const gl = window.__model.model.renderer.getContext();
      const ext = gl.getExtension("WEBGL_lose_context");
      if (!ext) return "no WEBGL_lose_context";
      const host = document.querySelector(".mk-stage");
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 400));
      const lostShown = host.classList.contains("mk-lost");
      ext.restoreContext();
      await new Promise((r) => setTimeout(r, 1500));
      return lostShown && !host.classList.contains("mk-lost") ? "ok" : `lost shown ${lostShown}, recovered ${!host.classList.contains("mk-lost")}`;
    });
    run.contextLoss = loss;
    if (loss !== "ok") fail(sizeName, "context loss: " + loss);
    await sleep(800);
    await stageShot(page, path.join(dir, "99-after-restore.png"));
  }
  for (const e of errors) fail(sizeName, e);
  run.errors = errors;
  report.runs.push(run);
  await ctx.close();

  // Contact sheet.
  try {
    const pngs = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.png$/.test(f) && !f.endsWith("-page.png") && f !== "00-page.png").sort();
    if (pngs.length) {
      // Tiles take the shots' own shape (read from the PNG header), so there are no white bands.
      const head = fs.readFileSync(path.join(dir, pngs[0]));
      const aspect = head.readUInt32BE(20) / head.readUInt32BE(16) || 1.2;
      const cols = sizeName === "desktop" ? 3 : 5, w = sizeName === "desktop" ? 560 : 300;
      const inputs = pngs.flatMap((f) => ["-i", path.join(dir, f)]);
      const n = pngs.length;
      const H = Math.round(w * aspect / 2) * 2;
      const sc = pngs.map((_, k) => `[${k}]scale=${w}:${H}:force_original_aspect_ratio=decrease,pad=${w}:${H}:(ow-iw)/2:(oh-ih)/2:white[s${k}]`).join(";");
      const lay = pngs.map((_, k) => `${(k % cols) * w}_${Math.floor(k / cols) * H}`).join("|");
      const filter = n === 1 ? `${sc};[s0]copy` : `${sc};${pngs.map((_, k) => `[s${k}]`).join("")}xstack=inputs=${n}:layout=${lay}:fill=white`;
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...inputs, "-filter_complex", filter, path.join(OUT, `sheet-${sizeName}.jpg`)]);
    }
  } catch (e) { console.log("  (contact sheet skipped: " + e.message.split("\n")[0] + ")"); }
}

// The matrix: same state, {3D on/off} x {motion/reduced}; data-check text must match.
if (has("--matrix")) {
  console.log("\nmatrix");
  // The whole walk-through replayed (set, select, eval, click; scenes skipped), then compared.
  for (const sizeName of [SIZES[0]]) {
    const results = {};
    for (const no3d of [false, true]) for (const reduced of [false, true]) {
      const tag = `${no3d ? "no3d" : "3d"}-${reduced ? "reduced" : "motion"}`;
      const { ctx, page, errors } = await open(sizeName, { no3d, reduced });
      for (const c of CASES) if (!c.play) await applyCase(page, { ...c, wait: 250 });
      await sleep(1200);
      results[tag] = (await checks(page)).join(" | ");
      fs.mkdirSync(path.join(OUT, "matrix"), { recursive: true });
      await page.screenshot({ path: path.join(OUT, "matrix", `${sizeName}-${tag}.png`) });
      for (const e of errors) fail(`matrix/${tag}`, e);
      if (no3d && !(await page.evaluate(() => Boolean(document.querySelector(".mk-fallback"))))) fail(`matrix/${tag}`, "no3d run did not fall back to the poster");
      await ctx.close();
    }
    const vals = new Set(Object.values(results));
    report.matrix = results;
    if (vals.size > 1) fail("matrix", "data-check text differs between runs: " + JSON.stringify(results));
    else console.log("  same in all four runs: " + [...vals][0]);
  }
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.failures.length ? report.failures.length + " FAILED" : "all checks passed"}  ->  ${path.join(OUT, "report.json")}`);
process.exit(report.failures.length ? 1 : 0);
