// Balance simulator: bots play many seeded seasons against the league.
// Usage: node tools/sim.js [runs] [thorough|casual|random] [teams] [cards]
//   thorough (default): plans each turn by expected value - it understands costs,
//       risk (turnovers, fatigue, exhaust), the opponent's intent and its own Contest,
//       uses timeouts, holds a card, and picks the recommended game plan.
//   casual: one setup card, the first shot it sees, one defense card. No coaching.
//   random: plays random playable cards, random rewards. The floor.
//   teams: per-team table.   cards: top cards in winning decks.
import { league as content, REAL_CONFIG as CONFIG } from "../tests/helpers.js";
import { createRun } from "../src/engine/gameState.js";
import { startMatch, playCard, endTurn, toggleHold } from "../src/engine/turnLoop.js";
import { canPlay, calcShot, checkCondition, getCard, getCardCost, getShootEffect, opponentPreview } from "../src/engine/rules.js";
import { applyReward, upgradable, removable } from "../src/engine/rewards.js";
import { canUseAction, useAction, isClosingTime } from "../src/engine/actions.js";
import { recommended, setStrategy } from "../src/engine/strategy.js";
import { nextFloat } from "../src/engine/rng.js";

const ARG = process.argv.slice(2);
const MODE = ARG.includes("random") ? "random" : ARG.includes("casual") ? "casual" : "thorough";
const PER_TEAM = ARG.includes("teams");
const TOP_CARDS = ARG.includes("cards");
// Reward policy of the thorough bot: mix (default) | card | upgrade | remove | deal | player
const POLICY = (ARG.find((a) => a.startsWith("policy=")) || "policy=mix").slice(7);

// ---------- Thorough bot: expected-value planning ----------

/** Sum of an effect type over a card's effects, honouring conditions against a virtual tag list. */
function effectSum(run, card, type, tags) {
  let total = 0;
  for (const e of card.effects || []) {
    if (e.type !== type) continue;
    if (e.condition) {
      if (e.condition.type === "tag_played_this_turn") {
        if (!tags.includes(e.condition.tag)) continue;
      } else if (!checkCondition(run, e.condition)) continue;
    }
    total += e.value || 0;
  }
  return total;
}

/**
 * Value of playing a set of cards this turn, in expected points.
 * Order assumed: setup first, then the shot, then defense.
 */
