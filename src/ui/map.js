// Tournament map: three opponents, your team, deck viewer.
import { getActiveChemistry } from "../engine/rules.js";
import { $, esc, ARCHETYPE_LABEL } from "./dom.js";
import { playerCardHTML } from "./playerCard.js";
import { cardHTML } from "./cards.js";
import { showOverlay, hideOverlay } from "./screens.js";

const TYPE_ORDER = ["Shot", "Offense", "Defense", "Buff", "Utility"];

export function showDeck(app) {
  const run = app.run;
  const cards = run.deck
    .map((inst) => ({ inst, card: run.content.cards[inst.cardId] }))
    .sort((a, b) => TYPE_ORDER.indexOf(a.card.type) - TYPE_ORDER.indexOf(b.card.type) || a.card.name.localeCompare(b.card.name));
  const o = showOverlay(
    `<h3 class="ov-title">YOUR DECK · ${cards.length} CARDS</h3>
     <div class="deck-grid">${cards
       .map(({ inst, card }) => {
         const owner = run.lineup.find((p) => p.id === inst.source);
         return cardHTML(card, { owner: owner ? `#${owner.jersey} ${owner.name.split(" ").slice(-1)[0]}` : "" });
       })
       .join("")}</div>
     <button class="btn" id="ov-close">CLOSE</button>`,
    "wide"
  );
  $("#ov-close", o).addEventListener("click", hideOverlay);
}

export function renderMap(app) {
  const run = app.run;
  const teams = run.content.teams;
  const next = teams[run.round];
  const chem = getActiveChemistry(run);
  const host = $("#screen-map");

  const node = (t, i) => {
    const result = run.results[i];
    const state = i < run.round ? "done" : i === run.round ? "current" : "locked";
    return `
      <div class="bnode ${state}" style="--team:${t.color}">
        <div class="bnode-round">${esc(t.round)}</div>
        <div class="bnode-name">${esc(t.name)}</div>
        <div class="bnode-tag">${esc(t.tagline || "")}</div>
        <div class="bnode-stats">
          <span class="bnode-def" title="Subtracted from all your shot percentages">DEF ${t.defense}</span>
          ${t.clutch ? `<span class="tag tag-clutch">CLUTCH</span>` : ""}
        </div>
        <ul class="bnode-intents">
          ${t.intents.map((it) => `<li><span>${esc(it.name)}</span><b>${it.points}PT · ${it.pct}%</b></li>`).join("")}
        </ul>
        <div class="bnode-state">${
          state === "done" && result ? `✔ WON ${result.player}–${result.opp}` : state === "current" ? "NEXT GAME" : "LOCKED"
        }</div>
      </div>`;
  };

  host.innerHTML = `
    <div class="page">
      <header class="page-head">
        <h1>THE TOURNAMENT</h1>
        <p>Win three games to take the title. Lose once and the run is over.</p>
      </header>
      <div class="bracket">
        ${teams.map((t, i) => node(t, i) + `<div class="bline${i < run.round ? " done" : ""}"></div>`).join("")}
        <div class="btrophy">🏆<span>CHAMPION</span></div>
      </div>
      <section class="map-team">
        <div class="map-team-head">
          <h3>YOUR TEAM</h3>
          <div class="map-chem">
            ${
              chem.length
                ? chem.map((c) => `<span class="chem-pill on" title="${esc(c.text)}"><b>${esc(c.name)}</b> ${c.count}× ${esc(ARCHETYPE_LABEL[c.archetype] || c.archetype)}: ${esc(c.text)}</span>`).join("")
                : `<span class="chem-pill">No chemistry yet: two players of the same archetype unlock a bonus</span>`
            }
          </div>
          <button class="btn btn-small" id="map-deck">VIEW DECK (${run.deck.length})</button>
        </div>
        <div class="pc-row">${run.lineup.map((p) => playerCardHTML(p, run.content)).join("")}</div>
      </section>
      <div class="page-actions">
        <button class="btn btn-primary btn-big" id="map-go">TIP-OFF vs ${esc(next.name.toUpperCase())}</button>
      </div>
    </div>`;

  $("#map-go", host).addEventListener("click", () => app.beginMatch());
  $("#map-deck", host).addEventListener("click", () => showDeck(app));
}
