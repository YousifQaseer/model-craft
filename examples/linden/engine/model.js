// model-craft engine: an interactive 3D model that mirrors what the visitor is
// choosing. Generalised from a cleaning company's "dollhouse" booking model (Three.js r169).
//
//   const model = createModel(host, { layout, kinds, materials, themes, ... });
//   model.update(state);          // re-run layout(state); items tween, rise, sink
//   model.select("t4");           // lift / focus an item (silent: the page already knows)
//
// The page owns ONE state object. layout(state, view) is pure and returns
// items; every item is drawn by a kind. Nothing here knows any business.
// See references/engine.md for the full contract.

export const VERSION = "1.2.0"; // see the skill's CHANGELOG.md

import * as THREE from "./vendor/three-0.169.0.module.min.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment-0.169.0.js";
import * as fx from "./fx.js";

export { THREE, fx };

const TONEMAP = { none: THREE.NoToneMapping, neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping };
const { clamp01, easeOut, easeBack, approach } = fx;
const reduce = fx.reducedMotion;
const now = () => performance.now();

// Unit geometry, base at y = 0, centred in x/z. Shared by every model; scale it with put().
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 32).translate(0, 0.5, 0),
  cone: new THREE.CylinderGeometry(0, 0.5, 1, 32).translate(0, 0.5, 0),
  sph: new THREE.SphereGeometry(0.5, 24, 16).translate(0, 0.5, 0),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), // lies flat, faces up
  disc: new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2),
};
const SHARED = new Set(Object.values(GEO));
const EDGES = new WeakMap();
function edgesOf(geo) {
  if (!EDGES.has(geo)) { const e = new THREE.EdgesGeometry(geo, 25); EDGES.set(geo, e); if (SHARED.has(geo)) SHARED.add(e); }
  return EDGES.get(geo);
}
const RBOX = new Map(); // cached rounded boxes by size
function rboxGeo(w, h, d, r, seg) {
  const k = [w, h, d, r, seg].map((v) => Math.round(v * 1000)).join(",");
  if (!RBOX.has(k)) { const g = fx.roundedBox(w, h, d, r, seg); RBOX.set(k, g); SHARED.add(g); }
  return RBOX.get(k);
}

const BOX_KEYS = ["x", "y", "z", "w", "h", "d"];
function boxOf(it) {
  const b = it.box || {};
  return { x: b.x || 0, y: b.y || 0, z: b.z || 0, w: b.w ?? 1, h: b.h ?? 1, d: b.d ?? 1 };
}

