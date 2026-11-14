// League tests: the 16-team data, the per-run schedule, the Finals series,
// and every team rule type (star abilities, signature mechanics, phases, film study).
import test from "node:test";
import assert from "node:assert/strict";
import { league, content, CONFIG, REAL_CONFIG, newRun, matchVs, giveCard, loadContent } from "./helpers.js";
import { createRun, buildSchedule, winsNeeded } from "../src/engine/gameState.js";
import { startMatch, playCard, endTurn, debugAddPoints } from "../src/engine/turnLoop.js";
import { calcShot, getCardCost, opponentPreview, passiveOpenness } from "../src/engine/rules.js";
import { activeRules } from "../src/engine/teamRules.js";
import { applyReward } from "../src/engine/rewards.js";
import { normalizeLook } from "../src/look.js";

const KNOWN_RULES = [
  "intent_bonus", "streak_bonus", "ramp_bonus", "late_bonus", "hot_streak", "mismatch_bonus", "ignore_contest",
  "ignore_all_contest_every", "every_nth_intent", "adapt_after", "second_chance", "and_one", "shot_mod", "shot_mult",
  "rating_cap", "card_cost", "pass_steal", "negate_tag", "openness_start", "no_passive_openness", "energy_tax", "pace",
  "counter_favorite_type",
];

/** Opponent attempt outcomes over many seeds for a custom team. */
function sample(team, n, setup = () => {}) {
  const out = [];
  for (let seed = 1; seed <= n; seed++) {
    const run = matchVs(team, seed);
    setup(run);
    const events = endTurn(run);
    out.push({ run, events, attempt: events.find((e) => e.type === "opp_attempt") });
  }
  return out;
}

// ---------- League data ----------

test("league: 16 fictional teams in tiers 6 / 6 / 3 + boss, complete and valid", () => {
  const teams = league.teams;
  assert.equal(teams.length, 16);
  const tier = (t) => teams.filter((x) => x.tier === t).length;
  assert.deepEqual([tier(1), tier(2), tier(3), tier("boss")], [6, 6, 3, 1]);
  assert.equal(new Set(teams.map((t) => t.id)).size, 16);
  const names = new Set();
  for (const t of teams) {
    assert.ok(t.name && t.identity && t.tagline, `${t.id} identity`);
    assert.ok(t.coach && t.coach.hint && typeof t.coach.aggression === "number", `${t.id} coach profile`);
    assert.ok(t.star.name && t.star.text && t.signature.name && t.signature.text, `${t.id} star + signature`);
    assert.equal(t.players.length, 8, `${t.id} roster`);
    assert.ok(t.players.some((p) => p.id === t.star.playerId), `${t.id} star is on the roster`);
    assert.ok(t.intents.length >= 2);
    for (const i of t.intents) assert.ok(i.name && [2, 3].includes(i.points) && i.pct > 0 && Array.isArray(i.tags));
    for (const p of t.players) {
      assert.ok(!names.has(p.name), `duplicate player name ${p.name}`);
      names.add(p.name);
      assert.deepEqual(normalizeLook(p.look), p.look, `${p.id} look is valid`);
      assert.ok(p.tendencies.length >= 1);
    }
    assert.equal(new Set(t.players.map((p) => p.jersey)).size, 8, `${t.id} jersey numbers are unique`);
    const effects = [...t.star.effects, ...t.signature.effects, ...(t.phases || []).flatMap((p) => p.effects || [])];
    for (const e of effects) assert.ok(KNOWN_RULES.includes(e.type), `${t.id}: unknown rule type ${e.type}`);
  }
  // No league player shares a name with your roster.
  for (const p of league.playerList) assert.ok(!names.has(p.name));
  const boss = teams.find((t) => t.tier === "boss");
  assert.equal(boss.series, 3);
  assert.equal(boss.phases.length, 2);
});

// ---------- Schedule + series ----------

