// Card rendering: hand cards with live cost / playability / shot %.
import { calcShot, canPlay, getCard, getCardCost, getShootEffect } from "../engine/rules.js";
import { $, esc, lastName } from "./dom.js";

export const TYPE_ICON = { Offense: "⚡", Shot: "🏀", Defense: "🛡️", Buff: "🔥", Utility: "⏱️" };

/**
 * Generic card face. opts: { iid, cost, baseCost, playable, reason, pct, sub, owner, hotkey }
 */
export function cardHTML(card, opts = {}) {
  const type = card.type.toLowerCase();
  const cost = opts.cost ?? card.cost;
  const cls = ["card", `type-${type}`];
  if (opts.playable === false) cls.push("unplayable");
  if (opts.playable === true) cls.push("playable");
  const shoot = getShootEffect(card);
  const costCls = opts.baseCost != null && cost < opts.baseCost ? "card-cost discounted" : "card-cost";
  const art =
    opts.pct != null
      ? `<div class="card-pct"><b>${Math.round(opts.pct)}%</b><span>${shoot.points}PT${opts.sub ? " · " + esc(opts.sub) : ""}</span></div>`
      : `<div class="card-art">${shoot ? `<b class="pts">${shoot.points}PT</b>` : TYPE_ICON[card.type] || "🏀"}</div>`;
  return `
    <div class="${cls.join(" ")}" ${opts.iid ? `data-iid="${opts.iid}"` : ""} data-type="${esc(card.type)}"
         ${opts.reason ? `data-reason="${esc(opts.reason)}"` : ""}>
      <div class="card-top">
        <span class="${costCls}" title="Shot-clock seconds">${cost}</span>
        <span class="card-type">${esc(card.type)}</span>
      </div>
      <div class="card-name">${esc(card.name)}</div>
      ${art}
      <div class="card-text">${esc(card.text || "")}</div>
      <div class="card-foot">
        <span class="card-owner">${opts.owner ? esc(opts.owner) : ""}</span>
        ${opts.hotkey ? `<span class="card-key">${opts.hotkey}</span>` : ""}
      </div>
      ${opts.reason ? `<div class="card-reason">${esc(opts.reason)}</div>` : ""}
      ${opts.tip ? `<div class="card-tip">${opts.tip}</div>` : ""}
    </div>`;
}

/** "45 base +13 open +25 INS -5 DEF" breakdown shown when hovering a shot card. */
function shotTip(s) {
  const r = Math.round;
  let t = `${s.base} <i>base</i> +${r(s.openness)} <i>open</i> +${s.ratingBonus} <i>${s.ratingKey}</i> −${s.defense} <i>DEF</i>`;
  if (s.bonus) t += ` +${r(s.bonus)} <i>bonus</i>`;
  return t;
}

export function renderHand(app) {
  const run = app.run;
  const m = run.match;
  const host = $("#g-hand");
  host.classList.toggle("crowded", m.hand.length > 6);
  host.classList.toggle("packed", m.hand.length > 8);
  host.innerHTML = m.hand
    .map((inst, i) => {
      const card = getCard(run, inst);
      const check = canPlay(run, inst.iid);
      const shot = calcShot(run, inst);
      const owner = run.lineup.find((p) => p.id === inst.source);
      return cardHTML(card, {
        iid: inst.iid,
        cost: getCardCost(run, card),
        baseCost: card.cost,
        playable: check.ok,
        reason: check.ok ? "" : check.reason,
        pct: shot ? shot.pct : null,
        sub: shot ? lastName(shot.shooter.name) : "",
        tip: shot ? shotTip(shot) : "",
        owner: owner ? `#${owner.jersey} ${lastName(owner.name)}` : "",
        hotkey: i < 9 ? i + 1 : "",
      });
    })
    .join("");
}
