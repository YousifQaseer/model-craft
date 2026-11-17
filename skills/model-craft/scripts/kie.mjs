#!/usr/bin/env node
/**
 * model-craft picture generator: kie.ai jobs API.
 *
 *   POST https://api.kie.ai/api/v1/jobs/createTask   { model, input }
 *   GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
 *   GET  https://api.kie.ai/api/v1/chat/credit
 *
 * kie.ai makes PICTURES for a model-craft build, never the 3D model itself:
 * concept phone screens, photoreal target renders of model screenshots,
 * seamless textures, dirt and effect sprites on flat white/black, page photos.
 *
 * COMMANDS
 *   probe
 *       Print the credit balance.
 *
 *   image "<prompt>" <out.png> [--model pro|seedream] [--ar 9:16] [--ref a.png ...]
 *                              [--budget N] [--quality high]
 *       pro      = nano-banana-pro, 2K. Concepts, renders of the model, textures.
 *                  Follows "keep this exact layout" edits best. 18 credits.
 *       seedream = seedream/5-pro. Sprites, decals, page photos. ~14 credits.
 *       --ref    = image-to-image; several allowed. Local files are uploaded.
 *       --budget = refuse to start if the balance is below N.
 *
 *   still ...   alias of: image ... --model seedream
 *
 *   --cap N     refuse if kie-ledger.jsonl in this folder plus this call would pass N
 *               (a per-site budget that other builds on the same key cannot eat).
 *
 * Every image writes <out>.kie.json beside the output: prompt, model, refs,
 * the task's true cost (kie.ai's creditsConsumed), the balance, seconds. A ledger line is appended to
 * kie-ledger.jsonl in the current folder. Prompts are never lost again.
 *
 * KEY: KIE_AI_API_KEY from the environment, else the first .env walking up
 * from the current folder THAT CONTAINS the key (a site .env without it is
 * skipped), else ~/.config/model-craft/.env, else ~/.kie.env.
 * The file used is printed to stderr; the key never is.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const API = "https://api.kie.ai";
const UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";

// --------------------------------------------------------------- key ----
function keyFrom(file) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*KIE_AI_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return null;
}
function loadKey() {
  if (process.env.KIE_AI_API_KEY) return { key: process.env.KIE_AI_API_KEY, from: "environment" };
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 10; i++) {
    const p = path.join(dir, ".env");
    const k = fs.existsSync(p) && keyFrom(p);
    if (k) return { key: k, from: p };
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  for (const p of [path.join(os.homedir(), ".config/model-craft/.env"), path.join(os.homedir(), ".kie.env")]) {
    const k = keyFrom(p);
    if (k) return { key: k, from: p };
  }
  throw new Error("KIE_AI_API_KEY not found: set it in the environment or in a .env (walking up from here), ~/.config/model-craft/.env or ~/.kie.env. Get a key at https://kie.ai");
}
let KEY, KEY_FROM;
try { ({ key: KEY, from: KEY_FROM } = loadKey()); } catch (err) { console.error("ERROR: " + err.message); process.exit(1); }
process.stderr.write(`  key: ${KEY_FROM}\n`);
const H = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };

// ----------------------------------------------------------- helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function credit() {
  const j = await (await fetch(`${API}/api/v1/chat/credit`, { headers: H })).json();
  return typeof j?.data === "number" ? j.data : Number(j?.data);
}

async function uploadLocal(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error("input not found: " + abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const dataUrl = `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`;
  const res = await fetch(UPLOAD, {
    method: "POST", headers: H,
    body: JSON.stringify({ base64Data: dataUrl, uploadPath: "model-craft", fileName: path.basename(abs) }),
  });
  const j = await res.json();
  const url = j?.data?.downloadUrl || j?.data?.fileUrl || j?.data?.url;
  if (!url) throw new Error("upload failed: " + JSON.stringify(j));
  return url;
}
const asUrl = (v) => (/^https?:\/\//i.test(v) ? Promise.resolve(v) : uploadLocal(v));

async function createTask(model, input) {
  const res = await fetch(`${API}/api/v1/jobs/createTask`, {
    method: "POST", headers: H, body: JSON.stringify({ model, input }),
  });
  const j = await res.json();
  if (j.code !== 200 || !j?.data?.taskId) throw new Error(`createTask ${model}: ${JSON.stringify(j)}`);
  return j.data.taskId;
}

async function waitTask(taskId, { label = "job", timeoutMs = 15 * 60 * 1000 } = {}) {
  const t0 = Date.now();
  let delay = 4000;
  for (;;) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`${label}: timed out`);
    const j = await (await fetch(`${API}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: H })).json();
    const d = j?.data || {};
    const state = d.state || d.status;
    if (state === "success") {
      let out = d.resultJson;
      if (typeof out === "string") { try { out = JSON.parse(out); } catch {} }
      const urls = out?.resultUrls || out?.result_urls || out?.urls || d.response?.resultUrls || [];
      if (!urls.length) throw new Error(`${label}: success with no result url`);
      urls.credits = typeof d.creditsConsumed === "number" ? d.creditsConsumed : null; // the task's true cost
      return urls;
    }
    if (state === "fail" || state === "failed") throw new Error(`${label} failed: ${d.failMsg || d.failCode || JSON.stringify(d)}`);
    process.stderr.write(`  ${label}: ${state || "queued"} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
    await sleep(delay);
    delay = Math.min(delay * 1.25, 15000);
  }
}

async function download(url, out) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  fs.writeFileSync(path.resolve(out), Buffer.from(await res.arrayBuffer()));
}

const flag = (a, n, d = null) => { const i = a.indexOf(n); return i > -1 && a[i + 1] ? a[i + 1] : d; };
const flags = (a, n) => a.flatMap((x, i) => (x === n && a[i + 1] ? [a[i + 1]] : []));

// -------------------------------------------------------------- main ----
let [cmd, ...rest] = process.argv.slice(2);
if (cmd === "still") { cmd = "image"; if (!rest.includes("--model")) rest.push("--model", "seedream"); }

try {
  if (cmd === "probe") {
    console.log("credit:", await credit());
  } else if (cmd === "image") {
    const [prompt, out] = rest;
    if (!prompt || !out || prompt.startsWith("--")) throw new Error('usage: kie.mjs image "<prompt>" <out.png> [--model pro|seedream] [--ar 9:16] [--ref a.png] [--budget N]');
    const which = flag(rest, "--model", "pro");
    const ar = flag(rest, "--ar", which === "pro" ? "1:1" : "16:9");
    const refs = flags(rest, "--ref");
    const budget = Number(flag(rest, "--budget", "0"));
    const cap = Number(flag(rest, "--cap", "0"));
    const before = await credit();
    if (budget && before < budget) throw new Error(`balance ${before} is below --budget ${budget}; not starting`);
    // --cap N: refuse if this folder's ledger plus this call's list price would pass N.
    const LIST = { pro: 18, seedream: 14 };
    if (cap) {
      let spent = 0;
      try { for (const l of fs.readFileSync(path.resolve("kie-ledger.jsonl"), "utf8").split("\n")) if (l.trim()) spent += JSON.parse(l).cost || 0; } catch {}
      if (spent + (LIST[which] || 18) > cap) throw new Error(`ledger here shows ${spent} credits spent; this call (~${LIST[which] || 18}) would pass --cap ${cap}; not starting`);
    }
    const urls = await Promise.all(refs.map(asUrl));
    let model, input;
    if (which === "pro") {
      // nano-banana-pro: image_input (not image_urls), aspect_ratio, resolution.
      model = "nano-banana-pro";
      input = { prompt, output_format: "png", aspect_ratio: ar, resolution: "2K" };
      if (urls.length) input.image_input = urls;
    } else if (which === "seedream") {
      // seedream needs aspect_ratio, quality and output_format explicitly; a
      // missing one returns "This field is required" without naming it.
      // 16:9, 9:16, 3:4 and 1:1 work; 4:5 is rejected.
      model = urls.length ? "seedream/5-pro-image-to-image" : "seedream/5-pro-text-to-image";
      input = { prompt, aspect_ratio: ar, quality: flag(rest, "--quality", "high"), output_format: "png", nsfw_checker: false };
      if (urls.length) input.image_urls = urls;
    } else throw new Error("--model must be pro or seedream");
    const t0 = Date.now();
    const id = await createTask(model, input);
    const res = await waitTask(id, { label: path.basename(out) });
    await download(res[0], out);
    const after = await credit();
    // cost is the task's own creditsConsumed from kie.ai: exact even when other
    // builds share the key. The balance difference is kept for reference only.
    const diff = Math.round((before - after) * 100) / 100;
    const rec = { at: new Date().toISOString(), out: path.resolve(out), model, prompt, refs, aspect_ratio: ar,
      credits_before: before, credits_after: after, cost: res.credits ?? diff, balance_diff: diff, shared: res.credits != null && diff > res.credits,
      seconds: Math.round((Date.now() - t0) / 1000), taskId: id };
    fs.writeFileSync(out + ".kie.json", JSON.stringify(rec, null, 2));
    fs.appendFileSync(path.resolve("kie-ledger.jsonl"), JSON.stringify(rec) + "\n");
    process.stderr.write(`  cost ${rec.cost} credits, balance ${after}\n`);
    console.log(out);
  } else {
    console.error(`model-craft picture generator
  node kie.mjs probe
  node kie.mjs image "<prompt>" <out.png> [--model pro|seedream] [--ar 9:16] [--ref ref.png ...] [--budget N]
  node kie.mjs still "<prompt>" <out.png> [--ar 16:9] [--ref ref.png]     (seedream)`);
    process.exit(1);
  }
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
}