export function createModel(host, o = {}) {
  if (typeof o.layout !== "function") throw new Error("createModel: layout(state, view) is required");
  if (!o.kinds) throw new Error("createModel: kinds are required");
  const themeNames = Object.keys(o.themes || {});
  if (!themeNames.length) throw new Error("createModel: at least one theme is required");
  const opt = {
    accent: "#2F6FED", interactive: true, transparent: false, label: "the model", edges: true,
    tween: 460, labelMin: 36, shadows: true, dev: /[?&]dev\b/.test(location.search), ...o,
  };
  const camOpt = {
    landscape: { az: 0.55, el: 0.82 }, portrait: { az: 0.85, el: 0.92 },
    azRange: 1.1, elRange: [0.4, 1.35], orbit: true, pad: 1.05, frame: null, ...(o.camera || {}),
  };
  const ac = new AbortController();
  const on = (t, ev, fn, opts = {}) => t.addEventListener(ev, fn, { ...opts, signal: ac.signal });

  // ---------------------------------------------------------- renderer --
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: opt.transparent, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = opt.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement;
  canvas.className = "mk-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `3D model of ${opt.label}.${opt.interactive ? " Tap a part, or use the buttons on it, to see its options." : ""}`);
  host.classList.add("mk-stage");
  host.appendChild(canvas);
  const labelsEl = document.createElement("div");
  labelsEl.className = "mk-labels";
  labelsEl.setAttribute("role", "group");
  labelsEl.setAttribute("aria-label", opt.labelsLabel || `Parts of ${opt.label}`);
  host.appendChild(labelsEl);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 400);
  const root = new THREE.Group();
  scene.add(root);

  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight("#ffffff", 2);
  sun.castShadow = opt.shadows;
  const small = Math.min(screen.width, screen.height) < 700;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(hemi, sun, sun.target);
  const sunDir = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();

  // ------------------------------------------------------- materials --
  const owned = new Set(); // engine-owned things to dispose
  const own = (x) => { if (x) owned.add(x); return x; };
  const edgeMat = own(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.12, color: "#000000" }));
  const accentMat = own(new THREE.MeshBasicMaterial({ color: opt.accent, transparent: true, opacity: 0.2, depthWrite: false }));
  const ghostFill = own(new THREE.MeshBasicMaterial({ color: opt.accent, transparent: true, opacity: 0.12, depthWrite: false }));
  const ghostLine = own(new THREE.LineBasicMaterial({ color: opt.accent, transparent: true, opacity: 0.9 }));
  const shadowCatch = own(new THREE.ShadowMaterial({ opacity: 0.3 }));

  const textures = new Map(); // key -> { base, clones:Set }
  function texture(key, { repeat } = {}) {
    let e = textures.get(key);
    if (!e) {
      const def = typeof o.textures?.[key] === "string" ? { url: o.textures[key] } : o.textures?.[key];
      if (!def) throw new Error(`model-craft: unknown texture "${key}". Known: ${Object.keys(o.textures || {}).join(", ")}`);
      const base = def.canvas ? fx.canvasTexture(def.canvas()) : new THREE.Texture();
      base.wrapS = base.wrapT = THREE.RepeatWrapping;
      base.colorSpace = def.color === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      e = { base, clones: new Set([base]), def };
      textures.set(key, e);
      if (def.url) {
        new THREE.TextureLoader().load(def.url, (lt) => {
          for (const t of e.clones) { t.image = lt.image; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true; }
          lt.dispose?.();
          wake(300);
        }, undefined, () => console.warn(`model-craft: texture "${key}" failed to load: ${def.url}`));
      }
    }
    const t = e.base.clone();
    e.clones.add(t);
    const rep = repeat || e.def.repeat;
    if (rep) t.repeat.set(...rep);
    return t;
  }

  function makeMat(def = {}) {
    const { type = "std", map, color, emissive, ...p } = def;
    const C = { std: THREE.MeshStandardMaterial, physical: THREE.MeshPhysicalMaterial, basic: THREE.MeshBasicMaterial, lambert: THREE.MeshLambertMaterial }[type];
    if (!C) throw new Error(`model-craft: material type "${type}" (use std, physical, basic, lambert)`);
    const m = new C(type === "basic" || type === "lambert" ? p : { roughness: 0.8, metalness: 0, ...p });
    if (color) m.color.set(color);
    if (emissive && m.emissive) m.emissive.set(emissive);
    if (map) m.map = typeof map === "string" ? texture(map) : map;
    return m;
  }
  const mats = {};
  for (const [name, def] of Object.entries(o.materials || {})) mats[name] = own(makeMat(def));
  function mat(name) {
    if (name && typeof name === "object") return name;
    const m = mats[name];
    if (!m) throw new Error(`model-craft: unknown material "${name}". Known: ${Object.keys(mats).join(", ")}`);
    return m;
  }

  // Dim copies of materials for items with tone "dim" (refreshed every frame, so
  // theme changes and live recolours carry through).
  const dims = new Map();
  function dimOf(base) {
    if (!base || base.isLineBasicMaterial || base.isShadowMaterial || base.userData.noDim) return base;
    let d = dims.get(base);
    if (!d) { d = base.clone(); d.userData.dimOf = base; dims.set(base, d); }
    return d;
  }
  const dimTarget = new THREE.Color();
  function refreshDims() {
    const amt = theme.cur.dimAmount;
    dimTarget.copy(theme.cur.dim);
    for (const [base, d] of dims) {
      if (d.color && base.color) d.color.copy(base.color).lerp(dimTarget, amt);
      if (d.emissive && base.emissive) { d.emissive.copy(base.emissive); d.emissiveIntensity = base.emissiveIntensity * 0.2; }
      if (base.map !== d.map) d.map = base.map;
      d.opacity = base.opacity;
    }
  }

  // ---------------------------------------------------------- themes --
  // A theme: { label, bg, tone, exposure, env, hemi:[i, sky, ground], sun:{i, color, dir:[x,y,z]},
  //   shadow, edge:[hex, opacity], veil:[hex, opacity], dim:[hex, amount], glow, night, colors:{mat: hex|{...}} }
  const theme = { name: null, t0: 0, ms: 0, from: null, to: null, cur: null };
  function readTheme(name) {
    const t = o.themes[name];
    if (!t) throw new Error(`model-craft: unknown theme "${name}"`);
    const C = (v, d) => new THREE.Color(v ?? d);
    const colors = {};
    for (const [k, v] of Object.entries(t.colors || {})) {
      const s = typeof v === "string" ? { color: v } : v;
      colors[k] = { color: s.color != null ? C(s.color) : null, emissive: s.emissive != null ? C(s.emissive) : null, ei: s.emissiveIntensity ?? null, opacity: s.opacity ?? null };
    }
    return {
      bg: t.bg != null ? C(t.bg) : null, tone: t.tone || "neutral", exposure: t.exposure ?? 1, env: t.env ?? 0.3,
      hemiI: t.hemi?.[0] ?? 0.6, hemiSky: C(t.hemi?.[1], "#ffffff"), hemiGround: C(t.hemi?.[2], "#5a5148"),
      sunI: t.sun?.i ?? 2, sunColor: C(t.sun?.color, "#ffffff"), sunDir: new THREE.Vector3(...(t.sun?.dir || [-0.45, 0.8, 0.4])).normalize(),
      shadow: t.shadow ?? 0.3, edge: C(t.edge?.[0], "#1A1E22"), edgeOpacity: t.edge?.[1] ?? 0.12,
      veil: C(t.veil?.[0], "#0D0F12"), veilOpacity: t.veil?.[1] ?? 0.45,
      dim: C(t.dim?.[0], t.bg ?? "#d9d6d0"), dimAmount: t.dim?.[1] ?? 0.55, glow: t.glow ?? 1, night: t.night ?? 0, colors,
    };
  }
  function cloneTheme(t) {
    const c = { ...t };
    for (const k of ["bg", "hemiSky", "hemiGround", "sunColor", "edge", "veil", "dim"]) c[k] = t[k]?.clone() ?? null;
    c.sunDir = t.sunDir.clone();
    c.colors = {};
    for (const [k, v] of Object.entries(t.colors)) c.colors[k] = { color: v.color?.clone() ?? null, emissive: v.emissive?.clone() ?? null, ei: v.ei, opacity: v.opacity };
    return c;
  }
  function blendTheme(k) {
    const a = theme.from, b = theme.to, c = theme.cur;
    const L = (x, y) => x + (y - x) * k;
    for (const key of ["exposure", "env", "hemiI", "sunI", "shadow", "edgeOpacity", "veilOpacity", "dimAmount", "glow", "night"]) c[key] = L(a[key], b[key]);
    for (const key of ["hemiSky", "hemiGround", "sunColor", "edge", "veil", "dim"]) c[key].copy(a[key]).lerp(b[key], k);
    if (b.bg) { c.bg = c.bg || b.bg.clone(); c.bg.copy(a.bg || b.bg).lerp(b.bg, k); }
    c.sunDir.copy(a.sunDir).lerp(b.sunDir, k).normalize();
    c.tone = k < 0.5 ? a.tone : b.tone;
    for (const [name, tv] of Object.entries(b.colors)) {
      const m = mats[name];
      if (!m) continue;
      const fv = a.colors[name] || tv;
      if (tv.color && m.color) m.color.copy(fv.color || tv.color).lerp(tv.color, k);
      if (tv.emissive && m.emissive) m.emissive.copy(fv.emissive || tv.emissive).lerp(tv.emissive, k);
      if (tv.ei != null && "emissiveIntensity" in m) m.emissiveIntensity = L(fv.ei ?? tv.ei, tv.ei);
      if (tv.opacity != null) m.opacity = L(fv.opacity ?? tv.opacity, tv.opacity);
    }
    applyLights();
  }
  function applyLights() {
    const c = theme.cur;
    renderer.toneMapping = TONEMAP[c.tone] ?? THREE.NeutralToneMapping;
    renderer.toneMappingExposure = c.exposure;
    scene.environmentIntensity = c.env;
    hemi.intensity = c.hemiI; hemi.color.copy(c.hemiSky); hemi.groundColor.copy(c.hemiGround);
    sun.intensity = c.sunI; sun.color.copy(c.sunColor); sunDir.copy(c.sunDir);
    shadowCatch.opacity = c.shadow;
    edgeMat.color.copy(c.edge); edgeMat.opacity = c.edgeOpacity; edgeMat.visible = c.edgeOpacity > 0.005;
    veilMat.color.copy(c.veil);
    if (!opt.transparent) scene.background = c.bg;
  }
  function setTheme(name, { ms = 650 } = {}) {
    const to = readTheme(name);
    theme.from = theme.cur ? cloneTheme(theme.cur) : cloneTheme(to);
    // Materials start from their current colour, so a change mid-blend never jumps.
    for (const [k, v] of Object.entries(to.colors)) if (mats[k]) {
      theme.from.colors[k] = { color: mats[k].color?.clone() ?? v.color, emissive: mats[k].emissive?.clone() ?? v.emissive, ei: mats[k].emissiveIntensity ?? v.ei, opacity: mats[k].opacity };
    }
    theme.to = to;
    theme.cur = theme.cur || cloneTheme(to);
    theme.name = name;
    theme.t0 = now();
    theme.ms = reduce() || !theme.started ? 0 : ms;
    theme.started = true;
    blendTheme(theme.ms ? 0 : 1);
    wake(theme.ms + 200);
  }

  // ------------------------------------------- veil, ghost, ground --
  const veilMat = own(new THREE.MeshBasicMaterial({ color: "#0D0F12", transparent: true, opacity: 0, depthWrite: false }));
  const veil = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), veilMat);
  veil.renderOrder = 5;
  veil.scale.set(400, 400, 1);
  veil.visible = false;
  veil.userData.helper = true;
  scene.add(veil);

  const catcher = new THREE.Mesh(GEO.plane, shadowCatch);
  catcher.scale.set(200, 1, 200);
  catcher.position.y = o.groundY ?? -0.002;
  catcher.receiveShadow = true;
  catcher.userData.helper = true;
  if (o.ground !== false) scene.add(catcher);

  // Ghost: where the lifted item came from, with four guide posts to it.
  const ghost = new THREE.Group();
  ghost.userData.helper = true;
  const ghostBox = new THREE.Mesh(GEO.box, ghostFill);
  const ghostEdges = new THREE.LineSegments(edgesOf(GEO.box), ghostLine);
  ghostBox.add(ghostEdges);
  ghostBox.userData.helper = ghostEdges.userData.helper = true;
  const postGeo = own(new THREE.BufferGeometry());
  postGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(24), 3));
  const posts = new THREE.LineSegments(postGeo, ghostLine);
  posts.frustumCulled = false;
  posts.userData.helper = true;
  ghost.add(ghostBox, posts);
  ghost.visible = false;

  // -------------------------------------------------------- the items --
  const inst = new Map(); // id -> live instance
  const dying = new Set();
  let order = []; // layout order of ids
  let state = {};
  let selected = null, hovered = null, focusId = null;
  let tweenT0 = 0;

  function kindOf(it) {
    const k = opt.kinds[it.kind];
    if (!k) throw new Error(`model-craft: unknown kind "${it.kind}" (item "${it.id}"). Known: ${Object.keys(opt.kinds).join(", ")}`);
    return k;
  }

  function makeCtx(I) {
    const add = (m, parent) => { (parent || I.group).add(m); return m; };
    const ctx = {
      THREE, fx, GEO, item: I,
      get state() { return state; },
      get night() { return theme.cur?.night ?? 0; },
      mat, texture,
      newMat(def) { const m = makeMat(def); I.own.push(m); return m; },
      own(x) { I.own.push(x); return x; },
      group(parent) { return add(new THREE.Group(), parent); },
      mesh(geo, m, { parent, edges, cast = true, receive = true, name } = {}) {
        const base = mat(m);
        const mesh = new THREE.Mesh(geo, base);
        mesh.castShadow = cast && opt.shadows;
        mesh.receiveShadow = receive;
        mesh.userData.base = base;
        if (name) mesh.name = name;
        const wantEdges = edges ?? (opt.edges && (geo === GEO.box || geo === GEO.cyl));
        if (wantEdges) { const e = new THREE.LineSegments(edgesOf(geo), edgeMat); e.userData.edge = true; mesh.add(e); }
        if (!SHARED.has(geo)) I.own.push(geo);
        I.meshes.push(mesh);
        I.toneDirty = true;
        return add(mesh, parent);
      },
      box(m, opts) { return ctx.mesh(GEO.box, m, opts); },
      cyl(m, opts) { return ctx.mesh(GEO.cyl, m, opts); },
      cone(m, opts) { return ctx.mesh(GEO.cone, m, opts); },
      sph(m, opts) { return ctx.mesh(GEO.sph, m, opts); },
      plane(m, opts) { return ctx.mesh(GEO.plane, m, { cast: false, edges: false, ...opts }); },
      disc(m, opts) { return ctx.mesh(GEO.disc, m, { cast: false, edges: false, ...opts }); },
      // Rounded box at an exact size in metres. Do not scale it non-uniformly.
      rbox(w, h, d, r, m, opts = {}) {
        const geo = rboxGeo(w, h, d, r ?? Math.min(w, h, d) * 0.12, opts.seg ?? 3);
        return ctx.mesh(geo, m, { edges: false, ...opts });
      },
      // Unit geometry: centre (x, z), base y, size w x h x d. Hidden when too small.
      put(m, x, z, w, d, y = 0, h = 1) {
        const ok = w > 0.0005 && d > 0.0005 && h > 0.0005;
        m.visible = ok;
        if (!ok) return m;
        m.position.set(x, y, z);
        m.scale.set(w, h, d);
        return m;
      },
      // Many small parts, one mesh per material: const B = ctx.batch(); B.box(...); B.build();
      batch() { return fx.createBatch(GEO.box, (g, m, o) => ctx.mesh(g, m, o)); },
      at(m, x, y, z, ry) { m.position.set(x, y, z); if (ry != null) m.rotation.y = ry; return m; },
      // Change a mesh's material; keeps tone (dim) working. Never assign mesh.material directly.
      setMat(m, mm) { const b = mat(mm); if (m.userData.base !== b) { m.userData.base = b; I.toneDirty = true; } },
      wake,
    };
    return ctx;
  }

  function build(it) {
    const kind = kindOf(it);
    const group = new THREE.Group();
    group.userData.itemId = it.id;
    const b = boxOf(it);
    const I = {
      id: it.id, key: it.key ?? "", item: it, kind, group, meshes: [], own: [], parts: null,
      from: { ...b }, to: { ...b }, cur: { ...b }, rotFrom: it.rot || 0, rotTo: it.rot || 0, rot: it.rot || 0,
      born: now(), dying: 0, liftK: 0, glowK: 0, tone: "", toneDirty: true, label: null,
    };
    I.ctx = makeCtx(I);
    I.parts = kind.make?.(I.ctx, it, state) || {};
    // The glow exists for every item that may ever be "on", picked or hovered;
    // invisible (no draw call) until its opacity rises. glowShape "round" and
    // glowSize [w, d] let it sit under one chair instead of filling the box.
    if (kind.glow !== false && it.glow !== false) {
      I.glow = new THREE.Mesh(it.glowShape === "round" ? GEO.disc : GEO.plane, accentMat.clone());
      I.glow.userData.helper = true;
      I.glow.material.opacity = 0;
      I.glow.renderOrder = 2;
      I.glow.visible = false;
      I.own.push(I.glow.material);
      group.add(I.glow);
    }
    makeLabel(I);
    return I;
  }
  function makeLabel(I) {
    const it = I.item;
    if (I.label || !it.label || it.pickable === false || !opt.interactive) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mk-label" + (it.labelClass ? " " + it.labelClass : "");
    btn.tabIndex = -1;
    btn.dataset.id = it.id;
    btn.innerHTML = "<b></b><span></span>";
    labelsEl.appendChild(btn);
    I.label = btn;
  }

  function retire(I) {
    if (I.dying) return;
    I.dying = now();
    inst.delete(I.id);
    dying.add(I);
    I.label?.remove();
    I.label = null;
  }
  function destroy(I) {
    I.group.parent?.remove(I.group);
    I.kind.dispose?.(I.parts, I.ctx);
    for (const x of I.own) { x.dispose?.(); const d = dims.get(x); if (d) { d.dispose(); dims.delete(x); } }
    dying.delete(I);
  }

  let view = { portrait: false, w: 1, h: 1 };
  let lastSig = "";
  function update(next = state) {
    state = next;
    const items = opt.layout(state, view) || [];
    // Same layout as last time: nothing to tween (keeps render() cheap to call).
    const sig = JSON.stringify(items);
    if (sig === lastSig && inst.size) return;
    lastSig = sig;
    const t = now();
    const seen = new Set();
    order = [];
    for (const it of items) {
      if (!it || !it.id) throw new Error("model-craft: every item needs an id");
      if (seen.has(it.id)) throw new Error(`model-craft: duplicate item id "${it.id}"`);
      seen.add(it.id);
      order.push(it.id);
      let I = inst.get(it.id);
      if (I && I.key !== (it.key ?? "")) { retire(I); I = null; }
      if (!I) { I = build(it); inst.set(it.id, I); }
      else {
        const b = boxOf(it);
        I.from = { ...I.cur }; I.to = b; I.rotFrom = I.rot; I.rotTo = it.rot || 0;
        if (I.label && (I.item.label !== it.label || I.item.sub !== it.sub)) I.labelText = null;
        I.item = it;
        makeLabel(I);
      }
    }
    for (const I of [...inst.values()]) if (!seen.has(I.id)) retire(I);
    for (const it of items) {
      const I = inst.get(it.id);
      const P = it.parent ? inst.get(it.parent) : null;
      if (it.parent && !P) throw new Error(`model-craft: item "${it.id}" has unknown parent "${it.parent}"`);
      const pg = P ? P.group : root;
      if (I.group.parent !== pg) pg.add(I.group);
    }
    tweenT0 = t;
    // The page owns state: a deselect caused by a layout change is silent, so it
    // can never overwrite a choice the page is in the middle of making.
    if (selected && (!inst.has(selected) || !selectable(inst.get(selected)))) select(null, { silent: true });
    wake(1500);
  }

  function effTone(I) {
    let t = I.item.tone || "", p = I.item.parent ? inst.get(I.item.parent) : null;
    while (!t && p) { t = p.item.tone || ""; p = p.item.parent ? inst.get(p.item.parent) : null; }
    return t;
  }
  // "dim" = unavailable (faded and not pickable). "faded" = not chosen (faded, still pickable).
  const selectable = (I) => I && !I.dying && I.item.pickable !== false && effTone(I) !== "dim";
  function applyTone(I, tone) {
    for (const m of I.meshes) {
      const b = m.userData.base;
      m.material = tone === "dim" || tone === "faded" ? dimOf(b) : b;
    }
    I.tone = tone;
    I.toneDirty = false;
  }

  function liftVec(I) {
    const L = I.item.lift;
    if (!L || L === "custom" || typeof L !== "object") return null;
    const b = I.to, axis = L.axis || "y", dir = L.dir ?? 1;
    const dist = L.dist ?? (axis === "y" ? Math.max(1.0, b.h * 1.5 + 0.5) : (axis === "x" ? b.w : b.d) * 1.15 + 0.3);
    return new THREE.Vector3(axis === "x" ? dist * dir : 0, axis === "y" ? dist : 0, axis === "z" ? dist * dir : 0);
  }

  // ------------------------------------------------------------ camera --
  const cam = { az: 0, el: 0.8, baseAz: 0, inset: { top: 0, right: 0, bottom: 0, left: 0 }, f: null, target: new THREE.Vector3(), goal: null, home: null };
  // Phones count as portrait even when the stage is square-ish (358 x 354).
  const isPortrait = () => host.clientWidth < 600 || host.clientHeight > host.clientWidth * 1.05;
  function resetView() {
    const v = isPortrait() ? camOpt.portrait : camOpt.landscape;
    cam.baseAz = v.az; cam.az = v.az; cam.el = v.el; cam.goal = null;
  }
  const corner = new THREE.Vector3();
  const tmpBox = new THREE.Box3();
  // World-space corners of an item's box (current, including lift).
  function eachCorner(I, fn, pad = 0) {
    const b = I.cur, m = I.group.matrixWorld;
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
      corner.set(sx * (b.w / 2 + pad), sy * (b.h + pad) - (sy ? 0 : pad), sz * (b.d / 2 + pad)).applyMatrix4(m);
      fn(corner);
    }
  }
  function frameItems() {
    if (camOpt.frame) return camOpt.frame.map((id) => inst.get(id)).filter(Boolean);
    return [...inst.values()].filter((I) => !I.item.parent && I.item.frame !== false);
  }
  let camFocus = null; // Box3 in world space, or null
  function goalBounds() {
    tmpBox.makeEmpty();
    if (camFocus) return tmpBox.copy(camFocus);
    const F = focusId ? inst.get(focusId) : null;
    if (F) { eachCorner(F, (c) => tmpBox.expandByPoint(c), F.item.focusPad ?? 0.35); return tmpBox; }
    for (const I of frameItems()) eachCorner(I, (c) => tmpBox.expandByPoint(c));
    const S = selected && inst.get(selected);
    if (S) eachCorner(S, (c) => tmpBox.expandByPoint(c));
    if (tmpBox.isEmpty()) tmpBox.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
    return tmpBox;
  }
  const bcorners = Array.from({ length: 8 }, () => new THREE.Vector3());
  function fitCamera(dt) {
    const W = host.clientWidth, Hh = host.clientHeight;
    if (!W || !Hh) return false;
    const box = goalBounds();
    box.getCenter(cam.target);
    const dir = new THREE.Vector3(Math.cos(cam.el) * Math.sin(cam.az), Math.sin(cam.el), Math.cos(cam.el) * Math.cos(cam.az));
    const size = box.getSize(corner).length();
    camera.position.copy(cam.target).addScaledVector(dir, Math.max(30, size * 2));
    camera.near = 0.1; camera.far = Math.max(400, size * 6);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();
    let i = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) bcorners[i++].set(x, y, z);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of bcorners) {
      corner.copy(c).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
    }
    const { top, right, bottom, left } = cam.inset;
    const availH = Math.max(0.25, (Hh - top - bottom) / Hh), availW = Math.max(0.25, (W - left - right) / W);
    const aspect = W / Hh;
    const halfH = Math.max((maxY - minY) / 2 / availH, (maxX - minX) / 2 / (aspect * availW)) * camOpt.pad;
    const halfW = halfH * aspect;
    const cx = (minX + maxX) / 2 + ((right - left) / W) * halfW;
    const cy = (minY + maxY) / 2 - ((bottom - top) / Hh) * halfH;
    const goal = { l: cx - halfW, r: cx + halfW, t: cy + halfH, b: cy - halfH };
    if (!cam.f || reduce()) cam.f = { ...goal };
    const k = approach(dt, scn ? 3.6 : cam.goal ? 6 : 9);
    for (const key of ["l", "r", "t", "b"]) cam.f[key] += (goal[key] - cam.f[key]) * k;
    Object.assign(camera, { left: cam.f.l, right: cam.f.r, top: cam.f.t, bottom: cam.f.b });
    camera.updateProjectionMatrix();
    // Shadows follow the framed model, so any size of model gets crisp shadows.
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(1, sphere.radius * 1.15);
    sun.target.position.copy(sphere.center);
    sun.position.copy(sphere.center).addScaledVector(sunDir, r * 3);
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.1, far: r * 6 });
    sun.shadow.camera.updateProjectionMatrix();
    return Math.abs(goal.t - cam.f.t) + Math.abs(goal.l - cam.f.l) + Math.abs(goal.r - cam.f.r) + Math.abs(goal.b - cam.f.b) > 0.002 * halfH;
  }

  // -------------------------------------------------------------- loop --
  let awakeUntil = 0, running = false, rafId = 0, last = now(), onScreen = true, frames = 0, lost = false, disposed = false, firstFrame = true;
  const io = "IntersectionObserver" in window ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) wake(); }, { rootMargin: "160px" }) : null;
  io?.observe(host);
  function wake(ms = 900) {
    if (disposed || lost) return;
    awakeUntil = Math.max(awakeUntil, now() + ms);
    if (!running) { running = true; last = now(); rafId = requestAnimationFrame(frame); }
  }
  // The observer can lag a fast scroll; check the box itself before going to sleep.
  function inView() { const b = host.getBoundingClientRect(); return b.bottom > -160 && b.top < innerHeight + 160 && b.width > 0; }

  const liftOff = new THREE.Vector3();
  function stepItem(I, t, k, dt) {
    const it = I.item;
    for (const key of BOX_KEYS) I.cur[key] = I.from[key] + (I.to[key] - I.from[key]) * k;
    let dr = I.rotTo - I.rotFrom; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    I.rot = I.rotFrom + dr * k;
    const lifting = selected === I.id && !I.dying && (!scn || scn.keepLift);
    const goal = lifting && it.lift ? 1 : 0;
    I.liftK += (goal - I.liftK) * (reduce() ? 1 : approach(dt, 9));
    if (Math.abs(goal - I.liftK) < 0.001) I.liftK = goal;
    let busy = I.liftK !== goal;
    const lv = liftVec(I);
    liftOff.set(0, 0, 0);
    if (lv) liftOff.copy(lv).multiplyScalar(fx.easeInOut(I.liftK));
    const g = I.group;
    g.position.set(I.cur.x + liftOff.x, I.cur.y + liftOff.y, I.cur.z + liftOff.z);
    g.rotation.y = I.rot;
    // Enter and exit.
    const style = it.enter ?? I.kind.enter ?? "pop";
    const age = reduce() ? 1e9 : t - I.born;
    let s = 1, sy = 1, dy = 0;
    if (style === "rise") sy = easeOut(clamp01(age / 420));
    else if (style === "pop") s = age >= 380 ? 1 : 0.35 + 0.65 * easeBack(clamp01(age / 380));
    else if (style === "drop") { const e = clamp01(age / 420); dy = (1 - easeBack(e)) * 0.6; s = e > 0 ? 1 : 0.001; }
    if (I.dying) {
      const d = reduce() ? 1 : clamp01((t - I.dying) / 300);
      if (style === "rise") { sy *= 1 - easeOut(d); dy -= 0.3 * d; } else s *= 1 - easeOut(d);
      if (d >= 1) { destroy(I); return false; }
      busy = true;
    }
    g.scale.set(Math.max(0.001, s), Math.max(0.001, s * sy), Math.max(0.001, s));
    g.position.y += dy;
    if (age < 1400) busy = true;
    // Tone and glow.
    const tone = effTone(I);
    if (tone !== I.tone || I.toneDirty) applyTone(I, tone);
    if (I.glow) {
      const gl = theme.cur.glow;
      const target = (selected === I.id ? 0.3 : tone === "on" ? 0.2 : hovered === I.id ? 0.12 : focusedLabel === I.id ? 0.16 : 0) * gl;
      I.glowK += (target - I.glowK) * (reduce() ? 1 : approach(dt, 10));
      if (Math.abs(target - I.glowK) < 0.002) I.glowK = target; else busy = true;
      I.glow.material.opacity = I.glowK;
      I.glow.visible = I.glowK > 0.004;
      I.glow.position.y = (it.glowY ?? 0.012) / Math.max(0.001, s * sy);
      const gs = it.glowSize || [I.cur.w + 0.06, I.cur.d + 0.06];
      I.glow.scale.set(gs[0], 1, gs[1]);
    }
    // The kind draws its parts.
    if (I.kind.draw) {
      const L = I.L || (I.L = {});
      Object.assign(L, I.cur);
      L.rot = I.rot; L.t = age; L.lift = I.liftK; L.sel = selected === I.id; L.hover = hovered === I.id;
      L.tone = tone; L.night = theme.cur.night; L.now = t; L.dt = dt; L.dying = I.dying ? clamp01((t - I.dying) / 300) : 0;
      L.k = (i, o2) => (reduce() ? 1 : fx.stagger(age, i, o2));
      if (I.kind.draw(I.parts, L, it, state, I.ctx) === true) busy = true;
    }
    return busy;
  }

  function placeGhost() {
    const S = selected && inst.get(selected);
    const lv = S && liftVec(S);
    if (!S || !lv || S.liftK < 0.01 || scn) { ghost.visible = false; veil.visible = false; return; }
    const pg = S.group.parent;
    if (ghost.parent !== pg) pg.add(ghost);
    ghost.visible = true;
    const b = S.cur;
    ghostBox.position.set(b.x, b.y, b.z);
    ghostBox.rotation.y = S.rot;
    ghostBox.scale.set(b.w, Math.max(0.01, b.h), b.d);
    ghostFill.opacity = 0.12 * S.liftK;
    ghostLine.opacity = 0.9 * S.liftK;
    // Posts from the four corners of the face that leaves, to where it went.
    const axis = S.item.lift.axis || "y", off = lv.clone().multiplyScalar(fx.easeInOut(S.liftK));
    const p = postGeo.attributes.position;
    const c = Math.cos(S.rot), sn = Math.sin(S.rot);
    const rot = (x, z) => [b.x + x * c + z * sn, b.z - x * sn + z * c];
    const pts = axis === "y"
      ? [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]].map(([u, , v]) => [u * b.w / 2, 0, v * b.d / 2])
      : axis === "x"
        ? [[0, 0, -1], [0, 1, -1], [0, 1, 1], [0, 0, 1]].map(([, yy, v]) => [-(lv.x > 0 ? 1 : -1) * b.w / 2, yy * b.h, v * b.d / 2])
        : [[-1, 0, 0], [1, 0, 0], [1, 1, 0], [-1, 1, 0]].map(([u, yy]) => [u * b.w / 2, yy * b.h, -(lv.z > 0 ? 1 : -1) * b.d / 2]);
    pts.forEach(([x, y, z], i) => {
      const [wx, wz] = rot(x, z);
      p.setXYZ(i * 2, wx, b.y + y, wz);
      p.setXYZ(i * 2 + 1, wx + off.x, b.y + y + off.y, wz + off.z);
    });
    p.needsUpdate = true;
    postGeo.computeBoundingSphere();
    // Veil: a dark pane between the camera and everything except the lifted item.
    if (S.item.lift.veil === false) { veil.visible = false; return; }
    const worldDir = lv.clone().normalize().transformDirection(pg.matrixWorld);
    let far = -Infinity;
    for (const R of frameItems()) {
      if (R === S) continue;
      eachCorner(R, (cc) => { far = Math.max(far, cc.dot(worldDir)); });
    }
    let near = Infinity;
    eachCorner(S, (cc) => { near = Math.min(near, cc.dot(worldDir)); });
    const d = Math.min(far + 0.04, near - 0.02);
    const centre = goalBounds().getCenter(new THREE.Vector3());
    veil.position.copy(centre).addScaledVector(worldDir, d - centre.dot(worldDir));
    veil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldDir);
    veilMat.opacity = theme.cur.veilOpacity * fx.easeInOut(S.liftK);
    veil.visible = veilMat.opacity > 0.01;
  }

  function frame(t) {
    rafId = 0;
    if (disposed || lost) { running = false; return; }
    if (!onScreen && !inView()) { running = false; return; }
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    frames++;
    const k = reduce() ? 1 : easeOut(clamp01((t - tweenT0) / opt.tween));
    let busy = k < 1;
    if (theme.ms) {
      const tk = clamp01((t - theme.t0) / theme.ms);
      blendTheme(fx.easeInOut(tk));
      if (tk >= 1) theme.ms = 0; else busy = true;
    }
    refreshDims();
    for (const id of order) { const I = inst.get(id); if (I && stepItem(I, t, k, dt)) busy = true; }
    for (const I of [...dying]) if (stepItem(I, t, 1, dt)) busy = true;
    root.updateMatrixWorld(true);
    if (scn) {
      const sk = clamp01((t - scn.t0) / scn.dur);
      const focusing = sk < (scn.release ?? 0.85);
      camFocus = focusing && scn.focus ? toBox(scn.focus()) : null;
      if (scn.view) cam.goal = focusing ? scn.view : scn.home;
      scn.step?.(sk, t);
      busy = true;
      if (sk >= 1) endScene();
    } else camFocus = null;
    if (cam.goal) {
      const kk = reduce() ? 1 : approach(dt, scn ? 3.2 : 5.5);
      const da = Math.atan2(Math.sin(cam.goal.az - cam.az), Math.cos(cam.goal.az - cam.az));
      cam.az += da * kk;
      cam.el += (cam.goal.el - cam.el) * kk;
      if (!scn && Math.abs(da) < 0.002 && Math.abs(cam.goal.el - cam.el) < 0.002) { cam.az = cam.goal.az; cam.el = cam.goal.el; cam.goal = null; }
      busy = true;
    }
    placeGhost();
    if (stepBursts(t)) busy = true;
    if (fitCamera(dt)) busy = true;
    placeLabels();
    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; host.classList.add("mk-live"); opt.onReady?.(); }
    if (busy || t < awakeUntil) rafId = requestAnimationFrame(frame);
    else running = false;
  }
  function toBox(f) {
    if (!f) return null;
    if (f.isBox3) return f;
    const I = inst.get(f);
    if (!I) return null;
    const b = new THREE.Box3();
    eachCorner(I, (c) => b.expandByPoint(c), I.item.focusPad ?? 0.35);
    return b;
  }

  // ------------------------------------------------------------ labels --
  const proj = new THREE.Vector3();
  const placed = [];
  let focusedLabel = null, smallWarned = false;
  function placeLabels() {
    const W = host.clientWidth, Hh = host.clientHeight;
    const ppu = W / Math.max(1e-6, camera.right - camera.left);
    const cands = [];
    const small = [];
    for (const id of order) {
      const I = inst.get(id);
      if (!I?.label) continue;
      const it = I.item, tone = I.tone;
      if (I.labelText !== `${it.label}|${it.sub || ""}`) {
        I.labelText = `${it.label}|${it.sub || ""}`;
        I.label.firstChild.textContent = it.label;
        I.label.lastChild.textContent = it.sub || "";
        I.label.setAttribute("aria-label", it.ariaLabel || [it.label, it.sub].filter(Boolean).join(", "));
        I.size = null;
      }
      const spanPx = Math.max(I.cur.w, I.cur.d) * ppu;
      if (spanPx < 44 && tone !== "dim") small.push(id);
      const usable = tone !== "dim" && now() - I.born > 300;
      I.label.disabled = !usable;
      I.label.setAttribute("aria-pressed", String(selected === id));
      I.label.classList.toggle("is-selected", selected === id);
      I.label.classList.toggle("is-on", false);
      const isFocus = focusedLabel === id;
      const show = isFocus || (usable && spanPx >= opt.labelMin && (!selected || selected === id || it.alwaysLabel) && !scn?.hideLabels && !(focusId && focusId !== id && !selected));
      if (!show) { I.label.style.pointerEvents = "none"; continue; }
      const at = it.labelAt || [0, I.cur.h, 0];
      proj.set(at[0], at[1], at[2]).applyMatrix4(I.group.matrixWorld).project(camera);
      if (proj.x < -1.1 || proj.x > 1.1 || proj.y < -1.1 || proj.y > 1.1) { I.label.style.pointerEvents = "none"; continue; }
      if (!I.size) I.size = [I.label.offsetWidth || 60, I.label.offsetHeight || 24];
      const pri = isFocus ? 0 : selected === id ? 1 : tone === "on" ? 2 : 3;
      cands.push({ I, x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * Hh, pri, ord: cands.length });
    }
    cands.sort((a, b) => a.pri - b.pri || a.ord - b.ord);
    placed.length = 0;
    for (const c of cands) {
      const [w, h] = c.I.size;
      const r = { l: c.x - w / 2 - 3, r: c.x + w / 2 + 3, t: c.y - h / 2 - 2, b: c.y + h / 2 + 2 };
      if (c.pri > 1 && placed.some((p) => r.l < p.r && r.r > p.l && r.t < p.b && r.b > p.t)) { c.I.label.style.pointerEvents = "none"; continue; }
      placed.push(r);
      c.I.label.classList.add("is-on");
      c.I.label.style.pointerEvents = opt.interactive ? "auto" : "none";
      // A lifted (selected) item keeps its label above it, not on top of it.
      const up = c.pri === 1 && c.I.item.lift ? "calc(-100% - 12px)" : "-50%";
      c.I.label.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px) translate(-50%, ${up})`;
    }
    // Roving tab stop: the selected label, else the first usable one.
    const labels = order.map((id) => inst.get(id)?.label).filter((b) => b && !b.disabled);
    const stop = (selected && inst.get(selected)?.label && !inst.get(selected).label.disabled ? inst.get(selected).label : null) || labels[0];
    for (const b of labels) b.tabIndex = b === stop ? 0 : -1;
    lastSmall = small;
    if (opt.dev && small.length && !smallWarned && frames > 30) {
      smallWarned = true;
      console.warn(`model-craft: ${small.length} pickable item(s) are under 44px on screen at ${W}px wide: ${small.join(", ")}. Make them bigger, fewer, or tap them through labels.`);
    }
  }
  let lastSmall = [];
  on(labelsEl, "click", (e) => {
    const b = e.target.closest(".mk-label");
    if (!b || b.disabled) return;
    const id = b.dataset.id;
    select(selected === id ? null : id);
  });
  on(labelsEl, "focusin", (e) => { const b = e.target.closest(".mk-label"); focusedLabel = b?.dataset.id || null; wake(300); });
  on(labelsEl, "focusout", () => { focusedLabel = null; wake(300); });
  on(labelsEl, "keydown", (e) => {
    const list = order.map((id) => inst.get(id)?.label).filter((b) => b && !b.disabled);
    const i = list.indexOf(document.activeElement);
    if (e.key === "Escape") { select(null); return; }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step || i < 0) return;
    e.preventDefault();
    list[(i + step + list.length) % list.length].focus();
  });

  // ----------------------------------------------------------- picking --
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function itemAt(ev) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const hit of ray.intersectObjects(root.children, true)) {
      let ob = hit.object;
      if (ob.isLineSegments || ob.isSprite || !ob.visible) continue;
      let helper = false;
      for (let a = ob; a; a = a.parent) if (a.userData.helper) { helper = true; break; }
      if (helper) continue;
      while (ob) {
        const id = ob.userData.itemId;
        if (id) { const I = inst.get(id); if (selectable(I)) return id; }
        ob = ob.parent;
      }
    }
    return null;
  }
  function select(id, { silent = false } = {}) {
    // An item that can't be picked (dim, not pickable, gone) is ignored: the
    // current selection stays. Only null deselects.
    if (id && !selectable(inst.get(id))) return;
    if (selected === id) return;
    selected = id;
    const I = id && inst.get(id);
    focusId = I && (I.item.lift == null || I.item.focus) ? id : null;
    if (I?.item.view) { if (!cam.home) cam.home = { az: cam.az, el: cam.el }; cam.goal = I.item.view; }
    else if (cam.home) { cam.goal = cam.home; cam.home = null; }
    if (!silent) opt.onSelect?.(I ? I.item : null);
    wake(1200);
  }

  if (opt.interactive) {
    canvas.style.touchAction = "pan-y";
    let down = null;
    on(canvas, "pointerdown", (e) => {
      const ended = Boolean(scn);
      if (ended) endScene();
      down = { x: e.clientX, y: e.clientY, az: cam.goal?.az ?? cam.az, el: cam.goal?.el ?? cam.el, drag: false, id: e.pointerId, ended };
    });
    on(canvas, "pointermove", (e) => {
      if (down && e.pointerId === down.id) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (camOpt.orbit && !down.drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { down.drag = true; canvas.setPointerCapture(e.pointerId); }
        if (down.drag) {
          cam.goal = null;
          cam.az = Math.max(cam.baseAz - camOpt.azRange, Math.min(cam.baseAz + camOpt.azRange, down.az - dx * 0.006));
          if (e.pointerType === "mouse") cam.el = Math.max(camOpt.elRange[0], Math.min(camOpt.elRange[1], down.el + dy * 0.004));
          wake();
        }
        return;
      }
      if (e.pointerType === "mouse") {
        const id = itemAt(e);
        canvas.style.cursor = id ? "pointer" : camOpt.orbit ? "grab" : "default";
        if (id !== hovered) { hovered = id; wake(250); }
      }
    });
    on(canvas, "pointerup", (e) => {
      if (down && !down.drag && !down.ended) { const id = itemAt(e); select(id === selected ? null : id); }
      down = null;
    });
    on(canvas, "pointercancel", () => { down = null; });
    on(canvas, "pointerleave", () => { if (hovered) { hovered = null; wake(250); } });
  } else canvas.style.pointerEvents = "none";

  // ------------------------------------------------------------ scenes --
  // A scene is a short scripted moment (a table dresses itself). It never
  // carries state: when it ends, layout + state alone decide what is drawn.
  let scn = null;
  const sceneApi = {
    THREE, fx, GEO, mat, texture,
    item: (id) => { const I = inst.get(id); return I ? { group: I.group, parts: I.parts, item: I.item, box: I.cur, ctx: I.ctx } : null; },
    box: (id) => toBox(id),
    add(obj, parentId) { const P = parentId && inst.get(parentId); (P ? P.group : scene).add(obj); scn?.owned.push(obj); return obj; },
    newMat(def) { const m = makeMat(def); scn?.ownedMats.push(m); return m; },
    burst: (...a) => burst(...a),
    get accent() { return opt.accent; },
  };
  function play(name, arg) {
    if (reduce() || lost || disposed) return 0;
    const def = opt.scenes?.[name];
    if (!def) { if (opt.dev) console.warn(`model-craft: no scene "${name}"`); return 0; }
    endScene();
    scn = { owned: [], ownedMats: [], t0: now(), home: { az: cam.az, el: cam.el } };
    const sc = def(sceneApi, arg);
    if (!sc) { scn = null; return 0; }
    Object.assign(scn, sc, { t0: now() });
    wake();
    return sc.dur;
  }
  function endScene() {
    if (!scn) return;
    const s = scn;
    scn = null;
    try { s.end?.(); } catch (err) { console.error(err); }
    for (const ob of s.owned) {
      ob.parent?.remove(ob);
      ob.traverse?.((x) => { if (x.geometry && !SHARED.has(x.geometry)) x.geometry.dispose(); });
    }
    for (const m of s.ownedMats) m.dispose();
    if (s.view) cam.goal = s.home;
    camFocus = null;
    wake(1200);
  }

  // ------------------------------------------------------------ bursts --
  const bursts = [];
  let sparkTex = null;
  function burst(target, { count = 7, color = "#ffffff", size = 0.22, spread = 0.45, dur = 650, height = 0.2 } = {}) {
    if (reduce() || disposed) return;
    const p = new THREE.Vector3();
    if (typeof target === "string") { const b = toBox(target); if (!b) return; b.getCenter(p); p.y = b.max.y + height; }
    else p.copy(target);
    sparkTex = sparkTex || own(fx.canvasTexture(fx.sparkleCanvas(64), { repeat: false }));
    const rnd = fx.seeded(String(now()));
    const group = new THREE.Group();
    const m = new THREE.SpriteMaterial({ map: sparkTex, color, transparent: true, depthWrite: false });
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(m);
      s.userData = { off: new THREE.Vector3((rnd() - 0.5) * spread * 2, rnd() * spread, (rnd() - 0.5) * spread * 2), delay: rnd() * 0.35 };
      s.renderOrder = 6;
      group.add(s);
    }
    group.position.copy(p);
    scene.add(group);
    bursts.push({ group, m, t0: now(), dur, size });
    wake(dur + 100);
  }
  function stepBursts(t) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], k = (t - b.t0) / b.dur;
      if (k >= 1) { scene.remove(b.group); b.m.dispose(); bursts.splice(i, 1); continue; }
      for (const s of b.group.children) {
        const kk = clamp01((k - s.userData.delay) / (1 - s.userData.delay));
        const a = Math.sin(Math.PI * kk);
        s.scale.setScalar(Math.max(0.001, b.size * a));
        s.position.copy(s.userData.off).multiplyScalar(0.6 + 0.4 * kk);
      }
    }
    return bursts.length > 0;
  }

  // ------------------------------------------------- size, loss, life --
  function resize() {
    const W = host.clientWidth, Hh = host.clientHeight;
    if (!W || !Hh) return;
    renderer.setSize(W, Hh, false);
    const p = isPortrait();
    view = { portrait: p, w: W, h: Hh };
    if (p !== cam.portrait) { cam.portrait = p; resetView(); lastSig = ""; if (cam.ready) update(state); }
    cam.f = null;
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  on(canvas, "webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    host.classList.add("mk-lost");
    opt.onLost?.(true);
  });
  on(canvas, "webglcontextrestored", () => {
    envRT.dispose();
    envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    for (const e of textures.values()) for (const t of e.clones) t.needsUpdate = true;
    lost = false;
    host.classList.remove("mk-lost");
    opt.onLost?.(false);
    wake(600);
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    ac.abort();
    io?.disconnect();
    ro.disconnect();
    endScene();
    for (const I of [...inst.values(), ...dying]) destroy(I);
    inst.clear();
    for (const b of bursts) { scene.remove(b.group); b.m.dispose(); }
    for (const d of dims.values()) d.dispose();
    for (const e of textures.values()) for (const t of e.clones) t.dispose();
    for (const x of owned) x.dispose?.();
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
    labelsEl.remove();
    host.classList.remove("mk-live", "mk-lost");
  }

  // -------------------------------------------------------------- start --
  view = { portrait: isPortrait(), w: host.clientWidth, h: host.clientHeight };
  cam.portrait = view.portrait;
  resetView();
  setTheme(opt.theme || themeNames[0]);
  cam.ready = true;
  if (o.state) update(o.state);

  return {
    el: canvas, canvas, labels: labelsEl, THREE, scene, camera, renderer,
    update,
    // The page calls this from render(); it never fires onSelect (state already
    // knows). Pass { notify: true } to behave like a tap (tests, demos).
    select: (id, o = {}) => select(id, { silent: !o.notify }),
    get selected() { return selected; },
    focus(id) { focusId = id && inst.has(id) ? id : null; wake(1200); },
    setTheme,
    get theme() { return theme.name; },
    setInsets(v) {
      cam.inset = typeof v === "number" ? { top: 0, right: 0, bottom: v, left: 0 } : { top: 0, right: 0, bottom: 0, left: 0, ...v };
      wake();
    },
    resetView() { resetView(); wake(); },
    view(v) { cam.goal = v; wake(1500); },
    play, stop: endScene, busy: () => Boolean(scn), burst,
    items: () => order.map((id) => inst.get(id)?.item).filter(Boolean),
    item: (id) => inst.get(id)?.item || null,
    wake,
    stats: () => ({
      frames, running, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      items: inst.size, small: [...lastSmall], selected, theme: theme.name, lost,
    }),
    // A PNG/WebP of the current view (used for the poster image).
    snapshot(type = "image/webp", quality = 0.9) { renderer.render(scene, camera); return canvas.toDataURL(type, quality); },
    dispose,
  };
}
