// The page: ONE state object, ONE render(). The model, the form, the sheet, the
// dock and the price all read from state; nothing else holds a choice. Tapping
// a chair on the model changes state through onSelect, exactly like a button.

import { mountModel } from "./engine/mount.js";
import { createSheet } from "./engine/sheet.js";
import {
  BARBERS, SERVICES, ADDONS, barberById, barberAt, serviceById, mainBarber, friendBarber, modelState,
  price, money, slots, openDays, nextOpen, fmtTime, fmtDay, reference,
} from "./data.js";

const state = {
  barber: "any", service: "classic", wash: false, towel: false,
  friend: false, friendService: "kids",
  date: null, time: null, step: 1, pick: null,
  name: "", phone: "", email: "", ref: null, errors: {},
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const stage = $("#stage");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const model = mountModel(stage, {
  poster: "assets/poster.webp",
  posterAlt: "The barbershop in cutaway: three barber chairs with round mirrors on the back wall, a black-and-white checker floor, a wash basin, a bench and a barber pole.",
  create: async (host) => (await import("./model.js")).build(host, { onSelect: (it) => set({ pick: it?.id ?? null }) }),
});
const sheet = createSheet(stage, { onClose: () => set({ pick: null }), label: "Barber details" });

function set(patch) {
  // Test hook convenience: time "first" means the first open slot of the chosen day.
  if (patch.time === "first") { Object.assign(state, patch, { time: null }); fixTime(); state.time = slots(mainBarber(state), state.date)[0] || null; patch = {}; }
  Object.assign(state, patch);
  render();
}

// Keep date and time valid for the barber who will do the cut.
function fixTime() {
  const who = mainBarber(state);
  const days = openDays(who);
  if (!days.includes(state.date)) state.date = days[0] || null;
  if (state.time && !slots(who, state.date).includes(state.time)) state.time = null;
}

// ------------------------------------------------------- static parts --
function buildStatic() {
  $("#service-cards").innerHTML = SERVICES.map((s) => `
    <button type="button" class="card" data-service="${s.id}">
      <span class="card__name">${s.name}</span>
      <span class="card__price">$${s.price}</span>
      <span class="card__blurb">${s.blurb}</span>
      <span class="card__mins">${s.mins} min</span>
    </button>`).join("");
  $("#addon-cards").innerHTML = ADDONS.map((a) => `
    <button type="button" class="card card--addon" data-addon="${a.id}">
      <span class="card__name">${a.name}</span><span class="card__price">+$${a.price}</span>
      <span class="card__blurb">${a.blurb}</span>
    </button>`).join("");
  $("#step-services").innerHTML = SERVICES.map((s) => `<button type="button" class="chip" data-service="${s.id}">${s.name} · $${s.price}</button>`).join("");
  $("#step-addons").innerHTML = ADDONS.map((a) => `<button type="button" class="chip" data-addon="${a.id}">${a.name} · +$${a.price}</button>`).join("");
  const friendChips = SERVICES.map((s) => `<button type="button" class="chip" data-friend-service="${s.id}">${s.name}</button>`).join("");
  $("#friend-services").innerHTML = friendChips;
  $("#step-friend").innerHTML = friendChips;
  $("#people").innerHTML = BARBERS.map((b) => `
    <article class="person">
      <p class="person__chair">Chair ${b.station.slice(1)}</p>
      <h3 class="person__name">${b.name}</h3>
      <p class="person__known">${b.known}</p>
      <p class="person__line">${b.line}</p>
      <button type="button" class="btn btn--ghost btn--sm" data-choose="${b.id}">Choose ${b.name}</button>
    </article>`).join("");
}

// ------------------------------------------------------------ render --
const memo = {};
const once = (key, val, fn) => { if (memo[key] !== val) { memo[key] = val; fn(); } };

function render() {
  fixTime();
  const ms = modelState(state);
  // A dimmed chair cannot stay picked.
  if (state.pick && !ms.stations[state.pick]?.on) state.pick = null;
  model.update(ms);
  model.select(state.pick);

  const main = barberById(mainBarber(state));
  const fb = barberById(friendBarber(state));
  const svc = serviceById(state.service);
  const p = price(state);
  const press = (sel, test) => $$(sel).forEach((b) => b.setAttribute("aria-pressed", String(test(b))));
  press("[data-barber]", (b) => b.dataset.barber === state.barber);
  press("[data-service]", (b) => b.dataset.service === state.service);
  press("[data-addon]", (b) => Boolean(state[b.dataset.addon]));
  press("[data-friend]", () => state.friend);
  press("[data-friend-service]", (b) => b.dataset.friendService === state.friendService);
  $$("[data-addon=towel]").forEach((b) => { b.disabled = state.service === "shave"; b.title = b.disabled ? "Included with the hot towel shave" : ""; });
  $$("#friend-services, #step-friend").forEach((el) => { el.hidden = !state.friend; });

  $("#assigned").textContent = state.barber === "any"
    ? `Any barber: ${main.name} is known for ${svc.name.toLowerCase()}s, so the chair is theirs.${fb ? ` Your friend sits with ${fb.name}.` : ""}`
    : fb ? `Your friend sits with ${fb.name}, next chair over.` : "";

  // Step 2: days and times for the barber doing the cut.
  once("days", `${main.id}|${state.date}`, () => {
    $("#days").innerHTML = openDays(main.id).map((d) => `<button type="button" class="chip" data-date="${d}" aria-pressed="${d === state.date}">${fmtDay(d)}</button>`).join("");
  });
  once("times", `${main.id}|${state.date}|${state.time}`, () => {
    const list = state.date ? slots(main.id, state.date) : [];
    $("#times").innerHTML = list.length
      ? list.map((t) => `<button type="button" class="chip" data-time="${t}" aria-pressed="${t === state.time}">${fmtTime(t)}</button>`).join("")
      : `<p class="muted">No times left that day.</p>`;
  });
  $("#time-with").textContent = `with ${main.name}`;

  // Steps.
  for (const pane of $$("[data-pane]")) pane.hidden = +pane.dataset.pane !== state.step;
  for (const li of $$("[data-step-dot]")) {
    const n = +li.dataset.stepDot;
    li.classList.toggle("is-now", n === state.step);
    li.classList.toggle("is-done", n < state.step);
    if (n === state.step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  }
  $(".steps").hidden = state.step === 4;
  for (const [k, id] of [["time", "#err-time"], ["name", "#err-name"], ["phone", "#err-phone"], ["email", "#err-email"]]) $(id).hidden = !state.errors[k];
  for (const k of ["name", "phone", "email"]) $(`#f-${k}`).setAttribute("aria-invalid", String(Boolean(state.errors[k])));

  // Review.
  const when = state.time ? `${fmtDay(state.date, new Date(), true)}, ${fmtTime(state.time)}` : "No time yet";
  if (state.step === 3) {
    $("#review").innerHTML = `
      <h3 class="sub">Review</h3>
      <dl class="facts">
        <div><dt>When</dt><dd>${when}</dd></div>
        <div><dt>Barber</dt><dd>${main.name}${state.barber === "any" ? " (any barber)" : ""}</dd></div>
        ${fb ? `<div><dt>Friend</dt><dd>${serviceById(state.friendService).name} with ${fb.name}</dd></div>` : ""}
      </dl>
      <table class="lines"><tbody>
        ${p.lines.map((l) => `<tr><th scope="row">${l.label}</th><td>${money(l.cents)}</td></tr>`).join("")}
        <tr class="lines__sub"><th scope="row">Subtotal</th><td>${money(p.subtotal)}</td></tr>
        <tr><th scope="row">HST 13%</th><td>${money(p.tax)}</td></tr>
        <tr class="lines__total"><th scope="row">Total</th><td>${money(p.total)}</td></tr>
      </tbody></table>
      <p class="muted small">Sample pricing in CAD. Pay at the shop.</p>`;
  }
  if (state.step === 4) {
    $("#done-ref").textContent = `Reference ${state.ref}`;
    $("#done-what").textContent = `${svc.name} with ${main.name}${fb ? `, and a ${serviceById(state.friendService).name.toLowerCase()} with ${fb.name} for your friend` : ""}, ${when}. Total ${money(p.total)} including HST, paid at the shop.`;
  }

  // The dock (and the matrix check): summary + live total.
  const bits = [main.name + (state.barber === "any" ? " (any)" : ""), svc.name];
  if (state.wash) bits.push("Wash");
  if (state.towel && state.service !== "shave") bits.push("Hot towel");
  if (fb) bits.push(`+ friend with ${fb.name}`);
  if (state.time) bits.push(`${fmtDay(state.date)} ${fmtTime(state.time)}`);
  $("#sum").textContent = bits.join(" · ");
  $("#total").textContent = money(p.total);
  $("#dock").hidden = state.step === 4; // the confirmation is the end; nothing left to dock
  $("#dock-go").textContent = state.step === 4 ? "Booked" : state.step === 1 ? "Book" : state.step === 2 ? "Pick a time" : "Confirm";

  // The sheet: the tapped chair's barber.
  const b = state.pick ? barberAt(state.pick) : null;
  once("sheet", `${state.pick}|${b ? nextOpen(b.id).map((x) => x.iso + x.t).join() : ""}`, () => {
    sheet.show(b ? {
      title: b.name, meta: `Known for ${b.known.toLowerCase()}`,
      body: `<p class="sheet__line">${b.line}</p>
        <p class="sheet__label">Next open <span>(sample)</span></p>
        <div class="chips chips--small chips--row">${nextOpen(b.id).map((x) => `<button type="button" class="chip" data-slot="${b.id}|${x.iso}|${x.t}" aria-label="${fmtDay(x.iso, new Date(), true)} at ${fmtTime(x.t)}">${fmtDay(x.iso)} ${fmtTime(x.t).replace(":00", "")}</button>`).join("")}</div>
        <button type="button" class="btn btn--block" data-book-with="${b.id}">Book with ${b.name}</button>` } : null);
  });
  // Phones: the stage grows while a chair is open, so the sheet never squeezes it.
  stage.classList.toggle("is-picked", Boolean(state.pick));
  model.setInsets(sheet.inset());
}

// ------------------------------------------------------------ events --
function goBook(step) {
  set({ step, pick: null });
  const el = $("#book");
  el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
}
function playCut() {
  const id = barberById(mainBarber(state)).station;
  if (!reduced()) setTimeout(() => model.play("cut", id), 60);
}
function validate() {
  const e = {};
  if (!state.name.trim()) e.name = true;
  if (state.phone.replace(/\D/g, "").length < 10) e.phone = true;
  if (state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) e.email = true;
  return e;
}

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button, a[data-go]");
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.barber) set({ barber: d.barber });
  else if (d.service) { const changed = d.service !== state.service; set({ service: d.service }); if (changed) playCut(); }
  else if (d.addon) set({ [d.addon]: !state[d.addon] });
  else if ("friend" in d) set({ friend: !state.friend });
  else if (d.friendService) set({ friendService: d.friendService, friend: true });
  else if (d.choose) { const bb = barberById(d.choose); set({ barber: bb.id, pick: bb.station }); } // the stage is pinned, so the focus is seen
  else if (d.date) set({ date: d.date, time: null });
  else if (d.time) set({ time: d.time, errors: { ...state.errors, time: false } });
  else if (d.slot) { const [id, iso, t] = d.slot.split("|"); set({ barber: id, date: iso, time: t, errors: {} }); goBook(2); }
  else if (d.bookWith) { set({ barber: d.bookWith }); goBook(2); }
  else if (d.step) {
    const to = +d.step;
    if (to === 3 && !state.time) { set({ errors: { time: true } }); $("#times button")?.focus(); return; }
    set({ step: to, errors: {} });
    $(`[data-pane="${to}"] button, [data-pane="${to}"] input`)?.focus({ preventScroll: true });
  } else if ("reset" in d) {
    Object.assign(state, { step: 1, time: null, ref: null, name: "", phone: "", email: "", errors: {} });
    $("#booking").reset();
    render();
  } else if (b.id === "dock-go" && state.step === 3) {
    $("#booking").requestSubmit();
  } else if (d.go === "book" || b.id === "dock-go") {
    ev.preventDefault();
    goBook(state.step === 4 ? 4 : state.step);
  }
});
document.addEventListener("input", (ev) => {
  const k = ev.target.name;
  if (k in state) state[k] = ev.target.value;
});
$("#booking").addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (state.step !== 3) return;
  const e = validate();
  if (Object.keys(e).length) { set({ errors: e }); $(`#f-${Object.keys(e)[0]}`).focus(); return; }
  set({ step: 4, ref: reference(), errors: {} });
  $('[data-pane="4"]').focus({ preventScroll: true });
  $("#book").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
});

buildStatic();
// Test hooks for scripts/shoot.mjs.
Object.assign(window, { __model: model, __state: state, __set: set });
render();
