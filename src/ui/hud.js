// HUD rendering: score bug, shot clock, bars, lineup, chemistry, intent, log, piles.
import { getActiveChemistry, getTeam, opponentPreview, passiveContest, passiveOpenness } from "../engine/rules.js";
import { $, esc, ARCHETYPE_LABEL } from "./dom.js";

let shownScore = { player: -1, opp: -1 };

export function renderScore(app, score = app.run.match.score) {
  const run = app.run;
  const m = run.match;
  const team = getTeam(run);
  $("#g-round").innerHTML = `<b>${esc(team.round)}</b><span>Game ${run.round + 1} of ${run.content.teams.length}</span>`;
  const popP = shownScore.player >= 0 && score.player > shownScore.player ? " pop" : "";
  const popO = shownScore.opp >= 0 && score.opp > shownScore.opp ? " pop" : "";
  $("#g-scorebug").innerHTML = `
    <div class="sb-team sb-you"><span class="sb-name">${esc(run.config.TEAM_NAME)}</span><span class="sb-score${popP}">${score.player}</span></div>
    <div class="sb-mid"><span>FIRST TO</span><b>${m.target}</b></div>
    <div class="sb-team sb-opp" style="--team:${team.color}"><span class="sb-score${popO}">${score.opp}</span><span class="sb-name">${esc(team.name)}</span></div>`;
  shownScore = { ...score };
}

export function resetScoreMemory() {
  shownScore = { player: -1, opp: -1 };
}

export function renderClock(app) {
  const m = app.run.match;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const frac = m.energy / m.maxEnergy;
  const low = m.energy <= 5;
  $("#g-clock").innerHTML = `
    <svg viewBox="0 0 120 120" class="${low ? "low" : ""}">
      <circle cx="60" cy="60" r="${r}" class="ring-bg"/>
      <circle cx="60" cy="60" r="${r}" class="ring" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - frac)}" transform="rotate(-90 60 60)"/>
      <text x="60" y="66" text-anchor="middle" class="clock-num">${m.energy}</text>
      <text x="60" y="88" text-anchor="middle" class="clock-label">SHOT CLOCK</text>
    </svg>`;
}

export function renderBars(app) {
  const run = app.run;
  const m = run.match;
  const bar = (cls, label, value, hint, sign) => `
    <div class="bar ${cls}">
      <div class="bar-head"><span>${label}</span><b>${sign}${Math.round(value)}%</b></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, (Math.max(0, value) / 60) * 100)}%"></div></div>
      <div class="bar-hint">${hint}</div>
    </div>`;
  $("#g-bars").innerHTML =
    bar("openness", "OPENNESS", m.openness, "added to your next shot", "+") +
    bar("contest", "CONTEST", m.contest, "off their next shot", "−");
}

export function renderLineup(app) {
  const run = app.run;
  $("#g-lineup").innerHTML = run.lineup
    .map(
      (p, i) => `
    <div class="lp" data-slot="${i}" style="--pc:${p.color}">
      <span class="lp-num">${p.jersey}</span>
      <div class="lp-info">
        <div class="lp-name">${esc(p.name)}</div>
        <div class="lp-arch">${esc(p.position)} · ${esc(ARCHETYPE_LABEL[p.archetype] || p.archetype)}</div>
      </div>
      <div class="lp-ratings">
        <span title="Shooting (3PT)">SHT<b>${p.ratings.SHT}</b></span>
        <span title="Inside (2PT)">INS<b>${p.ratings.INS}</b></span>
        <span title="Defense">DEF<b>${p.ratings.DEF}</b></span>
        <span title="Playmaking">PLY<b>${p.ratings.PLY}</b></span>
      </div>
    </div>`
    )
    .join("");
}

export function renderChem(app) {
  const run = app.run;
  const chem = getActiveChemistry(run);
  const passive = `<div class="chem-passive">Passive each turn: <b>+${Math.round(passiveOpenness(run))}</b> Openness · <b>+${Math.round(passiveContest(run))}</b> Contest</div>`;
  $("#g-chem").innerHTML =
    (chem.length
      ? chem
          .map(
            (c) => `<div class="chem-chip on"><b>${esc(c.name)}</b><span>${c.count}× ${esc(ARCHETYPE_LABEL[c.archetype] || c.archetype)} — ${esc(c.text)}</span></div>`
          )
          .join("")
      : `<div class="chem-chip"><span>None yet. Two players of the same archetype unlock a bonus.</span></div>`) + passive;
}

export function renderIntent(app) {
  const run = app.run;
  const team = getTeam(run);
  const pre = opponentPreview(run);
  // Cap the displayed base at the max % so a clamped value is not shown as "lowered".
  const base = Math.round(Math.min(run.config.PCT_MAX, pre.basePct));
  const eff = Math.round(pre.pct);
  const lowered = eff < base;
  $("#g-intent").innerHTML = `
    <div class="intent-box${pre.clutch ? " clutch" : ""}" style="--team:${team.color}">
      <div class="intent-head">${esc(team.name)} WILL TRY</div>
      <div class="intent-name">${esc(pre.intent.name)} <span class="intent-pts">${pre.intent.points} PTS</span></div>
      <div class="intent-pct">
        ${lowered ? `<s>${base}%</s>` : ""}<b class="${lowered ? "lowered" : ""}">${eff}%</b>
        <span>to score</span>
      </div>
      <div class="intent-tags">
        ${pre.clutch ? `<span class="tag tag-clutch">CLUTCH +${team.clutch.bonus}%</span>` : ""}
        ${pre.intent.unblockableBySteal ? `<span class="tag tag-warn">CAN'T BE STOLEN</span>` : ""}
        ${pre.steals ? `<span class="tag tag-steal">STEAL ARMED</span>` : ""}
      </div>
    </div>`;
}

export function renderLog(app) {
  const m = app.run.match;
  $("#g-log").innerHTML = m.log
    .slice(-5)
    .map((t, i, arr) => `<div class="log-line${i === arr.length - 1 ? " latest" : ""}">${esc(t)}</div>`)
    .join("");
}

export function renderPiles(app) {
  const m = app.run.match;
  $("#g-piles").innerHTML = `
    <div class="pile" title="Draw pile"><b>${m.draw.length}</b><span>DRAW</span></div>
    <div class="pile" title="Discard pile"><b>${m.discard.length}</b><span>DISCARD</span></div>
    <div class="pile dim" title="Exhausted (gone this match)"><b>${m.exhaust.length}</b><span>EXHAUST</span></div>
    <div class="turn-no">TURN ${m.turn}</div>`;
}

export function renderEndHint(app) {
  const m = app.run.match;
  const el = $("#g-endhint");
  if (m.over) el.textContent = "";
  else if (m.shotsTaken === 0) el.innerHTML = `<span class="warn">No shot yet!</span> Ending now = violation`;
  else el.innerHTML = `Shot taken. Add defense or end turn.`;
}
