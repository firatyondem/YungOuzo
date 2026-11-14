// Team strategy: one offensive system, one defensive scheme and a pace.
// Options are data (content/strategy.json). Each option is a list of rule
// effects (the same rule types opponents use, see teamRules.js), so a system's
// bonus and its weakness resolve in one place with everything else.
//
// run.strategy = { offense, defense, pace, starId }
//   - set freely on the season map before a game
//   - during a game: free at halftime, otherwise it costs a timeout
const KINDS = ["offense", "defense", "pace"];

export function defaultStrategy(run) {
  return { offense: "balanced", defense: "man", pace: "normal", starId: bestScorer(run).id };
}

/** Your most dangerous scorer: the default Star for star-based systems. */
export function bestScorer(run) {
  let best = run.lineup[0];
  const score = (p) => p.ratings.SHT + p.ratings.INS;
  for (const p of run.lineup) if (score(p) > score(best)) best = p;
  return best;
}

export function getOption(run, kind, id) {
  return ((run.content.strategy || {})[kind] || []).find((o) => o.id === id) || null;
}

/** The three chosen options (falls back to the first option of each kind). */
export function chosen(run) {
  const s = run.strategy || {};
  const out = {};
  for (const kind of KINDS) {
    const list = (run.content.strategy || {})[kind] || [];
    out[kind] = list.find((o) => o.id === s[kind]) || list[0] || null;
  }
  return out;
}

/** Rule effects of the current plan, labelled with the option that causes them. */
export function strategyRules(run) {
  const rules = [];
  const pick = chosen(run);
  for (const kind of KINDS) {
    const opt = pick[kind];
    if (opt) for (const e of opt.effects || []) rules.push({ ...e, label: opt.name });
  }
  return rules;
}

/** Change part of the plan. Returns true if something changed. */
export function setStrategy(run, patch) {
  if (!run.strategy) run.strategy = defaultStrategy(run);
  let changed = false;
  for (const kind of KINDS) {
    if (patch[kind] && getOption(run, kind, patch[kind]) && run.strategy[kind] !== patch[kind]) {
      run.strategy[kind] = patch[kind];
      changed = true;
    }
  }
  if (patch.starId && run.lineup.some((p) => p.id === patch.starId) && run.strategy.starId !== patch.starId) {
    run.strategy.starId = patch.starId;
    changed = true;
  }
  return changed;
}

/** The Star must be in the lineup; if he was replaced, pick the best scorer again. */
export function ensureStar(run) {
  if (!run.strategy) run.strategy = defaultStrategy(run);
  if (!run.lineup.some((p) => p.id === run.strategy.starId)) run.strategy.starId = bestScorer(run).id;
}

// ---------- Matchup reading ----------

const teamRules = (team) => [...((team.star && team.star.effects) || []), ...((team.signature && team.signature.effects) || [])];

/**
 * How a defensive scheme fares against a team's plays: the average change to
 * their make % across their play cycle. Negative = good for you.
 */
function defenseDelta(option, team) {
  const intents = [...(team.intents || []), ...teamRules(team).filter((r) => r.type === "every_nth_intent" && r.intent).map((r) => r.intent)];
  if (!intents.length) return { delta: 0, helped: [], hurt: [] };
  let total = 0;
  const helped = new Set();
  const hurt = new Set();
  for (const it of intents) {
    for (const e of option.effects || []) {
      if (e.type !== "intent_bonus") continue;
      if (e.tag && !(it.tags || []).includes(e.tag)) continue;
      if (e.points && it.points !== e.points) continue;
      total += e.value;
      (e.value < 0 ? helped : hurt).add(it.name);
    }
  }
  return { delta: total / intents.length, helped: [...helped], hurt: [...hurt] };
}