function planValue(run, picks) {
  const m = run.match;
  const cardsOf = picks.map((inst) => ({ inst, card: getCard(run, inst) }));
  const setup = cardsOf.filter((x) => !getShootEffect(x.card) && x.card.type !== "Defense");
  const shots = cardsOf.filter((x) => getShootEffect(x.card));
  const defense = cardsOf.filter((x) => x.card.type === "Defense");
  if (shots.length > m.shotsAllowed - m.shotsTaken) return -Infinity;

  // Affordability (escalating cards counted once each is close enough).
  let cost = 0;
  for (const x of cardsOf) cost += getCardCost(run, x.card);
  if (cost > m.energy) return -Infinity;

  // Requirements, with the tags this plan would have put down before the shot.
  const tags = [...m.playedTags];
  for (const x of setup) tags.push(...(x.card.tags || []));
  for (const x of cardsOf) {
    for (const req of x.card.requires || []) {
      if (req.type === "tag_played_this_turn") {
        if (!tags.includes(req.tag)) return -Infinity;
      } else if (!checkCondition(run, req)) return -Infinity;
    }
  }

  let value = 0;
  let openness = m.openness;
  let contest = m.contest;
  let draws = 0;
  let fatigue = 0;
  for (const x of [...setup, ...defense]) {
    openness += effectSum(run, x.card, "add_openness", tags);
    contest += effectSum(run, x.card, "add_contest", tags);
    draws += effectSum(run, x.card, "draw", tags);
  }
  for (const x of cardsOf) {
    if ((x.card.effects || []).some((e) => e.type === "add_status")) fatigue++;
    if (x.card.status) value += 0.12; // clearing dead weight is worth a little
    if ((x.card.effects || []).some((e) => e.type === "add_buff")) value += 0.25;
    if ((x.card.effects || []).some((e) => e.type === "on_opponent_fail")) value += 0.1;
  }

  // The opponent's play after this plan's Contest.
  const pre = opponentPreview(run);
  let oppBonus = 0;
  // Our own shot, evaluated on a temporarily adjusted state.
  if (shots.length) {
    const saved = { o: m.openness, t: m.playedTags, c: m.turnCards };
    m.openness = openness;
    m.playedTags = tags;
    m.turnCards = [...m.turnCards, ...setup.map((x) => ({ tags: x.card.tags || [], type: x.card.type, points: null }))];
    for (const x of shots) {
      const s = calcShot(run, x.inst);
      const p = s.pct / 100;
      value += p * s.points;
      // A miss can be a turnover that helps them.
      for (const e of x.card.onMiss || []) if (e.type === "opp_bonus") oppBonus += (1 - p) * e.value;
      if (x.card.exhaust) value -= 0.12; // spending a once-per-game card has an opportunity cost
      m.openness = 0; // a shot uses all Openness (matters for a second shot)
    }
    m.openness = saved.o;
    m.playedTags = saved.t;
    m.turnCards = saved.c;
  } else if (m.shotsTaken === 0) {
    value -= 0.15; // a turn without a shot scores nothing (already true), and wastes built Openness
  }

  let oppPct = Math.max(5, Math.min(95, pre.basePct + oppBonus - (pre.contest + (contest - m.contest))));
  let oppEV = (oppPct / 100) * pre.intent.points;
  for (const x of defense) {
    for (const e of x.card.effects || []) {
      if (e.type !== "steal_attempt" || pre.intent.unblockableBySteal) continue;
      const c = Math.min(95, e.chance) / 100;
      const failBonus = (e.onFail || []).filter((f) => f.type === "opp_bonus").reduce((s, f) => s + f.value, 0);
      const failEV = (Math.min(95, oppPct + failBonus) / 100) * pre.intent.points;
      oppEV = c * 0 + (1 - c) * failEV;
      value += c * 0.3; // the extra draws next turn
    }
  }
  value -= oppEV;
  value += draws * 0.12;
  value -= fatigue * 0.22;
  value += Math.min(CONFIG.CARRY_MAX || 0, m.energy - cost) * 0.012; // banked seconds are worth a little
  return value;
}

/** Best subset of the hand by planValue (hands are small: at most 2^n subsets). */
function bestPlan(run) {
  const m = run.match;
  const hand = m.hand.slice(0, 9);
  let best = { value: planValue(run, []), picks: [] };
  const n = hand.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const picks = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) picks.push(hand[i]);
    if (picks.length > 5) continue;
    const value = planValue(run, picks);
    if (value > best.value + 1e-9) best = { value, picks };
  }
  return best;
}

function thoroughTurn(run) {
  const m = run.match;
  // Coach actions: simple, explainable heuristics.
  const pre = opponentPreview(run);
  const canShoot = m.hand.some((c) => getShootEffect(getCard(run, c)) && canPlay(run, c.iid).ok);
  if (!canShoot && m.shotsTaken === 0 && canUseAction(run, "regroup").ok) useAction(run, "regroup");
  if (isClosingTime(run) && pre.intent.points >= 3 && pre.pct >= 55 && canUseAction(run, "foul").ok) useAction(run, "foul");
  else if (pre.pct >= 66 && (isClosingTime(run) || m.timeouts > 1) && canUseAction(run, "ice").ok) useAction(run, "ice");

  // Plan, play, and re-plan while cards drawn mid-turn open something better.
  for (let pass = 0; pass < 4 && !m.over && !m.turnEnded; pass++) {
    const plan = bestPlan(run);
    if (!plan.picks.length) break;
    const order = (inst) => {
      const card = getCard(run, inst);
      return getShootEffect(card) ? 1 : card.type === "Defense" ? 2 : 0;
    };
    let played = 0;
    for (const inst of [...plan.picks].sort((a, b) => order(a) - order(b))) {
      if (m.over || m.turnEnded) break;
      if (!m.hand.some((c) => c.iid === inst.iid)) continue;
      if (canPlay(run, inst.iid).ok) {
        playCard(run, inst.iid);
        played++;
      }
    }
    if (!played) break;
  }
  if (m.over || m.turnEnded) return;
  // Hold the most valuable card left (a shot first, then the dearest card).
  const keep = m.hand
    .filter((c) => !getCard(run, c).status)
    .sort((a, b) => {
      const ca = getCard(run, a);
      const cb = getCard(run, b);
      return (getShootEffect(cb) ? 100 : 0) + cb.cost - ((getShootEffect(ca) ? 100 : 0) + ca.cost);
    })[0];
  if (keep) toggleHold(run, keep.iid);
  endTurn(run);
}

