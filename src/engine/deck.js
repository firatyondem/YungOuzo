// Card instances and pile management. Pure logic, no DOM.
import { shuffle } from "./rng.js";

/** Every card in a deck is an instance: unique id + where it came from. */
export function makeInstance(run, cardId, source) {
  return { iid: "c" + run.nextIid++, cardId, source };
}

/** Starter cards (config) + 2 signature cards per lineup player. */
export function buildStartingDeck(run) {
  const deck = [];
  for (const { id, count } of run.config.STARTER_CARDS) {
    for (let i = 0; i < count; i++) deck.push(makeInstance(run, id, "starter"));
  }
  for (const p of run.lineup) {
    for (const id of p.signatureCards) deck.push(makeInstance(run, id, p.id));
  }
  return deck;
}

/** Move the discard pile back into the draw pile (never duplicating an instance). */
export function reshuffle(run) {
  const m = run.match;
  const seen = new Set([...m.hand, ...m.draw, ...m.exhaust].map((c) => c.iid));
  const fresh = [];
  for (const c of m.discard) {
    if (!seen.has(c.iid)) {
      seen.add(c.iid);
      fresh.push(c);
    }
  }
  m.discard = [];
  m.draw = shuffle(run, m.draw.concat(fresh));
}

/** Draw n cards into the hand, reshuffling when the draw pile runs out. */
export function drawCards(run, n) {
  const m = run.match;
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (m.draw.length === 0) {
      if (m.discard.length === 0) break;
      reshuffle(run);
    }
    const c = m.draw.pop();
    m.hand.push(c);
    drawn.push(c);
  }
  return drawn;
}

export function discardHand(run) {
  const m = run.match;
  m.discard.push(...m.hand);
  m.hand = [];
}
