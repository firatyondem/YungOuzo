// Opponent team rules: star abilities, signature mechanics, boss phases, league
// scouting and film study. Everything is data (content/teams.json): a rule is
// { type, ...params } and each type has exactly one meaning here.
//
// Where rules come from (resolved fresh every time, nothing is cached):
//   team.star.effects        the star's ability
//   team.signature.effects   the team's signature mechanic
//   team.phases[n].effects   the current boss phase
//   match.extraRules         computed at tip-off: league scouting, film study
//
// RULE TYPES
//   Opponent offense
//     intent_bonus { tag?, points?, value }      +value% on matching intents
//     streak_bonus { value, cap, resetContest? } +value% per consecutive make
//     ramp_bonus { value, cap }                  +value% per possession played
//     late_bonus { value, within, window }       close game, late
//     hot_streak { chance, bonus, length }       rolled at turn start, shown to the player
//     mismatch_bonus { perPoint }                per point your weakest DEF is below 5
//     ignore_contest { points?, value }          part of your Contest is ignored
//     ignore_all_contest_every { n }             every nth possession ignores all Contest
//     every_nth_intent { n, intent }             a set play every nth possession
//     adapt_after { n, bonus }                   after n possessions, +bonus on their best play type
//     second_chance { chance, pct }              putback after a miss (denied by Box Out)
//     and_one { chance, tag }                    extra point on made matching intents
//   Your offense
//     shot_mod { points?, tag?, archetype?, value }   +/- % on your matching shots
//     shot_mult { points?, value }                     multiplies your make chance
//     rating_cap { value }                             your shooter's rating counts as at most value
//     card_cost { tag?, cardType?, value }             matching cards cost more/less
//     pass_steal { chance }                            your Pass cards can be picked off
//     negate_tag { tag }                               matching cards create no Openness
//     openness_start { value } / no_passive_openness   your Openness at turn start
//     energy_tax { value }                             fewer seconds each turn
//     pace { clock, draw }                             shot clock length and cards drawn
//     counter_favorite_type { value, fromGame? }       becomes a card_cost rule at tip-off

function teamOf(run) {
  const m = run.match;
  return m ? run.content.teams.find((t) => t.id === m.teamId) : null;
}

const withLabel = (effects, label) => (effects || []).map((e) => ({ ...e, label: e.label || label }));

/** All rules in force right now, each tagged with a `label` naming its source. */
export function activeRules(run) {
  const m = run.match;
  const team = teamOf(run);
  if (!m || !team) return [];
  const rules = [];
  if (team.star) rules.push(...withLabel(team.star.effects, team.star.name));
  if (team.signature) rules.push(...withLabel(team.signature.effects, team.signature.name));
  const phase = team.phases && team.phases[m.opp ? m.opp.phase : 0];
  if (phase) rules.push(...withLabel(phase.effects, phase.name));
  rules.push(...(m.extraRules || []));
  return rules;
}

export function rulesOf(run, type) {
  return activeRules(run).filter((r) => r.type === type);
}

export function firstRule(run, type) {
  return activeRules(run).find((r) => r.type === type) || null;
}

/** Intents of the current phase (falls back to the team's base intents). */
export function phaseIntents(run) {
  const team = teamOf(run);
  const m = run.match;
  const phase = team.phases && team.phases[m.opp ? m.opp.phase : 0];
  return (phase && phase.intents) || team.intents;
}

/** Does an intent match a rule's filter (tag and/or points)? */
export function intentMatches(rule, intent) {
  if (rule.tag && !(intent.tags || []).includes(rule.tag)) return false;
  if (rule.points && intent.points !== rule.points) return false;
  return true;
}

/** Your weakest defender in the lineup (lowest DEF, first one on ties). */
export function weakestDefender(run) {
  let worst = run.lineup[0];
  for (const p of run.lineup) if (p.ratings.DEF < worst.ratings.DEF) worst = p;
  return worst;
}

/**
 * Rules computed once at tip-off from what the league has seen of you this run:
 *  - league scouting: later opponents defend your favourite shot type harder
 *  - film study: teams with counter_favorite_type tax your most-played card type
 * Returns { rules, notes } (notes are shown to the player before the game).
 */
export function tipOffRules(run, team, stop) {
  const rules = [];
  const notes = [];
  const film = run.film || { types: {}, shots: {} };
  const cfg = run.config.LEAGUE_SCOUTING;
  const s2 = film.shots[2] || 0;
  const s3 = film.shots[3] || 0;
  const total = s2 + s3;
  if (cfg && run.round > 0 && total >= cfg.minShots) {
    if (s3 / total >= cfg.share) {
      rules.push({ type: "shot_mod", points: 3, value: -cfg.defense, label: "League scouting" });
      notes.push(`League has scouted your three-point barrage: your threes are at -${cfg.defense}%.`);
    } else if (s2 / total >= cfg.share) {
      rules.push({ type: "shot_mod", points: 2, value: -cfg.defense, label: "League scouting" });
      notes.push(`League has scouted your paint attack: your two-point shots are at -${cfg.defense}%.`);
    }
  }
  const sources = [team.star, team.signature].filter(Boolean);
  for (const src of sources) {
    for (const e of src.effects || []) {
      if (e.type !== "counter_favorite_type") continue;
      const game = stop ? stop.wins + stop.losses + 1 : 1;
      if (e.fromGame && game < e.fromGame) continue;
      const entries = Object.entries(film.types).sort((a, b) => b[1] - a[1]);
      const played = entries.reduce((n, [, v]) => n + v, 0);
      if (!entries.length || played < 5) continue;
      const [cardType] = entries[0];
      rules.push({ type: "card_cost", cardType, value: e.value, label: src.name });
      notes.push(`${src.name}: they prepared for your ${cardType} cards, which cost ${e.value}s more.`);
    }
  }
  return { rules, notes };
}