test("league: each run draws one opponent per act, then the Finals series", () => {
  const seen = [new Set(), new Set(), new Set()];
  for (let seed = 1; seed <= 60; seed++) {
    const run = createRun(league, REAL_CONFIG, seed);
    assert.equal(run.schedule.length, 4);
    assert.deepEqual(run.schedule.map((s) => s.label), ["Act 1", "Act 2", "Act 3", "Finals"]);
    run.schedule.slice(0, 3).forEach((s, i) => {
      assert.equal(league.teams.find((t) => t.id === s.teamId).tier, i + 1);
      assert.equal(s.games, 1);
      seen[i].add(s.teamId);
    });
    assert.equal(run.schedule[3].teamId, "dynasty");
    assert.equal(run.schedule[3].games, 3);
    assert.equal(winsNeeded(run.schedule[3]), 2);
  }
  assert.ok(seen[0].size >= 5 && seen[1].size >= 5 && seen[2].size === 3, "different runs meet different teams");
  // Same seed, same season.
  const a = createRun(league, REAL_CONFIG, 777).schedule;
  const b = createRun(league, REAL_CONFIG, 777).schedule;
  assert.deepEqual(a, b);
  // Without tiers, teams are played in file order (used by the engine tests).
  assert.deepEqual(buildSchedule(newRun()).map((s) => s.teamId), content.teams.map((t) => t.id));
});

test("league: the Finals are a best-of-3 series", () => {
  const finals = (seed) => {
    const run = createRun(league, REAL_CONFIG, seed);
    run.round = 3;
    return run;
  };
  // Win, lose, win -> champion.
  let run = finals(1);
  startMatch(run);
  assert.equal(run.match.gameNo, 1);
  debugAddPoints(run, 15, "player");
  assert.equal(run.phase, "map", "one win does not end the series");
  assert.equal(run.rewards, null, "no reward inside the series");
  startMatch(run);
  assert.equal(run.match.gameNo, 2);
  debugAddPoints(run, 15, "opp");
  assert.equal(run.phase, "map", "one loss does not end the run");
  startMatch(run);
  assert.equal(run.match.gameNo, 3);
  debugAddPoints(run, 15, "player");
  assert.equal(run.phase, "victory");
  assert.deepEqual(run.results.map((r) => [r.label, r.game, r.won]), [["Finals", 1, true], ["Finals", 2, false], ["Finals", 3, true]]);

  // Two losses end the run.
  run = finals(2);
  startMatch(run);
  debugAddPoints(run, 15, "opp");
  startMatch(run);
  debugAddPoints(run, 15, "opp");
  assert.equal(run.phase, "gameover");

  // Before the Finals a win gives a reward; with no lives left a loss ends the run.
  run = createRun(league, { ...REAL_CONFIG, LIVES: 0 }, 3);
  startMatch(run);
  debugAddPoints(run, 15, "player");
  assert.equal(run.phase, "reward");
  applyReward(run, 0);
  assert.equal(run.round, 1);
  startMatch(run);
  debugAddPoints(run, 15, "opp");
  assert.equal(run.phase, "gameover");
});

test("league: boss changes phase mid-game with new intents and rules", () => {
  const run = createRun(league, REAL_CONFIG, 5);
  run.round = 3;
  startMatch(run);
  const m = run.match;
  const boss = league.teams.find((t) => t.id === "dynasty");
  assert.equal(m.opp.phase, 0);
  assert.equal(opponentPreview(run).intent.name, boss.intents[0].name);
  assert.equal(activeRules(run).some((r) => r.type === "negate_tag"), false);
  m.score.player = boss.phases[1].at;
  const events = endTurn(run);
  if (m.over) return;
  assert.ok(events.some((e) => e.type === "phase_shift" && e.name === boss.phases[1].name));
  assert.equal(m.opp.phase, 1);
  assert.equal(m.intentIndex, 0);
  assert.equal(opponentPreview(run).intent.name, boss.phases[1].intents[0].name);
  assert.ok(activeRules(run).some((r) => r.type === "negate_tag" && r.label === boss.phases[1].name));
});

// ---------- Opponent-side rules ----------

