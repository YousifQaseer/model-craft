#!/usr/bin/env node
// Copy the starter, the engine and the kit into a new site folder.
//   node new-site.mjs <dir>        (refuses to overwrite an existing site)
//   node new-site.mjs <dir> --engine-only   (refresh engine/ and kit/ in an existing site)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [dir, mode] = process.argv.slice(2);
if (!dir) { console.error("usage: new-site.mjs <dir> [--engine-only]"); process.exit(1); }
const dest = path.resolve(dir);
// Never overwrites: files you already wrote in the site folder are kept (engine/ is refreshed with --engine-only).
const copy = (from, to, force = false) => fs.cpSync(path.join(SKILL, from), path.join(dest, to), { recursive: true, force, errorOnExist: false });
if (mode === "--engine-only") {
  copy("engine", "engine", true);
  console.log(`engine refreshed in ${dest} (kit/ left alone: it is yours to edit)`);
} else {
  if (fs.existsSync(path.join(dest, "index.html"))) { console.error(`${dest} already has an index.html; not overwriting`); process.exit(1); }
  fs.mkdirSync(dest, { recursive: true });
  copy("templates/starter", ".");
  copy("engine", "engine");
  copy("kit", "kit");
  fs.mkdirSync(path.join(dest, "assets"), { recursive: true });
  fs.mkdirSync(path.join(dest, "lab"), { recursive: true });
  // The registry of builds lives in the folder that holds your sites (created once).
  const reg = path.join(path.dirname(dest), "FINGERPRINTS.md");
  if (!fs.existsSync(reg)) fs.writeFileSync(reg, "# Builds\n\nEvery model-craft build gets a row. A new build must differ from the others in model, signature, palette and type.\n\n| Build | Archetype | The model | What a tap does | Signature change | Palette and type | Port |\n|---|---|---|---|---|---|---|\n");
  const S = path.join(SKILL, "scripts");
  console.log(`site created in ${dir}
next:
  node ${S}/serve.mjs --root ${dir} --port <a free port> &
  node ${S}/poster.mjs --url http://127.0.0.1:<port>/ --out ${dir}/assets/poster.webp   (replaces the starter's poster)
  node ${S}/shoot.mjs --url http://127.0.0.1:<port>/ --out ${dir}/lab/shots --cases ${dir}/cases.json --matrix
  add a row to ${reg}`);
}
