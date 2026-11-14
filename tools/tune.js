// Balance helper: finds per-tier strength offsets that hit target win rates.
// For each tier in turn it tries "+p% on every intent and +p/2 DEF" and keeps
// the value whose game win rate (thorough bot) is closest to the target.
//   node tools/tune.js [runs]
import { league } from "../tests/helpers.js";
import { simulate } from "./sim.js";

const runs = Number(process.argv[2]) || 500;
const TARGET = { 1: 96, 2: 80, 3: 62, boss: 50 }; // thorough-bot game win rate per tier
const offsets = { 1: 0, 2: 0, 3: 0, boss: 0 };

function apply(off) {
  const teams = JSON.parse(JSON.stringify(league.teams));
  for (const t of teams) {
    const p = off[t.tier] || 0;
    t.defense += Math.round(p / 2);
    const bump = (i) => (i.pct = Math.min(92, i.pct + p));
    t.intents.forEach(bump);
    for (const ph of t.phases || []) (ph.intents || []).forEach(bump);
    for (const src of [t.star, t.signature]) for (const e of src.effects) if (e.intent) bump(e.intent);
  }
  return teams;
}

function tierRate(result, teams, tier) {
  let games = 0;
  let wins = 0;
  for (const t of teams.filter((x) => x.tier === tier)) {
    const s = result.byTeam[t.id];
    if (s) {
      games += s.games;
      wins += s.wins;
    }
  }
  return games ? (100 * wins) / games : 0;
}

for (const tier of [1, 2, 3, "boss"]) {
  let best = null;
  for (let p = -8; p <= 36; p += 4) {
    const teams = apply({ ...offsets, [tier]: p });
    const rate = tierRate(simulate(runs, { casual: false, teams }), teams, tier);
    const diff = Math.abs(rate - TARGET[tier]);
    if (!best || diff < best.diff) best = { p, rate, diff };
    if (rate < TARGET[tier] - 6) break;
  }
  offsets[tier] = best.p;
  console.log(`tier ${tier}: +${best.p}% intents, +${Math.round(best.p / 2)} DEF -> thorough bot wins ${best.rate.toFixed(1)}% (target ${TARGET[tier]}%)`);
}
console.log("offsets:", JSON.stringify(offsets));
const teams = apply(offsets);
for (const casual of [false, true]) {
  const r = simulate(runs * 2, { casual, teams });
  console.log(`\n${casual ? "casual" : "thorough"} bot, ${runs * 2} runs: champions ${((100 * r.champions) / r.runs).toFixed(1)}%`);
  for (const t of teams) {
    const s = r.byTeam[t.id];
    if (s) console.log(`  ${String(t.tier).padEnd(4)} ${t.name.padEnd(22)} ${((100 * s.wins) / s.games).toFixed(0).padStart(3)}%  ${(s.pf / s.games).toFixed(1)}-${(s.pa / s.games).toFixed(1)}`);
  }
}
