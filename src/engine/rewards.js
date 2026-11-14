// Post-win rewards: new card / new player (replaces a slot) / +1 rating.
// Pools come from rewards.json, picks use the seeded RNG.
import { pick } from "./rng.js";
import { makeInstance } from "./deck.js";
import { clonePlayer } from "./gameState.js";

const RATINGS = ["SHT", "INS", "DEF", "PLY"];

export function generateRewards(run) {
  const pool = run.content.rewards;
  const maxRating = pool.maxRating || 5;
  const options = [];

  const cardIds = (pool.cards || []).filter((id) => run.content.cards[id]);
  if (cardIds.length) options.push({ kind: "card", cardId: pick(run, cardIds) });

  const inLineup = new Set(run.lineup.map((p) => p.id));
  const playerIds = (pool.players || []).filter((id) => run.content.players[id] && !inLineup.has(id));
  if (playerIds.length) options.push({ kind: "player", playerId: pick(run, playerIds) });

  // Only valid upgrades (rating below the cap).
  const upgrades = [];
  for (const p of run.lineup) {
    for (const r of RATINGS) if (p.ratings[r] < maxRating) upgrades.push({ playerId: p.id, rating: r });
  }
  if (upgrades.length) options.push({ kind: "upgrade", amount: 1, ...pick(run, upgrades) });

  run.rewards = options;
  return options;
}

/** Swap a lineup slot: only the old player's own signature instances leave the deck. */
export function replacePlayer(run, slot, newPlayerId) {
  const old = run.lineup[slot];
  const template = run.content.players[newPlayerId];
  if (!old || !template) return false;
  run.deck = run.deck.filter((c) => c.source !== old.id);
  const np = clonePlayer(template);
  run.lineup[slot] = np;
  for (const id of np.signatureCards) run.deck.push(makeInstance(run, id, np.id));
  if (run.strategy && run.strategy.starId === old.id) run.strategy.starId = np.id;
  return true;
}

/** Take reward `index`. For a player reward pass { slot }. Advances to the next round. */
export function applyReward(run, index, params = {}) {
  if (run.phase !== "reward" || !run.rewards) return false;
  const opt = run.rewards[index];
  if (!opt) return false;
  const maxRating = run.content.rewards.maxRating || 5;
  if (opt.kind === "card") {
    run.deck.push(makeInstance(run, opt.cardId, "reward"));
  } else if (opt.kind === "player") {
    const slot = params.slot;
    if (!(slot >= 0 && slot < run.lineup.length)) return false;
    replacePlayer(run, slot, opt.playerId);
  } else if (opt.kind === "upgrade") {
    const p = run.lineup.find((x) => x.id === opt.playerId);
    if (!p) return false;
    p.ratings[opt.rating] = Math.min(maxRating, p.ratings[opt.rating] + opt.amount);
  }
  run.rewards = null;
  run.round++;
  run.phase = "map";
  run.match = null;
  return true;
}

/** Skip the reward (still advances). */
export function skipReward(run) {
  if (run.phase !== "reward") return false;
  run.rewards = null;
  run.round++;
  run.phase = "map";
  run.match = null;
  return true;
}
