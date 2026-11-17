#!/usr/bin/env node
// Prepare a kie.ai picture for the model or the page (ffmpeg).
//   node tex.mjs in.png out.jpg  [--size 1024]            texture: square, smaller, JPEG/WebP
//   node tex.mjs in.png out.webp --key white|black [--size 512] [--gain 3.2]
//        sprite/decal: flat white (dirt, spills) or black (steam, sparkle) becomes transparent
//   node tex.mjs in.png out.webp --width 1600              photo: resize keeping aspect
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const [inp, out, ...rest] = process.argv.slice(2);
const flag = (n, d) => { const i = rest.indexOf(n); return i > -1 ? rest[i + 1] : d; };
if (!inp || !out) { console.error("usage: tex.mjs in.png out.(jpg|webp|png) [--size 1024] [--width 1600] [--key white|black] [--gain 3.2]"); process.exit(1); }
const key = flag("--key"), size = flag("--size"), width = flag("--width"), gain = +flag("--gain", 3.2);
const f = [];
if (size) f.push(`scale=${size}:${size}:flags=lanczos`);
else if (width) f.push(`scale=${width}:-2:flags=lanczos`);
if (key) {
  const lum = "(0.299*r(X,Y)+0.587*g(X,Y)+0.114*b(X,Y))";
  const a = key === "white" ? `clip((247-${lum})*${gain},0,255)` : `clip((${lum}-8)*${gain},0,255)`;
  f.push(`format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${a}'`);
}
const args = ["-loglevel", "error", "-y", "-i", inp];
if (f.length) args.push("-vf", f.join(","));
if (out.endsWith(".webp")) args.push("-c:v", "libwebp", "-quality", "86", ...(key ? ["-pix_fmt", "yuva420p"] : []));
if (out.endsWith(".jpg") || out.endsWith(".jpeg")) args.push("-q:v", "3");
args.push("-frames:v", "1", out);
execFileSync("ffmpeg", args, { stdio: "inherit" });
console.log(out, Math.round(fs.statSync(out).size / 1024) + " KB");
