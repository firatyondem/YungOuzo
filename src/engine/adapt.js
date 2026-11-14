// Opponents adapt to repetitive play, and misses have basketball consequences.
//
// Adaptation. Every turn the opponent notes five habits: shooting a three,
// playing a Drive card, shooting without a Pass card (isolation), playing no
// Defense card, and gambling for a steal. A habit's counter goes up by one on a
// turn you do it and down by one on a turn you don't. When a counter is one
// short of the team's threshold you are warned; when it reaches the threshold
// the adjustment applies from your next turn, and it relaxes as soon as the
// counter drops below it again. The player therefore always sees a warning at
// least one turn before an adjustment costs anything, and can always respond by
// doing something else.
//
// Knobs: CONFIG.ADAPT ({ at, three, paint, double, attack, steal } or null to
// switch it off) and a team's `adaptAt` (signature speed; lower = adapts faster).
//
// Miss consequences: CONFIG.MISS ({ longRebound, orebPerBig, orebBoxOut, orebMax,
// orebSeconds } or null). A missed three is a long rebound (their play gets
// easier) unless you boxed out; a missed two can be an offensive rebound (Bigs
// and Box Out raise the odds), which lets you shoot again this turn.
import { roll100 } from "./rng.js";

export const HABITS = [
  {
    key: "three",
    icon: "target",
    name: "Perimeter tightened",
    warn: "One more three and they tighten the perimeter.",
    text: (c) => `Your threes are at ${c.three}%. Shoot a two to pull them in.`,
    rules: (c) => [
      { type: "shot_mod", points: 3, value: c.three },
      { type: "shot_mod", points: 4, value: c.three },
    ],
  },
  {
    key: "paint",
    icon: "defense",
    name: "Paint protected",
    warn: "One more Drive card and they pack the paint.",
    text: (c) => `Your twos are at ${c.paint}%. Skip the Drive cards for a turn.`,
    rules: (c) => [{ type: "shot_mod", points: 2, value: c.paint }],
  },
  {
    key: "iso",
    icon: "users",
    name: "Double team",
    warn: "One more shot without a Pass and they double you.",
    text: (c) => `Shots without a Pass card are at ${c.double}%. Move the ball.`,
    rules: (c) => [{ type: "shot_mod", noPass: true, value: c.double }],
  },
  {
    key: "nodef",
    icon: "clutch",
    name: "They attack",
    warn: "One more turn without a Defense card and they attack.",
    text: (c) => `Their plays are at +${c.attack}%. Play a Defense card to settle them.`,
    rules: (c) => [{ type: "intent_bonus", value: c.attack }],
  },
  {
    key: "steal",
    icon: "lock",
    name: "Ball protected",
    warn: "One more steal attempt and they protect the ball.",
    text: (c) => `Your steals are at ${c.steal}%. Leave the ball alone for a turn.`,
    rules: (c) => [{ type: "steal_bonus", value: c.steal }],
  },
];
const BY_KEY = Object.fromEntries(HABITS.map((h) => [h.key, h]));

export function freshAdapt() {
  return { count: { three: 0, paint: 0, iso: 0, nodef: 0, steal: 0 }, active: [], warned: [], turn: null };
}

function settings(run) {
  return run.config.ADAPT || null;
}

/** Uses in a row before the adjustment kicks in (a team's signature speed can change it). */
export function adaptThreshold(run, key) {
  const cfg = settings(run);
  const team = run.content.teams.find((t) => t.id === run.match.teamId) || {};
  const base = team.adaptAt ?? cfg.at ?? 3;
  if (key === "nodef") return base + 1; // you do not always draw a defense card
  if (key === "steal") return Math.max(2, base - 1);
  return base;
}

/** What you did this turn. Called by the engine as cards resolve. */
export function noteCard(run, card) {
  const m = run.match;
  if (!settings(run) || !m.adapt) return;
  const t = (m.adapt.turn ||= { three: false, paint: false, shot: false, pass: false, def: false, steal: false });
  const tags = card.tags || [];
  if (tags.includes("Drive")) t.paint = true;
  if (tags.includes("Pass")) t.pass = true;
  if (card.type === "Defense") t.def = true;
  for (const e of card.effects || []) {
    if (e.type === "steal_attempt") t.steal = true;
    if (e.type === "shoot") {
      t.shot = true;
      if (e.points >= 3) t.three = true;
      if (!t.pass) t.isoShot = true; // judged at the moment of the shot
    }
  }
}

