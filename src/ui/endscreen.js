// Victory and Game Over screens with run stats.
import { $, esc, lastName } from "./dom.js";
import { avatarHTML } from "./avatar.js";

export function renderEnd(app) {
  const run = app.run;
  const s = run.stats;
  const teams = run.content.teams;
  const won = run.phase === "victory";
  const last = run.results[run.results.length - 1];
  const lastTeam = last ? teams.find((t) => t.id === last.teamId) : null;
  const fg = s.shots ? Math.round((s.makes / s.shots) * 100) : 0;
  const stat = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;
  const host = $("#screen-end");
  host.className = `screen ${won ? "end-win" : "end-loss"}`;
  host.innerHTML = `
    <div class="page page-center">
      <div class="end-icon">${won ? "🏆" : "🏀"}</div>
      <h1 class="end-title ${won ? "gold" : "bad"}">${won ? "CHAMPIONS!" : "RUN OVER"}</h1>
      <p class="end-sub">${
        won
          ? "You ran the full court and took down The Dynasty. The title is yours."
          : lastTeam
            ? `Eliminated by ${esc(lastTeam.name)} (${esc(lastTeam.round)}), ${last.opp}–${last.player}.`
            : "The run ends here."
      }</p>
      <div class="end-results">
        ${run.results
          .map((r) => {
            const t = teams.find((x) => x.id === r.teamId);
            return `<div class="end-result ${r.won ? "w" : "l"}"><span>${esc(t.round)}</span><b>${r.player}–${r.opp}</b><span>${r.won ? "W" : "L"} vs ${esc(t.name)}</span></div>`;
          })
          .join("")}
      </div>
      <div class="end-squad">
        ${run.lineup.map((p) => `<div class="end-player">${avatarHTML(p, { size: "lg", badge: true })}<span>${esc(lastName(p.name))}</span></div>`).join("")}
      </div>
      <div class="stats">
        ${stat(s.wins, "Wins")}
        ${stat(s.pointsFor, "Points scored")}
        ${stat(s.pointsAgainst, "Points allowed")}
        ${stat(`${s.makes}/${s.shots}`, `Shots made (${fg}%)`)}
        ${stat(s.threes, "Threes")}
        ${stat(s.steals, "Steals")}
        ${stat(s.cardsPlayed, "Cards played")}
        ${stat(s.turns, "Turns")}
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-big" id="end-again">PLAY AGAIN</button>
        <button class="btn" id="end-title">TITLE SCREEN</button>
      </div>
      <div class="end-seed">Seed ${esc(run.seed)}</div>
    </div>`;
  if (won) app.mountTrophy?.($(".end-icon", host));
  $("#end-again", host).addEventListener("click", () => app.startRun());
  $("#end-title", host).addEventListener("click", () => app.goTitle());
}
