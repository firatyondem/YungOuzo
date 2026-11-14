// Screen switching + the shared overlay.
import { $, $$ } from "./dom.js";

export function showScreen(name) {
  for (const s of $$(".screen")) s.hidden = s.id !== `screen-${name}`;
  const boot = $("#boot");
  if (boot) boot.hidden = true;
  document.body.dataset.screen = name;
}

export function currentScreen() {
  return document.body.dataset.screen || "";
}

export function showOverlay(html, cls = "") {
  const o = $("#overlay");
  o.className = `overlay ${cls}`;
  o.innerHTML = `<div class="overlay-box">${html}</div>`;
  o.hidden = false;
  return o;
}

export function hideOverlay() {
  const o = $("#overlay");
  o.hidden = true;
  o.innerHTML = "";
}
