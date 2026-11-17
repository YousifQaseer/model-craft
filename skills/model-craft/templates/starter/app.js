// The page: ONE state object, ONE render(). The model, the form controls, the
// sheet and the price all read from state; nothing else holds a choice.
// Tapping the model changes state through onSelect, exactly like a button.

import { mountModel } from "./engine/mount.js";
import { createSheet } from "./engine/sheet.js";
import { TABLES, fits as fitsParty, price } from "./data.js"; // plain data: no Three.js on first paint

const state = { party: 2, time: "day", pick: null, step: "choose" };
const stage = document.querySelector("#stage");
const $ = (s) => document.querySelector(s);

const model = mountModel(stage, {
  poster: "assets/poster.webp", // made by scripts/poster.mjs once the model looks right
  posterAlt: "A small café in cutaway: four tables, a bar and plants.",
  create: async (host) => (await import("./model.js")).build(host, { theme: state.time, onSelect: (it) => set({ pick: it?.id ?? null }) }),
});
const sheet = createSheet(stage, { onClose: () => set({ pick: null }), label: "Table details" });

function set(patch) { Object.assign(state, patch); render(); }
const fits = (t) => fitsParty(t, state.party);

let lastTime = null;
function render() {
  if (state.pick && !fits(TABLES.find((t) => t.id === state.pick))) state.pick = null;
  model.update({ party: state.party });
  if (state.time !== lastTime) { model.setTheme(state.time); lastTime = state.time; }
  model.select(state.pick);

  for (const b of document.querySelectorAll("[data-party]")) b.setAttribute("aria-pressed", String(+b.dataset.party === state.party));
  for (const b of document.querySelectorAll("[data-time]")) b.setAttribute("aria-pressed", String(b.dataset.time === state.time));
  $("#tables").innerHTML = TABLES.filter(fits).map((t) =>
    `<button type="button" class="chip" data-table="${t.id}" aria-pressed="${state.pick === t.id}">Table ${t.id.slice(1)} · ${t.seats} seats · ${t.spot}</button>`).join("");

  const t = TABLES.find((x) => x.id === state.pick);
  sheet.show(t ? { title: `Table ${t.id.slice(1)}`, meta: `${t.spot} · seats ${t.seats}`,
    body: `<button type="button" class="btn" data-reserve>Reserve this table</button>` } : null);
  model.setInsets(sheet.inset());
  $("#price").textContent = `Deposit $${price(state).total}`;
  $("#summary").textContent = t ? `Party of ${state.party} · Table ${t.id.slice(1)} · ${state.time === "day" ? "Lunch" : "Dinner"}` : `Party of ${state.party}: pick a table`;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.party) set({ party: +b.dataset.party });
  if (b.dataset.time) set({ time: b.dataset.time });
  if (b.dataset.table) set({ pick: state.pick === b.dataset.table ? null : b.dataset.table });
  if ("reserve" in b.dataset) { const id = state.pick; set({ step: "done" }); model.play("celebrate", id); }
});

// Test hooks for scripts/shoot.mjs.
Object.assign(window, { __model: model, __state: state, __set: set });
render();
