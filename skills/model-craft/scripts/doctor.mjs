#!/usr/bin/env node
// Check the tools model-craft needs. Exit 1 if a required one is missing.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadPlaywright, findChrome, SKILL_DIR } from "./lib.mjs";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let bad = 0;
const ok = (m) => console.log("  ok   " + m), no = (m, req = true) => { console.log((req ? "  FAIL " : "  warn ") + m); if (req) bad++; };
const major = +process.versions.node.split(".")[0];
major >= 20 ? ok(`node ${process.versions.node}`) : no(`node ${process.versions.node} (need 20+)`);
const chrome = findChrome();
chrome ? ok("Chrome " + chrome) : no("no Chrome found: Playwright's own Chromium will be used (npx playwright install chromium), or set MODELCRAFT_CHROME", false);
const pw = loadPlaywright({ exit: false });
pw ? ok("playwright-core") : no(`playwright-core not found: cd "${SKILL_DIR}" && npm install`);
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); ok("ffmpeg"); } catch { no("ffmpeg not found (optional: contact sheets and tex.mjs need it)", false); }
const v = path.join(HERE, "../engine/vendor/three-0.169.0.module.min.js");
fs.existsSync(v) ? ok("three r169 vendored") : no("engine/vendor/three-0.169.0.module.min.js missing");
try {
  const out = execFileSync(process.execPath, [path.join(HERE, "kie.mjs"), "probe"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  ok("kie.ai " + out);
} catch (e) { const why = String(e.stderr || e.message).split("\n").find((l) => l.startsWith("ERROR:")) || "no key"; no("kie.ai (optional) not set up: " + why.replace("ERROR: ", "") + ". The skill works without it; see references/kie.md", false); }
console.log(bad ? `\n${bad} required check(s) failed` : "\nready");
process.exit(bad ? 1 : 0);
