// model-craft fx: small helpers shared by the engine, kinds and scenes.
// Pure functions and canvas-drawn textures; this file ships no image assets.

import * as THREE from "./vendor/three-0.169.0.module.min.js";

// ------------------------------------------------------------- numbers --
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
export const easeIn = (k) => k * k * k;
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeBack = (k) => { const c = 1.5; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
export const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
// Exponential approach that is frame-rate independent: x += (goal - x) * approach(dt, rate).
export const approach = (dt, rate) => 1 - Math.exp(-dt * rate);
// A 0..1 window inside a 0..1 timeline: span(k, 0.2, 0.5) is 0 before 0.2, 1 after 0.5.
export const span = (k, a, b) => clamp01((k - a) / (b - a));

// Staggered drop-in for the parts of a new item: part i starts at delay + i*step
// and overshoots slightly (easeBack). t is ms since the item was born.
export function stagger(t, i, { delay = 160, step = 18, dur = 360 } = {}) {
  const k = clamp01((t - delay - i * step) / dur);
  return k <= 0 ? 0 : easeBack(k);
}

// Seeded random from a string, so the same item is always dressed the same way.
export function seeded(str) {
  let h = 2166136261;
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = (h >>> 0) || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)), ((s >>> 0) % 100000) / 100000);
}

export const reducedMotion = (() => {
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let v = Boolean(mq?.matches);
  mq?.addEventListener?.("change", (e) => { v = e.matches; });
  return () => v || globalThis.__mkReduce === true;
})();

// ------------------------------------------------------------ textures --
export function canvasTexture(canvas, { repeat = true, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}
function canvas(w, h = w) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

// Plank floor, drawn: used until a photo texture loads, or on its own.
export function plankCanvas({ base = "#C9A57A", line = "#A9845A", vary = 0.06, rows = 8 } = {}) {
  const c = canvas(512), g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const rh = 512 / rows, rnd = seeded("planks");
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 300;
    while (x < 512) {
      const len = 220 + rnd() * 200, k = (rnd() - 0.5) * vary * 2;
      g.fillStyle = k > 0 ? `rgba(255,255,255,${k})` : `rgba(0,0,0,${-k})`;
      g.fillRect(x, r * rh, len, rh);
      g.fillStyle = line; g.fillRect(x, r * rh, 2, rh);
      x += len;
    }
    g.fillStyle = line; g.fillRect(0, r * rh, 512, 2);
  }
  return c;
}
export function tileCanvas({ base = "#E9E7E2", line = "#CFCBC3", n = 4 } = {}) {
  const c = canvas(256), g = c.getContext("2d"), s = 256 / n;
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.fillStyle = line;
  for (let i = 0; i < 256; i += s) { g.fillRect(i, 0, 3, 256); g.fillRect(0, i, 256, 3); }
  return c;
}
export function checkerCanvas({ a = "#F2F0EB", b = "#1C1C1E", n = 4 } = {}) {
  const c = canvas(256), g = c.getContext("2d"), s = 256 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? b : a; g.fillRect(i * s, j * s, s, s); }
  return c;
}
// Soft round shadow / glow: white centre fading to clear. Tint with material colour.
export function radialCanvas({ size = 128, inner = 0, stops = [[0, 1], [1, 0]] } = {}) {
  const c = canvas(size), g = c.getContext("2d");
  const gr = g.createRadialGradient(size / 2, size / 2, inner, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}
// Four-point sparkle, white on clear.
export function sparkleCanvas(size = 64) {
  const c = canvas(size), g = c.getContext("2d"), m = size / 2;
  const gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = i % 2 ? m * 0.16 : m;
    g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
  }
  g.fill();
  return c;
}
// A generated picture on flat white (or black) becomes alpha: dirt, spills, steam.
// mode "white": darker = more opaque. mode "black": brighter = more opaque.
export function keyed(image, { mode = "white", gain = 3.2, floor = 0.97 } = {}) {
  const c = canvas(image.width, image.height), g = c.getContext("2d");
  g.drawImage(image, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const lum = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;
    p[i + 3] = 255 * clamp01(mode === "white" ? (floor - lum) * gain : (lum - (1 - floor)) * gain);
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ------------------------------------------------------------ geometry --
// Rounded box at an exact size (no non-uniform scaling, so corners stay round).
// Base at y = 0, centred in x and z. Normals are analytic, so it shades smoothly.
export function roundedBox(w, h, d, r = 0.02, seg = 3) {
  r = Math.max(0.0001, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const n = seg * 2 + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const remap = (u, H) => {
    const i = Math.round((u + 0.5) * n);
    if (i <= seg) return -H + r * (i / seg);
    if (i >= n - seg) return H - r * ((n - i) / seg);
    return 0;
  };
  const p = new THREE.Vector3(), inner = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.set(remap(pos.getX(i), half[0]), remap(pos.getY(i), half[1]), remap(pos.getZ(i), half[2]));
    inner.set(
      Math.max(-half[0] + r, Math.min(half[0] - r, p.x)),
      Math.max(-half[1] + r, Math.min(half[1] - r, p.y)),
      Math.max(-half[2] + r, Math.min(half[2] - r, p.z)),
    );
    const off = p.clone().sub(inner);
    const len = off.length() || 1;
    off.divideScalar(len);
    p.copy(inner).addScaledVector(off, r);
    pos.setXYZ(i, p.x, p.y + h / 2, p.z);
    nor.setXYZ(i, off.x, off.y, off.z);
  }
  pos.needsUpdate = nor.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// Smooth normals across faces that meet at less than `angle` degrees. Extruded
// shapes come out flat-shaded (every triangle its own normal), which bands
// under clearcoat; this is the biggest single quality lever on a car body.
export function smoothNormals(geo, angle = 40) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, n = pos.count;
  const cos = Math.cos((angle * Math.PI) / 180);
  const face = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    fn.subVectors(c, b).cross(a.clone().sub(b)); // area-weighted
    for (let k = 0; k < 3; k++) face.set([fn.x, fn.y, fn.z], (i + k) * 3);
  }
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const groups = new Map();
  for (let i = 0; i < n; i++) { const k = key(i); (groups.get(k) || groups.set(k, []).get(k)).push(i); }
  const out = new Float32Array(n * 3);
  const vi = new THREE.Vector3(), vj = new THREE.Vector3(), sum = new THREE.Vector3();
  for (const list of groups.values()) {
    for (const i of list) {
      vi.fromArray(face, i * 3).normalize();
      sum.set(0, 0, 0);
      for (const j of list) {
        vj.fromArray(face, j * 3);
        if (vj.clone().normalize().dot(vi) >= cos) sum.add(vj);
      }
      sum.normalize();
      out.set([sum.x, sum.y, sum.z], i * 3);
    }
  }
  g.setAttribute("normal", new THREE.BufferAttribute(out, 3));
  return g;
}

// Dense polyline through points with a fillet radius per corner:
// points = [[x, y, r?], ...] (closed). Used for car profiles and any soft outline.
export function fillet(points, { step = 0.1, segs = 8 } = {}) {
  const P = points.map(([x, y, r = 0]) => ({ x, y, r }));
  const out = [];
  const N = P.length;
  for (let i = 0; i < N; i++) {
    const p0 = P[(i - 1 + N) % N], p1 = P[i], p2 = P[(i + 1) % N];
    const v1x = p0.x - p1.x, v1y = p0.y - p1.y, v2x = p2.x - p1.x, v2y = p2.y - p1.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    const r = Math.min(p1.r, l1 * 0.45, l2 * 0.45);
    if (r <= 0) { out.push([p1.x, p1.y]); continue; }
    const ax = p1.x + (v1x / l1) * r, ay = p1.y + (v1y / l1) * r;
    const bx = p1.x + (v2x / l2) * r, by = p1.y + (v2y / l2) * r;
    for (let s = 0; s <= segs; s++) { // quadratic Bezier through the corner
      const t = s / segs, u = 1 - t;
      out.push([u * u * ax + 2 * u * t * p1.x + t * t * bx, u * u * ay + 2 * u * t * p1.y + t * t * by]);
    }
  }
  // Resample long straight runs so extrusion side caps triangulate evenly.
  const dense = [];
  for (let i = 0; i < out.length; i++) {
    const [x0, y0] = out[i], [x1, y1] = out[(i + 1) % out.length];
    const L = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.ceil(L / step));
    for (let s = 0; s < k; s++) dense.push([x0 + ((x1 - x0) * s) / k, y0 + ((y1 - y0) * s) / k]);
  }
  return dense;
}

