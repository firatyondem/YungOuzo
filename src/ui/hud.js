// HUD rendering: broadcast score bug, shot clock, segmented meters, lineup tiles,
// chemistry, opponent intent lower-third, play-by-play ticker, piles.
import { getActiveChemistry, getTeam, opponentPreview, passiveContest, passiveOpenness } from "../engine/rules.js";
import { $, esc, ARCHETYPE_LABEL, lastName } from "./dom.js";
import { avatarHTML } from "./avatar.js";
import { icon } from "./icons.js";

let shownScore = { player: -1, opp: -1 };
let countTimers = [];

/** Team colours with safe fallbacks: { primary, secondary }. */
export function teamColors(team) {
  const c = (team && team.colors) || {};
  return { primary: c.primary || (team && team.color) || "#A9B8D6", secondary: c.secondary || "#0B1426" };
}

/** Count a score up one point at a time (never blocks input). */
function countUp(el, from, to) {
  if (!el || to <= from || from < 0) return;
  let v = from;
  el.textContent = v;
  const step = () => {
    v++;
    el.textContent = v;
    el.classList.remove("tick");
    void el.offsetWidth;
    el.classList.add("tick");
    if (v < to) countTimers.push(setTimeout(step, 110));
  };
  countTimers.push(setTimeout(step, 60));
}

export function renderScore(app, score = app.run.match.score) {
  const run = app.run;
  const m = run.match;
  const team = getTeam(run);
  const tc = teamColors(team);
  countTimers.forEach(clearTimeout);
  countTimers = [];
  const series = m.seriesGames > 1;
  $("#g-round").innerHTML = `<b>${esc(m.stopLabel || "")}${series ? ` G${m.gameNo}` : ""}</b><span>${series ? `Best of ${m.seriesGames}` : `Stop ${run.round + 1} of ${run.schedule.length}`} / Turn ${m.turn}</span>`;
  const upP = shownScore.player >= 0 && score.player > shownScore.player;
  const upO = shownScore.opp >= 0 && score.opp > shownScore.opp;
  const bug = $("#g-scorebug");
  bug.innerHTML = `
    <div class="bug-team bug-you${upP ? " flash" : ""}"><span class="bug-name">${esc(run.config.TEAM_NAME)}</span><span class="bug-score" id="bug-p">${score.player}</span></div>
    <div class="bug-mid"><span>FIRST TO</span><b>${m.target}</b></div>
    <div class="bug-team bug-opp${upO ? " flash" : ""}" style="--team:${tc.primary};--team2:${tc.secondary}"><span class="bug-score" id="bug-o">${score.opp}</span><span class="bug-name">${esc(team.name)}</span></div>`;
  if (upP) countUp($("#bug-p"), shownScore.player, score.player);
  if (upO) countUp($("#bug-o"), shownScore.opp, score.opp);
  shownScore = { ...score };
}

export function resetScoreMemory() {
  shownScore = { player: -1, opp: -1 };
}

/** "ON FIRE" flame edge on the score bug. */
export function setOnFire(on) {
  $("#g-scorebug")?.classList.toggle("onfire", !!on);
}

export function renderClock(app) {
  const m = app.run.match;
  const r = 50;
  const circ = 2 * Math.PI * r;
  const frac = m.energy / m.maxEnergy;
  const low = m.energy <= 5;
  $("#g-clock").innerHTML = `
    <svg viewBox="0 0 120 120" class="${low ? "low" : ""}" role="img" aria-label="Shot clock: ${m.energy} seconds">
      <circle cx="60" cy="60" r="${r}" class="ring-bg"/>
      <circle cx="60" cy="60" r="${r}" class="ring" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - frac)}" transform="rotate(-90 60 60)"/>
      <text x="60" y="68" text-anchor="middle" class="clock-num">${m.energy}</text>
      <text x="60" y="88" text-anchor="middle" class="clock-label">SHOT CLOCK</text>
    </svg>`;
}

