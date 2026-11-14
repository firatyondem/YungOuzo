// Tiny DOM helpers shared by the UI modules.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const lastName = (name) => String(name).split(" ").slice(-1)[0];

export const ARCHETYPE_LABEL = {
  Sniper: "Sniper",
  Slasher: "Slasher",
  Big: "Big",
  FloorGeneral: "Floor General",
  Lockdown: "Lockdown",
};
