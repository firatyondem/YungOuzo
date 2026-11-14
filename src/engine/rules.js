// Pure rule calculations: chemistry, costs, shot %, opponent %, playability.
// Nothing in here mutates state or references a specific card/player/team.
//
// ORDER OF OPERATIONS (your shot):
//   base + Openness + rating x multiplier - opponent DEF + card bonuses + chemistry
//   + team rules (shot_mod), clamp to 5-95, then team multipliers (shot_mult), clamp again.
// ORDER OF OPERATIONS (their attempt):
//   intent % + clutch + team rule bonuses, minus your Contest (after any ignored part), clamp to 5-95.
// Every modifier that applies is returned in `notes` with the name of its source,
// so the UI can explain the number.
import { rulesOf, firstRule, phaseIntents, intentMatches, weakestDefender } from "./teamRules.js";
import { playFor } from "./plays.js";

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function clampPct(run, v) {
  return clamp(v, run.config.PCT_MIN, run.config.PCT_MAX);
}

export function getTeam(run) {
  return run.content.teams.find((t) => t.id === run.match.teamId);
}

/** The card an instance stands for. An upgraded instance (inst.up) costs
 *  UPGRADE_DISCOUNT seconds less, or uses the card's own `upgrade` patch from cards.json. */
export function getCard(run, inst) {
  const base = run.content.cards[inst.cardId];
  if (!base || !inst.up) return base;
  const cache = (run.content.upgradedCards ||= {});
  if (!cache[base.id]) {
    const off = run.config.UPGRADE_DISCOUNT ?? 4;
    const patch = base.upgrade || {};
    cache[base.id] = {
      ...base,
      cost: Math.max(0, base.cost - off),
      text: `${base.text} Upgraded: -${off}s.`,
      ...patch,
      name: `${base.name}+`,
      upgraded: true,
    };
  }
  return cache[base.id];
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
  if (run.match) {
    for (const r of rulesOf(run, "card_cost")) {
      if (r.tag && !(card.tags || []).includes(r.tag)) continue;
      if (r.cardType && card.type !== r.cardType) continue;
      if (r.cardId && card.id !== r.cardId) continue;
      cost += r.value;
    }
  }
  // Escalating cost: each earlier play of this card in the same game makes it dearer.
  if (run.match && card.escalate) cost += card.escalate * ((run.match.cardPlays || {})[card.id] || 0);
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
  if (points >= 3) bonus += (m.buffs.threeStreakBonus || 0) * m.threeStreak;

  let defense = Math.max(0, getTeam(run).defense - ignore); // never below 0
  let rating = shooter.ratings[ratingKey];
  const notes = [];
  // Cold spell: the price of a missed heat check, on your next three only.
  if (points >= 3 && m.threeCold) {
    bonus -= m.threeCold;
    notes.push({ label: "Cold spell", value: -m.threeCold });
  }
  // Play call: the right sequence of cards this turn boosts the shot that finishes it.
  const play = playFor(run, card);
  if (play) {
    bonus += play.bonus;
    if (play.defenseMult != null) defense *= play.defenseMult;
    notes.push({ label: play.name, value: play.bonus });
  }
  // Coach calls for this turn (timeouts, closing options).
  if (m.mods && m.mods.shotBonus) {
    bonus += m.mods.shotBonus;
    notes.push({ label: "Coach call", value: m.mods.shotBonus });
  }
  const cap = firstRule(run, "rating_cap");
  if (cap && rating > cap.value) {
    notes.push({ label: cap.label, text: `${ratingKey} counts as ${cap.value}` });
    rating = cap.value;
  }
  let ruleBonus = 0;
  const tags = card.tags || [];
  for (const r of rulesOf(run, "shot_mod")) {
    if (r.points && r.points !== points) continue;
    if (r.tag && !tags.includes(r.tag)) continue;
    if (r.noPass && m.playedTags.includes("Pass")) continue; // double teams punish shots without ball movement
    if (r.archetype && shooter.archetype !== r.archetype) continue;
    if (r.star != null && r.star !== (shooter.id === (run.strategy && run.strategy.starId))) continue;
    ruleBonus += r.value;
    notes.push({ label: r.label, value: r.value });
  }
  const raw = cfg.BASE_PCT[points] + m.openness + rating * mult - defense + bonus + ruleBonus;
  let pct = clampPct(run, raw);
  for (const r of rulesOf(run, "shot_mult")) {
    if (r.points && r.points !== points) continue;
    pct = clampPct(run, pct * r.value);
    notes.push({ label: r.label, text: `x${r.value}` });
  }
  return {
    pct,
    ruleBonus,
    notes,
    play,
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
  const m = run.match;
  const nth = firstRule(run, "every_nth_intent");
  if (nth && m.opp && (m.opp.possessions + 1) % nth.n === 0) return { ...nth.intent, setPlay: true, setPlayLabel: nth.label };
  const intents = phaseIntents(run);
  // A coached opponent may have picked the next play in its cycle instead (see turnLoop.chooseIntent).
  const index = m.opp && m.opp.pick != null ? m.opp.pick : m.intentIndex;
  return intents[index % intents.length];
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
  const m = run.match;
  const opp = m.opp || { streak: 0, possessions: 0, hot: 0, adapted: null };
  const intent = currentIntent(run);
  const clutch = isClutch(run);
  const notes = [];
  let basePct = intent.pct + (clutch ? getTeam(run).clutch.bonus : 0);
  const add = (label, value, text) => {
    if (!value) return;
    basePct += value;
    notes.push({ label, value, text });
  };
  if (intent.setPlay) notes.push({ label: intent.setPlayLabel || "Set play", value: 0 });
  for (const r of rulesOf(run, "intent_bonus")) if (intentMatches(r, intent)) add(r.label, r.value);
  for (const r of rulesOf(run, "streak_bonus")) add(r.label, Math.min(r.cap, r.value * opp.streak), `${opp.streak} in a row`);
  for (const r of rulesOf(run, "ramp_bonus")) add(r.label, Math.min(r.cap, r.value * opp.possessions));
  for (const r of rulesOf(run, "late_bonus")) {
    const close = Math.abs(m.score.player - m.score.opp) <= r.within;
    const late = Math.max(m.score.player, m.score.opp) >= m.target - r.window;
    if (close && late) add(r.label, r.value, "close and late");
  }
  const hot = firstRule(run, "hot_streak");
  if (hot && opp.hot > 0) add(hot.label, hot.bonus, "on fire");
  for (const r of rulesOf(run, "mismatch_bonus")) {
    const weak = weakestDefender(run);
    add(r.label, Math.max(0, 5 - weak.ratings.DEF) * r.perPoint, `attacking ${weak.name}`);
  }
  if (opp.adapted && (intent.tags || []).includes(opp.adapted.tag)) add(opp.adapted.label, opp.adapted.bonus, "adapted");
  if (opp.readNote) notes.push({ label: "Coach read", value: 0, text: opp.readNote });
  if (m.mods && m.mods.ice) add("Iced", -m.mods.ice, "timeout");
  // Consequences of your own mistakes this turn (turnovers, failed steals).
  for (const b of (m.mods && m.mods.oppBonus) || []) add(b.label, b.value, "your mistake");

  // Your Contest, after any part the opponent ignores.
  let contest = m.contest;
  for (const r of rulesOf(run, "ignore_contest")) {
    if (!intentMatches(r, intent) || contest <= 0) continue;
    const ignored = Math.min(contest, r.value);
    contest -= ignored;
    notes.push({ label: r.label, value: 0, text: `ignores ${Math.round(ignored)} Contest` });
  }
  const all = firstRule(run, "ignore_all_contest_every");
  if (all && (opp.possessions + 1) % all.n === 0) {
    contest = 0;
    notes.push({ label: all.label, value: 0, text: "ignores all Contest" });
  }
  return {
    intent,
    clutch,
    basePct,
    contest,
    pct: clampPct(run, basePct - contest),
    steals: m.steals.length,
    notes,
    foul: (m.mods && m.mods.foul) || null,
  };
}
