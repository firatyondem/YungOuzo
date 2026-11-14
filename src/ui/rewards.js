// Reward screen: pick one of three (new card / new player / rating upgrade).
import { applyReward } from "../engine/rewards.js";
import { getTeam } from "../engine/rules.js";
import { $, $$, esc, ARCHETYPE_LABEL } from "./dom.js";
import { cardHTML } from "./cards.js";
import { playerCardHTML } from "./playerCard.js";

const RATING_NAME = { SHT: "Shooting", INS: "Inside scoring", DEF: "Defense", PLY: "Playmaking" };

export function renderRewards(app) {
  const run = app.run;
  const host = $("#screen-reward");
  const content = run.content;
  const last = run.results[run.results.length - 1];
  const beaten = run.match ? getTeam(run) : null;

  const panels = run.rewards.map((opt, i) => {
    if (opt.kind === "card") {
      const card = content.cards[opt.cardId];
      return `
        <div class="reward" data-index="${i}">
          <div class="reward-kind">NEW CARD</div>
          <div class="reward-body">${cardHTML(card)}</div>
          <div class="reward-desc">Add <b>${esc(card.name)}</b> to your deck.</div>
          <button class="btn btn-primary reward-btn">ADD CARD</button>
        </div>`;
    }
    if (opt.kind === "player") {
      const p = content.players[opt.playerId];
      return `
        <div class="reward" data-index="${i}">
          <div class="reward-kind">NEW PLAYER</div>
          <div class="reward-body">${playerCardHTML(p, content)}</div>
          <div class="reward-desc">Sign <b>${esc(p.name)}</b>. Replaces one starter and brings two signature cards.</div>
          <button class="btn btn-primary reward-btn">SIGN PLAYER</button>
        </div>`;
    }
    const p = run.lineup.find((x) => x.id === opt.playerId);
    const from = p.ratings[opt.rating];
    return `
      <div class="reward" data-index="${i}">
        <div class="reward-kind">TRAINING</div>
        <div class="reward-body">
          <div class="upgrade" style="--pc:${p.color}">
            <span class="upgrade-num">${p.jersey}</span>
            <div class="upgrade-name">${esc(p.name)}</div>
            <div class="upgrade-rating">${opt.rating} <s>${from}</s> → <b>${from + opt.amount}</b></div>
            <div class="upgrade-what">${RATING_NAME[opt.rating]}</div>
          </div>
        </div>
        <div class="reward-desc">+${opt.amount} ${opt.rating} for <b>${esc(p.name)}</b>, permanently.</div>
        <button class="btn btn-primary reward-btn">TRAIN</button>
      </div>`;
  });

  host.innerHTML = `
    <div class="page">
      <header class="page-head">
        <h1 class="gold">${beaten ? esc(beaten.name.toUpperCase()) + " BEATEN" : "VICTORY"}${last ? ` <span>${last.player}–${last.opp}</span>` : ""}</h1>
        <p>Choose one reward to strengthen your team for the next game.</p>
      </header>
      <div class="rewards">${panels.join("")}</div>
      <div class="page-actions"><button class="btn btn-ghost btn-small" id="reward-skip">Skip reward</button></div>
    </div>`;

  for (const el of $$(".reward", host)) {
    const index = Number(el.dataset.index);
    $(".reward-btn", el).addEventListener("click", () => {
      const opt = run.rewards[index];
      if (opt.kind === "player") renderSlotPicker(app, index);
      else {
        applyReward(run, index);
        app.sfx("swish");
        app.goMap();
      }
    });
  }
  $("#reward-skip", host).addEventListener("click", () => {
    app.skipReward();
  });
}

function renderSlotPicker(app, index) {
  const run = app.run;
  const content = run.content;
  const host = $("#screen-reward");
  const incoming = content.players[run.rewards[index].playerId];
  host.innerHTML = `
    <div class="page">
      <header class="page-head">
        <h1>WHO SITS OUT?</h1>
        <p>Pick the starter that <b>${esc(incoming.name)}</b> (${esc(ARCHETYPE_LABEL[incoming.archetype])}) replaces. Their signature cards leave your deck.</p>
      </header>
      <div class="picker">
        <div class="picker-in">${playerCardHTML(incoming, content, { tag: "INCOMING" })}</div>
        <div class="picker-arrow">⇄</div>
        <div class="pc-row">${run.lineup.map((p, i) => playerCardHTML(p, content, { slot: i, action: "REPLACE" })).join("")}</div>
      </div>
      <div class="page-actions"><button class="btn btn-small" id="picker-back">← BACK</button></div>
    </div>`;
  for (const el of $$(".pcard[data-slot]", host)) {
    el.classList.add("clickable");
    el.addEventListener("click", () => {
      applyReward(run, index, { slot: Number(el.dataset.slot) });
      app.sfx("swish");
      app.goMap();
    });
  }
  $("#picker-back", host).addEventListener("click", () => renderRewards(app));
}
