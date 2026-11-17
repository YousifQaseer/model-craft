// Gridline Motors: one state object, one render(). The car, the controls, the
// sheet, the price and the booking all read from state.

import { mountModel } from "./engine/mount.js";
import { createSheet } from "./engine/sheet.js";
import { BODIES, BODY_ORDER, PAINTS, FINISH_LABEL, WHEEL_OPTIONS, WHEEL_ORDER, PACKS, PACK_ORDER, TERMS, FEES, price, money } from "./data.js";

const state = {
  body: "suv", paint: "electric", wheel: "spoke", pack: "touring", spinAt: 0, pick: null,
  down: 5000, term: 60,
  step: "time", day: null, time: null, name: "", email: "", phone: "", trade: "no", errors: {}, ref: null,
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const paintOf = (id) => PAINTS.find((p) => p.id === id);

const stage = $("#stage");
const model = mountModel(stage, {
  poster: "assets/poster.webp",
  posterAlt: "A blue Gridline SUV on a turntable in a grey showroom.",
  create: async (host) => (await import("./model.js")).build(host, { onSelect: (it) => set({ pick: it?.id ?? null }) }),
});
const sheet = createSheet(stage, { onClose: () => set({ pick: null }), label: "Options for this part" });

function set(patch) { Object.assign(state, patch); render(); }

// ------------------------------------------------------------ days --
const DAYS = (() => {
  const out = [], d = new Date();
  for (let i = 1; out.length < 6; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    if (x.getDay() === 0) continue; // closed Sundays
    out.push({ id: x.toISOString().slice(0, 10), label: x.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" }), sat: x.getDay() === 6 });
  }
  return out;
})();
const TIMES = ["10:00", "11:30", "13:00", "14:30", "16:00", "17:30"];
const timesFor = (day) => (DAYS.find((d) => d.id === day)?.sat ? TIMES.slice(0, 4) : TIMES);

// ---------------------------------------------------------- render --
function render() {
  const P = price(state);
  model.update({ body: state.body, paint: state.paint, wheel: state.wheel, pack: state.pack, spinAt: state.spinAt });
  model.select(state.pick);

  // Build controls.
  for (const b of $$("[data-body]")) b.setAttribute("aria-checked", String(b.dataset.body === state.body));
  for (const b of $$("[data-paint]")) b.setAttribute("aria-checked", String(b.dataset.paint === state.paint));
  for (const b of $$("[data-wheel]")) b.setAttribute("aria-checked", String(b.dataset.wheel === state.wheel));
  for (const b of $$("[data-pack]")) b.setAttribute("aria-checked", String(b.dataset.pack === state.pack));
  for (const b of $$("[data-term]")) b.setAttribute("aria-pressed", String(+b.dataset.term === state.term));
  const paint = paintOf(state.paint);
  $("#paint-name").textContent = `${paint.name} · ${FINISH_LABEL[paint.finish]}${paint.price ? " · +" + money(paint.price) : ""}`;
  $("#model-name").textContent = `${BODIES[state.body].name} ${BODIES[state.body].label}`;
  for (const el of $$("[data-check=price]")) el.textContent = money(P.total);
  for (const el of $$("[data-check=monthly]")) el.textContent = `${money(P.monthly)}/mo`;
  $("#price-terms").textContent = `${P.term} months at ${(FEES.apr * 100).toFixed(2)}% APR with ${money(P.down)} down`;

  // Finance.
  $("#down").value = state.down;
  $("#down-out").textContent = money(P.down);
  $("#breakdown").innerHTML = P.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${l.amount ? money(l.amount) : "Included"}</td></tr>`).join("")
    + `<tr class="sub"><td>Subtotal</td><td>${money(P.subtotal)}</td></tr><tr><td>HST 13%</td><td>${money(P.hst)}</td></tr>`
    + `<tr class="total"><td>Estimated total</td><td>${money(P.total)}</td></tr>`;

  // The sheet: options for the tapped part.
  if (state.pick === "car") sheet.show({ title: "Paint", meta: `${paint.name} · ${FINISH_LABEL[paint.finish]}`, body: swatchRow() });
  else if (state.pick === "wheels") sheet.show({ title: "Wheels", meta: WHEEL_OPTIONS[state.wheel].label, body: chipRow("wheel", WHEEL_ORDER, WHEEL_OPTIONS) });
  else if (state.pick === "cabin") sheet.show({ title: "Package", meta: PACKS[state.pack].note, body: chipRow("pack", PACK_ORDER, PACKS) });
  else sheet.show(null);
  model.setInsets(sheet.inset());
  $("#hint").hidden = Boolean(state.pick);

  renderBooking(P);
}

function swatchRow() {
  return `<div class="swatches swatches--sheet" role="radiogroup" aria-label="Paint">${PAINTS.map((p) =>
    `<button type="button" role="radio" class="swatch" data-paint="${p.id}" aria-checked="${p.id === state.paint}" aria-label="${esc(p.name)}, ${FINISH_LABEL[p.finish]}${p.price ? ", plus " + money(p.price) : ""}" style="--c:${p.hex}"></button>`).join("")}</div>`;
}
function chipRow(key, order, table) {
  return `<div class="chips" role="radiogroup">${order.map((id) =>
    `<button type="button" role="radio" class="chip" data-${key}="${id}" aria-checked="${state[key] === id}">${esc(table[id].label)}<span>${table[id].price ? "+" + money(table[id].price) : "Included"}</span></button>`).join("")}</div>`;
}

// --------------------------------------------------------- booking --
function renderBooking(P) {
  const steps = ["time", "details", "review", "done"];
  const i = steps.indexOf(state.step);
  for (const li of $$(".steps li")) li.classList.toggle("is-on", steps.indexOf(li.dataset.step) <= i);
  for (const pane of $$("[data-pane]")) pane.hidden = pane.dataset.pane !== state.step;
  $("#build-summary").innerHTML = summaryHTML(P);
  $("#days").innerHTML = DAYS.map((d) => `<button type="button" class="chip" data-day="${d.id}" aria-pressed="${state.day === d.id}">${esc(d.label)}</button>`).join("");
  $("#times").innerHTML = state.day ? timesFor(state.day).map((t) => `<button type="button" class="chip" data-time="${t}" aria-pressed="${state.time === t}">${t}</button>`).join("") : `<p class="muted">Pick a day first.</p>`;
  $("#to-details").disabled = !(state.day && state.time);
  for (const k of ["name", "email", "phone"]) {
    const err = state.errors[k];
    $(`#err-${k}`).textContent = err || "";
    $(`#f-${k}`).setAttribute("aria-invalid", String(Boolean(err)));
  }
  const day = DAYS.find((d) => d.id === state.day);
  $("#review").innerHTML = `${summaryHTML(P)}
    <dl class="facts"><dt>Test drive</dt><dd>${day ? esc(day.label) : ""} at ${esc(state.time || "")}</dd>
    <dt>Name</dt><dd>${esc(state.name)}</dd><dt>Email</dt><dd>${esc(state.email)}</dd><dt>Phone</dt><dd>${esc(state.phone)}</dd>
    <dt>Trade-in</dt><dd>${state.trade === "yes" ? "Yes, bring it for an appraisal" : "No"}</dd></dl>`;
  $("#ref").textContent = state.ref || "";
  $("#done-when").textContent = day ? `${day.label} at ${state.time}` : "";
}
function summaryHTML(P) {
  const paint = paintOf(state.paint);
  return `<div class="summary"><div><strong>${BODIES[state.body].name} ${BODIES[state.body].label}</strong>
    <span>${esc(paint.name)} · ${WHEEL_OPTIONS[state.wheel].label} · ${PACKS[state.pack].label}</span></div>
    <div class="summary__price"><strong>${money(P.total)}</strong><span>or ${money(P.monthly)}/mo</span></div></div>`;
}

function validate() {
  const e = {};
  if (!state.name.trim()) e.name = "Add your name so we know who to expect.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) e.email = "That email doesn't look right.";
  if (state.phone.replace(/\D/g, "").length < 10) e.phone = "Add a 10-digit phone number.";
  return e;
}

// ---------------------------------------------------------- events --
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.body && d.body !== state.body) set({ body: d.body, spinAt: performance.now() });
  else if (d.paint) { set({ paint: d.paint }); model.burst("car", { color: "#ffffff", count: 6 }); }
  else if (d.wheel) set({ wheel: d.wheel });
  else if (d.pack) set({ pack: d.pack });
  else if (d.term) set({ term: +d.term });
  else if (d.pickPart) set({ pick: state.pick === d.pickPart ? null : d.pickPart });
  else if (d.day) set({ day: d.day, time: timesFor(d.day).includes(state.time) ? state.time : null });
  else if (d.time) set({ time: d.time });
  else if (d.go === "book") { set({ pick: null, step: state.step === "done" ? "time" : state.step }); $("#book").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
  else if (d.step) set({ step: d.step });
});
$("#to-details").addEventListener("click", () => set({ step: "details" }));
$("#details-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const errors = validate();
  set({ errors, step: Object.keys(errors).length ? "details" : "review" });
  if (Object.keys(errors).length) $(`#f-${Object.keys(errors)[0]}`).focus();
});
for (const k of ["name", "email", "phone"]) $(`#f-${k}`).addEventListener("input", (e) => { state[k] = e.target.value; if (state.errors[k]) set({ errors: { ...state.errors, [k]: undefined } }); });
for (const r of $$("input[name=trade]")) r.addEventListener("change", (e) => { state.trade = e.target.value; });
$("#confirm").addEventListener("click", () => {
  const ref = "GM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  set({ step: "done", ref });
  $("#book").scrollIntoView({ block: "start" });
});
$("#down").addEventListener("input", (e) => set({ down: +e.target.value }));

// Keyboard: arrow keys move through each radio group.
document.addEventListener("keydown", (e) => {
  const r = e.target.closest?.('[role="radio"]');
  if (!r || !["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
  const group = [...r.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')];
  const next = group[(group.indexOf(r) + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + group.length) % group.length];
  e.preventDefault();
  next.click();
  next.focus();
});

Object.assign(window, { __model: model, __state: state, __set: set });
render();
