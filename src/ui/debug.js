// Debug panel (toggle with D). Hidden by default.
import { debugAddCard, debugAddPoints, debugWinMatch } from "../engine/turnLoop.js";
import { $, esc } from "./dom.js";

export function createDebug(app) {
  const el = document.createElement("div");
  el.id = "debug";
  el.className = "debug";
  el.hidden = true;
  document.body.appendChild(el);

  function inMatch() {
    return app.run?.match && !app.run.match.over && app.run.phase === "match" && !app.locked;
  }

  function render() {
    if (el.hidden) return;
    const run = app.run;
    const cards = app.content?.cardList || [];
    el.innerHTML = `
      <div class="debug-head"><b>DEBUG</b><span>seed: <code id="dbg-seed">${run ? esc(run.seed) : "-"}</code></span><button data-act="close">×</button></div>
      <div class="debug-row">
        <button data-act="pts">+5 points</button>
        <button data-act="opp">+5 opponent</button>
        <button data-act="win">Win game</button>
      </div>
      <div class="debug-row">
        <select id="dbg-card">${cards.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
        <button data-act="card">Add card</button>
      </div>
      <div class="debug-row">
        <input id="dbg-seed-in" placeholder="seed" value="${run ? esc(run.seed) : ""}" size="10">
        <button data-act="seed">New run with seed</button>
      </div>
      <pre id="dbg-state">${run ? esc(stateSummary(run)) : ""}</pre>`;
  }

  function stateSummary(run) {
    const m = run.match;
    const names = (pile) => pile.map((c) => c.cardId).join(", ");
    const view = {
      phase: run.phase,
      round: run.round,
      rngState: run.rngState,
      deck: run.deck.length,
      lineup: run.lineup.map((p) => `${p.name} [${p.archetype}] ${Object.values(p.ratings).join("/")}`),
      stats: run.stats,
      match: m && {
        turn: m.turn,
        score: m.score,
        energy: m.energy,
        openness: m.openness,
        contest: m.contest,
        shotsTaken: m.shotsTaken,
        intentIndex: m.intentIndex,
        lastOppFailed: m.lastOppFailed,
        threeStreak: m.threeStreak,
        buffs: m.buffs,
        pending: m.pending,
        hand: names(m.hand),
        draw: m.draw.length,
        discard: m.discard.length,
        exhaust: names(m.exhaust),
      },
    };
    return JSON.stringify(view, null, 1);
  }

  el.addEventListener("click", (e) => {
    const act = e.target.dataset?.act;
    if (!act) return;
    const run = app.run;
    if (act === "close") el.hidden = true;
    else if (act === "seed") {
      const v = $("#dbg-seed-in", el).value.trim();
      if (v) app.startRun(/^\d+$/.test(v) ? Number(v) : v);
    } else if (inMatch()) {
      let events = [];
      if (act === "pts") events = debugAddPoints(run, 5, "player");
      else if (act === "opp") events = debugAddPoints(run, 5, "opp");
      else if (act === "win") events = debugWinMatch(run);
      else if (act === "card") debugAddCard(run, $("#dbg-card", el).value);
      app.game.processEvents(events);
    }
    render();
  });

  function toggle() {
    el.hidden = !el.hidden;
    render();
  }

  return { toggle, render };
}
