// Match flow: start match, start turn, play card, end turn, opponent attempt.
import { shuffle, roll100 } from "./rng.js";
import { drawCards, discardHand, makeInstance } from "./deck.js";
import { applyEffects, log } from "./effects.js";
import {
  canPlay,
  clampPct,
  getCard,
  getCardCost,
  getShootEffect,
  getTeam,
  opponentPreview,
  passiveContest,
  passiveOpenness,
  chemistrySum,
} from "./rules.js";
import { generateRewards } from "./rewards.js";
import { winsNeeded } from "./gameState.js";
import { firstRule, rulesOf, intentMatches, tipOffRules, phaseIntents } from "./teamRules.js";
import { cardInfo } from "./plays.js";

/** Per-turn coach modifiers (timeouts and closing options). Reset every turn. */
const freshMods = () => ({ ice: 0, foul: null, shotBonus: 0, endAfterShot: false, endNow: false });

export function startMatch(run) {
  const stop = run.schedule[run.round];
  const team = run.content.teams.find((t) => t.id === stop.teamId);
  run.match = {
    teamId: team.id,
    stopLabel: stop.label,
    gameNo: stop.wins + stop.losses + 1,
    seriesGames: stop.games,
    target: run.config.TARGET_SCORE,
    score: { player: 0, opp: 0 },
    turn: 0,
    energy: 0,
    maxEnergy: run.config.MAX_ENERGY,
    openness: 0,
    contest: 0,
    draw: [],
    hand: [],
    discard: [],
    exhaust: [],
    shotsTaken: 0,
    shotsAllowed: 1,
    missedShotThisTurn: false,
    playedTags: [],
    turnCards: [], // cards played this turn, for play calls (see plays.js)
    steals: [],
    onOppFail: [],
    pending: { draw: 0, openness: 0 },
    intentIndex: 0,
    lastOppFailed: false,
    threeStreak: 0,
    buffs: {},
    timeouts: run.config.TIMEOUTS_PER_MATCH ?? 3,
    usedActions: [], // closing options already used this game
    mods: freshMods(),
    // Opponent-side state used by team rules (see teamRules.js) and the coach's read.
    opp: { streak: 0, possessions: 0, hot: 0, phase: 0, tagStats: {}, adapted: null, pick: null, lastContest: null, readNote: "" },
    extraRules: [], // league scouting + film study, fixed at tip-off
    notes: [], // what the player is told before the game
    turnEnded: false,
    over: false,
    winner: null,
    log: [],
  };
  const m = run.match;
  const tip = tipOffRules(run, team, stop);
  m.extraRules = tip.rules;
  m.notes = tip.notes;
  const pace = firstRule(run, "pace");
  if (pace && pace.clock) m.maxEnergy = pace.clock;
  m.draw = shuffle(run, run.deck.map((c) => ({ ...c })));
  run.phase = "match";
  const events = [{ type: "match_start", teamId: team.id }];
  log(run, `Tip-off vs ${team.name}. First to ${m.target} wins.`);
  for (const note of m.notes) log(run, note);
  startTurn(run, events);
  return events;
}

/** Boss phases: when either team reaches the next phase's score, the opponent changes shape. */
function checkPhase(run, events) {
  const m = run.match;
  const team = getTeam(run);
  const next = team.phases && team.phases[m.opp.phase + 1];
  if (!next || (m.score.player < next.at && m.score.opp < next.at)) return;
  m.opp.phase++;
  m.intentIndex = 0;
  log(run, `${team.name} change shape: ${next.name}. ${next.text}`);
  events.push({ type: "phase_shift", name: next.name, text: next.text });
}

/**
 * Bait and read. A coached opponent looks at the Contest you showed on the
 * previous possession and picks, from its next two plays, the one worth more
 * expected points against that defense (aggressive coaches value threes a bit
 * more). It only knows what it saw: showing no defense invites the bigger,
 * lower-percentage shot, which you can then contest. No randomness is involved
 * and the choice is shown to the player before they act.
 */
function chooseIntent(run) {
  const m = run.match;
  const opp = m.opp;
  const team = getTeam(run);
  opp.pick = null;
  opp.readNote = "";
  if (!team.coach || run.config.OPPONENT_READS === false || opp.lastContest == null) return;
  const set = firstRule(run, "every_nth_intent");
  if (set && (opp.possessions + 1) % set.n === 0) return;
  const intents = phaseIntents(run);
  if (intents.length < 2) return;
  const lean = 1 + ((team.coach.aggression ?? 0.5) - 0.5) * 0.3;
  const value = (it) => it.points * Math.max(5, Math.min(95, it.pct - opp.lastContest)) * (it.points >= 3 ? lean : 1);
  const a = intents[m.intentIndex % intents.length];
  const b = intents[(m.intentIndex + 1) % intents.length];
  if (value(b) > value(a) * 1.05) {
    opp.pick = m.intentIndex + 1;
    opp.readNote = b.points > a.points ? "saw light defense, going for more" : "saw heavy defense, taking the surer shot";
  } else {
    opp.pick = m.intentIndex;
  }
}