test("rules: intent bonuses (tag, streak, ramp, late, mismatch) add to their %", () => {
  const eff = (effects, setup) => {
    const run = matchVs({ star: { name: "Star", text: "", effects } }, 1);
    run.match.contest = 0;
    if (setup) setup(run);
    return opponentPreview(run);
  };
  // Tag bonus only on matching intents (first intent is a drive, second a three).
  assert.equal(eff([{ type: "intent_bonus", tag: "drive", value: 10 }]).pct, 60);
  assert.equal(eff([{ type: "intent_bonus", tag: "three", value: 10 }]).pct, 50);
  assert.equal(eff([{ type: "intent_bonus", tag: "three", value: 10 }], (r) => (r.match.intentIndex = 1)).pct, 50);
  // Streak: +5 per make in a row, capped.
  assert.equal(eff([{ type: "streak_bonus", value: 5, cap: 25 }], (r) => (r.match.opp.streak = 3)).pct, 65);
  assert.equal(eff([{ type: "streak_bonus", value: 5, cap: 25 }], (r) => (r.match.opp.streak = 9)).pct, 75);
  // Ramp: per possession, capped.
  assert.equal(eff([{ type: "ramp_bonus", value: 3, cap: 15 }], (r) => (r.match.opp.possessions = 2)).pct, 56);
  assert.equal(eff([{ type: "ramp_bonus", value: 3, cap: 15 }], (r) => (r.match.opp.possessions = 20)).pct, 65);
  // Late and close only.
  const late = [{ type: "late_bonus", value: 20, within: 3, window: 6 }];
  assert.equal(eff(late).pct, 50);
  assert.equal(eff(late, (r) => Object.assign(r.match.score, { player: 10, opp: 9 })).pct, 70);
  assert.equal(eff(late, (r) => Object.assign(r.match.score, { player: 13, opp: 6 })).pct, 50);
  // Mismatch: per point the weakest defender is below 5, and it names him.
  const mm = eff([{ type: "mismatch_bonus", perPoint: 3 }]);
  const weakest = Math.min(...mm && newRun().lineup.map((p) => p.ratings.DEF));
  assert.equal(mm.pct, 50 + (5 - weakest) * 3);
  assert.ok(mm.notes.some((n) => /attacking/.test(n.text)));
  // Every applied modifier is explained.
  assert.ok(eff([{ type: "intent_bonus", tag: "drive", value: 10 }]).notes.some((n) => n.label === "Star" && n.value === 10));
});

test("rules: ignored Contest, set plays every nth possession, hot streaks", () => {
  const post = { type: "ignore_contest", points: 2, value: 15 };
  let run = matchVs({ star: { name: "Titan", text: "", effects: [post] } });
  run.match.contest = 40;
  assert.equal(opponentPreview(run).pct, 50 - 25, "15 of the 40 Contest is ignored");
  run.match.contest = 10;
  assert.equal(opponentPreview(run).pct, 50);
  run.match.intentIndex = 1; // a three: not affected
  run.match.contest = 20;
  assert.equal(opponentPreview(run).pct, 20);

  run = matchVs({ star: { name: "Breaker", text: "", effects: [{ type: "ignore_all_contest_every", n: 4 }] } });
  run.match.contest = 60;
  run.match.opp.possessions = 2;
  assert.equal(opponentPreview(run).pct, 5);
  run.match.opp.possessions = 3; // the 4th possession
  assert.equal(opponentPreview(run).pct, 50);
  assert.ok(opponentPreview(run).notes.some((n) => /ignores all Contest/.test(n.text)));

  // Set play every 3rd possession, without skipping the normal cycle.
  const setPlay = { name: "Run Out", points: 3, pct: 42, tags: ["three"] };
  run = matchVs({ signature: { name: "Run Out", text: "", effects: [{ type: "every_nth_intent", n: 3, intent: setPlay }] } });
  const order = [];
  for (let i = 0; i < 6 && !run.match.over; i++) {
    order.push(opponentPreview(run).intent.name);
    run.match.score.opp = 0;
    endTurn(run);
  }
  assert.deepEqual(order, ["Drive", "Three", "Run Out", "Drive", "Three", "Run Out"]);

  // Hot streak: rolled at turn start, visible in the preview, lasts `length` possessions.
  let started = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = matchVs({ star: { name: "Spark", text: "", effects: [{ type: "hot_streak", chance: 50, bonus: 15, length: 2 }] } }, seed);
    r.match.contest = 0;
    if (r.match.opp.hot > 0) {
      started++;
      assert.equal(r.match.opp.hot, 2);
      assert.equal(opponentPreview(r).pct, 65);
      endTurn(r);
      if (!r.match.over) assert.ok(r.match.opp.hot >= 1, "still hot for the next possession");
    } else {
      assert.equal(opponentPreview(r).pct, 50);
    }
  }
  assert.ok(started > 60 && started < 140, `hot starts: ${started}`);
});

