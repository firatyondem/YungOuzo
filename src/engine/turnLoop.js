// Match flow: start match, start turn, play card, end turn, opponent attempt.
import { shuffle, roll100 } from "./rng.js";
import { drawCards, discardHand, makeInstance } from "./deck.js";
import { applyEffects, log } from "./effects.js";
import {
  canPlay,
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

export function startMatch(run) {
  const team = run.content.teams[run.round];
  run.match = {
    teamId: team.id,
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
    steals: [],
    onOppFail: [],
    pending: { draw: 0, openness: 0 },
    intentIndex: 0,
    lastOppFailed: false,
    threeStreak: 0,
    buffs: {},
    turnEnded: false,
    over: false,
    winner: null,
    log: [],
  };
  run.match.draw = shuffle(run, run.deck.map((c) => ({ ...c })));
  run.phase = "match";
  const events = [{ type: "match_start", teamId: team.id }];
  log(run, `Tip-off vs ${team.name}. First to ${run.match.target} wins.`);
  startTurn(run, events);
  return events;
}

function startTurn(run, events) {
  const m = run.match;
  m.turn++;
  run.stats.turns++;
  m.energy = m.maxEnergy;
  m.shotsTaken = 0;
  m.shotsAllowed = 1;
  m.missedShotThisTurn = false;
  m.playedTags = [];
  m.steals = [];
  m.onOppFail = [];
  m.turnEnded = false;
  // Passive lineup + chemistry bonuses, plus delayed effects from last turn.
  m.openness = passiveOpenness(run) + m.pending.openness;
  m.contest = passiveContest(run);
  const n = run.config.HAND_SIZE + chemistrySum(run, "extra_draw") + m.pending.draw;
  m.pending = { draw: 0, openness: 0 };
  events.push({ type: "turn_start", turn: m.turn });
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
  m.over = true;
  m.winner = winner;
  run.results.push({ teamId: m.teamId, player: m.score.player, opp: m.score.opp, won: winner === "player" });
  if (winner === "player") {
    run.stats.wins++;
    if (run.round >= run.content.teams.length - 1) {
      run.phase = "victory";
    } else {
      run.phase = "reward";
      generateRewards(run);
    }
    log(run, `FINAL: you beat ${getTeam(run).name} ${m.score.player}-${m.score.opp}!`);
  } else {
    run.phase = "gameover";
    log(run, `FINAL: ${getTeam(run).name} win ${m.score.opp}-${m.score.player}.`);
  }
  events.push({ type: "match_end", winner, phase: run.phase });
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
  m.energy = Math.max(0, m.energy - cost);
  m.hand.splice(idx, 1);
  m.playedTags.push(...(card.tags || []));
  run.stats.cardsPlayed++;
  const events = [{ type: "card_played", iid, cardId: card.id, cost, cardType: card.type }];
  applyEffects(run, card.effects, { inst, events });
  (card.exhaust ? m.exhaust : m.discard).push(inst);
  checkWin(run, events);
  return events;
}

function resolveOpponent(run, events) {
  const m = run.match;
  const team = getTeam(run);
  const pre = opponentPreview(run);
  const intent = pre.intent;

  // Steal attempts first: each one rolls until one succeeds.
  let stolen = false;
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

  let made = false;
  if (!stolen) {
    made = roll100(run) < pre.pct;
    if (made) {
      m.score.opp += intent.points;
      run.stats.pointsAgainst += intent.points;
    }
    log(
      run,
      made
        ? `${team.name}: ${intent.name} is good for ${intent.points}. (${Math.round(pre.pct)}%)`
        : `${team.name}: ${intent.name} misses! (${Math.round(pre.pct)}%)`
    );
  }
  events.push({
    type: "opp_attempt",
    intent,
    pct: pre.pct,
    clutch: pre.clutch,
    made,
    stolen,
    points: intent.points,
    score: { ...m.score },
  });

  const failed = stolen || !made;
  m.lastOppFailed = failed;
  if (failed) {
    applyEffects(run, m.onOppFail, { inst: null, events });
    m.pending.draw += chemistrySum(run, "draw_on_opponent_fail");
  }
  m.intentIndex++;
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
