// Card rendering. Anatomy (see DESIGN.md): type band, cost badge, art window
// (procedural play diagram), name, effect text with keyword chips, live % badge,
// owner strip. Used for the hand, rewards, deck viewer, how-to and title fan.
import { calcShot, canPlay, getCard, getCardCost, getShootEffect } from "../engine/rules.js";
import { $, esc, lastName } from "./dom.js";
import { avatarHTML } from "./avatar.js";
import { icon, TYPE_ICON } from "./icons.js";
import { playDiagramSVG } from "./playDiagram.js";

export const TYPE_COLOR = {
  Offense: "#2EA8FF",
  Shot: "#FF3B3B",
  Defense: "#1FD18A",
  Buff: "#9B5CFF",
  Utility: "#9B5CFF",
  Hustle: "#FFB800",
  Status: "#A9B8D6",
};

// Keywords become small coloured chips with a tooltip.
const KEYWORDS = {
  Openness: ["kw-openness", "Openness: every point adds +1% to your next shot"],
  Contest: ["kw-contest", "Contest: subtracted from the opponent's next shot %"],
  Pass: ["kw-pass", "Pass: a card with the Pass tag"],
  Drive: ["kw-drive", "Drive: a card with the Drive tag"],
  Exhaust: ["kw-exhaust", "Exhaust: leaves your deck for the rest of this game after one use"],
  Fatigue: ["kw-fatigue", "Fatigue: adds a Tired Legs card to your deck for this game. It does nothing and costs 8s to clear"],
  Miss: ["kw-risk", "Risk: this card punishes you if it fails"],
  turnover: ["kw-risk", "Turnover: their next play gets easier"],
};
const TOKEN = /(\bOpenness\b|\bContest\b|\bPass\b|\bDrive\b|\bExhaust\b|\bFatigue\b|\bMiss\b|\bturnover\b|[+−-]?\d+%?(?:PT|s\b)?)/;

/** Effect text -> HTML: key numbers bold + coloured, keywords as chips. */
export function richText(text) {
  return String(text || "")
    .split(TOKEN)
    .map((part) => {
      if (!part) return "";
      if (KEYWORDS[part]) return `<span class="kw ${KEYWORDS[part][0]}" title="${esc(KEYWORDS[part][1])}">${part}</span>`;
      if (/^[+−-]?\d/.test(part)) return `<b class="num">${esc(part)}</b>`;
      return esc(part);
    })
    .join("");
}

export function pctClass(pct) {
  return pct < 35 ? "pct-red" : pct <= 60 ? "pct-yellow" : "pct-green";
}

const nameClass = (name) => (name.length <= 12 ? "" : name.length <= 14 ? "nm-m" : name.length <= 16 ? "nm-s" : "nm-xs");

/**
 * Card face. opts: { iid, cost, baseCost, playable, reason, pct, bump, performer (player),
 *                    hotkey, tip, index (fan position), dealt (deal order), actorId }
 */
export function cardHTML(card, opts = {}) {
  const type = card.type || "Utility";
  const color = TYPE_COLOR[type] || TYPE_COLOR.Utility;
  const cost = opts.cost ?? card.cost;
  const shoot = getShootEffect(card);
  const cls = ["card", `type-${type.toLowerCase()}`, `rar-${card.rarity || "common"}`];
  if (opts.playable === false) cls.push("unplayable");
  if (opts.playable === true) cls.push("playable");
  if (opts.dealt != null) cls.push("dealt");
  const style = [];
  if (opts.index != null) style.push(`--i:${opts.index}`);
  if (opts.dealt != null) style.push(`--d:${opts.dealt}`);
  const discounted = opts.baseCost != null && cost < opts.baseCost;
  const raised = opts.baseCost != null && cost > opts.baseCost;
  if (opts.held) cls.push("held");

  let pct = "";
  if (opts.pct != null) {
    const v = Math.round(opts.pct);
    pct = `<div class="card-pct ${pctClass(v)}${opts.bump ? " bump" : ""}" title="Chance to make this shot right now">${v}%<small>${shoot.points}PT</small></div>`;
  } else if (shoot) {
    pct = `<div class="card-pct">${shoot.points}PT</div>`;
  }

  const who = opts.performer;
  const owner = who
    ? `${avatarHTML(who, { size: "xs" })}<span class="owner-name">#${esc(who.jersey)} ${esc(lastName(who.name))}</span>`
    : `<span class="owner-name">Team play</span>`;

  return `
    <div class="${cls.join(" ")}" ${opts.iid ? `data-iid="${opts.iid}"` : ""} data-type="${esc(type)}"
         ${opts.actorId ? `data-actor="${esc(opts.actorId)}"` : ""} ${style.length ? `style="${style.join(";")}"` : ""}>
      <div class="card-cost${discounted ? " discounted" : raised ? " raised" : ""}" title="Costs ${cost} seconds of the 24-second shot clock">${cost}<small>s</small></div>
      <div class="card-frame">
        <div class="card-band">${icon(TYPE_ICON[type] || "utility")}<span>${esc(card.category || type)}</span></div>
        <div class="card-art">${playDiagramSVG(card, color)}</div>
        <div class="card-name ${nameClass(card.name)}">${esc(card.name)}</div>
        <div class="card-text">${richText(card.text)}</div>
        <div class="card-owner">${owner}${opts.hotkey ? `<span class="card-key">${opts.hotkey}</span>` : ""}</div>
      </div>
      ${pct}
      ${opts.playable === false && opts.reason ? `<div class="card-lock">${icon("lock")}${esc(opts.reason)}</div>` : ""}
      ${opts.holdable ? `<button class="card-hold${opts.held ? " on" : ""}" data-hold="${opts.iid}" title="Hold: keep this card for next turn instead of discarding it (1 card)">${opts.held ? "HELD" : "HOLD"}</button>` : ""}
      ${opts.tip ? `<div class="card-tip">${opts.tip}</div>` : ""}
    </div>`;
}