function startTurn(run, events) {
  const m = run.match;
  m.turn++;
  run.stats.turns++;
  checkPhase(run, events);
  chooseIntent(run);
  const pace = firstRule(run, "pace");
  const sum = (type) => rulesOf(run, type).reduce((s, r) => s + r.value, 0);
  m.energy = Math.max(0, m.maxEnergy - sum("energy_tax"));
  m.shotsTaken = 0;
  m.shotsAllowed = 1;
  m.missedShotThisTurn = false;
  m.playedTags = [];
  m.turnCards = [];
  m.steals = [];
  m.onOppFail = [];
  m.mods = freshMods();
  m.turnEnded = false;
  // Passive lineup + chemistry bonuses, plus delayed effects from last turn.
  const passive = firstRule(run, "no_passive_openness") ? 0 : passiveOpenness(run);
  m.openness = passive + m.pending.openness + sum("openness_start");
  m.contest = passiveContest(run) + sum("contest_start");
  const n = Math.max(
    1,
    run.config.HAND_SIZE + chemistrySum(run, "extra_draw") + m.pending.draw + (pace ? pace.draw || 0 : 0) + sum("draw_bonus")
  );
  m.pending = { draw: 0, openness: 0 };
  events.push({ type: "turn_start", turn: m.turn });
  // A streaky opponent can catch fire; it is rolled now so the player sees it coming.
  const hot = firstRule(run, "hot_streak");
  if (hot && m.opp.hot <= 0 && roll100(run) < hot.chance) {
    m.opp.hot = hot.length;
    log(run, `${getTeam(run).name} are heating up: ${hot.label}!`);
    events.push({ type: "hot_start", label: hot.label });
  }
  const drawn = drawCards(run, n);
  // No dead hands: keep drawing (a few) until the hand holds a shot card.
  let extra = 0;
  const hasShot = () => m.hand.some((c) => getShootEffect(getCard(run, c)));
  while (extra < (run.config.NO_SHOT_REDRAWS || 0) && !hasShot() && drawCards(run, 1).length) extra++;
  if (extra) log(run, `No shot in hand: drew ${extra} extra card${extra > 1 ? "s" : ""}.`);
  events.push({ type: "draw", count: drawn.length + extra, extra });
}

function finishMatch(run, winner, events) {
  const m = run.match;
  const stop = run.schedule[run.round];
  const team = getTeam(run);
  m.over = true;
  m.winner = winner;
  const won = winner === "player";
  let lifeLost = false;
  run.results.push({ teamId: m.teamId, label: stop.label, game: m.gameNo, player: m.score.player, opp: m.score.opp, won });
  if (won) {
    stop.wins++;
    run.stats.wins++;
    log(run, `FINAL: you beat ${team.name} ${m.score.player}-${m.score.opp}!`);
    if (stop.wins >= winsNeeded(stop)) {
      if (run.round >= run.schedule.length - 1) {
        run.phase = "victory";
      } else if (stop.forfeit) {
        // Won the rematch after losing a life: you move on, but without the reward.
        run.round++;
        run.phase = "map";
      } else {
        run.phase = "reward";
        generateRewards(run);
      }
    } else {
      run.phase = "map"; // series continues
    }
  } else {
    stop.losses++;
    log(run, `FINAL: ${team.name} win ${m.score.opp}-${m.score.player}.`);
    if (stop.games > 1) {
      run.phase = stop.losses >= winsNeeded(stop) ? "gameover" : "map";
    } else if (run.lives > 0) {
      // A life buys a rematch; the price is this stop's reward.
      run.lives--;
      lifeLost = true;
      stop.forfeit = true;
      run.phase = "map";
      log(run, `You lose a life (${run.lives} left). Rematch, but no reward for this stop.`);
    } else {
      run.phase = "gameover";
    }
  }
  events.push({
    type: "match_end",
    winner,
    phase: run.phase,
    lifeLost,
    lives: run.lives,
    series: stop.games > 1 ? { wins: stop.wins, losses: stop.losses } : null,
  });
}

