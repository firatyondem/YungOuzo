// Balance helper: finds the per-tier strength offset that hits a target game
// win rate for the thorough bot. It plays isolated games at each stop (with the
// rewards a run would have by then), and bisects on "+p% on every intent and
// +p/2 DEF" for that tier. Print-only: put the result into TUNE in gen-league.js.
//   node tools/tune.js [games per step]
import { league, REAL_CONFIG as CONFIG } from "../tests/helpers.js";
import { createRun } from "../src/engine/gameState.js";
import { startMatch } from "../src/engine/turnLoop.js";
import { generateRewards } from "../src/engine/rewards.js";
import { recommended, setStrategy } from "../src/engine/strategy.js";
import { botTurn, pickReward } from "./sim.js";

const games = Number(process.argv[2]) || 300;
// Thorough-bot game win rate per tier. With two lives and a best-of-3 Finals
// these give roughly: Act 1 85%, Act 2 57%, Act 3 47%, Finals series ~35%, full run ~20%.
export const TARGET = { 1: 85, 2: 57, 3: 47, boss: 40 };
const STOP = { 1: 0, 2: 1, 3: 2, boss: 3 };

function apply(teams, tier, p) {
  const out = JSON.parse(JSON.stringify(teams));
  for (const t of out.filter((x) => x.tier === tier)) {
    t.defense = Math.max(0, t.defense + Math.round(p / 2));
    const bump = (i) => (i.pct = Math.max(15, Math.min(92, i.pct + p)));
    t.intents.forEach(bump);
    for (const ph of t.phases || []) (ph.intents || []).forEach(bump);
    for (const src of [t.star, t.signature]) for (const e of src.effects) if (e.intent) bump(e.intent);
  }
  return out;
}

/** Win rate of the thorough bot in single games against one tier. */
export function tierRate(teams, tier, n = games, mode = "thorough") {
  const content = { ...league, teams };
  const pool = teams.filter((t) => t.tier === tier);
  let wins = 0;
  for (let seed = 1; seed <= n; seed++) {
    const run = createRun(content, CONFIG, seed * 31 + 7);
    // Give the run the rewards it would have collected before this stop.
    for (let r = 0; r < STOP[tier]; r++) {
      run.phase = "reward";
      generateRewards(run);
      pickReward(run, "thorough", null);
    }
    run.round = STOP[tier];
    const team = pool[seed % pool.length];
    run.schedule[run.round].teamId = team.id;
    if (mode === "thorough") setStrategy(run, recommended(run, team));
    startMatch(run);
    let g = 0;
    const dice = { rngState: seed * 7919 };
    while (!run.match.over && g++ < 300) botTurn(run, mode, dice);
    if (run.match.winner === "player") wins++;
  }
  return (100 * wins) / n;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/tune.js")) {
  const offsets = {};
  for (const tier of [1, 2, 3, "boss"]) {
    let lo = -44; // weaker opponent -> higher win rate
    let hi = 12;
    let best = null;
    for (let step = 0; step < 6; step++) {
      const mid = Math.round((lo + hi) / 2);
      const rate = tierRate(apply(league.teams, tier, mid), tier);
      if (!best || Math.abs(rate - TARGET[tier]) < Math.abs(best.rate - TARGET[tier])) best = { p: mid, rate };
      if (rate > TARGET[tier]) lo = mid; // too easy: make them stronger
      else hi = mid;
      if (hi - lo <= 1) break;
    }
    offsets[tier] = best.p;
    console.log(`tier ${String(tier).padEnd(4)} offset ${String(best.p).padStart(4)} -> thorough bot wins ${best.rate.toFixed(1)}% of games (target ${TARGET[tier]}%)`);
  }
  console.log("add to TUNE in tools/gen-league.js (pct += offset, def += offset / 2):", JSON.stringify(offsets));
}