test("rules: second chances are denied by Box Out; and-ones add a point", () => {
  const glass = { star: { name: "Glass", text: "", effects: [{ type: "second_chance", chance: 100, pct: 95 }] } };
  // Force misses with huge Contest... which also lowers the putback, so use contest 0 and a 5% intent.
  const weak = { ...glass, intents: [{ name: "Heave", points: 2, pct: 5, tags: ["mid"] }] };
  let putbacks = 0;
  for (const { run, events, attempt } of sample(weak, 80, (r) => (r.match.contest = 0))) {
    const second = events.find((e) => e.type === "second_chance");
    if (attempt.made) {
      assert.equal(second, undefined, "no putback after a make");
      continue;
    }
    assert.ok(second, "a miss always gives a second chance at 100%");
    if (second.made) {
      putbacks++;
      assert.equal(run.match.score.opp, 2);
      assert.equal(run.match.lastOppFailed, false, "a made putback is not a stop");
    }
  }
  assert.ok(putbacks > 60, `putbacks: ${putbacks}`);
  // Box Out (any on-opponent-fail card) denies it.
  for (const { run, events, attempt } of sample(weak, 40, (r) => {
    r.match.contest = 0;
    playCard(r, giveCard(r, "box_out", "starter", true).iid);
  })) {
    if (attempt.made) continue;
    assert.equal(events.some((e) => e.type === "second_chance"), false);
    assert.ok(events.some((e) => e.type === "box_out_stop"));
    assert.equal(run.match.score.opp, 0);
  }

  const andOne = { star: { name: "AndOne", text: "", effects: [{ type: "and_one", chance: 100, tag: "drive" }] }, intents: [{ name: "Drive", points: 2, pct: 95, tags: ["drive"] }] };
  for (const { run, attempt } of sample(andOne, 30, (r) => (r.match.contest = 0))) {
    if (attempt.made) {
      assert.equal(attempt.extra, 1);
      assert.equal(run.match.score.opp, 3);
    }
  }
});

test("rules: opponents adapt to what works, and heavy Contest cools a streak", () => {
  const team = {
    signature: { name: "Quick Study", text: "", effects: [{ type: "adapt_after", n: 4, bonus: 10 }] },
    intents: [{ name: "Sure", points: 2, pct: 95, tags: ["post"] }, { name: "Brick", points: 3, pct: 5, tags: ["three"] }],
  };
  const run = matchVs(team, 3);
  let adapted = null;
  for (let i = 0; i < 4 && !run.match.over; i++) {
    run.match.contest = 0;
    run.match.score.opp = 0;
    const ev = endTurn(run).find((e) => e.type === "adapt");
    if (ev) adapted = ev;
  }
  assert.ok(adapted, "adapts after 4 possessions");
  assert.equal(adapted.tag, "post", "goes back to the play type that worked");
  run.match.contest = 0;
  run.match.intentIndex = 0;
  assert.equal(opponentPreview(run).pct, 95, "95 + 10 is clamped");
  assert.ok(opponentPreview(run).notes.some((n) => n.text === "adapted"));

  const hot = { star: { name: "Nova", text: "", effects: [{ type: "streak_bonus", value: 5, cap: 25, resetContest: 30 }] }, intents: [{ name: "Iso", points: 2, pct: 95, tags: ["iso"] }] };
  const r = matchVs(hot, 2);
  r.match.opp.streak = 3;
  r.match.contest = 30;
  const events = endTurn(r);
  assert.ok(events.some((e) => e.type === "cooled"));
  assert.equal(r.match.opp.streak, 0);
});

// ---------- Player-side rules ----------

test("rules: shot modifiers, multipliers and rating caps change your make %", () => {
  const base = () => {
    const run = matchVs({ defense: 10 });
    run.match.openness = 0;
    return run;
  };
  const plain = base();
  const two = giveCard(plain, "pull_up_jumper");
  const three = giveCard(plain, "corner_three");
  const drive = giveCard(plain, "drive_and_finish");
  const p2 = calcShot(plain, two).pct;
  const p3 = calcShot(plain, three).pct;
  const pd = calcShot(plain, drive).pct;

  const mod = (effects) => {
    const run = matchVs({ defense: 10, star: { name: "Rule", text: "", effects } });
    run.match.openness = 0;
    return run;
  };
  let run = mod([{ type: "shot_mod", tag: "Drive", value: -15 }]);
  assert.equal(calcShot(run, drive).pct, pd - 15);
  assert.equal(calcShot(run, two).pct, p2, "only Drive-tagged cards");
  assert.ok(calcShot(run, drive).notes.some((n) => n.label === "Rule" && n.value === -15));

  run = mod([{ type: "shot_mod", points: 3, value: 8 }]);
  assert.equal(calcShot(run, three).pct, p3 + 8);
  assert.equal(calcShot(run, two).pct, p2);

  run = mod([{ type: "shot_mod", archetype: "Big", value: -10 }]);
  const bigShot = giveCard(run, "pull_up_jumper", "player_07"); // owned by the Big
  const guardShot = giveCard(run, "pull_up_jumper", "player_10");
  const plainBig = calcShot(plain, giveCard(plain, "pull_up_jumper", "player_07")).pct;
  assert.equal(calcShot(run, bigShot).pct, plainBig - 10);
  assert.equal(calcShot(run, guardShot).notes.length, 0);

  run = mod([{ type: "shot_mult", points: 2, value: 0.75 }]);
  assert.equal(calcShot(run, two).pct, p2 * 0.75);
  assert.equal(calcShot(run, three).pct, p3);

  run = mod([{ type: "rating_cap", value: 4 }]);
  assert.equal(calcShot(run, two).pct, p2 - 5, "best INS 5 counts as 4");
});

