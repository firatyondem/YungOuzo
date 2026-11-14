// Reward screen. Every choice costs something: a new card makes the deck bigger,
// an upgrade brings no new tool, a cut removes an option, a deal has a price,
// a signing replaces a starter. The deck size and what the deck lacks are shown
// on top so the choice can be made without opening anything else.
import { applyReward, deckSummary, upgradable, removable } from "../engine/rewards.js";
import { getCard, getTeam } from "../engine/rules.js";
import { $, $$, esc, ARCHETYPE_LABEL } from "./dom.js";
import { cardHTML } from "./cards.js";
import { playerCardHTML } from "./playerCard.js";
import { icon } from "./icons.js";

/** Deck size, mix and the one thing it lacks. Also used by the deck viewer. */
export function deckBarHTML(run) {
  const d = deckSummary(run);
  const chip = (label, n) => `<span class="deck-chip"><b>${n}</b>${esc(label)}</span>`;
  return `
    <div class="deck-bar">
      <div class="deck-size" title="Cards in your deck. You draw 5 a turn: the bigger the deck, the less often you see each card."><b>${d.size}</b><span>CARDS IN DECK</span></div>
      <div class="deck-mix">
        <div class="deck-chips">${chip("Setup", d.byCategory.Setup)}${chip("Finishing", d.byCategory.Finishing)}${chip("Defensive", d.byCategory.Defensive)}${chip("High-risk", d.byCategory["High-risk"])}<span class="deck-lean">Style: <b>${esc(d.leanName)}</b></span></div>
        <div class="deck-hint ${d.lacks.length ? "lack" : ""}">${icon(d.lacks.length ? "mismatch" : "check")}${esc(d.hint)}</div>
      </div>
    </div>`;
}

export function renderRewards(app) {
  const run = app.run;
  const host = $("#screen-reward");
  const content = run.content;
  const last = run.results[run.results.length - 1];
  const beaten = run.match ? getTeam(run) : null;
  const size = run.deck.length;
  const off = run.config.UPGRADE_DISCOUNT ?? 4;

  const panels = run.rewards.map((opt, i) => {
    if (opt.kind === "card") {
      const card = content.cards[opt.cardId];
      return `
        <div class="reward" data-index="${i}">
          <div class="reward-kind">${icon("deck")}NEW CARD</div>
          <div class="reward-body">${cardHTML(card)}</div>
          <div class="reward-desc">Add <b>${esc(card.name)}</b>.<em>Price: deck ${size} → ${size + 1}, you see every card less often.</em></div>
          <button class="btn btn-primary reward-btn">ADD CARD</button>
        </div>`;
    }
    if (opt.kind === "upgrade") {
      return `
        <div class="reward" data-index="${i}">
          <div class="reward-kind">${icon("stamina")}UPGRADE</div>
          <div class="reward-body"><div class="reward-big">${icon("stamina")}<b>−${off}s</b><span>on one card you own</span></div></div>
          <div class="reward-desc">One of your cards costs <b>${off} seconds less</b> for the rest of the run.<em>Price: no new tool.</em></div>
          <button class="btn btn-primary reward-btn">CHOOSE A CARD</button>
        </div>`;
    }
    if (opt.kind === "remove") {
      return `
        <div class="reward" data-index="${i}">
          <div class="reward-kind">${icon("close")}CUT A CARD</div>
          <div class="reward-body"><div class="reward-big">${icon("deck")}<b>${size} → ${size - 1}</b><span>cards in deck</span></div></div>
          <div class="reward-desc">Remove one card for good: you draw your best cards <b>more often</b>.<em>Price: one option fewer.</em></div>
          <button class="btn btn-primary reward-btn">CHOOSE A CARD</button>
        </div>`;
    }
    if (opt.kind === "deal") {
      const deal = (content.rewards.deals || []).find((d) => d.id === opt.dealId);
      return `
        <div class="reward" data-index="${i}">
          <div class="reward-kind">${icon("star")}FRONT OFFICE</div>
          <div class="reward-body">
            <div class="deal">
              <div class="deal-name">${esc(deal.name)}</div>
              <div class="deal-row gain">${icon("check")}<span>${esc(deal.gain)}</span></div>
              <div class="deal-row price">${icon("mismatch")}<span>${esc(deal.price)}</span></div>
            </div>
          </div>
          <div class="reward-desc">Lasts for the <b>whole run</b>.<em>Price: it cannot be undone.</em></div>
          <button class="btn btn-primary reward-btn">SIGN THE DEAL</button>
        </div>`;
    }
    const p = content.players[opt.playerId];
    return `
      <div class="reward" data-index="${i}">
        <div class="reward-kind">${icon("users")}FRONT OFFICE</div>
        <div class="reward-body">${playerCardHTML(p, content)}</div>
        <div class="reward-desc">Sign <b>${esc(p.name)}</b> with two signature cards.<em>Price: a starter and their cards leave.</em></div>
        <button class="btn btn-primary reward-btn">SIGN PLAYER</button>
      </div>`;
  });

  host.innerHTML = `
    <div class="page">
      <header class="page-head">
        <h1 class="gold">${beaten ? esc(beaten.name.toUpperCase()) + " BEATEN" : "VICTORY"}${last ? ` <span>${last.player}–${last.opp}</span>` : ""}</h1>
        <p>Choose one. Every choice costs you something.</p>
      </header>
      ${deckBarHTML(run)}
      <div class="rewards four">${panels.join("")}</div>
      <div class="page-actions"><button class="btn btn-ghost btn-small" id="reward-skip">Skip reward</button></div>
    </div>`;

  const done = () => {
    app.sfx("swish");
    app.sfx("reward_pick");
    app.goMap();
  };
  for (const el of $$(".reward", host)) {
    const index = Number(el.dataset.index);
    $(".reward-btn", el).addEventListener("click", () => {
      const opt = run.rewards[index];
      if (opt.kind === "player") renderSlotPicker(app, index, done);
      else if (opt.kind === "upgrade" || opt.kind === "remove") renderCardPicker(app, index, done);
      else if (applyReward(run, index)) done();
    });
  }
  $("#reward-skip", host).addEventListener("click", () => {
    app.skipReward();
  });
}

