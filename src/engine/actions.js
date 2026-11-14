// Coach actions: limited timeouts and closing-time options.
// Actions are data (content/coach_actions.json) and use the normal effect system.
//
//   group "timeout"  - any time on your turn, limited to TIMEOUTS_PER_MATCH in total
//   group "closing"  - only in closing time (either team within CLOSING_WINDOW of
//                      the target), each one once per match
import { applyEffects, log } from "./effects.js";
import { setStrategy } from "./strategy.js";

export function isClosingTime(run) {
  const m = run.match;
  if (!m) return false;
  const line = m.target - (run.config.CLOSING_WINDOW ?? 4);
  return m.score.player >= line || m.score.opp >= line;
}

export function getAction(run, id) {
  return (run.content.actions || []).find((a) => a.id === id) || null;
}

/** Can this coach action be used right now? -> { ok, reason } */
export function canUseAction(run, id) {
  const m = run.match;
  const action = getAction(run, id);
  if (!action) return { ok: false, reason: "Unknown action" };
  if (!m || m.over) return { ok: false, reason: "No game in progress" };
  if (m.turnEnded) return { ok: false, reason: "Turn is over" };
  if ((action.cost || 0) > m.energy) return { ok: false, reason: `Need ${action.cost}s` };
  if (action.group === "timeout") {
    if (m.timeouts <= 0) return { ok: false, reason: "No timeouts left" };
  } else if (action.group === "closing") {
    if (!isClosingTime(run)) return { ok: false, reason: "Only in closing time" };
    if (m.usedActions.includes(id)) return { ok: false, reason: "Already used this game" };
  }
  const effects = action.effects || [];
  if (effects.some((e) => e.type === "ice_intent") && m.mods.ice > 0) return { ok: false, reason: "Already iced" };
  if (effects.some((e) => e.type === "foul_intent") && m.mods.foul) return { ok: false, reason: "Already fouling" };
  if (effects.some((e) => e.endTurnAfterShot) && m.shotsTaken > 0) return { ok: false, reason: "Shot already taken" };
  return { ok: true, reason: "" };
}

/** Use a coach action. Returns events ([] if it cannot be used). */
export function useAction(run, id) {
  if (!canUseAction(run, id).ok) return [];
  const m = run.match;
  const action = getAction(run, id);
  m.energy = Math.max(0, m.energy - (action.cost || 0));
  if (action.group === "timeout") m.timeouts--;
  else m.usedActions.push(id);
  run.stats.actions = (run.stats.actions || 0) + 1;
  const events = [{ type: "coach_action", id, name: action.name, group: action.group, timeouts: m.timeouts }];
  log(run, action.group === "timeout" ? `Timeout: ${action.name}. ${m.timeouts} left.` : `Closing time: ${action.name}.`);
  applyEffects(run, action.effects, { inst: null, events });
  return events;
}

/** Can the game plan be changed now? Outside a game: always. In a game: free at halftime, else a timeout. */
export function canChangePlan(run) {
  const m = run.match;
  if (!m || m.over || run.phase !== "match") return { ok: true, free: true, reason: "" };
  if (m.turnEnded) return { ok: false, free: false, reason: "Turn is over" };
  if (m.freePlanChange) return { ok: true, free: true, reason: "" };
  if (m.timeouts <= 0) return { ok: false, free: false, reason: "No timeouts left" };
  return { ok: true, free: false, reason: "" };
}

/**
 * Change the game plan ({ offense, defense, pace, starId }). During a game this
 * is free in the halftime window and otherwise spends a timeout; nothing is
 * spent if the plan does not actually change. Returns events.
 */
export function changePlan(run, patch) {
  const can = canChangePlan(run);
  if (!can.ok) return [];
  const m = run.match;
  const inGame = m && !m.over && run.phase === "match";
  if (!setStrategy(run, patch)) return [];
  if (!inGame) return [{ type: "plan_changed", free: true }];
  if (can.free) m.freePlanChange = false;
  else m.timeouts--;
  log(run, can.free ? "Halftime adjustment: new game plan." : `Timeout: new game plan. ${m.timeouts} left.`);
  return [{ type: "plan_changed", free: can.free, timeouts: m.timeouts }];
}

/** Actions for the UI, with whether each can be used now. */
export function actionList(run) {
  return (run.content.actions || []).map((a) => ({ action: a, ...canUseAction(run, a.id) }));
}
