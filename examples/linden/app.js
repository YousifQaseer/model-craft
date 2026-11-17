// The Linden: ONE state object, ONE render(). The model, the controls, the
// sheet, the price and the booking flow all read state. A tap on the model
// calls set() exactly like a button does.

import { mountModel } from "./engine/mount.js";
import { createSheet } from "./engine/sheet.js";
import {
  TYPES, TYPE_ORDER, ROOMS, EXTRAS, roomById, roomsFor, typeFits, typeForGuests, maxGuests,
  activeRoom, fitsGuests, nightsBetween, price, money, bookingRef,
} from "./data.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function isoDay(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const TODAY = isoDay(0);

const state = {
  type: "king", guests: 2, theme: "day", pick: null, room: null,
  breakfast: false, parking: false, late: false,
  checkin: isoDay(14), checkout: isoDay(16),
  step: 1, name: "", email: "", phone: "", errors: {}, ref: null, note: "",
};

// ------------------------------------------------------------ the model --
const stage = $("#stage");
const model = mountModel(stage, {
  poster: "assets/poster.webp",
  posterAlt: "The Linden in section: a four-storey townhouse with the front wall off, a lobby and garage on the ground floor and eight guest rooms above.",
  // While render() runs, the engine may drop a selection that state already
  // dropped (model.update deselects an item that just dimmed and fires
  // onSelect(null) synchronously). Ignore that echo: state is the source.
  create: async (host) => (await import("./model.js")).build(host, { theme: state.theme, onSelect: (it) => { if (!rendering) set({ pick: it?.id ?? null }); } }),
});
const sheet = createSheet(stage, { onClose: () => set({ pick: null }), label: "Room details" });

