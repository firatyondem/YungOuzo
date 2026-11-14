// Pure rule calculations: chemistry, costs, shot %, opponent %, playability.
// Nothing in here mutates state or references a specific card/player/team.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function clampPct(run, v) {
  return clamp(v, run.config.PCT_MIN, run.config.PCT_MAX);
}

export function getTeam(run) {
  return run.content.teams.find((t) => t.id === run.match.teamId);
}

export function getCard(run, inst) {
  return run.content.cards[inst.cardId];
}

export function lineupAverage(run, rating) {
  if (!run.lineup.length) return 0;
  return run.lineup.reduce((s, p) => s + p.ratings[rating], 0) / run.lineup.length;
}

// ---------- Chemistry ----------

/** Active chemistry bonuses: [{archetype, count, name, text, effect}] */
export function getActiveChemistry(run) {
  const counts = {};
  for (const p of run.lineup) counts[p.archetype] = (counts[p.archetype] || 0) + 1;
  const out = [];
  for (const [archetype, def] of Object.entries(run.content.chemistry)) {
    if ((counts[archetype] || 0) >= (def.threshold || 2)) {
      out.push({ archetype, count: counts[archetype], ...def });
    }
  }
  return out;
}

/** Sum of `value` across active chemistry effects of a given type. */
export function chemistrySum(run, type, match = () => true) {
  let sum = 0;
  for (const c of getActiveChemistry(run)) {
    if (c.effect && c.effect.type === type && match(c.effect)) sum += c.effect.value || 0;
  }
  return sum;
}

export function passiveOpenness(run) {
  return lineupAverage(run, "PLY") * run.config.PASSIVE_OPENNESS_MULT;
}

export function passiveContest(run) {
  return (
    lineupAverage(run, "DEF") * run.config.PASSIVE_CONTEST_MULT + chemistrySum(run, "passive_contest")
  );
}

// ---------- Conditions (data-driven) ----------

export function checkCondition(run, cond) {
  if (!cond) return true;
  const m = run.match;
  switch (cond.type) {
    case "archetype_in_lineup":
      return run.lineup.some((p) => p.archetype === cond.archetype);
    case "tag_played_this_turn":
      return !!m && m.playedTags.includes(cond.tag);
    case "opponent_last_failed":
      return !!m && m.lastOppFailed;
    case "missed_shot_this_turn":
      return !!m && m.missedShotThisTurn;
    default:
      return false;
  }
}

export function conditionText(cond) {
  switch (cond.type) {
    case "archetype_in_lineup":
      return `Needs a ${cond.archetype} in your lineup`;
    case "tag_played_this_turn":
      return `Play a ${cond.tag} card first`;
    case "opponent_last_failed":
      return "Only after an opponent miss";
    case "missed_shot_this_turn":
      return "Only after you miss a shot this turn";
    default:
      return "Requirement not met";
  }
}

// ---------- Cards ----------

export function getCardCost(run, card) {
  let cost = card.cost;
  for (const tag of card.tags || []) {
    cost -= chemistrySum(run, "tag_cost_reduction", (e) => e.tag === tag);
  }
  return Math.max(0, cost);
}

export function getShootEffect(card) {
  return (card.effects || []).find((e) => e.type === "shoot") || null;
}

/** Card owner if they are in the lineup, otherwise the best player for the shot. */
export function selectShooter(run, inst, points) {
  const key = run.config.SHOT_RATING[points];
  const owner = run.lineup.find((p) => p.id === inst.source);
  if (owner) return owner;
  let best = run.lineup[0];
  for (const p of run.lineup) if (p.ratings[key] > best.ratings[key]) best = p;
  return best;
}

/**
 * Shot preview for a card instance (null if the card is not a shot).
 * makePct = base + openness + rating * mult - opponentDefense (+ bonuses), clamped.
 */
export function calcShot(run, inst) {
  const card = getCard(run, inst);
  const eff = card && getShootEffect(card);
  if (!eff || !run.match) return null;
  const m = run.match;
  const cfg = run.config;
  const points = eff.points;
  const ratingKey = cfg.SHOT_RATING[points];
  const shooter = selectShooter(run, inst, points);

  let mult = cfg.RATING_MULT;
  let ignore = 0;
  let bonus = 0;
  for (const mod of eff.modifiers || []) {
    if (mod.condition && !checkCondition(run, mod.condition)) continue;
    if (mod.type === "bonus") bonus += mod.value;
    else if (mod.type === "ignore_defense") ignore += mod.value;
    else if (mod.type === "rating_multiplier") mult = mod.value;
  }
  // Chemistry (e.g. +5% on 3PT) and match buffs (e.g. heat check streak).
  bonus += chemistrySum(run, "shot_bonus", (e) => e.points === points);
  if (points === 3) bonus += (m.buffs.threeStreakBonus || 0) * m.threeStreak;

  const defense = Math.max(0, getTeam(run).defense - ignore); // never below 0
  const rating = shooter.ratings[ratingKey];
  const raw = cfg.BASE_PCT[points] + m.openness + rating * mult - defense + bonus;
  return {
    pct: clampPct(run, raw),
    raw,
    points,
    shooter,
    ratingKey,
    base: cfg.BASE_PCT[points],
    openness: m.openness,
    ratingBonus: rating * mult,
    defense,
    bonus,
  };
}

/** Can this card instance be played right now? -> { ok, reason } */
export function canPlay(run, iid) {
  const m = run.match;
  if (!m || m.over) return { ok: false, reason: "No match in progress" };
  if (m.turnEnded) return { ok: false, reason: "Turn is over" };
  const inst = m.hand.find((c) => c.iid === iid);
  if (!inst) return { ok: false, reason: "Card is not in hand" };
  const card = getCard(run, inst);
  if (getCardCost(run, card) > m.energy) return { ok: false, reason: "Not enough shot clock" };
  for (const req of card.requires || []) {
    if (!checkCondition(run, req)) return { ok: false, reason: conditionText(req) };
  }
  if (getShootEffect(card) && m.shotsTaken >= m.shotsAllowed && !card.ignoresShotLimit) {
    return { ok: false, reason: "One shot per turn" };
  }
  return { ok: true, reason: "" };
}

// ---------- Opponent ----------

export function currentIntent(run) {
  const t = getTeam(run);
  return t.intents[run.match.intentIndex % t.intents.length];
}

/** Clutch: team-defined bonus when either side is within N points of the target. */
export function isClutch(run) {
  const t = getTeam(run);
  if (!t.clutch) return false;
  const m = run.match;
  const threshold = m.target - t.clutch.within;
  return m.score.player >= threshold || m.score.opp >= threshold;
}

/** What the opponent will attempt, and their chance after your Contest. */
export function opponentPreview(run) {
  const intent = currentIntent(run);
  const clutch = isClutch(run);
  const basePct = intent.pct + (clutch ? getTeam(run).clutch.bonus : 0);
  return {
    intent,
    clutch,
    basePct,
    contest: run.match.contest,
    pct: clampPct(run, basePct - run.match.contest),
    steals: run.match.steals.length,
  };
}