const TYPE_ORDER = ["Shot", "Offense", "Defense", "Buff", "Utility", "Status"];

/** Pick the deck card to upgrade or to cut. */
function renderCardPicker(app, index, done) {
  const run = app.run;
  const host = $("#screen-reward");
  const kind = run.rewards[index].kind;
  const off = run.config.UPGRADE_DISCOUNT ?? 4;
  const list = (kind === "upgrade" ? upgradable(run) : removable(run))
    .map((inst) => ({ inst, card: getCard(run, inst) }))
    .sort((a, b) => TYPE_ORDER.indexOf(a.card.type) - TYPE_ORDER.indexOf(b.card.type) || a.card.name.localeCompare(b.card.name));
  host.innerHTML = `
    <div class="page">
      <header class="page-head">
        <h1>${kind === "upgrade" ? "UPGRADE WHICH CARD?" : "CUT WHICH CARD?"}</h1>
        <p>${kind === "upgrade" ? `The card you click costs <b>${off} seconds less</b> for the rest of the run.` : "The card you click leaves your deck <b>for good</b>."}</p>
      </header>
      ${deckBarHTML(run)}
      <div class="deck-grid pick">${list
        .map(({ inst, card }) => {
          const owner = run.lineup.find((p) => p.id === inst.source);
          return cardHTML(card, { iid: inst.iid, performer: owner || null });
        })
        .join("")}</div>
      <div class="page-actions"><button class="btn btn-small" id="picker-back">${icon("arrowLeft")}BACK</button></div>
    </div>`;
  for (const el of $$(".card[data-iid]", host)) {
    el.classList.add("clickable");
    el.addEventListener("click", () => {
      if (applyReward(run, index, { iid: el.dataset.iid })) done();
    });
  }
  $("#picker-back", host).addEventListener("click", () => renderRewards(app));
}

function renderSlotPicker(app, index, done) {
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
        <div class="picker-arrow">${icon("swap")}</div>
        <div class="pc-row">${run.lineup.map((p, i) => playerCardHTML(p, content, { slot: i, action: "REPLACE" })).join("")}</div>
      </div>
      <div class="page-actions"><button class="btn btn-small" id="picker-back">${icon("arrowLeft")}BACK</button></div>
    </div>`;
  for (const el of $$(".pcard[data-slot]", host)) {
    el.classList.add("clickable");
    el.addEventListener("click", () => {
      if (applyReward(run, index, { slot: Number(el.dataset.slot) })) done();
    });
  }
  $("#picker-back", host).addEventListener("click", () => renderRewards(app));
}