/** "45 base +13 open +25 INS -5 DEF" breakdown shown when hovering a shot card. */
function shotTip(s) {
  const r = Math.round;
  let t = `${s.base} <i>base</i> +${r(s.openness)} <i>open</i> +${s.ratingBonus} <i>${s.ratingKey}</i> −${s.defense} <i>DEF</i>`;
  if (s.bonus) t += ` ${s.bonus > 0 ? "+" : "−"}${r(Math.abs(s.bonus))} <i>bonus</i>`;
  for (const n of s.notes || []) {
    t += n.value != null ? ` ${n.value > 0 ? "+" : "−"}${r(Math.abs(n.value))} <i>${esc(n.label)}</i>` : ` <i>${esc(n.label)}: ${esc(n.text)}</i>`;
  }
  return t;
}

/** Short lock label: "Need 6s" for the shot clock, otherwise the rule that blocks it. */
function lockLabel(reason, cost) {
  if (/shot clock/i.test(reason)) return `Need ${cost}s`;
  if (/one shot/i.test(reason)) return "Shot taken";
  if (/opponent miss/i.test(reason)) return "After a stop";
  if (/you miss/i.test(reason)) return "After a miss";
  const needs = /Needs a (\w+)/.exec(reason);
  if (needs) return `Needs a ${needs[1]}`;
  return reason;
}

// Remembered between renders: which cards were already in hand, and their last %.
let seenIids = new Set();
let lastPct = new Map();

export function resetHandMemory() {
  seenIids = new Set();
  lastPct = new Map();
}

export function renderHand(app) {
  const run = app.run;
  const m = run.match;
  const host = $("#g-hand");
  const n = m.hand.length;
  const mid = (n - 1) / 2;
  let dealt = 0;
  const nextSeen = new Set();
  const nextPct = new Map();

  host.innerHTML = m.hand
    .map((inst, i) => {
      const card = getCard(run, inst);
      const check = canPlay(run, inst.iid);
      const shot = calcShot(run, inst);
      const cost = getCardCost(run, card);
      const owner = run.lineup.find((p) => p.id === inst.source);
      const performer = shot ? shot.shooter : owner || null;
      const pct = shot ? Math.round(shot.pct) : null;
      const isNew = !seenIids.has(inst.iid);
      nextSeen.add(inst.iid);
      if (pct != null) nextPct.set(inst.iid, pct);
      return cardHTML(card, {
        iid: inst.iid,
        cost,
        baseCost: card.cost,
        playable: check.ok,
        reason: check.ok ? "" : lockLabel(check.reason, cost),
        pct,
        bump: pct != null && lastPct.has(inst.iid) && lastPct.get(inst.iid) !== pct,
        performer,
        actorId: performer ? performer.id : "",
        tip: shot ? shotTip(shot) : "",
        hotkey: i < 9 ? i + 1 : "",
        holdable: !card.status && (run.config.HOLD_MAX ?? 0) > 0,
        held: (m.held || []).includes(inst.iid),
        index: Math.round((i - mid) * 100) / 100,
        dealt: isNew ? dealt++ : null,
      });
    })
    .join("");
  seenIids = nextSeen;
  lastPct = nextPct;
  layoutHand(host);
}

/** Overlap the cards just enough to fit the row (CSS px, unaffected by zoom). */
export function layoutHand(host = $("#g-hand")) {
  const cards = host.children;
  const n = cards.length;
  if (!n) return;
  const cw = cards[0].offsetWidth || 180;
  const avail = host.clientWidth - 24;
  const gap = 10;
  const natural = n * cw + (n - 1) * gap;
  const ov = natural <= avail || n < 2 ? gap : Math.max(-cw * 0.62, (avail - n * cw) / (n - 1));
  host.style.setProperty("--ov", `${Math.floor(ov)}px`);
}
