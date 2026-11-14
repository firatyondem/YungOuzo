// Balance simulator: a simple bot plays many seeded tournaments.
// Usage: node tools/sim.js [runs]
import { content, REAL_CONFIG as CONFIG } from "../tests/helpers.js";
import { createRun } from "../src/engine/gameState.js";
import { startMatch, playCard, endTurn } from "../src/engine/turnLoop.js";
import { canPlay, calcShot, getCard, getCardCost, getShootEffect } from "../src/engine/rules.js";
import { applyReward } from "../src/engine/rewards.js";

function botTurn(run) {
  const m = run.match;
  const playable = () => m.hand.filter((c) => canPlay(run, c.iid).ok);
  const shots = () => playable().filter((c) => getShootEffect(getCard(run, c)));
  const bestShot = () =>
    shots().sort((a, b) => {
      const sa = calcShot(run, a), sb = calcShot(run, b);
      return sb.pct * sb.points - sa.pct * sa.points;
    })[0];

  // 1) Offense/utility/buff cards while we can still afford the cheapest shot afterwards.
  let guard = 0;
  while (guard++ < 20 && !m.over) {
    const allShots = m.hand.filter((c) => getShootEffect(getCard(run, c)));
    const reserve = allShots.length ? Math.min(...allShots.map((c) => getCardCost(run, getCard(run, c)))) : 0;
    const next = playable().find((c) => {
      const card = getCard(run, c);
      return ["Offense", "Utility", "Buff"].includes(card.type) && m.energy - getCardCost(run, card) >= reserve;
    });
    if (!next || m.shotsTaken > 0) break;
    playCard(run, next.iid);
  }
  // 2) Shoot.
  const shot = bestShot();
  if (shot && !m.over) playCard(run, shot.iid);
  // 3) Dump the rest into defense (and any extra shot).
  guard = 0;
  while (guard++ < 20 && !m.over) {
    const next = playable().find((c) => ["Defense", "Shot"].includes(getCard(run, c).type));
    if (!next) break;
    playCard(run, next.iid);
  }
  if (!m.over) endTurn(run);
}

const runs = Number(process.argv[2]) || 2000;
const reached = [0, 0, 0, 0];
const turns = [[], [], []];
for (let seed = 1; seed <= runs; seed++) {
  const run = createRun(content, CONFIG, seed);
  while (run.phase === "map") {
    const round = run.round;
    startMatch(run);
    let guard = 0;
    while (!run.match.over && guard++ < 300) botTurn(run);
    turns[round].push(run.match.turn);
    if (run.phase === "reward") {
      // Bot preference: upgrade > card > player (keeps it simple and deterministic).
      const idx = run.rewards.findIndex((r) => r.kind === "upgrade");
      applyReward(run, idx >= 0 ? idx : 0, { slot: 0 });
      reached[round + 1]++;
    } else if (run.phase === "victory") {
      reached[3]++;
    }
  }
  reached[0]++;
}
const avg = (a) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : "-");
console.log(`runs: ${runs}`);
content.teams.forEach((t, i) => {
  const played = turns[i].length;
  console.log(
    `${t.round.padEnd(11)} ${t.name.padEnd(12)} played ${String(played).padStart(5)}  won ${((reached[i + 1] / Math.max(1, played)) * 100).toFixed(1)}%  avg turns ${avg(turns[i])}`
  );
});
console.log(`champions: ${((reached[3] / runs) * 100).toFixed(1)}%`);
