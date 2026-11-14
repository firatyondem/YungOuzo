// Team strategy tests: offensive systems, defensive schemes, pace, the matchup
// reading, and changing the plan (free at halftime, otherwise a timeout).
import test from "node:test";
import assert from "node:assert/strict";
import { league, content, CONFIG, newRun, newMatch, matchVs, giveCard } from "./helpers.js";
import { startMatch, playCard, endTurn } from "../src/engine/turnLoop.js";
import { calcShot, getCardCost, opponentPreview, passiveContest } from "../src/engine/rules.js";
import { chosen, defaultStrategy, evaluateMatchup, recommended, setStrategy, bestScorer } from "../src/engine/strategy.js";
import { canChangePlan, changePlan } from "../src/engine/actions.js";
import { replacePlayer } from "../src/engine/rewards.js";

const S = content.strategy;
const play = (run, cardId, source = "starter") => playCard(run, giveCard(run, cardId, source).iid);
const withPlan = (plan, team = {}, seed = 12345) => {
  const run = matchVs(team, seed);
  setStrategy(run, plan);
  run.match.openness = 0;
  return run;
};

test("strategy: content has 5+ systems, 5 schemes and 3 paces, each with strengths and weaknesses", () => {
  assert.ok(S.offense.length >= 5 && S.defense.length === 5 && S.pace.length === 3);
  for (const kind of ["offense", "defense", "pace"]) {
    for (const o of S[kind]) {
      assert.ok(o.id && o.name && o.strengths.length && o.weaknesses.length, `${kind}/${o.id}`);
      assert.ok(Array.isArray(o.effects));
    }
  }
  const run = newRun();
  assert.deepEqual(run.strategy, { ...defaultStrategy(run) });
  assert.equal(run.strategy.offense, "balanced");
  assert.equal(run.strategy.defense, "man");
  assert.equal(run.strategy.pace, "normal");
  assert.equal(run.strategy.starId, bestScorer(run).id);
  // The neutral defaults change nothing.
  for (const kind of ["offense", "defense", "pace"]) assert.equal(chosen(run)[kind].effects.length, 0);
});

test("systems: Pace & Space, Post Hub and Heliocentric change your shots", () => {
  const base = withPlan({});
  const three = (r) => calcShot(r, giveCard(r, "corner_three")).pct;
  const two = (r, src = "starter") => calcShot(r, giveCard(r, "pull_up_jumper", src)).pct;
  const b3 = three(base);
  const b2 = two(base);
  const bigTwo = two(base, "player_07");

  // Pace & Space: +10% threes, Fast Break 2s cheaper, -10 Contest every turn.
  let run = withPlan({ offense: "pace_space" });
  assert.equal(three(run), b3 + 10);
  assert.equal(two(run), b2);
  assert.equal(getCardCost(run, content.cards.fast_break), 2);
  assert.ok(calcShot(run, giveCard(run, "corner_three")).notes.some((n) => n.label === "Pace & Space" && n.value === 10));
  endTurn(run);
  if (!run.match.over) assert.equal(run.match.contest, passiveContest(run) - 10);

  // Post Hub: Bigs +15% on twos, Box Out free, threes -10%.
  run = withPlan({ offense: "post_hub" });
  assert.equal(two(run, "player_07"), bigTwo + 15);
  assert.equal(two(run), b2, "non-Bigs get nothing");
  assert.equal(three(run), b3 - 10);
  assert.equal(getCardCost(run, content.cards.box_out), 0);

  // Heliocentric: the Star +20%, everyone else -10%.
  run = withPlan({ offense: "heliocentric" });
  const star = run.lineup.find((p) => p.id === run.strategy.starId);
  assert.equal(star.id, bestScorer(run).id);
  const starShot = calcShot(run, giveCard(run, "pull_up_jumper", star.id));
  const other = run.lineup.find((p) => p.id !== star.id);
  const otherShot = calcShot(run, giveCard(run, "pull_up_jumper", other.id));
  const plainStar = calcShot(base, giveCard(base, "pull_up_jumper", star.id)).pct;
  const plainOther = calcShot(base, giveCard(base, "pull_up_jumper", other.id)).pct;
  assert.equal(starShot.pct, Math.min(95, plainStar + 20));
  assert.equal(otherShot.pct, plainOther - 10);
  // You can designate a different Star; a replaced Star hands the role to the newcomer.
  assert.equal(setStrategy(run, { starId: other.id }), true);
  assert.equal(calcShot(run, giveCard(run, "pull_up_jumper", other.id)).pct, Math.min(95, plainOther + 20));
  const slot = run.lineup.findIndex((p) => p.id === other.id);
  replacePlayer(run, slot, "player_02");
  assert.equal(run.strategy.starId, "player_02");
});