test("rules: card costs, pick-offs, negated tags, Openness and shot clock changes", () => {
  // Card cost by tag.
  let run = matchVs({ signature: { name: "Press", text: "", effects: [{ type: "card_cost", tag: "Pass", value: 1 }] } });
  assert.equal(getCardCost(run, content.cards.swing_pass), content.cards.swing_pass.cost + 1);
  assert.equal(getCardCost(run, content.cards.contest), content.cards.contest.cost);

  // Pass cards can be picked off: spent, no effect, not counted as a pass.
  let picked = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = matchVs({ star: { name: "Pickpocket", text: "", effects: [{ type: "pass_steal", chance: 25 }] } }, seed);
    const before = r.match.openness;
    const card = giveCard(r, "swing_pass", "starter", true);
    const events = playCard(r, card.iid);
    if (events.some((e) => e.type === "picked_off")) {
      picked++;
      assert.equal(r.match.openness, before);
      assert.equal(r.match.energy, r.match.maxEnergy - content.cards.swing_pass.cost);
      assert.equal(r.match.playedTags.includes("Pass"), false);
      assert.equal(r.match.hand.length, 0);
    } else {
      assert.equal(r.match.openness, before + 10);
    }
    // Non-pass cards are never picked off.
    assert.equal(playCard(r, giveCard(r, "contest").iid).some((e) => e.type === "picked_off"), false);
  }
  assert.ok(picked > 25 && picked < 80, `picked off: ${picked}`);

  // Negated tag: Screen cards create no Openness but keep their other effects.
  run = matchVs({ signature: { name: "Switch", text: "", effects: [{ type: "negate_tag", tag: "Screen" }] } });
  const o = run.match.openness;
  const hand = run.match.hand.length;
  const events = playCard(run, giveCard(run, "pick_and_roll").iid);
  assert.ok(events.some((e) => e.type === "negated"));
  assert.equal(run.match.openness, o);
  assert.equal(run.match.hand.length, hand + 1, "still draws its card");
  playCard(run, giveCard(run, "swing_pass").iid);
  assert.equal(run.match.openness, o + 10, "other cards are unaffected");

  // Openness at turn start.
  run = matchVs({ signature: { name: "Set", text: "", effects: [{ type: "openness_start", value: -10 }] } });
  assert.equal(run.match.openness, passiveOpenness(run) - 10);
  run = matchVs({ signature: { name: "Read", text: "", effects: [{ type: "no_passive_openness" }] } });
  assert.equal(run.match.openness, 0);

  // Shot clock: tax and pace.
  run = matchVs({ signature: { name: "Bruisers", text: "", effects: [{ type: "energy_tax", value: 2 }] } });
  assert.equal(run.match.energy, 22);
  // Pace changes how many cards you see. The shot clock is always 24.
  run = matchVs({ signature: { name: "Fast", text: "", effects: [{ type: "pace", pace: "fast", clock: 18, draw: 1 }] } });
  assert.equal(run.match.maxEnergy, 24);
  assert.equal(run.match.energy, 24);
  assert.equal(run.match.hand.length, 6);
  run = matchVs({ signature: { name: "Slow", text: "", effects: [{ type: "pace", pace: "slow", draw: -1 }] } });
  assert.equal(run.match.energy, 24);
  assert.equal(run.match.hand.length, 4);
});

// ---------- Film study ----------