// ---------- Casual and random bots ----------

function casualTurn(run) {
  const m = run.match;
  const playable = () => m.hand.filter((c) => canPlay(run, c.iid).ok);
  const first = (types) => playable().find((c) => types.includes(getCard(run, c).type));
  // Keep enough clock for the cheapest shot in hand, then one setup card, the shot, one defense card.
  const shotsInHand = m.hand.filter((c) => getShootEffect(getCard(run, c)));
  const reserve = shotsInHand.length ? Math.min(...shotsInHand.map((c) => getCardCost(run, getCard(run, c)))) : 0;
  const setup = playable().find((c) => ["Offense", "Utility", "Buff"].includes(getCard(run, c).type) && m.energy - getCardCost(run, getCard(run, c)) >= reserve);
  if (setup) playCard(run, setup.iid);
  const shot = first(["Shot"]);
  if (shot && !m.over) playCard(run, shot.iid);
  const def = first(["Defense"]);
  if (def && !m.over) playCard(run, def.iid);
  if (!m.over) endTurn(run);
}

function randomTurn(run, dice) {
  const m = run.match;
  let guard = 0;
  while (!m.over && guard++ < 12) {
    const playable = m.hand.filter((c) => canPlay(run, c.iid).ok);
    if (!playable.length || nextFloat(dice) < 0.2) break;
    playCard(run, playable[Math.floor(nextFloat(dice) * playable.length)].iid);
  }
  if (!m.over) endTurn(run);
}

export function botTurn(run, mode = MODE, dice = null) {
  if (mode === "random") randomTurn(run, dice || run);
  else if (mode === "casual") casualTurn(run);
  else thoroughTurn(run);
}

// ---------- Seasons ----------

/** Play `runs` seasons. Returns per-stop and per-team tallies. */
export function simulate(runs, { mode = MODE, teams = content.teams, config = CONFIG, casual = false, policy = POLICY } = {}) {
  if (casual) mode = "casual";
  const c = { ...content, teams };
  const stops = {};
  const byTeam = {};
  const plans = {};
  const winCards = {};
  const winUpgrades = {};
  const winPerks = {};
  const rewardsTaken = {};
  const stat = { cards: 0, turns: 0, shots: 0, makes: 0 };
  let champions = 0;
  let matches = 0;
  let turns = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const run = createRun(c, config, seed);
    const dice = { rngState: seed * 7919 + 13 }; // the random bot's own dice: never the game's RNG
    let guard = 0;
    const reached = new Set();
    while (run.phase === "map" && guard++ < 30) {
      const stop = run.schedule[run.round];
      const roundBefore = run.round;
      if (mode === "thorough") setStrategy(run, recommended(run, c.teams.find((t) => t.id === stop.teamId)));
      const plan = `${run.strategy.offense} / ${run.strategy.defense}`;
      plans[plan] = (plans[plan] || 0) + 1;
      startMatch(run);
      const cardsBefore = run.stats.cardsPlayed;
      let g = 0;
      while (!run.match.over && g++ < 300) botTurn(run, mode, dice);
      const won = run.match.winner === "player";
      matches++;
      turns += run.match.turn;
      stat.cards += run.stats.cardsPlayed - cardsBefore;
      stat.turns += run.match.turn;
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
        const took = pickReward(run, mode, dice, policy);
        if (took) rewardsTaken[took] = (rewardsTaken[took] || 0) + 1;
      } else if (run.phase === "victory") {
        s.cleared++;
        champions++;
        // Only what the run added or improved: starters and signature cards are in every deck.
        for (const id of new Set(run.deck.filter((d) => d.source === "reward").map((d) => d.cardId))) winCards[id] = (winCards[id] || 0) + 1;
        for (const id of new Set(run.deck.filter((d) => d.up).map((d) => d.cardId))) winUpgrades[id] = (winUpgrades[id] || 0) + 1;
        for (const p of run.perks || []) winPerks[p.id] = (winPerks[p.id] || 0) + 1;
      }
    }
    stat.shots += run.stats.shots;
    stat.makes += run.stats.makes;
  }
  return { runs, mode, stops, byTeam, plans, winCards, winUpgrades, winPerks, rewardsTaken, stat, champions, matches, turns };
}