function checkWin(run, events) {
  const m = run.match;
  if (m.over) return true;
  if (m.score.player >= m.target) finishMatch(run, "player", events);
  else if (m.score.opp >= m.target) finishMatch(run, "opp", events);
  return m.over;
}

/** Play a card from hand. Returns events ([] if the card cannot be played). */
export function playCard(run, iid) {
  if (!canPlay(run, iid).ok) return [];
  const m = run.match;
  const idx = m.hand.findIndex((c) => c.iid === iid);
  const inst = m.hand[idx];
  const card = getCard(run, inst);
  const cost = getCardCost(run, card);
  const tags = card.tags || [];
  m.energy = Math.max(0, m.energy - cost);
  m.hand.splice(idx, 1);
  run.stats.cardsPlayed++;
  // Film: the league remembers what you lean on.
  run.film.types[card.type] = (run.film.types[card.type] || 0) + 1;
  const shoot = getShootEffect(card);
  if (shoot) run.film.shots[shoot.points] = (run.film.shots[shoot.points] || 0) + 1;
  const events = [{ type: "card_played", iid, cardId: card.id, cost, cardType: card.type }];

  // A pressing opponent can pick off a Pass card: it is spent for nothing.
  const steal = tags.includes("Pass") ? firstRule(run, "pass_steal") : null;
  if (steal && roll100(run) < steal.chance) {
    log(run, `${steal.label}! ${card.name} is picked off.`);
    events.push({ type: "picked_off", label: steal.label, cardId: card.id });
    (card.exhaust ? m.exhaust : m.discard).push(inst);
    return events;
  }

  m.playedTags.push(...tags);
  let effects = card.effects;
  const negated = rulesOf(run, "negate_tag").find((r) => tags.includes(r.tag));
  if (negated) {
    effects = (effects || []).filter((e) => e.type !== "add_openness");
    log(run, `${negated.label}: ${card.name} creates no Openness.`);
    events.push({ type: "negated", label: negated.label, cardId: card.id });
  }
  applyEffects(run, effects, { inst, events });
  m.turnCards.push(cardInfo(card)); // after resolving, so a shot never counts toward its own play
  (card.exhaust ? m.exhaust : m.discard).push(inst);
  checkWin(run, events);
  // "Hold for the last shot": the turn ends the moment the shot is taken.
  if (m.mods.endNow && !m.over && !m.turnEnded) events.push(...endTurn(run));
  return events;
}

