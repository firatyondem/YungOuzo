// =====================================================================
// FULL COURT RUN - engine public API and state shape
// =====================================================================
// The engine is pure logic: no DOM, no Three.js, runs in Node.
// The UI holds one `run` object and calls the functions below; every
// mutating function returns an array of EVENTS the UI can animate.
//
// PUBLIC API
//   gameState.js  buildContent(raw)              index raw JSON for the engine
//                 createRun(content, config, seed)
//   turnLoop.js   startMatch(run)                -> events   (phase "map" -> "match")
//                 playCard(run, iid)             -> events
//                 endTurn(run)                   -> events   (opponent attempt + next turn)
//                 debugAddPoints / debugWinMatch / debugAddCard
//   rules.js      canPlay(run, iid)              -> { ok, reason }
//                 getCardCost(run, card)         -> seconds
//                 calcShot(run, inst)            -> { pct, points, shooter, ... } | null
//                 opponentPreview(run)           -> { intent, pct, basePct, clutch }
//                 getActiveChemistry(run)        -> [{ archetype, name, text }]
//                 passiveOpenness / passiveContest / getTeam / getCard
//   rewards.js    applyReward(run, index, { slot })   (phase "reward" -> "map")
//                 replacePlayer(run, slot, playerId)
//
// RUN STATE
//   run = {
//     seed, rngState,            // seeded RNG (see rng.js)
//     phase,                     // "map" | "match" | "reward" | "victory" | "gameover"
//     round,                     // index into content.teams (0..2)
//     lineup: [player x5],       // deep copies (ratings can be upgraded)
//     deck:   [{ iid, cardId, source }],   // source: "starter" | "reward" | playerId
//     nextIid,
//     rewards: null | [{ kind: "card"|"player"|"upgrade", ... }],
//     results: [{ teamId, player, opp, won }],   // finished matches
//     stats: { wins, turns, shots, makes, threes, pointsFor, pointsAgainst, cardsPlayed, steals },
//     match: null | {
//       teamId, target,
//       score: { player, opp },
//       turn, energy, maxEnergy,
//       openness, contest,       // floats, reset every turn
//       draw, hand, discard, exhaust,   // arrays of card instances
//       shotsTaken, shotsAllowed, missedShotThisTurn,
//       playedTags,              // tags of cards played this turn
//       steals, onOppFail,       // defensive triggers armed this turn
//       pending: { draw, openness },    // delayed effects for next turn
//       intentIndex, lastOppFailed,
//       threeStreak, buffs,      // match-long values
//       turnEnded, over, winner, // winner: "player" | "opp"
//       log: [string],
//     },
//   }
//   run.content / run.config are attached non-enumerably (JSON.stringify(run) is safe).
//
// EVENTS (type + payload)
//   match_start {teamId} · turn_start {turn} · draw {count} · card_played {iid, cardId, cost}
//   openness {value} · contest {value} · energy {value} · buff {buff, value} · steal_set {chance}
//   shot {made, points, pct, shooterId, cardId, audio, score} · violation {}
//   steal {success, blocked} · opp_attempt {intent, pct, made, points, clutch, score}
//   match_end {winner, phase}
// =====================================================================
import { hashSeed } from "./rng.js";
import { buildStartingDeck } from "./deck.js";

export function clonePlayer(p) {
  return JSON.parse(JSON.stringify(p));
}

/** raw = { cards: [], players: [], teams: [], chemistry: {}, rewards: {} } */
export function buildContent(raw) {
  const cards = {};
  for (const c of raw.cards) cards[c.id] = c;
  const players = {};
  for (const p of raw.players) players[p.id] = p;
  return {
    cards,
    players,
    cardList: raw.cards,
    playerList: raw.players,
    teams: raw.teams,
    chemistry: raw.chemistry || {},
    rewards: raw.rewards || { cards: [], players: [] },
  };
}

export function createRun(content, config, seed) {
  const run = {
    seed,
    rngState: hashSeed(seed),
    phase: "map",
    round: 0,
    lineup: [],
    deck: [],
    nextIid: 1,
    rewards: null,
    results: [],
    stats: {
      wins: 0,
      turns: 0,
      shots: 0,
      makes: 0,
      threes: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      cardsPlayed: 0,
      steals: 0,
    },
    match: null,
  };
  Object.defineProperty(run, "content", { value: content, enumerable: false });
  Object.defineProperty(run, "config", { value: config, enumerable: false });
  run.lineup = config.STARTING_LINEUP.map((id) => clonePlayer(content.players[id]));
  run.deck = buildStartingDeck(run);
  return run;
}