// ------------------------------------------------------------- batching --
// Merge many small parts into ONE mesh per material (from The Linden build:
// eight furnished rooms went from ~400 draw calls to under 200). Use through
// ctx.batch() in a kind's make(); the merged parts cannot move independently.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function mergeGeometries(list) {
  const parts = list.map(([g, m]) => (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m));
  const withUV = parts.every((p) => p.attributes.uv);
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = withUV ? new Float32Array(n * 2) : null;
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    if (uv) uv.set(p.attributes.uv.array, o * 2);
    o += p.attributes.position.count;
    p.dispose();
  }
  for (const [g] of list) if (g.userData.temp) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
export function createBatch(unitBox, makeMesh) {
  const by = new Map(), stack = [new THREE.Matrix4()];
  const temp = (g) => { g.userData.temp = true; return g; };
  const push = (mat, geo, x = 0, y = 0, z = 0, r = [0, 0, 0], s = [1, 1, 1]) => {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(s[0], s[1], s[2]));
    const m = stack[stack.length - 1].clone().multiply(_m);
    if (!by.has(mat)) by.set(mat, []);
    by.get(mat).push([geo, m]);
  };
  const B = {
    box: (mat, x, z, w, d, y, h, ry = 0) => push(mat, unitBox, x, y, z, [0, ry, 0], [w, h, d]), // centre x/z, base y
    rbox: (mat, w, h, d, r, x, y, z, ry = 0) => push(mat, temp(roundedBox(w, h, d, r, 2)), x, y, z, [0, ry, 0]),
    cyl: (mat, rt, rb, h, x, y, z, seg = 20) => push(mat, temp(new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0)), x, y, z),
    ball: (mat, r, x, y, z, s = [1, 1, 1], detail = 1) => push(mat, temp(new THREE.IcosahedronGeometry(r, detail)), x, y, z, [0, 0, 0], s),
    geo: (mat, g, x, y, z, rot, s) => push(mat, temp(g), x, y, z, rot, s),
    // Parts added inside fn are placed relative to (x, y, z), turned by ry.
    at(x, y, z, ry, fn) {
      _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1));
      stack.push(stack[stack.length - 1].clone().multiply(_m));
      fn();
      stack.pop();
    },
    // One mesh per material. Returns { matName: mesh }.
    build({ parent, edges = [], noCast = [] } = {}) {
      const out = {};
      for (const [mat, list] of by) out[mat] = makeMesh(mergeGeometries(list), mat, { parent, edges: edges.includes(mat), cast: !noCast.includes(mat) });
      by.clear();
      return out;
    },
  };
  return B;
}