/** End of your turn: move every habit counter up or down. */
export function observeTurn(run) {
  const m = run.match;
  if (!settings(run) || !m.adapt) return;
  const t = m.adapt.turn || {};
  const did = { three: !!t.three, paint: !!t.paint, iso: !!t.isoShot, nodef: !t.def, steal: !!t.steal };
  for (const key of Object.keys(m.adapt.count)) {
    const max = adaptThreshold(run, key) + 1;
    m.adapt.count[key] = did[key] ? Math.min(max, m.adapt.count[key] + 1) : Math.max(0, m.adapt.count[key] - 1);
  }
  m.adapt.turn = null;
}

/** Start of your turn: fix which adjustments apply this turn and which are one step away. */
export function refreshAdapt(run, events, logFn) {
  const m = run.match;
  const cfg = settings(run);
  if (!cfg || !m.adapt) return;
  const was = new Set(m.adapt.active);
  const warnedBefore = new Set(m.adapt.warned);
  const active = [];
  const warned = [];
  for (const h of HABITS) {
    const n = m.adapt.count[h.key];
    const at = adaptThreshold(run, h.key);
    if (n >= at) active.push(h.key);
    else if (n === at - 1) warned.push(h.key);
  }
  for (const key of active) {
    if (was.has(key)) continue;
    const h = BY_KEY[key];
    logFn(run, `They adjust. ${h.name}: ${h.text(cfg)}`);
    events.push({ type: "adjust", key, on: true, name: h.name, text: h.text(cfg) });
    run.stats.adjustments = (run.stats.adjustments || 0) + 1;
  }
  for (const key of was) {
    if (active.includes(key)) continue;
    const h = BY_KEY[key];
    logFn(run, `They relax: ${h.name} is off.`);
    events.push({ type: "adjust", key, on: false, name: h.name, text: `${h.name} is off: you changed it up.` });
  }
  for (const key of warned) {
    if (warnedBefore.has(key) || was.has(key)) continue;
    const h = BY_KEY[key];
    logFn(run, h.warn);
    events.push({ type: "adjust_warn", key, name: h.name, text: h.warn });
  }
  m.adapt.active = active;
  m.adapt.warned = warned;
}

/** Rules for the adjustments that apply this turn (merged in teamRules.activeRules). */
export function adaptRules(run) {
  const m = run.match;
  const cfg = settings(run);
  if (!cfg || !m || !m.adapt) return [];
  const out = [];
  for (const key of m.adapt.active) for (const r of BY_KEY[key].rules(cfg)) out.push({ ...r, label: BY_KEY[key].name });
  return out;
}

/** For the HUD: [{ key, state: "active" | "warn", icon, name, text, count, at }] */
export function adaptStatus(run) {
  const m = run.match;
  const cfg = settings(run);
  if (!cfg || !m || !m.adapt) return [];
  const row = (key, state) => {
    const h = BY_KEY[key];
    return { key, state, icon: h.icon, name: h.name, text: state === "active" ? h.text(cfg) : h.warn, count: m.adapt.count[key], at: adaptThreshold(run, key) };
  };
  return [...m.adapt.active.map((k) => row(k, "active")), ...m.adapt.warned.map((k) => row(k, "warn"))];
}

/**
 * What a missed shot costs or gives, in one line. Cards with their own onMiss
 * (turnovers) are handled by the card. Returns events.
 */
export function missConsequence(run, shot, card) {
  const m = run.match;
  const cfg = run.config.MISS;
  if (!cfg || card.onMiss) return [];
  const boxedOut = m.playedTags.includes("Rebound");
  if (shot.points >= 3) {
    if (boxedOut) return [{ type: "consequence", good: true, text: "Box Out wins the long rebound: no fast break for them." }];
    m.mods.oppBonus.push({ label: "Long rebound", value: cfg.longRebound });
    return [{ type: "consequence", text: `Long rebound off the missed three: they run, their play is at +${cfg.longRebound}%.` }];
  }
  const bigs = run.lineup.filter((p) => p.archetype === "Big").length;
  const chance = Math.min(cfg.orebMax, bigs * cfg.orebPerBig + (boxedOut ? cfg.orebBoxOut : 0));
  if (chance <= 0 || roll100(run) >= chance) return [];
  m.shotsAllowed += 1;
  m.energy += cfg.orebSeconds;
  run.stats.orebs = (run.stats.orebs || 0) + 1;
  return [{ type: "consequence", good: true, text: `Offensive rebound${boxedOut ? " off the Box Out" : ""}! You can shoot again this turn (+${cfg.orebSeconds}s).` }];
}