// --------------------------------------------------------------- state --
function normalise(prev) {
  const s = state;
  s.guests = Math.min(4, Math.max(1, Math.round(Number(s.guests) || 1)));
  if (!TYPES[s.type]) s.type = "king";
  if (!typeFits(s.type, s.guests)) {
    const to = typeForGuests(s.type, s.guests);
    s.note = `No ${TYPES[s.type].name} sleeps ${s.guests}, so the ${TYPES[to].name} is shown.`;
    s.type = to;
  } else if (prev.type !== s.type || prev.guests !== s.guests) s.note = "";
  const ok = (id) => { const r = roomById(id); return r && r.type === s.type && fitsGuests(r, s.guests); };
  if (s.room && !ok(s.room)) s.room = null;
  if (s.pick && !ok(s.pick)) s.pick = null;
  if (!["day", "night"].includes(s.theme)) s.theme = "day";
}
function set(patch) {
  const prev = { ...state };
  Object.assign(state, patch);
  normalise(prev);
  render();
  return prev;
}
const nights = () => nightsBetween(state.checkin, state.checkout);
const quote = () => price({ type: state.type, guests: state.guests, nights: Math.max(1, nights()), breakfast: state.breakfast, parking: state.parking, late: state.late });
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// -------------------------------------------------------------- render --
let lastTheme = null, rendering = false;
function render() {
  rendering = true;
  try { draw(); } finally { rendering = false; }
}
function draw() {
  const s = state;
  const room = activeRoom(s);
  // Model: what it draws is a pure function of these fields.
  model.update({ type: s.type, guests: s.guests, room: s.room, pick: s.pick, breakfast: s.breakfast, parking: s.parking });
  if (s.theme !== lastTheme) { model.setTheme(s.theme); lastTheme = s.theme; }
  document.documentElement.classList.toggle("is-night", s.theme === "night");
  $('meta[name="theme-color"]').content = s.theme === "night" ? "#0F1526" : "#1D2740";
  model.select(s.pick);

  // Sheet for the tapped room.
  const r = roomById(s.pick);
  if (r) {
    const t = TYPES[r.type];
    const extraBed = s.guests >= 3 && r.extra ? (r.extra === "twin" ? "A twin daybed is made up for the third guest." : `The sofa bed is made up for ${s.guests === 4 ? "guests three and four" : "the third guest"}.`) : "";
    sheet.show({
      title: `Room ${r.no} · ${t.name}`,
      meta: `${t.bed} · floor ${r.level} · looks onto ${r.view}`,
      body: `<p class="sheet-rate"><b>${money(t.rate)}</b> a night<span>Sample pricing</span></p>
        <p class="sheet-facts">Sleeps up to ${r.max}. ${esc(extraBed)}</p>
        ${s.late ? `<p class="sheet-late">Late checkout: stay until 1 pm (+${money(35)})</p>` : ""}
        <div class="sheet-chips">
          <button type="button" data-toggle="breakfast" aria-pressed="${s.breakfast}">Breakfast tray</button>
          <button type="button" data-toggle="parking" aria-pressed="${s.parking}">Parking</button>
          <button type="button" data-toggle="late" aria-pressed="${s.late}">Late checkout</button>
        </div>
        <button type="button" class="btn btn--ink btn--wide" data-choose="${r.id}">${s.room === r.id ? "Chosen · continue to dates" : "Choose this room"}</button>`,
    });
  } else sheet.show(null);
  model.setInsets(sheet.inset());

  // Hero controls.
  $("#types").innerHTML = TYPE_ORDER.map((id) => {
    const t = TYPES[id], fits = typeFits(id, s.guests);
    return `<button type="button" class="type" data-type="${id}" aria-pressed="${s.type === id}" ${fits ? "" : "disabled"}>
      <b>${t.name}</b><small>${t.bed} · sleeps up to ${maxGuests(id)}</small>
      <span class="rate">${money(t.rate)}<span>a night, sample</span></span></button>`;
  }).join("");
  $("#type-note").textContent = s.note;
  for (const b of $$("[data-guests]")) b.setAttribute("aria-pressed", String(+b.dataset.guests === s.guests));
  for (const b of $$("[data-theme]")) b.setAttribute("aria-pressed", String(b.dataset.theme === s.theme));
  $("#extras").innerHTML = Object.entries(EXTRAS).map(([k, e]) => `<button type="button" class="extra" data-toggle="${k}" aria-pressed="${s[k]}">
      <span class="box" aria-hidden="true"></span><span class="what">${e.name}<small>${k === "late" ? "Shown on your room, not in the house" : k === "breakfast" ? "A tray on your bed each morning" : "A car in the garage bay"}</small></span>
      <span class="cost">${money(e.price)} <small>${e.per}</small></span></button>`).join("");
  $("#room-chips").innerHTML = roomsFor(s.type, s.guests).map((x) =>
    `<button type="button" class="chip${s.room === x.id ? " is-mine" : ""}" data-pick="${x.id}" aria-pressed="${s.pick === x.id}">Room ${x.no}${s.room === x.id ? " · yours" : ""}</button>`).join("");

  // Summary and live total (compared across 3D on/off and motion/reduced by shoot.mjs).
  const q = quote();
  const extras = [s.breakfast && "breakfast", s.parking && "parking", s.late && "late checkout"].filter(Boolean);
  $("#summary").textContent = `${TYPES[s.type].name} · ${s.room ? `Room ${roomById(s.room).no}` : room ? "any room of this type" : "no room fits"} · ${plural(s.guests, "guest")} · ${plural(q.nights, "night")}${extras.length ? " · " + extras.join(", ") : ""}`;
  $("#price").textContent = `${money(q.total)} total`;

  // Room cards.
  $("#room-cards").innerHTML = TYPE_ORDER.map((id) => {
    const t = TYPES[id], n = ROOMS.filter((x) => x.type === id).length;
    return `<article class="card" aria-current="${s.type === id}">
      <h3>${t.name}</h3>
      <p class="meta">${t.bed} · sleeps up to ${maxGuests(id)} · ${plural(n, "room")}</p>
      <p>${t.blurb}</p>
      <p class="from">${money(t.rate)} <span>a night · Sample pricing</span></p>
      <button type="button" class="btn btn--ghost btn--small" data-type="${id}" data-show>See it in the house</button>
    </article>`;
  }).join("");

  renderFlow();
}

