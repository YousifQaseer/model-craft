// Salt Table: one state object, one render(). The room, the controls, the sheet,
// the extras and the reservation all read from state.

import { mountModel } from "./engine/mount.js";
import { createSheet } from "./engine/sheet.js";
import { TABLES, fits, SERVICES, OCCASIONS, TASTING, DEPOSIT, price, money } from "./data.js";

const state = {
  party: 2, service: "lunch", day: null, time: null, pick: null, occasion: "none", tasting: false,
  step: "details", name: "", email: "", phone: "", notes: "", errors: {}, ref: null,
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const tableOf = (id) => TABLES.find((t) => t.id === id);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const stage = $("#stage");
const model = mountModel(stage, {
  poster: "assets/poster.webp",
  posterAlt: "The Salt Table dining room in miniature: eight oak tables, a bar and olive trees.",
  create: async (host) => (await import("./model.js")).build(host, { theme: state.service, onSelect: (it) => set({ pick: it?.id ?? null }) }),
});
const sheet = createSheet(stage, { onClose: () => set({ pick: null }), label: "Table details" });

function set(patch) { Object.assign(state, patch); render(); }

const DAYS = (() => {
  const out = [], d = new Date();
  for (let i = 0; out.length < 7; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    if (x.getDay() === 1) continue; // closed Mondays
    out.push({ id: x.toISOString().slice(0, 10), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : x.toLocaleDateString("en-CA", { weekday: "short", day: "numeric" }) });
  }
  return out;
})();
state.day = DAYS[0].id;

let lastTheme = null;
function render() {
  if (state.pick && !fits(tableOf(state.pick), state.party)) state.pick = null;
  if (state.time && !SERVICES[state.service].times.includes(state.time)) state.time = null;
  const P = price(state);
  model.update({ party: state.party, pick: state.pick, occasion: state.occasion });
  if (state.service !== lastTheme) { model.setTheme(state.service); lastTheme = state.service; }
  model.select(state.pick);

  $("#party-out").textContent = state.party;
  $("#party-minus").disabled = state.party <= 1;
  $("#party-plus").disabled = state.party >= 8;
  for (const b of $$("[data-service]")) b.setAttribute("aria-checked", String(b.dataset.service === state.service));
  $("#days").innerHTML = DAYS.map((d) => `<button type="button" class="chip" data-day="${d.id}" aria-pressed="${state.day === d.id}">${esc(d.label)}</button>`).join("");
  $("#times").innerHTML = SERVICES[state.service].times.map((t) => `<button type="button" class="chip" data-time="${t}" aria-pressed="${state.time === t}">${t}</button>`).join("");
  const ok = TABLES.filter((t) => fits(t, state.party));
  $("#tables").innerHTML = ok.map((t) => `<button type="button" class="chip chip--table" data-table="${t.id}" aria-pressed="${state.pick === t.id}"><b>${t.n}</b> ${esc(t.spot)}<span>${t.seats} seats</span></button>`).join("");
  $("#tables-note").textContent = `${ok.length} table${ok.length === 1 ? "" : "s"} fit a party of ${state.party}. Tap one in the room or here.`;
  for (const b of $$("[data-occasion]")) b.setAttribute("aria-checked", String(b.dataset.occasion === state.occasion));
  $("#tasting").checked = state.tasting;
  $("#tasting-price").textContent = `${money(TASTING)} a guest · ${money(TASTING * state.party)} for ${state.party}`;

  // Summary and the money.
  const t = tableOf(state.pick);
  const day = DAYS.find((d) => d.id === state.day);
  const summary = `${state.party} ${state.party === 1 ? "guest" : "guests"} · ${SERVICES[state.service].label}${day ? " · " + day.label : ""}${state.time ? " " + state.time : ""}${t ? ` · Table ${t.n}` : ""}`;
  for (const el of $$("[data-check=summary]")) el.textContent = summary;
  for (const el of $$("[data-check=price]")) el.textContent = `Extras ${money(P.extras)} · Deposit ${money(P.deposit)}`;
  const missing = [!state.time && "a time", !t && "a table"].filter(Boolean);
  $("#to-reserve").disabled = missing.length > 0;
  $("#to-reserve-note").textContent = missing.length ? `Pick ${missing.join(" and ")} to reserve.` : "Ready when you are.";

  // The sheet for the tapped table.
  sheet.show(t ? { title: `Table ${t.n}`, meta: `${t.spot} · seats ${t.seats}`,
    body: `<p class="sheet-note">${esc(t.note)}</p><div class="sheet-row"><span>${state.time ? esc(state.time) : "Pick a time"}</span>
      <button type="button" class="btn btn--sm" data-go="reserve" ${state.time ? "" : "disabled"}>Reserve table ${t.n}</button></div>` } : null);
  model.setInsets(sheet.inset());

  renderReserve(P, summary);
}

function renderReserve(P, summary) {
  for (const pane of $$("[data-pane]")) pane.hidden = pane.dataset.pane !== state.step;
  const steps = ["details", "review", "done"];
  for (const li of $$(".steps li")) li.classList.toggle("is-on", steps.indexOf(li.dataset.step) <= steps.indexOf(state.step));
  $("#res-summary").textContent = summary;
  for (const k of ["name", "email", "phone"]) {
    $(`#err-${k}`).textContent = state.errors[k] || "";
    $(`#f-${k}`).setAttribute("aria-invalid", String(Boolean(state.errors[k])));
  }
  $("#review").innerHTML = `<dl class="facts"><dt>Booking</dt><dd>${esc(summary)}</dd>
    <dt>Occasion</dt><dd>${esc(OCCASIONS[state.occasion].label)}</dd>
    <dt>Name</dt><dd>${esc(state.name)}</dd><dt>Email</dt><dd>${esc(state.email)}</dd><dt>Phone</dt><dd>${esc(state.phone)}</dd>
    ${state.notes ? `<dt>Notes</dt><dd>${esc(state.notes)}</dd>` : ""}</dl>
    <table class="bill">${P.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${money(l.amount)}</td></tr>`).join("")}
    <tr><td>Extras, added to your bill</td><td>${money(P.extras)}</td></tr>
    <tr class="dep"><td>Deposit today (${money(DEPOSIT)} a guest, taken off your bill)</td><td>${money(P.deposit)}</td></tr></table>`;
  $("#ref").textContent = state.ref || "";
  $("#done-summary").textContent = summary;
}

function validate() {
  const e = {};
  if (!state.name.trim()) e.name = "Add the name for the booking.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) e.email = "That email doesn't look right.";
  if (state.phone.replace(/\D/g, "").length < 10) e.phone = "Add a 10-digit phone number.";
  return e;
}

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (b.id === "party-minus") set({ party: Math.max(1, state.party - 1) });
  else if (b.id === "party-plus") set({ party: Math.min(8, state.party + 1) });
  else if (d.service) set({ service: d.service });
  else if (d.day) set({ day: d.day });
  else if (d.time) set({ time: d.time });
  else if (d.table) set({ pick: state.pick === d.table ? null : d.table });
  else if (d.occasion) {
    set({ occasion: d.occasion });
    if (state.pick && d.occasion !== "none") model.play("dress", state.pick);
  } else if (d.go === "reserve") {
    set({ pick: state.pick, step: state.step === "done" ? "details" : state.step });
    $("#reserve").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
  } else if (d.step) set({ step: d.step });
});
$("#tasting").addEventListener("change", (e) => set({ tasting: e.target.checked }));
$("#to-reserve").addEventListener("click", () => $("#reserve").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }));
for (const k of ["name", "email", "phone", "notes"]) $(`#f-${k}`).addEventListener("input", (e) => { state[k] = e.target.value; if (state.errors[k]) set({ errors: { ...state.errors, [k]: undefined } }); });
$("#details-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const errors = validate();
  if (!state.time || !state.pick) errors.choice = true;
  set({ errors, step: Object.keys(errors).length ? "details" : "review" });
  if (errors.choice) { $("#need-choice").hidden = false; $("#book").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); }
  else if (Object.keys(errors).length) $(`#f-${Object.keys(errors)[0]}`).focus();
});
$("#confirm").addEventListener("click", () => {
  set({ step: "done", ref: "ST-" + Math.random().toString(36).slice(2, 8).toUpperCase() });
  $("#reserve").scrollIntoView({ block: "start" });
});

Object.assign(window, { __model: model, __state: state, __set: set });
render();
