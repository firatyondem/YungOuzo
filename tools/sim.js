// Balance simulator: a bot plays many seeded seasons against the league.
// Usage: node tools/sim.js [runs] [casual] [teams]
//   default bot: plays every useful card.  casual: one setup card, first shot, one defense card.
//   teams: also print the win rate against each team.
import { league as content, REAL_CONFIG as CONFIG } from "../tests/helpers.js";
import { createRun } from "../src/engine/gameState.js";
import { startMatch, playCard, endTurn } from "../src/engine/turnLoop.js";
import { canPlay, calcShot, getCard, getCardCost, getShootEffect } from "../src/engine/rules.js";
import { applyReward } from "../src/engine/rewards.js";
import { opponentPreview } from "../src/engine/rules.js";
import { canUseAction, useAction, isClosingTime } from "../src/engine/actions.js";
import { recommended, setStrategy } from "../src/engine/strategy.js";

const CASUAL = process.argv.includes("casual");
const PER_TEAM = process.argv.includes("teams");

export function botTurn(run, casual = CASUAL) {
  const m = run.match;
  const playable = () => m.hand.filter((c) => canPlay(run, c.iid).ok);
  const shots = () => playable().filter((c) => getShootEffect(getCard(run, c)));
  const value = (c) => calcShot(run, c).pct * calcShot(run, c).points;

  // 0) Coach actions (thorough bot only): simple, explainable heuristics.
  if (!casual) {
    const pre = opponentPreview(run);
    const noShot = !m.hand.some((c) => getShootEffect(getCard(run, c)));
    // No shot in hand: regroup rather than take a violation.
    if (noShot && canUseAction(run, "regroup").ok) useAction(run, "regroup");
    // Closing time: foul a dangerous three, otherwise ice a likely make.
    if (isClosingTime(run) && pre.intent.points >= 3 && pre.pct >= 55 && canUseAction(run, "foul").ok) useAction(run, "foul");
    else if (pre.pct >= 62 && (isClosingTime(run) || m.timeouts > 1) && canUseAction(run, "ice").ok) useAction(run, "ice");
  }

  // 1) Offense/utility/buff cards while we can still afford the cheapest shot afterwards.
  let guard = 0;
  while (guard++ < 20 && !m.over && m.shotsTaken === 0) {
    const allShots = m.hand.filter((c) => getShootEffect(getCard(run, c)));
    const reserve = allShots.length ? Math.min(...allShots.map((c) => getCardCost(run, getCard(run, c)))) : 0;
    const next = playable().find((c) => {
      const card = getCard(run, c);
      return ["Offense", "Utility", "Buff"].includes(card.type) && m.energy - getCardCost(run, card) >= reserve;
    });
    if (!next) break;
    playCard(run, next.iid);
    if (casual) break;
  }
  // 2) Shoot: the thorough bot takes the best expected value, the casual one the first shot.
  const options = shots();
  const shot = casual ? options[0] : options.sort((a, b) => value(b) - value(a))[0];
  if (shot && !m.over) playCard(run, shot.iid);
  // 3) Spend the rest on defense (and any extra shot).
  guard = 0;
  while (guard++ < 20 && !m.over) {
    const next = playable().find((c) => ["Defense", "Shot"].includes(getCard(run, c).type));
    if (!next) break;
    playCard(run, next.iid);
    if (casual) break;
  }
  if (!m.over) endTurn(run);
}

/** Play `runs` seasons. Returns per-stop and per-team tallies. */
export function simulate(runs, { casual = CASUAL, teams = content.teams, config = CONFIG } = {}) {
  const c = { ...content, teams };
  const stops = {};
  const byTeam = {};
  const plans = {};
  let champions = 0;
  let matches = 0;
  let turns = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const run = createRun(c, config, seed);
    let guard = 0;
    const reached = new Set();
    while (run.phase === "map" && guard++ < 30) {
      const stop = run.schedule[run.round];
      const roundBefore = run.round;
      // The thorough bot coaches: it picks the recommended system and scheme for this opponent.
      if (!casual) setStrategy(run, recommended(run, c.teams.find((t) => t.id === stop.teamId)));
      const plan = `${run.strategy.offense} / ${run.strategy.defense}`;
      plans[plan] = (plans[plan] || 0) + 1;
      startMatch(run);
      let g = 0;
      while (!run.match.over && g++ < 300) botTurn(run, casual);
      const won = run.match.winner === "player";
      matches++;
      turns += run.match.turn;
      const t = (byTeam[stop.teamId] ||= { games: 0, wins: 0, pf: 0, pa: 0 });
      t.games++;
      t.pf += run.match.score.player;
      t.pa += run.match.score.opp;
      if (won) t.wins++;
      const s = (stops[stop.label] ||= { reached: 0, cleared: 0, games: 0, wins: 0 });
      if (!reached.has(stop.label)) {
        reached.add(stop.label);
        s.reached++;
      }
      s.games++;
      if (won) s.wins++;
      if (run.phase === "map" && run.round > roundBefore) s.cleared++; // won a rematch: no reward
      if (run.phase === "reward") {
        s.cleared++;
        // Bot preference: upgrade > card > player (simple and deterministic).
        const idx = run.rewards.findIndex((r) => r.kind === "upgrade");
        applyReward(run, idx >= 0 ? idx : 0, { slot: 0 });
      } else if (run.phase === "victory") {
        s.cleared++;
        champions++;
      }
    }
  }
  return { runs, stops, byTeam, plans, champions, matches, turns };
}

function report(r, label) {
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1).padStart(5) + "%" : "    -");
  console.log(`runs: ${r.runs}  bot: ${label}  matches: ${r.matches}  avg turns/match: ${(r.turns / r.matches).toFixed(1)}`);
  for (const [name, s] of Object.entries(r.stops)) {
    console.log(`${name.padEnd(8)} reached ${String(s.reached).padStart(5)}  cleared ${pct(s.cleared, s.reached)}  game win rate ${pct(s.wins, s.games)}`);
  }
  console.log(`champions: ${pct(r.champions, r.runs)}`);
  const top = Object.entries(r.plans).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`plans used: ${top.map(([k, v]) => `${k} ${Math.round((100 * v) / r.matches)}%`).join(", ")}`);
  if (PER_TEAM) {
    console.log("\nper team (game win rate, average score):");
    for (const t of content.teams) {
      const s = r.byTeam[t.id];
      if (!s) continue;
      console.log(`  ${String(t.tier).padEnd(4)} ${t.name.padEnd(22)} ${pct(s.wins, s.games)}  ${(s.pf / s.games).toFixed(1)}-${(s.pa / s.games).toFixed(1)}  (${s.games} games)`);
    }
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/sim.js")) {
  const runs = Number(process.argv[2]) || 2000;
  report(simulate(runs), CASUAL ? "casual" : "thorough");
}