const SEGMENTS = 12; // each segment = 5 points
const ARCH_SHORT = { Sniper: "Sniper", Slasher: "Slasher", Big: "Big", FloorGeneral: "Floor Gen", Lockdown: "Lockdown" };
/** "Milo Ravenscroft" -> "M. Ravenscroft" (the full name stays in the tooltip). */
const shortName = (name) => {
  const parts = String(name).trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : parts[0] || "";
};

export function renderBars(app) {
  const m = app.run.match;
  const meter = (cls, ico, label, value, hint, sign) => {
    const lit = Math.max(0, Math.min(SEGMENTS, Math.round(value / 5)));
    let segs = "";
    for (let i = 0; i < SEGMENTS; i++) segs += `<i class="${i < lit ? "on" : ""}"></i>`;
    return `
      <div class="meter ${cls}" title="${hint}">
        <div class="meter-head">${icon(ico)}<span>${label}</span></div>
        <div class="meter-track"><div class="meter-segs">${segs}</div><b class="meter-num">${sign}${Math.round(value)}</b></div>
        <div class="meter-hint">${hint}</div>
      </div>`;
  };
  $("#g-bars").innerHTML =
    meter("m-open", "offense", "OPENNESS", m.openness, "added to your next shot", "+") +
    meter("m-contest", "defense", "CONTEST", m.contest, "off their next shot", "−");
}

export function renderLineup(app) {
  const run = app.run;
  const stat = (k, v, tip) => `<span title="${tip}"><em>${k}</em><b>${v}</b></span>`;
  $("#g-lineup").innerHTML = run.lineup
    .map(
      (p, i) => `
    <div class="lp" data-slot="${i}" data-pid="${esc(p.id)}" style="--pc:${p.color}">
      ${avatarHTML(p, { size: "md", badge: true })}
      <div class="lp-main">
        <div class="lp-name" title="${esc(p.name)}">${esc(shortName(p.name))}</div>
        <div class="lp-arch" title="${esc(p.position)} / ${esc(ARCHETYPE_LABEL[p.archetype] || p.archetype)}">${esc(ARCH_SHORT[p.archetype] || p.archetype)}</div>
      </div>
      <div class="lp-stats">
        ${stat("SHT", p.ratings.SHT, "Shooting: 3PT shots")}
        ${stat("INS", p.ratings.INS, "Inside: 2PT shots")}
        ${stat("DEF", p.ratings.DEF, "Defense: passive Contest")}
        ${stat("PLY", p.ratings.PLY, "Playmaking: passive Openness")}
      </div>
    </div>`
    )
    .join("");
}

/** Spotlight the lineup tile of the player who performs the hovered card. */
export function spotlightActor(playerId) {
  for (const el of document.querySelectorAll("#g-lineup .lp")) {
    el.classList.toggle("spot", !!playerId && el.dataset.pid === playerId);
  }
}

export function renderChem(app) {
  const run = app.run;
  const chem = getActiveChemistry(run);
  // The Chemistry heading only shows when a bonus is active (saves room for the opponent panel).
  const title = $("#g-chem").previousElementSibling;
  if (title) title.hidden = !chem.length;
  const passive = `<div class="chem-passive">Each turn: <b>+${Math.round(passiveOpenness(run))}</b> Openness, <b>+${Math.round(passiveContest(run))}</b> Contest</div>`;
  $("#g-chem").innerHTML =
    (chem.length
      ? chem
          .map(
            (c) => `<div class="chem-chip on">${icon("star")}<div><b>${esc(c.name)}</b><span>${c.count} x ${esc(ARCHETYPE_LABEL[c.archetype] || c.archetype)}: ${esc(c.text)}</span></div></div>`
          )
          .join("")
      : "") + passive;
}