test("film: the league scouts your favourite shot, and film-study teams tax your favourite card type", () => {
  const cfg = { ...CONFIG, LEAGUE_SCOUTING: { minShots: 8, share: 0.62, defense: 6 } };
  const twoTeams = [
    { id: "a", name: "A", defense: 10, color: "#888888", intents: [{ name: "Drive", points: 2, pct: 50, tags: ["drive"] }] },
    { id: "b", name: "B", defense: 10, color: "#888888", intents: [{ name: "Drive", points: 2, pct: 50, tags: ["drive"] }] },
  ];
  const make = (shots) => {
    const run = createRun(loadContent({ teams: twoTeams }), cfg, 9);
    run.film.shots = shots;
    run.round = 1;
    startMatch(run);
    run.match.openness = 0;
    return run;
  };
  // Three-heavy: threes are defended harder, twos are not.
  let run = make({ 2: 2, 3: 8 });
  assert.ok(run.match.notes.some((n) => /three-point barrage/.test(n)));
  const plain = make({ 2: 5, 3: 5 });
  assert.equal(plain.match.notes.length, 0, "a balanced attack is not countered");
  const p3 = calcShot(plain, giveCard(plain, "corner_three")).pct;
  const p2 = calcShot(plain, giveCard(plain, "pull_up_jumper")).pct;
  assert.equal(calcShot(run, giveCard(run, "corner_three")).pct, p3 - 6);
  assert.equal(calcShot(run, giveCard(run, "pull_up_jumper")).pct, p2);
  // Paint-heavy.
  run = make({ 2: 9, 3: 1 });
  assert.ok(run.match.notes.some((n) => /paint attack/.test(n)));
  assert.equal(calcShot(run, giveCard(run, "pull_up_jumper")).pct, p2 - 6);
  // Not on the first stop, and not before enough shots.
  const first = createRun(loadContent({ teams: twoTeams }), cfg, 9);
  first.film.shots = { 2: 0, 3: 20 };
  startMatch(first);
  assert.equal(first.match.notes.length, 0);
  assert.equal(make({ 2: 0, 3: 5 }).match.notes.length, 0);

  // Playing cards records film.
  const rec = matchVs({});
  rec.match.energy = 99;
  playCard(rec, giveCard(rec, "swing_pass").iid);
  playCard(rec, giveCard(rec, "corner_three").iid);
  assert.equal(rec.film.types.Offense, 1);
  assert.equal(rec.film.types.Shot, 1);
  assert.equal(rec.film.shots[3], 1);

  // counter_favorite_type: your most-played card type costs more.
  const owls = { star: { name: "Film Study", text: "", effects: [{ type: "counter_favorite_type", value: 1 }] } };
  const filmRun = (types, team = owls) => {
    const r = createRun(loadContent({ teams: [{ id: "t", name: "T", defense: 10, color: "#888888", intents: twoTeams[0].intents, ...team }] }), CONFIG, 4);
    r.film.types = types;
    startMatch(r);
    return r;
  };
  run = filmRun({ Defense: 9, Offense: 4, Shot: 3 });
  assert.equal(getCardCost(run, content.cards.contest), content.cards.contest.cost + 1);
  assert.equal(getCardCost(run, content.cards.swing_pass), content.cards.swing_pass.cost);
  assert.ok(run.match.notes.some((n) => /Defense cards/.test(n)));
  assert.equal(getCardCost(filmRun({ Defense: 2 }), content.cards.contest), content.cards.contest.cost, "not enough film yet");
  // fromGame: only from that game of a series on.
  const late = { series: 3, signature: { name: "Film Room", text: "", effects: [{ type: "counter_favorite_type", value: 1, fromGame: 2 }] } };
  run = filmRun({ Shot: 9 }, late);
  assert.equal(getCardCost(run, content.cards.pull_up_jumper), content.cards.pull_up_jumper.cost, "game 1: no tax");
  debugAddPoints(run, 15, "player");
  startMatch(run);
  assert.equal(run.match.gameNo, 2);
  assert.equal(getCardCost(run, content.cards.pull_up_jumper), content.cards.pull_up_jumper.cost + 1, "game 2: taxed");
});

test("league: a full seeded season is reproducible", () => {
  const play = (seed) => {
    const run = createRun(league, REAL_CONFIG, seed);
    let guard = 0;
    while (run.phase === "map" && guard++ < 12) {
      startMatch(run);
      let turns = 0;
      while (!run.match.over && turns++ < 200) {
        for (const inst of [...run.match.hand]) {
          playCard(run, inst.iid);
          if (run.match.over) break;
        }
        if (!run.match.over) endTurn(run);
      }
      if (run.phase === "reward") applyReward(run, 0, { slot: 0 });
    }
    return JSON.stringify(run);
  };
  assert.equal(play(31), play(31));
  assert.notEqual(play(31), play(32));
});
