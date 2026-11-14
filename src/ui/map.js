// Tournament map: three opponents, your team, deck viewer.
import { getActiveChemistry } from "../engine/rules.js";
import { $, esc, ARCHETYPE_LABEL } from "./dom.js";
import { playerCardHTML } from "./playerCard.js";
import { cardHTML } from "./cards.js";
import { avatarHTML } from "./avatar.js";
import { icon } from "./icons.js";
import { teamColors } from "./hud.js";
import { tipOffRules } from "../engine/teamRules.js";
import { openPlanBoard, planSummary, planVerdict } from "./strategy.js";
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
         return cardHTML(card, { performer: owner || null });
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
  const schedule = run.schedule;
  const stopNow = schedule[run.round];
  const next = teams.find((t) => t.id === stopNow.teamId);
  const chem = getActiveChemistry(run);
  const host = $("#screen-map");
  const tip = tipOffRules(run, next, stopNow);

  const trait = (ico, src) =>
    src ? `<div class="bnode-trait">${icon(ico)}<div><b>${esc(src.name)}</b><span>${esc(src.text)}</span></div></div>` : "";

  const node = (stop, i) => {
    const t = teams.find((x) => x.id === stop.teamId);
    const state = i < run.round ? "done" : i === run.round ? "current" : "locked";
    const series = stop.games > 1;
    const last = [...run.results].reverse().find((r) => r.teamId === t.id && r.label === stop.label);
    let status;
    if (state === "done") status = `${icon("check")}${series ? `WON ${stop.wins}\u2013${stop.losses}` : last ? `WON ${last.player}\u2013${last.opp}` : "WON"}`;
    else if (state === "current") status = `${icon("play")}${series && stop.wins + stop.losses > 0 ? `SERIES ${stop.wins}\u2013${stop.losses}` : "NEXT GAME"}`;
    else status = `${icon("lock")}LOCKED`;
    return `
      <div class="bnode ${state}" style="--team:${teamColors(t).primary}">
        <div class="bnode-top"><div class="bnode-round">${esc(stop.label)}${series ? ` / best of ${stop.games}` : ""}</div><div class="bnode-name">${esc(t.name)}</div></div>
        <div class="bnode-body">
          <div class="bnode-stats">
            <span class="bnode-def" title="Subtracted from all your shot percentages">DEF ${t.defense}</span>
            ${t.identity ? `<span class="chip">${esc(t.identity)}</span>` : ""}
            ${t.clutch ? `<span class="tag tag-clutch">${icon("clutch")}Clutch</span>` : ""}
          </div>
          ${trait("star", t.star)}
          ${trait("relic", t.signature)}
          <ul class="bnode-intents">
            ${t.intents.map((it) => `<li><span>${esc(it.name)}</span><b>${it.points}PT ${it.pct}%</b></li>`).join("")}
          </ul>
          ${t.coach ? `<div class="bnode-coach">${icon("scouting")}<span>Coach: ${esc(t.coach.hint)}</span></div>` : ""}
          <div class="bnode-roster">${(t.players || []).slice(0, 5).map((p) => avatarHTML(p, { color: teamColors(t).primary, size: "sm" })).join("")}</div>
          <div class="bnode-state">${status}</div>
        </div>
      </div>`;
  };

  const game = stopNow.games > 1 ? ` (GAME ${stopNow.wins + stopNow.losses + 1})` : "";
  host.innerHTML = `
    <div class="page">
      <header class="page-head">
        <h1>THE SEASON${run.config.LIVES ? ` <span class="lives" title="A loss before the Finals costs a life: you get a rematch, but no reward for that stop.">${icon("stamina")}${run.lives} ${run.lives === 1 ? "life" : "lives"}</span>` : ""}</h1>
        ${
          tip.notes.length
            ? `<div class="map-notes">${tip.notes.map((n) => `<span class="bnode-scout">${icon("mismatch")}<span>${esc(n)}</span></span>`).join("")}</div>`
            : `<p>Beat three league opponents, then win the <b>best-of-3 Finals</b>. A loss before the Finals costs a life.</p>`
        }
      </header>
      <div class="bracket">
        ${schedule.map((s, i) => node(s, i) + `<div class="bline${i < run.round ? " done" : ""}"></div>`).join("")}
        <div class="btrophy">${icon("trophy")}<span>CHAMPION</span></div>
      </div>
      <section class="map-team">
        <div class="map-team-head">
          <h3>YOUR TEAM</h3>
          <div class="map-chem">
            ${
              chem.length
                ? chem.map((c) => `<span class="chem-pill on" title="${esc(c.text)}">${icon("star")}<b>${esc(c.name)}</b> ${c.count} x ${esc(ARCHETYPE_LABEL[c.archetype] || c.archetype)}: ${esc(c.text)}</span>`).join("")
                : `<span class="chem-pill">No chemistry yet: two players of the same archetype unlock a bonus</span>`
            }
          </div>
          <button class="btn btn-small" id="map-deck">${icon("deck")}VIEW DECK (${run.deck.length})</button>
        </div>
        <div class="pc-row">${run.lineup.map((p) => playerCardHTML(p, run.content, { compact: true })).join("")}</div>
      </section>
      <div class="page-actions">
        <button class="btn plan-btn ${planVerdict(run) < 0 ? "warn" : ""}" id="map-plan" title="Choose your offensive system, defensive scheme and pace">${icon("utility")}<span><small>GAME PLAN</small>${esc(planSummary(run))}</span></button>
        <button class="btn btn-primary btn-big" id="map-go">TIP-OFF vs ${esc(next.name.toUpperCase())}${game}</button>
      </div>
    </div>`;

  $("#map-go", host).addEventListener("click", () => app.beginMatch());
  $("#map-deck", host).addEventListener("click", () => showDeck(app));
  $("#map-plan", host).addEventListener("click", () => openPlanBoard(app, () => renderMap(app)));
}