export function renderIntent(app) {
  const run = app.run;
  const team = getTeam(run);
  const tc = teamColors(team);
  const pre = opponentPreview(run);
  // Cap the displayed base at the max % so a clamped value is not shown as "lowered".
  const base = Math.round(Math.min(run.config.PCT_MAX, pre.basePct));
  const eff = Math.round(pre.pct);
  const lowered = eff < base;
  // Which opponent takes this attempt (presentation only; matches the court animation).
  const roster = team.players || [];
  const shooter = roster.length ? roster[run.match.intentIndex % roster.length] : null;
  const danger = eff >= 60 ? "hi" : eff >= 35 ? "mid" : "lo";
  $("#g-intent").innerHTML = `
    <div class="lt${pre.clutch ? " clutch" : ""}" style="--team:${tc.primary};--team2:${tc.secondary}">
      <div class="lt-slab">
        ${shooter ? avatarHTML(shooter, { color: tc.primary, size: "lg" }) : icon("users")}
      </div>
      <div class="lt-body">
        <div class="lt-kicker">${esc(team.name)} will try${shooter ? ` / #${esc(shooter.jersey)} ${esc(lastName(shooter.name))}` : ""}</div>
        <div class="lt-play">${icon(pre.intent.points >= 3 ? "target" : "shot")}<span>${esc(pre.intent.name)}</span><em>${pre.intent.points} PTS</em></div>
        <div class="lt-chips">
          ${pre.clutch ? `<span class="tag tag-clutch">${icon("clutch")}Clutch +${team.clutch.bonus}%</span>` : ""}
          ${pre.intent.unblockableBySteal ? `<span class="tag tag-warn">${icon("lock")}Can't be stolen</span>` : ""}
          ${pre.steals ? `<span class="tag tag-steal">${icon("hustle")}Steal armed</span>` : ""}
          ${(pre.notes || []).slice(0, 3).map((n) => `<span class="tag tag-rule" title="${esc(n.text || "")}">${icon("star")}${esc(n.label)}${n.value ? ` ${n.value > 0 ? "+" : ""}${Math.round(n.value)}%` : n.text ? `: ${esc(n.text)}` : ""}</span>`).join("")}
        </div>
      </div>
      <div class="lt-pct lt-${danger}">
        ${lowered ? `<s>${base}%</s>` : ""}
        <b>${eff}%</b>
        <span>to score</span>
      </div>
    </div>`;
}

/** Who you are playing: star ability, signature mechanic, boss phase, tip-off notes. */
export function renderOpponent(app) {
  const run = app.run;
  const m = run.match;
  const team = getTeam(run);
  const el = $("#g-opp");
  if (!el) return;
  const phase = team.phases && team.phases[m.opp ? m.opp.phase : 0];
  const row = (ico, name, text, cls = "") => `<div class="opp-trait ${cls}" title="${esc(text)}">${icon(ico)}<div><b>${esc(name)}</b><span>${esc(text)}</span></div></div>`;
  el.innerHTML =
    (team.star ? row("star", team.star.name, team.star.text) : "") +
    (team.signature ? row("relic", team.signature.name, team.signature.text) : "") +
    (phase && team.phases.length > 1 ? row("clutch", `Phase: ${phase.name}`, phase.text, "phase") : "") +
    (m.notes || []).map((n) => row("mismatch", "Scouted", n, "scout")).join("") ||
    `<div class="opp-trait"><div><span>No special rules.</span></div></div>`;
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
    <div class="pile" title="Draw pile">${icon("deck")}<b>${m.draw.length}</b><span>Draw</span></div>
    <div class="pile" title="Discard pile">${icon("swap")}<b>${m.discard.length}</b><span>Discard</span></div>
    <div class="pile ex" title="Exhausted: gone for this game">${icon("lock")}<b>${m.exhaust.length}</b><span>Exhaust</span></div>`;
}

export function renderEndHint(app) {
  const m = app.run.match;
  const el = $("#g-endhint");
  if (m.over) el.textContent = "";
  else if (m.shotsTaken === 0) el.innerHTML = `<b class="warn">No shot yet</b><span>Ending now is a violation</span>`;
  else el.innerHTML = `<b class="ok">Shot taken</b><span>Add defense or end the turn</span>`;
}