// ------------------------------------------------------- booking flow --
const STEPS = ["Room", "Dates and guests", "Your details", "Review"];
let flowKey = "";
function renderFlow() {
  const s = state, q = quote(), n = nights();
  $("#steps").innerHTML = STEPS.map((label, i) => `<li ${s.step === i + 1 ? 'aria-current="step"' : ""} class="${s.step > i + 1 || s.step === "done" ? "is-done" : ""}">${label}</li>`).join("");
  const r = roomById(s.room);
  $("#aside").innerHTML = `
    <p>${TYPES[s.type].name}${r ? `, Room ${r.no}` : ""}</p>
    <p>${s.checkin && s.checkout ? `${fmtDate(s.checkin)} to ${fmtDate(s.checkout)} · ${plural(n, "night")}` : "Dates to choose"}</p>
    <p>${plural(s.guests, "guest")}${[s.breakfast && "breakfast", s.parking && "parking", s.late && "late checkout"].filter(Boolean).map((x) => " · " + x).join("")}</p>
    <p class="big">${money(q.total)}</p>
    <p>Including ${money(q.hst)} HST (13%). Sample pricing, CAD.</p>`;

  const key = JSON.stringify([s.step, s.type, s.guests, s.errors, s.ref]);
  const form = $("#flow");
  if (key === flowKey) { syncFlow(form); return; }
  flowKey = key;
  const focusId = form.contains(document.activeElement) ? document.activeElement.id : null;
  form.innerHTML = flowHTML();
  syncFlow(form);
  if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus({ preventScroll: true });
}

function fmtDate(iso) {
  const d = new Date(iso + "T12:00:00");
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" }) : iso;
}
const err = (k) => `<p class="err" id="${k}-err">${esc(state.errors[k] || "")}</p>`;

