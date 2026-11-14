// Generic, data-driven effect system. Cards list effects in cards.json;
// each effect type has one handler here. No per-card logic.
import { missConsequence } from "./adapt.js";
import { drawCards, discardHand } from "./deck.js";
import { roll100 } from "./rng.js";
import { calcShot, checkCondition, getCard } from "./rules.js";
import { rulesOf } from "./teamRules.js";

export function log(run, text) {
  const m = run.match;
  if (!m) return;
  m.log.push(text);
  if (m.log.length > 40) m.log.shift();
}

const HANDLERS = {
  add_openness(run, e, ctx) {
    run.match.openness += e.value;
    ctx.events.push({ type: "openness", value: e.value });
  },

  add_contest(run, e, ctx) {
    run.match.contest += e.value;
    ctx.events.push({ type: "contest", value: e.value });
  },

  draw(run, e, ctx) {
    const drawn = drawCards(run, e.value);
    ctx.events.push({ type: "draw", count: drawn.length });
  },

  discard_hand(run) {
    discardHand(run);
  },

  gain_energy(run, e, ctx) {
    const m = run.match;
    m.energy = Math.min(m.maxEnergy, m.energy + e.value);
    ctx.events.push({ type: "energy", value: e.value });
  },

  // Match-long numeric buff, e.g. threeStreakBonus (+X% on 3PT per consecutive made 3).
  add_buff(run, e, ctx) {
    const m = run.match;
    m.buffs[e.buff] = (m.buffs[e.buff] || 0) + e.value;
    ctx.events.push({ type: "buff", buff: e.buff, value: e.value });
  },

  // Rolled when the opponent attempts; see turnLoop.resolveOpponent.
  steal_attempt(run, e, ctx) {
    const chance = Math.max(0, Math.min(95, e.chance + rulesOf(run, "steal_bonus").reduce((s, r) => s + r.value, 0)));
    run.match.steals.push({ chance, onSuccess: e.onSuccess || [], onFail: e.onFail || [] });
    ctx.events.push({ type: "steal_set", chance });
  },

  // Effects that fire if the opponent's attempt this turn fails (miss or steal).
  on_opponent_fail(run, e) {
    run.match.onOppFail.push(...(e.effects || []));
  },

  // Their play this possession gets easier because of something you did (turnover, failed steal).
  opp_bonus(run, e) {
    run.match.mods.oppBonus.push({ label: e.label || "Mistake", value: e.value });
  },

  // Fatigue: a status card (dead weight) joins your deck for the rest of this game.
  add_status(run, e, ctx) {
    const m = run.match;
    for (let i = 0; i < (e.count || 1); i++) m.discard.push({ iid: "s" + run.nextIid++, cardId: e.cardId, source: "status" });
    const name = (run.content.cards[e.cardId] || {}).name || e.cardId;
    log(run, `Fatigue: ${name} added to your deck.`);
    ctx.events.push({ type: "status_added", cardId: e.cardId, name });
  },

  // --- Coach actions (timeouts and closing options) ---
  ice_intent(run, e, ctx) {
    run.match.mods.ice += e.value;
    ctx.events.push({ type: "iced", value: e.value });
  },

  add_energy(run, e, ctx) {
    run.match.energy += e.value; // may exceed the normal shot clock for this turn
    ctx.events.push({ type: "energy", value: e.value });
  },

  foul_intent(run, e, ctx) {
    run.match.mods.foul = { shots: e.shots, pct: e.pct };
    ctx.events.push({ type: "foul_set", shots: e.shots, pct: e.pct });
  },

  turn_shot_bonus(run, e) {
    const mods = run.match.mods;
    mods.shotBonus += e.value;
    if (e.endTurnAfterShot) mods.endAfterShot = true;
  },

  extra_shots(run, e) {
    run.match.shotsAllowed += e.value;
  },

  next_turn_draw(run, e) {
    run.match.pending.draw += e.value;
  },

  next_turn_openness(run, e) {
    run.match.pending.openness += e.value;
  },

  shoot(run, e, ctx) {
    const m = run.match;
    const card = getCard(run, ctx.inst);
    const shot = calcShot(run, ctx.inst);
    const made = roll100(run) < shot.pct;
    const long = shot.points >= 3;
    if (long) m.threeCold = 0; // a cold spell lasts one attempt
    m.shotsTaken++;
    m.openness = 0; // a shot consumes all Openness
    run.stats.shots++;
    if (made) {
      m.score.player += shot.points;
      run.stats.pointsFor += shot.points;
      run.stats.makes++;
      if (long) {
        m.threeStreak++;
        run.stats.threes++;
      }
    } else {
      m.missedShotThisTurn = true;
      if (long) {
        m.threeStreak = 0;
        if (m.buffs.threeMissPenalty) m.threeCold = m.buffs.threeMissPenalty;
      }
    }
    const pct = Math.round(shot.pct);
    log(
      run,
      made
        ? `${shot.shooter.name} scores ${shot.points}! (${pct}%)`
        : `${shot.shooter.name} misses the ${shot.points}PT (${pct}%)`
    );
    if (shot.play) {
      run.stats.plays = (run.stats.plays || 0) + 1;
      log(run, `Play call: ${shot.play.name}!`);
      ctx.events.push({ type: "play_call", id: shot.play.id, name: shot.play.name, bonus: shot.play.bonus });
    }
    if (m.mods && m.mods.endAfterShot) m.mods.endNow = true;
    ctx.events.push({
      type: "shot",
      made,
      points: shot.points,
      pct: shot.pct,
      shooterId: shot.shooter.id,
      cardId: card.id,
      audio: card.audio || null,
      score: { ...m.score },
    });
    // A miss can cost you: the card says how (turnover, long rebound...).
    if (!made && card.onMiss) applyEffects(run, card.onMiss, ctx);
    // Every other miss has a basketball consequence too (long rebound, offensive rebound).
    if (!made) {
      for (const ev of missConsequence(run, shot, card)) {
        log(run, ev.text);
        ctx.events.push(ev);
      }
    }
  },
};

/** Apply a list of effects in order. ctx = { inst, events }. */
export function applyEffects(run, effects, ctx) {
  for (const e of effects || []) {
    if (e.condition && !checkCondition(run, e.condition)) continue;
    const handler = HANDLERS[e.type];
    if (handler) handler(run, e, ctx);
    if (e.text) {
      log(run, e.text);
      ctx.events.push({ type: "consequence", text: e.text });
    }
  }
}

export const EFFECT_TYPES = Object.keys(HANDLERS);
