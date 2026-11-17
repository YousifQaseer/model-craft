// model-craft sheet: the card that slides up inside the stage when an item is
// tapped. The site fills it; buttons inside it should change the page's one
// state object (never the model directly). Tell the model how tall it is, so
// the camera keeps the lifted item above it:
//
//   const sheet = createSheet(stage, { onClose: () => setState({ pick: null }) });
//   sheet.show({ title: "Table 6", meta: "Window · seats 4", body: html });
//   model.setInsets(sheet.inset());   // { bottom } on phones, { right } on desktop
//
// Stage attribute data-sheet="side" puts it on the right from 900px wide.

export function createSheet(stage, { onClose, label = "Details" } = {}) {
  const el = document.createElement("aside");
  el.className = "mk-sheet";
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-label", label);
  el.innerHTML = `<div class="mk-sheet__head"><div><h3 class="mk-sheet__title"></h3><p class="mk-sheet__meta"></p></div>
    <button type="button" class="mk-sheet__close" aria-label="Close">×</button></div><div class="mk-sheet__body"></div>`;
  stage.append(el);
  const $ = (s) => el.querySelector(s);
  $(".mk-sheet__close").addEventListener("click", () => onClose?.());
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") onClose?.(); });

  let open = false;
  function show(content) {
    open = Boolean(content);
    el.classList.toggle("is-open", open);
    el.inert = !open;
    if (!open) return;
    $(".mk-sheet__title").textContent = content.title || "";
    $(".mk-sheet__meta").textContent = content.meta || "";
    const body = $(".mk-sheet__body");
    if (content.body instanceof Node) body.replaceChildren(content.body);
    else body.innerHTML = content.body || "";
  }
  const side = () => stage.dataset.sheet === "side" && innerWidth >= 900;
  show(null);
  return {
    el, show, hide: () => show(null),
    get open() { return open; },
    // Insets for model.setInsets(): what the sheet covers, plus a margin.
    inset() {
      if (!open) return { bottom: 0, right: 0 };
      // On phones the sheet is capped (CSS max-height 46%) and scrolls, so the
      // model always keeps at least half the stage.
      return side() ? { right: el.offsetWidth + 24 } : { bottom: Math.min(el.offsetHeight, stage.clientHeight * 0.46) + 16 };
    },
  };
}
