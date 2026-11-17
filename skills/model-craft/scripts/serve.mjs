#!/usr/bin/env node
/**
 * model-craft static server, for building and checking a site locally.
 *
 * A model-craft page cannot be verified from file://: ES modules and textures
 * are blocked there, so the page falls back to the poster and proves nothing.
 * Serve it.
 *
 *   node serve.mjs --root my-site --port 4550
 *   node serve.mjs --root my-site --port 4550 --lan   # real-phone test
 *
 * Binds to 127.0.0.1 by default, so nothing else on the network can read the
 * folder. --lan binds every interface for testing on a phone over Wi-Fi, and
 * makes everything under the root readable by anyone on that network while it
 * runs.
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };

const ROOT = path.resolve(arg("--root", "."));
const PORT = parseInt(arg("--port", "4500"), 10);
const LAN = argv.includes("--lan");
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";
// With the separator, a root of builds/acme can't also serve builds/acme-v2.
const BASE = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".jpeg": "image/jpeg", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4", ".webm": "video/webm",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

http.createServer((req, res) => {
  // A malformed escape (e.g. /%E0%A4%A) makes decodeURIComponent throw, which
  // would otherwise take the whole server down.
  let url;
  try { url = decodeURIComponent(req.url.split("?")[0]); }
  catch { res.writeHead(400).end("bad request"); return; }
  let file = path.join(ROOT, url === "/" ? "/index.html" : url);

  // Refuse to serve outside the root even if the path walks up.
  if (file !== ROOT && !file.startsWith(BASE)) { res.writeHead(403).end("forbidden"); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }

  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Content-Length": stat.size,
    // No caching: verification loops re-shoot the same URLs after edits, and a
    // cached clip or stylesheet makes you screenshot the previous build.
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => {
  console.log(`model-craft: ${ROOT}\n  http://localhost:${PORT}`);
  if (!LAN) return;
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) console.log(`  http://${a.address}:${PORT}  (LAN)`);
    }
  }
  console.log("  --lan: everything under the root is readable by anyone on this network until you stop the server.");
});