/** How an offensive system fares against a team's rules. Positive = good for you. */
function offenseScore(option, team, run) {
  const rules = teamRules(team);
  let score = 0;
  const reasons = [];
  const mods = (points) =>
    rules.filter((r) => r.type === "shot_mod" && r.points === points).reduce((s, r) => s + r.value, 0) +
    rules.filter((r) => r.type === "shot_mult" && r.points === points).reduce((s, r) => s + (r.value - 1) * 60, 0);
  for (const e of option.effects || []) {
    if (e.type === "shot_mod" && e.points && e.value > 0) {
      const m = mods(e.points);
      if (m > 0) {
        score += 1;
        reasons.push(`they give up the ${e.points === 3 ? "three" : "two"}`);
      } else if (m < 0) {
        score -= 1;
        reasons.push(`they take away the ${e.points === 3 ? "three" : "two"}`);
      }
    }
    if (e.type === "shot_mod" && e.points && e.value < 0 && mods(e.points) > 0) {
      score -= 1;
      reasons.push(`it gives up the ${e.points === 3 ? "three" : "two"} they leave open`);
    }
    if (e.type === "pass_draw" || e.type === "pass_steal") {
      if (rules.some((r) => r.type === "pass_steal" || (r.type === "card_cost" && r.tag === "Pass"))) {
        score -= 1;
        reasons.push("they attack your passing");
      }
    }
    if (e.type === "openness_bonus" && rules.some((r) => r.type === "negate_tag" && r.tag === e.tag)) {
      score -= 2;
      reasons.push("they switch every screen");
    }
    if (e.type === "shot_mod" && e.archetype) {
      const arch = rules.find((r) => r.type === "shot_mod" && r.archetype === e.archetype && r.value < 0);
      if (arch) {
        score -= 1;
        reasons.push(`they out-play your ${e.archetype}s`);
      }
      if (!run.lineup.some((p) => p.archetype === e.archetype)) {
        score -= 2;
        reasons.push(`you have no ${e.archetype}`);
      }
    }
  }
  return { score, reasons: [...new Set(reasons)] };
}

/**
 * Rate every option against an opponent: verdict -1 (unfavourable), 0 (even),
 * +1 (favourable), with the reason in words. Used by the game plan board and
 * by "use recommended".
 */
export function evaluateMatchup(run, team) {
  const out = { offense: {}, defense: {}, pace: {} };
  const strat = run.content.strategy || {};
  for (const opt of strat.defense || []) {
    const d = defenseDelta(opt, team);
    const verdict = d.delta <= -4 ? 1 : d.delta >= 4 ? -1 : 0;
    const why =
      verdict > 0
        ? `takes away ${d.helped.slice(0, 2).join(" and ")}`
        : verdict < 0
          ? `gives up ${d.hurt.slice(0, 2).join(" and ")}`
          : d.helped.length || d.hurt.length
            ? "helps and hurts about equally"
            : "no effect on their plays";
    out.defense[opt.id] = { verdict, value: -d.delta, why: `${why} (${d.delta > 0 ? "+" : ""}${Math.round(d.delta)}% on their average play)` };
  }
  for (const opt of strat.offense || []) {
    const o = offenseScore(opt, team, run);
    const verdict = o.score > 0 ? 1 : o.score < 0 ? -1 : 0;
    out.offense[opt.id] = { verdict, value: o.score, why: o.reasons.length ? o.reasons.join(", ") : "no particular edge either way" };
  }
  const lock = teamRules(team).find((r) => r.type === "pace");
  for (const opt of strat.pace || []) {
    if (lock) {
      out.pace[opt.id] = { verdict: 0, value: 0, why: `the opponent locks the pace to ${lock.pace}`, locked: true };
      continue;
    }
    const d = defenseDelta(opt, team);
    const verdict = d.delta >= 3 ? -1 : 0;
    out.pace[opt.id] = { verdict, value: -d.delta, why: verdict < 0 ? `feeds ${d.hurt.slice(0, 2).join(" and ")}` : "no particular edge either way" };
  }
  return out;
}

/** The best-rated option of each kind against this opponent (ties keep the simpler, earlier option). */
export function recommended(run, team) {
  const ev = evaluateMatchup(run, team);
  const best = (kind) => {
    let pick = null;
    for (const opt of (run.content.strategy || {})[kind] || []) {
      const v = ev[kind][opt.id].value;
      if (!pick || v > pick.v) pick = { id: opt.id, v };
    }
    return pick ? pick.id : null;
  };
  return { offense: best("offense"), defense: best("defense"), pace: "normal" };
}
