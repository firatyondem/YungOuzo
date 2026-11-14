// Post-win rewards. Every choice is a sacrifice:
//   card     a powerful new card         (your deck gets bigger, so you see each card less)
//   upgrade  upgrade a card you own      (no new tool)
//   remove   cut a card from your deck   (one option fewer, but a tighter deck)
//   deal     a front-office deal         (a permanent bonus with a permanent price)
//   player   sign a player               (replaces a starter and their signature cards)
// The fourth option is either a deal or a player. Pools come from rewards.json,
// picks use the seeded RNG. Knobs: UPGRADE_DISCOUNT, MIN_DECK, MIN_SHOTS in config.
import { pick } from "./rng.js";
import { makeInstance } from "./deck.js";
import { clonePlayer } from "./gameState.js";

const isShot = (card) => (card.effects || []).some((e) => e.type === "shoot");

/** Deck instances that can still be upgraded. */
export function upgradable(run) {
  return run.deck.filter((c) => !c.up && run.content.cards[c.cardId] && !run.content.cards[c.cardId].status);
}

/** Deck instances you may cut: the deck keeps MIN_DECK cards and MIN_SHOTS shot cards. */
export function removable(run) {
  const cfg = run.config;
  if (run.deck.length <= (cfg.MIN_DECK ?? 12)) return [];
  const shots = run.deck.filter((c) => isShot(run.content.cards[c.cardId])).length;
  return run.deck.filter((c) => !isShot(run.content.cards[c.cardId]) || shots > (cfg.MIN_SHOTS ?? 4));
}

const CATEGORIES = ["Setup", "Finishing", "Defensive", "High-risk"];

/**
 * What the deck is and what it lacks, for the reward screen.
 * -> { size, byCategory, byArchetype, lean, lacks: [text], hint }
 */
export function deckSummary(run) {
  const cards = run.deck.map((c) => run.content.cards[c.cardId]).filter(Boolean);
  const size = cards.length;
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const byArchetype = {};
  let shots = 0;
  let defense = 0;
  let threes = 0;
  for (const c of cards) {
    if (byCategory[c.category] != null) byCategory[c.category]++;
    if (c.archetype) byArchetype[c.archetype] = (byArchetype[c.archetype] || 0) + 1;
    const shoot = (c.effects || []).find((e) => e.type === "shoot");
    if (shoot) {
      shots++;
      if (shoot.points >= 3) threes++;
    }
    if (c.type === "Defense") defense++;
  }
  const names = run.content.rewards.archetypes || {};
  const ranked = Object.entries(byArchetype)
    .filter(([k]) => k !== "Balanced")
    .sort((a, b) => b[1] - a[1]);
  const lean = ranked.length && ranked[0][1] >= 3 && (!ranked[1] || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : "Balanced";
  const share = (n) => (size ? n / size : 0);
  const lacks = [];
  if (share(shots) < 0.28) lacks.push(`shots (${shots} of ${size}): expect shot-clock violations`);
  if (share(defense) < 0.2) lacks.push(`defense (${defense} of ${size}): they will attack you`);
  if (share(byCategory.Setup) < 0.25) lacks.push(`setup (${byCategory.Setup} of ${size}): your shots will be contested`);
  if (shots && threes === 0) lacks.push("a three-point shot: they can sit in the paint");
  if (shots && threes === shots) lacks.push("a two-point shot: they can sit on the line");
  const hint = lacks.length ? `Your deck lacks ${lacks[0]}.` : `Your deck is rounded. It leans ${names[lean] || lean}.`;
  return { size, byCategory, byArchetype, lean, leanName: names[lean] || lean, lacks, hint };
}

export function generateRewards(run) {
  const pool = run.content.rewards;
  const options = [];

  // A: a powerful new card (uncommon or better when the pool has them).
  const cardIds = (pool.cards || []).filter((id) => run.content.cards[id]);
  const strong = cardIds.filter((id) => (run.content.cards[id].rarity || "common") !== "common");
  if (cardIds.length) options.push({ kind: "card", cardId: pick(run, strong.length ? strong : cardIds) });

  // B and C: you choose the card on the next screen.
  if (upgradable(run).length) options.push({ kind: "upgrade" });
  if (removable(run).length) options.push({ kind: "remove" });

  // D: the front office: a trade-off deal, or a player who replaces a starter.
  const owned = new Set((run.perks || []).map((p) => p.id));
  const deals = (pool.deals || []).filter((d) => !owned.has(d.id));
  const inLineup = new Set(run.lineup.map((p) => p.id));
  const playerIds = (pool.players || []).filter((id) => run.content.players[id] && !inLineup.has(id));
  const office = [];
  if (deals.length) office.push("deal");
  if (playerIds.length) office.push("player");
  if (office.length) {
    const kind = pick(run, office);
    if (kind === "deal") options.push({ kind: "deal", dealId: pick(run, deals).id });
    else options.push({ kind: "player", playerId: pick(run, playerIds) });
  }

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

/**
 * Take reward `index`. Params: { slot } for a player, { iid } (a deck instance)
 * for upgrade and remove. Returns false (and changes nothing) if the choice is
 * not valid. Advances to the next round.
 */
export function applyReward(run, index, params = {}) {
  if (run.phase !== "reward" || !run.rewards) return false;
  const opt = run.rewards[index];
  if (!opt) return false;
  if (opt.kind === "card") {
    run.deck.push(makeInstance(run, opt.cardId, "reward"));
  } else if (opt.kind === "upgrade") {
    const inst = upgradable(run).find((c) => c.iid === params.iid);
    if (!inst) return false;
    inst.up = true;
  } else if (opt.kind === "remove") {
    const inst = removable(run).find((c) => c.iid === params.iid);
    if (!inst) return false;
    run.deck = run.deck.filter((c) => c !== inst);
  } else if (opt.kind === "deal") {
    const deal = (run.content.rewards.deals || []).find((d) => d.id === opt.dealId);
    if (!deal) return false;
    (run.perks ||= []).push({ id: deal.id, name: deal.name, text: deal.text, effects: deal.effects || [] });
  } else if (opt.kind === "player") {
    const slot = params.slot;
    if (!(slot >= 0 && slot < run.lineup.length)) return false;
    replacePlayer(run, slot, opt.playerId);
  } else {
    return false;
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