// ---------- Rewards ----------

// What the thorough bot upgrades first (cheaper shots open up three-card turns) and cuts first.
const UPGRADE_ORDER = ["pull_up_jumper", "euro_step", "drive_and_finish", "alley_oop", "catch_and_shoot_3", "corner_three", "step_back_3", "lockdown", "pick_and_roll", "contest"];
const CUT_ORDER = ["film_study", "iso", "hard_screen", "swing_pass", "no_look_dime", "help_defense", "box_out", "swipe", "contest"];
const byOrder = (run, list, order) => {
  for (const id of order) {
    const hit = list.find((c) => c.cardId === id);
    if (hit) return hit;
  }
  return list[0] || null;
};

/** Take a reward. Returns the kind taken (or null). */
export function pickReward(run, mode, dice, policy = "mix") {
  const opts = run.rewards || [];
  const idxOf = (kind) => opts.findIndex((o) => o.kind === kind);
  const take = (kind) => {
    const i = idxOf(kind);
    if (i < 0) return false;
    let params = {};
    if (kind === "upgrade") {
      const list = upgradable(run);
      const inst = mode === "random" ? list[Math.floor(nextFloat(dice) * list.length)] : byOrder(run, list, UPGRADE_ORDER);
      params = { iid: inst && inst.iid };
    } else if (kind === "remove") {
      const list = removable(run);
      const inst = mode === "random" ? list[Math.floor(nextFloat(dice) * list.length)] : byOrder(run, list, CUT_ORDER);
      params = { iid: inst && inst.iid };
    } else if (kind === "player") {
      params = { slot: dice ? Math.floor(nextFloat(dice) * 5) : 0 };
    }
    return applyReward(run, i, params);
  };
  let order;
  if (mode === "random") {
    const kinds = opts.map((o) => o.kind);
    order = [kinds[Math.floor(nextFloat(dice) * kinds.length)], ...kinds];
  } else if (mode === "casual") {
    order = ["card", "upgrade", "remove"]; // "more cards is better"
  } else if (policy === "mix") {
    order = [["upgrade", "remove", "card"], ["remove", "upgrade", "card"], ["upgrade", "remove", "card"]][run.round % 3];
  } else {
    order = [policy, "upgrade", "remove", "card"];
  }
  for (const kind of order) if (take(kind)) return kind;
  return null;
}

function report(r) {
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1).padStart(5) + "%" : "    -");
  console.log(`runs: ${r.runs}  bot: ${r.mode}  matches: ${r.matches}  turns/match: ${(r.turns / r.matches).toFixed(1)}  cards/turn: ${(r.stat.cards / r.stat.turns).toFixed(2)}  shooting: ${pct(r.stat.makes, r.stat.shots).trim()}`);
  for (const [name, s] of Object.entries(r.stops)) {
    console.log(`${name.padEnd(8)} reached ${String(s.reached).padStart(5)}  cleared ${pct(s.cleared, s.reached)}  game win rate ${pct(s.wins, s.games)}`);
  }
  console.log(`full run (champions): ${pct(r.champions, r.runs)}`);
  const top = Object.entries(r.plans).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const taken = Object.entries(r.rewardsTaken).sort((a, b) => b[1] - a[1]);
  if (taken.length) console.log(`rewards taken: ${taken.map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`plans used: ${top.map(([k, v]) => `${k} ${Math.round((100 * v) / r.matches)}%`).join(", ")}`);
  if (TOP_CARDS && r.champions) {
    const top5 = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${id} ${Math.round((100 * n) / r.champions)}%`).join(", ") || "-";
    console.log(`winning decks (${r.champions}), cards added:    ${top5(r.winCards)}`);
    console.log(`winning decks (${r.champions}), cards upgraded: ${top5(r.winUpgrades)}`);
    console.log(`winning decks (${r.champions}), deals:          ${top5(r.winPerks)}`);
  }
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
  const runs = Number(ARG.find((a) => /^\d+$/.test(a))) || 2000;
  report(simulate(runs));
}
