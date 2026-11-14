// Game plan board: pick an offensive system, a defensive scheme and a pace on a
// coach's clipboard. Every option shows its strengths, weaknesses and a verdict
// against the current opponent with the reason in words.
import { chosen, evaluateMatchup, recommended } from "../engine/strategy.js";
import { canChangePlan, changePlan } from "../engine/actions.js";
import { $, $$, esc } from "./dom.js";
import { icon } from "./icons.js";
import { avatarHTML } from "./avatar.js";
import { showOverlay, hideOverlay } from "./screens.js";

const KINDS = [
  ["offense", "Offensive system", "offense"],
  ["defense", "Defensive scheme", "defense"],
  ["pace", "Pace", "clutch"],
];
const VERDICT = { 1: ["v-good", "Favourable"], 0: ["v-even", "Even"], [-1]: ["v-bad", "Unfavourable"] };

/** Team the plan is for: the current opponent in a game, otherwise the next stop. */
function opponent(run) {
  const id = run.match && !run.match.over && run.phase === "match" ? run.match.teamId : run.schedule[run.round].teamId;
  return run.content.teams.find((t) => t.id === id);
}

/** "Balanced / Man-to-Man / Normal" */
export function planSummary(run) {
  const c = chosen(run);
  return [c.offense, c.defense, c.pace].filter(Boolean).map((o) => o.name).join(" / ");
}

/** Worst verdict among the three chosen options (-1 if any is unfavourable). */
export function planVerdict(run) {
  const ev = evaluateMatchup(run, opponent(run));
  const c = chosen(run);
  return Math.min(...["offense", "defense", "pace"].map((k) => (c[k] ? ev[k][c[k].id].verdict : 0)));
}

/**
 * Open the board. Selections are local until DONE; then they are applied with
 * changePlan (free before a game and at halftime, otherwise one timeout).
 * onDone(events) is called with the resulting events.
 */
export function openPlanBoard(app, onDone = () => {}) {
  const run = app.run;
  const team = opponent(run);
  const ev = evaluateMatchup(run, team);
  const rec = recommended(run, team);
  const can = canChangePlan(run);
  const inGame = run.match && !run.match.over && run.phase === "match";
  const pick = { ...run.strategy };

  const cost = !can.ok ? `<b class="v-bad">${esc(can.reason)}</b>` : !inGame ? "Free before the game" : can.free ? "<b>Halftime: one free change</b>" : `Costs 1 timeout (${run.match.timeouts} left)`;

  const optionHTML = (kind, o) => {
    const v = ev[kind][o.id];
    const [cls, label] = VERDICT[v.verdict];
    return `
      <button class="plan-opt${pick[kind] === o.id ? " on" : ""}" data-kind="${kind}" data-id="${o.id}" ${can.ok ? "" : "disabled"}>
        <span class="plan-top"><b>${esc(o.name)}</b>${rec[kind] === o.id ? `<i class="plan-rec">Recommended</i>` : ""}<i class="plan-verdict ${cls}">${v.locked ? "Locked" : label}</i></span>
        <span class="plan-why">vs ${esc(team.name)}: ${esc(v.why)}</span>
        <span class="plan-pros">${o.strengths.map((s) => `<em class="pro">${icon("check")}${esc(s)}</em>`).join("")}${o.weaknesses.map((s) => `<em class="con">${icon("close")}${esc(s)}</em>`).join("")}</span>
      </button>`;
  };

  const render = () => {
    const usesStar = (run.content.strategy.offense.find((o) => o.id === pick.offense) || {}).usesStar;
    const o = showOverlay(
      `<div class="clip"></div>
       <h3 class="ov-title">GAME PLAN vs ${esc(team.name.toUpperCase())}</h3>
       <p class="plan-cost">${cost}. ${team.coach ? `Coach tendency: ${esc(team.coach.hint)}` : ""}</p>
       <div class="plan-cols">
         ${KINDS.map(
           ([kind, title, ico]) => `
           <div class="plan-col">
             <h4>${icon(ico)}${title}</h4>
             ${run.content.strategy[kind].map((opt) => optionHTML(kind, opt)).join("")}
             ${
               kind === "offense" && usesStar
                 ? `<div class="plan-star"><span>Your Star</span>${run.lineup
                     .map((p) => `<button class="plan-starpick${pick.starId === p.id ? " on" : ""}" data-star="${esc(p.id)}" title="${esc(p.name)}">${avatarHTML(p, { size: "md", badge: true })}</button>`)
                     .join("")}</div>`
                 : ""
             }
           </div>`
         ).join("")}
       </div>
       <div class="page-actions">
         <button class="btn btn-small" id="plan-rec" ${can.ok ? "" : "disabled"}>${icon("star")}USE RECOMMENDED</button>
         <button class="btn btn-primary" id="plan-done">DONE</button>
       </div>`,
      "wide plan"
    );
    const box = $(".overlay-box", o);
    box.addEventListener("click", (e) => {
      const opt = e.target.closest(".plan-opt");
      const star = e.target.closest(".plan-starpick");
      if (opt && !opt.disabled) {
        pick[opt.dataset.kind] = opt.dataset.id;
        render();
      } else if (star) {
        pick.starId = star.dataset.star;
        render();
      }
    });
    $("#plan-rec", o).addEventListener("click", () => {
      Object.assign(pick, rec);
      render();
    });
    $("#plan-done", o).addEventListener("click", () => {
      hideOverlay();
      onDone(can.ok ? changePlan(run, pick) : []);
    });
  };
  render();
}

/** Small "current plan" readout for the HUD. */
export function planChipHTML(run) {
  const c = chosen(run);
  const v = planVerdict(run);
  return `<span class="plan-chip ${VERDICT[v][0]}" title="Your game plan (click PLAN to change)">${icon("utility")}${esc(c.offense.name)} / ${esc(c.defense.name)} / ${esc(c.pace.name)}</span>`;
}

export function refreshPlanButtons(app) {
  for (const el of $$("[data-plan-summary]")) el.textContent = planSummary(app.run);
}
