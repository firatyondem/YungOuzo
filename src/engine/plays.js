// Play calls: sequencing cards in one turn triggers a named play that boosts
// the shot at the end of it. Plays are data (content/plays.json).
//
// A sequence step is "tag:<Tag>", "type:<CardType>", "shot", "shot:2" or "shot:3".
// Every play ends with a shot step. The earlier steps must have been played this
// turn in that order (other cards may sit in between). Only the best play applies.

/** What the engine remembers about a card played this turn. */
export function cardInfo(card) {
  const shoot = (card.effects || []).find((e) => e.type === "shoot");
  return { tags: card.tags || [], type: card.type, points: shoot ? shoot.points : null };
}

function stepMatches(step, info) {
  const [kind, arg] = String(step).split(":");
  if (kind === "tag") return info.tags.includes(arg);
  if (kind === "type") return info.type === arg;
  if (kind === "shot") return info.points != null && (!arg || info.points === Number(arg));
  return false;
}

/** How many of the play's leading (non-final) steps the cards played this turn satisfy. */
function progress(play, played) {
  const lead = play.sequence.length - 1;
  let i = 0;
  for (const info of played) {
    if (i < lead && stepMatches(play.sequence[i], info)) i++;
  }
  return i;
}

/** The play this card would complete if played now (highest bonus wins), or null. */
export function playFor(run, card) {
  const m = run.match;
  const plays = run.content.plays || [];
  if (!m || !plays.length) return null;
  const info = cardInfo(card);
  if (info.points == null) return null;
  let best = null;
  for (const play of plays) {
    const lead = play.sequence.length - 1;
    if (progress(play, m.turnCards || []) < lead) continue;
    if (!stepMatches(play.sequence[lead], info)) continue;
    if (!best || play.bonus > best.bonus) best = play;
  }
  return best;
}

/**
 * Playbook status for the HUD: every play with how far along it is this turn.
 * ready = only the finishing shot is missing; near = one more setup card needed.
 */
export function playbook(run) {
  const m = run.match;
  const plays = run.content.plays || [];
  if (!m) return [];
  return plays.map((play) => {
    const lead = play.sequence.length - 1;
    const done = progress(play, m.turnCards || []);
    return { play, done, total: play.sequence.length, ready: done === lead, near: done === lead - 1 && lead > 0 };
  });
}