function resolveOpponent(run, events) {
  const m = run.match;
  const opp = m.opp;
  const team = getTeam(run);
  const pre = opponentPreview(run);
  const intent = pre.intent;
  let stolen = false;
  let made = false;
  let extra = 0;

  if (m.mods.foul) {
    // Intentional foul: free throws replace their play.
    const foul = m.mods.foul;
    let ft = 0;
    for (let i = 0; i < foul.shots; i++) if (roll100(run) < foul.pct) ft++;
    m.score.opp += ft;
    run.stats.pointsAgainst += ft;
    made = ft > 0;
    log(run, `Intentional foul: ${team.name} make ${ft} of ${foul.shots} free throws.`);
    events.push({
      type: "opp_attempt", intent, foul: true, ftMade: ft, ftShots: foul.shots, pct: foul.pct,
      clutch: false, notes: [], made, stolen: false, extra: 0, points: ft, score: { ...m.score },
    });
  } else {
    // Steal attempts first: each one rolls until one succeeds.
    for (const steal of m.steals) {
      if (intent.unblockableBySteal) {
        events.push({ type: "steal", success: false, blocked: true });
        log(run, `${intent.name} can't be stolen!`);
        break;
      }
      const success = roll100(run) < steal.chance;
      events.push({ type: "steal", success, blocked: false });
      if (success) {
        stolen = true;
        run.stats.steals++;
        log(run, `STEAL! ${team.name}'s ${intent.name} is cancelled.`);
        applyEffects(run, steal.onSuccess, { inst: null, events });
        break;
      }
      log(run, "Steal attempt fails.");
    }

    if (!stolen) {
      made = roll100(run) < pre.pct;
      if (made) {
        m.score.opp += intent.points;
        run.stats.pointsAgainst += intent.points;
        const andOne = rulesOf(run, "and_one").find((r) => intentMatches(r, intent));
        if (andOne && roll100(run) < andOne.chance) {
          extra = 1;
          m.score.opp += 1;
          run.stats.pointsAgainst += 1;
        }
      }
      const pct = Math.round(pre.pct);
      log(
        run,
        made
          ? `${team.name}: ${intent.name} is good for ${intent.points}${extra ? " and the foul (+1)" : ""}. (${pct}%)`
          : `${team.name}: ${intent.name} misses! (${pct}%)`
      );
    }
    events.push({
      type: "opp_attempt",
      intent,
      pct: pre.pct,
      clutch: pre.clutch,
      notes: pre.notes,
      made,
      stolen,
      extra,
      points: intent.points,
      score: { ...m.score },
    });

    // What the opponent learns and carries forward.
    const tag = (intent.tags || [])[0];
    if (tag && !stolen) {
      const s = (opp.tagStats[tag] ||= { att: 0, made: 0 });
      s.att++;
      if (made) s.made++;
    }
  }

  opp.streak = made ? opp.streak + 1 : 0;
  const streak = firstRule(run, "streak_bonus");
  if (streak && streak.resetContest && opp.streak > 0 && m.contest >= streak.resetContest) {
    opp.streak = 0;
    log(run, `Heavy pressure cools off ${streak.label}.`);
    events.push({ type: "cooled", label: streak.label });
  }

  // Second chance: a putback after a missed play, unless you boxed out this turn.
  let putback = false;
  if (!stolen && !made && !m.mods.foul) {
    const second = firstRule(run, "second_chance");
    if (second) {
      if (m.onOppFail.length) {
        log(run, "Box Out denies the second chance.");
        events.push({ type: "box_out_stop", label: second.label });
      } else if (roll100(run) < second.chance) {
        const pct2 = clampPct(run, second.pct - m.contest / 2);
        putback = roll100(run) < pct2;
        if (putback) {
          m.score.opp += 2;
          run.stats.pointsAgainst += 2;
        }
        log(run, putback ? `${second.label}: offensive rebound and putback for 2!` : `${second.label}: offensive rebound, but the putback misses.`);
        events.push({ type: "second_chance", label: second.label, made: putback, pct: pct2, score: { ...m.score } });
      }
    }
  }

  const failed = stolen || (!made && !putback);
  m.lastOppFailed = failed;
  if (failed) {
    applyEffects(run, m.onOppFail, { inst: null, events });
    m.pending.draw += chemistrySum(run, "draw_on_opponent_fail");
  }
  opp.possessions++;
  opp.lastContest = m.contest; // what the coach saw (used by chooseIntent next turn)
  if (opp.hot > 0) opp.hot--;
  if (!intent.setPlay) m.intentIndex = (opp.pick != null ? opp.pick : m.intentIndex) + 1;

  // Adaptation: after n possessions they go back to what has worked best.
  const adapt = firstRule(run, "adapt_after");
  if (adapt && !opp.adapted && opp.possessions >= adapt.n) {
    const ranked = Object.entries(opp.tagStats).sort((a, b) => b[1].made / b[1].att - a[1].made / a[1].att || b[1].att - a[1].att);
    if (ranked.length) {
      opp.adapted = { tag: ranked[0][0], bonus: adapt.bonus, label: adapt.label };
      log(run, `Coach adjusts: ${team.name} go back to their ${ranked[0][0]} game (+${adapt.bonus}%).`);
      events.push({ type: "adapt", label: adapt.label, tag: ranked[0][0], bonus: adapt.bonus });
    }
  }
}

/** End the player's turn: violation check, opponent attempt, then next turn. */
export function endTurn(run) {
  const m = run.match;
  if (!m || m.over || m.turnEnded) return [];
  m.turnEnded = true;
  const events = [];
  if (m.shotsTaken === 0) {
    events.push({ type: "violation" });
    log(run, "Shot-clock violation! No shot this turn.");
  }
  resolveOpponent(run, events);
  discardHand(run);
  if (!checkWin(run, events)) startTurn(run, events);
  return events;
}

// ---------- Debug helpers (debug panel + tests) ----------

export function debugAddPoints(run, n = 5, side = "player") {
  const m = run.match;
  if (!m || m.over) return [];
  m.score[side] = Math.min(m.target, m.score[side] + n);
  const events = [];
  checkWin(run, events);
  return events;
}

export function debugWinMatch(run) {
  const m = run.match;
  if (!m || m.over) return [];
  return debugAddPoints(run, m.target, "player");
}

/** Add a card to the deck and straight into the hand. */
export function debugAddCard(run, cardId) {
  if (!run.content.cards[cardId]) return null;
  const inst = makeInstance(run, cardId, "reward");
  run.deck.push(inst);
  if (run.match && !run.match.over) run.match.hand.push({ ...inst });
  return inst;
}