test("systems: Motion Offense draws on every 2nd pass; Pick & Roll Heavy boosts screens", () => {
  let run = withPlan({ offense: "motion" });
  assert.equal(getCardCost(run, content.cards.iso), 7, "Iso costs 2s more");
  let hand = run.match.hand.length;
  play(run, "swing_pass");
  assert.equal(run.match.hand.length, hand, "first pass: nothing yet");
  play(run, "swing_pass");
  assert.equal(run.match.hand.length, hand + 1, "second pass draws a card");
  play(run, "swing_pass");
  assert.equal(run.match.hand.length, hand + 1);
  play(run, "no_look_dime");
  assert.equal(run.match.hand.length, hand + 2, "fourth pass draws again");

  run = withPlan({ offense: "pick_roll" });
  // Pick & Roll gives 20 + 10 extra; a 12% pick-off risk comes with it.
  let picked = 0;
  let boosted = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = withPlan({ offense: "pick_roll" }, {}, seed);
    const events = play(r, "pick_and_roll");
    if (events.some((e) => e.type === "picked_off")) picked++;
    else {
      boosted++;
      assert.equal(r.match.openness, 30);
    }
  }
  assert.ok(picked > 8 && picked < 50, `picked off: ${picked}`);
  assert.ok(boosted > 150);
  assert.ok(run);
});

test("schemes: each defensive scheme changes their plays as described", () => {
  const team = {
    intents: [
      { name: "Drive", points: 2, pct: 50, tags: ["drive"] },
      { name: "Three", points: 3, pct: 40, tags: ["three"] },
      { name: "Post-Up", points: 2, pct: 50, tags: ["post"] },
      { name: "Run-Out", points: 2, pct: 50, tags: ["transition"] },
    ],
  };
  const pcts = (defense) => {
    const run = matchVs(team);
    setStrategy(run, { defense });
    const out = [];
    for (let i = 0; i < 4; i++) {
      run.match.contest = 0;
      run.match.intentIndex = i;
      out.push(opponentPreview(run).pct);
    }
    return out;
  };
  assert.deepEqual(pcts("man"), [50, 40, 50, 50]);
  assert.deepEqual(pcts("zone_23"), [35, 50, 35, 50], "drives and post-ups -15, threes +10");
  assert.deepEqual(pcts("drop"), [35, 55, 35, 35], "twos -15, threes +15");
  assert.deepEqual(pcts("switch"), [50, 32, 65, 50], "threes -8, post-ups +15");
  assert.deepEqual(pcts("press"), [50, 40, 50, 70], "transition +20");

  // Full-Court Press: steals +20%, and it costs you 2 seconds a turn.
  const run = matchVs(team);
  setStrategy(run, { defense: "press" });
  const events = play(run, "swipe");
  assert.equal(events.find((e) => e.type === "steal_set").chance, 55);
  endTurn(run);
  if (!run.match.over) assert.equal(run.match.energy, 22);
  // The scheme is named next to the number it changes.
  const z = matchVs(team);
  setStrategy(z, { defense: "zone_23" });
  assert.ok(opponentPreview(z).notes.some((n) => n.label === "2-3 Zone" && n.value === -15));
});

test("pace: shot clock and hand size change for you; an opponent's pace lock wins", () => {
  let run = newRun();
  setStrategy(run, { pace: "fast" });
  startMatch(run);
  assert.equal(run.match.maxEnergy, 18);
  assert.equal(run.match.energy, 18);
  assert.equal(run.match.hand.length, 6);

  run = newRun();
  setStrategy(run, { pace: "slow" });
  startMatch(run);
  assert.equal(run.match.energy, 30);
  assert.equal(run.match.hand.length, 4);
  assert.equal(run.match.contest, passiveContest(run) + 4);

  // Pace affects the opponent too: fast feeds their transition game.
  const team = { intents: [{ name: "Run-Out", points: 2, pct: 50, tags: ["transition"] }] };
  run = matchVs(team);
  setStrategy(run, { pace: "fast" });
  run.match.contest = 0;
  assert.equal(opponentPreview(run).pct, 60);

  // A team that locks the pace overrides your choice.
  const locked = { signature: { name: "Slow Burn", text: "", effects: [{ type: "pace", pace: "slow", clock: 30, draw: -1 }] } };
  run = matchVs(locked);
  setStrategy(run, { pace: "fast" });
  endTurn(run);
  if (!run.match.over) {
    assert.equal(run.match.maxEnergy, 30);
    assert.equal(run.match.energy, 30);
  }
});

