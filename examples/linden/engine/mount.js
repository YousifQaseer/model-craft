// model-craft mount: the small, eager part. No Three.js here.
//
//   const model = mountModel(host, {
//     poster: "img/poster.webp", posterAlt: "The dining room, eight tables",
//     create: async (host) => (await import("./model.js")).build(host, { onSelect }),
//   });
//   model.update(state);   // safe right away: replayed when the 3D model is ready
//
// The poster shows at once. The 3D model loads when the browser is idle; it
// fades in over the poster after its first frame. Without WebGL2 (or with
// ?no3d in the URL, for tests) the poster stays and the page still works,
// because every choice on the model also exists as a normal form control.

export function supportsWebGL2() {
  try { return Boolean(document.createElement("canvas").getContext("webgl2")); } catch { return false; }
}

// poster: one URL, or { portrait, landscape } (chosen by the stage's shape, the
// same rule the camera uses, so the view does not jump when the model fades in).
export function mountModel(host, { poster, posterAlt = "", create, onReady, onFail, eager = false } = {}) {
  host.classList.add("mk-stage");
  if (poster && !host.querySelector(".mk-poster")) {
    const img = new Image();
    img.className = "mk-poster";
    const portrait = host.clientWidth < 600 || host.clientHeight > host.clientWidth * 1.05;
    img.src = typeof poster === "string" ? poster : (portrait ? poster.portrait : poster.landscape) || poster.landscape || poster.portrait;
    img.alt = posterAlt;
    img.decoding = "async";
    host.prepend(img);
  }
  const q = { state: undefined, theme: null, insets: null, select: undefined };
  let real = null;
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });

  const facade = {
    ready,
    get model() { return real; },
    get live() { return Boolean(real); },
    update(s) { q.state = s; real?.update(s); },
    select(id, o) { q.select = id; real?.select(id, o); },
    setTheme(name, o) { q.theme = [name, o]; real?.setTheme(name, o); },
    setInsets(v) { q.insets = v; real?.setInsets(v); },
    focus(id) { real?.focus(id); },
    view(v) { real?.view(v); },
    play(name, arg) { return real?.play(name, arg) ?? 0; },
    stop() { real?.stop(); },
    busy() { return real?.busy() ?? false; },
    burst(...a) { real?.burst(...a); },
    get selected() { return real?.selected ?? null; },
    stats() { return real?.stats() ?? { live: false }; },
    snapshot(...a) { return real?.snapshot(...a) ?? null; },
    dispose() { real?.dispose(); real = null; },
  };

  const fail = (why) => {
    host.classList.add("mk-fallback");
    if (why) console.warn("model-craft: staying on the poster:", why);
    onFail?.(why);
    resolveReady(null);
  };

  if (/[?&]no3d\b/.test(location.search)) { fail(); return facade; }
  if (!supportsWebGL2()) { fail("WebGL2 is not available"); return facade; }

  const start = async () => {
    try {
      const m = await create(host);
      real = m;
      if (q.theme) m.setTheme(q.theme[0], { ...(q.theme[1] || {}), ms: 0 });
      if (q.insets) m.setInsets(q.insets);
      if (q.state !== undefined) m.update(q.state);
      if (q.select !== undefined) m.select(q.select);
      onReady?.(m);
      resolveReady(m);
    } catch (err) {
      console.error(err);
      fail(err?.message || String(err));
    }
  };
  if (eager) start();
  else if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 600 });
  else setTimeout(start, 60);
  return facade;
}