function flowHTML() {
  const s = state;
  if (s.step === "done") {
    const q = quote(), r = roomById(s.room);
    return `<div class="done" role="status">
      <p class="eyebrow eyebrow--ink">Demo booking confirmed</p>
      <p class="ref">${s.ref}</p>
      <p class="demo-note"><b>This is a demo.</b> Nothing was sent, no room is held and no card was charged. The Linden is a placeholder hotel.</p>
      <p>Room ${r ? r.no : ""}, ${TYPES[s.type].name}, ${fmtDate(s.checkin)} to ${fmtDate(s.checkout)}, ${plural(s.guests, "guest")}. Sample total ${money(q.total)} including HST.</p>
      <div class="nav"><button type="button" class="btn btn--ghost" data-restart>Start over</button></div>
    </div>`;
  }
  if (s.step === 1) {
    const list = roomsFor(s.type, s.guests);
    return `<h3>Choose your room</h3>
      <div class="field"><span class="lab" id="type-lab">Room type</span>
        <div class="pick-list" role="radiogroup" aria-labelledby="type-lab">${TYPE_ORDER.map((id) => `<label class="pick"><input type="radio" name="ftype" value="${id}" id="ftype-${id}" ${typeFits(id, s.guests) ? "" : "disabled"}>
          <span>${TYPES[id].name} · ${money(TYPES[id].rate)} a night<small>${TYPES[id].bed}, sleeps up to ${maxGuests(id)}${typeFits(id, s.guests) ? "" : ` (not for ${s.guests})`}</small></span></label>`).join("")}</div></div>
      <div class="field"><span class="lab" id="room-lab">Room (${plural(s.guests, "guest")})</span>
        <div class="pick-list" role="radiogroup" aria-labelledby="room-lab" aria-describedby="room-err">${list.map((x) => `<label class="pick"><input type="radio" name="froom" value="${x.id}" id="froom-${x.id}">
          <span>Room ${x.no}, floor ${x.level}<small>Looks onto ${x.view} · sleeps up to ${x.max}</small></span></label>`).join("")}</div>${err("room")}</div>
      <div class="nav"><span></span><button type="submit" class="btn btn--ink">Next: dates</button></div>`;
  }
  if (s.step === 2) {
    return `<h3>Dates and guests</h3>
      <div class="two">
        <div class="field"><label for="checkin">Check-in</label><input type="date" id="checkin" name="checkin" min="${TODAY}" aria-describedby="checkin-err">${err("checkin")}</div>
        <div class="field"><label for="checkout">Checkout</label><input type="date" id="checkout" name="checkout" min="${TODAY}" aria-describedby="checkout-err">${err("checkout")}</div>
      </div>
      <p class="fine" id="nights-out" aria-live="polite"></p>
      <div class="field"><label for="fguests">Guests</label><select id="fguests" name="guests">${[1, 2, 3, 4].map((g) => `<option value="${g}">${plural(g, "guest")}</option>`).join("")}</select></div>
      <div class="field"><span class="lab">Extras</span><div class="checks">${Object.entries(EXTRAS).map(([k, e]) => `<label class="check"><input type="checkbox" id="fx-${k}" data-extra="${k}"> ${e.name}, ${money(e.price)} ${e.per}</label>`).join("")}</div></div>
      <div class="nav"><button type="button" class="btn btn--ghost" data-back>Back</button><button type="submit" class="btn btn--ink">Next: your details</button></div>`;
  }
  if (s.step === 3) {
    return `<h3>Your details</h3>
      <div class="field"><label for="fname">Full name</label><input id="fname" name="name" autocomplete="name" aria-describedby="name-err">${err("name")}</div>
      <div class="field"><label for="femail">Email</label><input id="femail" name="email" type="email" autocomplete="email" inputmode="email" aria-describedby="email-err">${err("email")}</div>
      <div class="field"><label for="fphone">Phone (optional)</label><input id="fphone" name="phone" type="tel" autocomplete="tel" inputmode="tel" aria-describedby="phone-err">${err("phone")}</div>
      <div class="nav"><button type="button" class="btn btn--ghost" data-back>Back</button><button type="submit" class="btn btn--ink">Next: review</button></div>`;
  }
  const q = quote(), r = roomById(s.room);
  return `<h3>Review</h3>
    <div class="review"><dl>
      <div><dt>Room</dt><dd>Room ${r ? r.no : "?"}, ${TYPES[s.type].name}</dd></div>
      <div><dt>Dates</dt><dd>${fmtDate(s.checkin)} to ${fmtDate(s.checkout)} (${plural(q.nights, "night")})</dd></div>
      <div><dt>Guests</dt><dd>${plural(s.guests, "guest")}</dd></div>
      <div><dt>Name</dt><dd>${esc(s.name)}, ${esc(s.email)}${s.phone ? ", " + esc(s.phone) : ""}</dd></div>
    </dl></div>
    <table class="lines"><tbody>
      ${q.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${money(l.amount)}</td></tr>`).join("")}
      <tr><td>Subtotal</td><td>${money(q.subtotal)}</td></tr>
      <tr><td>HST (13%)</td><td>${money(q.hst)}</td></tr>
      <tr class="total"><td>Total (CAD, sample pricing)</td><td>${money(q.total)}</td></tr>
    </tbody></table>
    <p class="demo-note">This is a demo booking. Confirming sends nothing and holds no room.</p>
    <div class="nav"><button type="button" class="btn btn--ghost" data-back>Back</button><button type="submit" class="btn btn--brass">Confirm demo booking</button></div>`;
}

// Keep inputs in step with state without rebuilding (so typing keeps focus).
function syncFlow(form) {
  const s = state;
  const v = (id, val) => { const el = form.querySelector("#" + id); if (el && el.value !== String(val) && document.activeElement !== el) el.value = val; };
  for (const el of form.querySelectorAll('input[name="ftype"]')) el.checked = el.value === s.type;
  for (const el of form.querySelectorAll('input[name="froom"]')) el.checked = el.value === s.room;
  v("checkin", s.checkin); v("checkout", s.checkout); v("fguests", s.guests);
  v("fname", s.name); v("femail", s.email); v("fphone", s.phone);
  for (const el of form.querySelectorAll("[data-extra]")) el.checked = Boolean(s[el.dataset.extra]);
  for (const [k, id] of [["name", "fname"], ["email", "femail"], ["checkin", "checkin"], ["checkout", "checkout"]]) {
    const el = form.querySelector("#" + id);
    if (el) el.setAttribute("aria-invalid", String(Boolean(s.errors[k])));
  }
  const no = form.querySelector("#nights-out");
  if (no) { const n = nights(); no.textContent = n > 0 ? `${plural(n, "night")}, ${fmtDate(s.checkin)} to ${fmtDate(s.checkout)}` : "Checkout must be after check-in."; }
}

function validate(step) {
  const s = state, e = {};
  if (step === 1 && !s.room) e.room = "Choose a room to continue.";
  if (step === 2) {
    if (!s.checkin || s.checkin < TODAY) e.checkin = "Choose a check-in date from today on.";
    if (nights() < 1) e.checkout = "Checkout must be at least one night after check-in.";
    else if (nights() > 21) e.checkout = "For stays over three weeks, please call the desk.";
  }
  if (step === 3) {
    if (s.name.trim().length < 2) e.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) e.email = "Please enter an email like name@example.com.";
    if (s.phone && s.phone.replace(/\D/g, "").length < 10) e.phone = "A phone number needs at least 10 digits, or leave it empty.";
  }
  return e;
}

function next() {
  const e = validate(state.step);
  if (Object.keys(e).length) {
    set({ errors: e });
    const first = $("#flow [aria-invalid='true'], #flow .err:not(:empty)");
    (first?.previousElementSibling?.matches?.("input,select,.pick-list") ? first.previousElementSibling : $("#flow input"))?.focus?.();
    return;
  }
  if (state.step === 4) { set({ step: "done", ref: bookingRef(), errors: {} }); $("#flow").scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" }); return; }
  set({ step: state.step + 1, errors: {} });
  $("#flow input, #flow select")?.focus({ preventScroll: true });
}

// --------------------------------------------------------------- input --
let lastBreakfast = false;
function toggleExtra(k, on = !state[k]) {
  set({ [k]: on });
  if (k === "breakfast" && on && !lastBreakfast) {
    const r = activeRoom(state);
    if (r) model.play("breakfast", r.id);
  }
  lastBreakfast = state.breakfast;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button, a");
  if (!b) return;
  const d = b.dataset;
  if (d.type) {
    set({ type: d.type, pick: null });
    if ("show" in d) $("#top").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
  }
  if (d.guests) set({ guests: +d.guests });
  if (d.theme) set({ theme: d.theme });
  if (d.toggle) toggleExtra(d.toggle);
  if (d.pick) set({ pick: state.pick === d.pick ? null : d.pick });
  if (d.choose) {
    set({ room: d.choose, pick: null, step: state.step === "done" ? 2 : Math.max(2, Number(state.step) || 1), errors: {} });
    $("#book").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
  }
  if ("goBook" in d && state.room && state.step === 1) set({ step: 2 });
  if ("back" in d) set({ step: Math.max(1, state.step - 1), errors: {} });
  if ("restart" in d) set({ step: 1, ref: null, errors: {}, name: "", email: "", phone: "" });
});

const flow = $("#flow");
flow.addEventListener("submit", (e) => { e.preventDefault(); next(); });
flow.addEventListener("change", (e) => {
  const el = e.target;
  if (el.name === "ftype") set({ type: el.value });
  if (el.name === "froom") set({ room: el.value, errors: {} });
  if (el.id === "checkin") {
    const patch = { checkin: el.value };
    if (nightsBetween(el.value, state.checkout) < 1 && el.value) { const d = new Date(el.value + "T12:00:00"); d.setDate(d.getDate() + 2); patch.checkout = d.toISOString().slice(0, 10); }
    set(patch);
  }
  if (el.id === "checkout") set({ checkout: el.value });
  if (el.id === "fguests") set({ guests: +el.value });
  if (el.dataset.extra) toggleExtra(el.dataset.extra, el.checked);
});
flow.addEventListener("input", (e) => {
  const el = e.target;
  const k = { fname: "name", femail: "email", fphone: "phone" }[el.id];
  if (k) { state[k] = el.value; if (state.errors[k]) { const er = { ...state.errors }; delete er[k]; set({ errors: er }); } }
});

// Test hooks for scripts/shoot.mjs.
Object.assign(window, { __model: model, __state: state, __set: set });
render();