test("matchup: schemes and systems are rated against the opponent, with reasons", () => {
  const run = newRun();
  const gulls = league.teams.find((t) => t.id === "gulls"); // three-point heavy
  const rams = league.teams.find((t) => t.id === "rams"); // all post-ups and drives
  const kings = league.teams.find((t) => t.id === "kings"); // take away the two, give up the three
  const swans = league.teams.find((t) => t.id === "swans"); // switch every screen
  const wolves = league.teams.find((t) => t.id === "wolves"); // attack your passing
  const polar = league.teams.find((t) => t.id === "polar"); // lock the pace

  let ev = evaluateMatchup(run, rams);
  assert.equal(ev.defense.zone_23.verdict, 1, "a zone is favourable against a paint team");
  assert.equal(ev.defense.drop.verdict, 1);
  assert.match(ev.defense.zone_23.why, /takes away/);
  assert.equal(ev.defense.man.verdict, 0);

  const shooters = { intents: [{ name: "Three", points: 3, pct: 45, tags: ["three"] }, { name: "Corner Three", points: 3, pct: 45, tags: ["three"] }, { name: "Drive", points: 2, pct: 50, tags: ["drive"] }] };
  ev = evaluateMatchup(run, shooters);
  assert.equal(ev.defense.drop.verdict, -1, "drop coverage is unfavourable against shooters");
  assert.match(ev.defense.drop.why, /gives up/);
  assert.equal(ev.defense.zone_23.verdict, 0, "a zone helps on the drive and hurts on the threes");
  assert.ok(evaluateMatchup(run, gulls).defense.switch.verdict >= 0);

  ev = evaluateMatchup(run, kings);
  assert.equal(ev.offense.pace_space.verdict, 1);
  assert.equal(ev.offense.post_hub.verdict, -1);
  assert.match(ev.offense.pace_space.why, /three/);

  assert.equal(evaluateMatchup(run, swans).offense.pick_roll.verdict, -1);
  assert.match(evaluateMatchup(run, swans).offense.pick_roll.why, /switch/);
  assert.equal(evaluateMatchup(run, wolves).offense.motion.verdict, -1);
  assert.equal(evaluateMatchup(run, polar).pace.fast.locked, true);

  // Every option gets a verdict and a reason for every team.
  for (const t of league.teams) {
    const e = evaluateMatchup(run, t);
    for (const kind of ["offense", "defense", "pace"]) {
      for (const o of S[kind]) {
        assert.ok([-1, 0, 1].includes(e[kind][o.id].verdict));
        assert.ok(e[kind][o.id].why.length > 3, `${t.id} ${kind}/${o.id}`);
      }
    }
    const rec = recommended(run, t);
    assert.ok(e.defense[rec.defense].verdict >= 0, `${t.id}: recommended defense is not unfavourable`);
    assert.ok(e.offense[rec.offense].verdict >= 0);
  }
  assert.equal(recommended(run, rams).defense, "zone_23");
});

test("changing the plan: free before a game and at halftime, otherwise it costs a timeout", () => {
  // Before a game: free.
  let run = newRun();
  assert.deepEqual(canChangePlan(run), { ok: true, free: true, reason: "" });
  assert.equal(changePlan(run, { defense: "zone_23" }).length, 1);
  assert.equal(run.strategy.defense, "zone_23");

  // During a game: a timeout, and only if something actually changes.
  run = newMatch();
  const m = run.match;
  assert.equal(canChangePlan(run).free, false);
  assert.deepEqual(changePlan(run, { defense: "man" }), [], "no change, nothing spent");
  assert.equal(m.timeouts, 3);
  let events = changePlan(run, { defense: "drop" });
  assert.equal(events[0].free, false);
  assert.equal(m.timeouts, 2);
  assert.equal(run.strategy.defense, "drop");
  changePlan(run, { defense: "man" });
  changePlan(run, { defense: "drop" });
  assert.equal(m.timeouts, 0);
  assert.equal(canChangePlan(run).ok, false);
  assert.deepEqual(changePlan(run, { defense: "zone_23" }), []);
  assert.equal(run.strategy.defense, "drop");

  // Halftime: one free change on the first turn after either team reaches 8.
  run = newMatch(21);
  run.match.score.player = 8;
  events = endTurn(run);
  if (run.match.over) return;
  assert.ok(events.some((e) => e.type === "halftime"));
  assert.equal(canChangePlan(run).free, true);
  events = changePlan(run, { offense: "pace_space" });
  assert.equal(events[0].free, true);
  assert.equal(run.match.timeouts, 3, "no timeout spent");
  assert.equal(canChangePlan(run).free, false, "only one free change");
  // Halftime happens once.
  endTurn(run);
  if (!run.match.over) assert.equal(run.match.freePlanChange, false);

  // The free window closes once you play a card.
  const r2 = newMatch(22);
  r2.match.score.opp = 8;
  endTurn(r2);
  if (r2.match.over) return;
  assert.equal(canChangePlan(r2).free, true);
  play(r2, "contest");
  assert.equal(canChangePlan(r2).free, false);

  // A new pace applies from the next turn.
  const r3 = newMatch(23);
  changePlan(r3, { pace: "fast" });
  assert.equal(r3.match.maxEnergy, 24);
  endTurn(r3);
  if (!r3.match.over) assert.equal(r3.match.maxEnergy, 18);
});
