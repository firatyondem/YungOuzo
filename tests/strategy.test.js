// Strategy-depth tests: play calls, the coach's read (bait and read), timeouts,
// closing-time options, lineup shapes and lives.
import test from "node:test";
import assert from "node:assert/strict";
import { league, content, CONFIG, REAL_CONFIG, newRun, newMatch, matchVs, giveCard } from "./helpers.js";
import { createRun } from "../src/engine/gameState.js";
import { startMatch, playCard, endTurn, debugAddPoints } from "../src/engine/turnLoop.js";
import { calcShot, canPlay, opponentPreview, passiveContest } from "../src/engine/rules.js";
import { playbook, playFor } from "../src/engine/plays.js";
import { canUseAction, useAction, isClosingTime, actionList } from "../src/engine/actions.js";
import { activeShapes } from "../src/engine/teamRules.js";
import { replacePlayer } from "../src/engine/rewards.js";

const play = (run, cardId, source = "starter") => playCard(run, giveCard(run, cardId, source).iid);
const status = (run, id) => playbook(run).find((p) => p.play.id === id);

// ---------- Play calls ----------

test("plays: content is valid and every play ends with a shot", () => {
  assert.ok(content.plays.length >= 3);
  for (const p of content.plays) {
    assert.ok(p.id && p.name && p.text && p.bonus > 0);
    assert.ok(p.sequence.length >= 2);
    assert.match(p.sequence.at(-1), /^shot(:[23])?$/);
    for (const step of p.sequence.slice(0, -1)) {
      const [kind, arg] = step.split(":");
      assert.ok(["tag", "type"].includes(kind) && arg, `${p.id}: step ${step}`);
      // Every setup step can actually be met by a card in the game.
      assert.ok(content.cardList.some((c) => (kind === "tag" ? c.tags.includes(arg) : c.type === arg)), `${p.id}: no card for ${step}`);
    }
  }
});

test("plays: Pass, Pass, shot triggers Swing-Swing (+10%) and is announced", () => {
  const run = newMatch();
  const m = run.match;
  m.energy = 99; // this test is about sequencing, not about affording it
  const shot = giveCard(run, "pull_up_jumper");
  const base = calcShot(run, shot).pct;
  assert.equal(playFor(run, content.cards.pull_up_jumper), null);

  play(run, "swing_pass");
  // One pass: the smaller "Give & Go" (Pass -> two) is ready, Swing-Swing is one card away.
  assert.equal(status(run, "swing_swing").near, true);
  assert.equal(status(run, "swing_swing").ready, false);
  assert.equal(playFor(run, content.cards.pull_up_jumper).id, "give_and_go");
  assert.equal(calcShot(run, shot).pct, base + 10 + 6, "+10 Openness, +6 play");

  play(run, "swing_pass");
  assert.equal(status(run, "swing_swing").ready, true);
  assert.equal(playFor(run, content.cards.pull_up_jumper).id, "swing_swing", "the best play wins");
  const s = calcShot(run, shot);
  assert.equal(s.pct, Math.min(95, base + 20 + 10));
  assert.ok(s.notes.some((n) => n.label === "Swing-Swing" && n.value === 10), "the bonus is explained");

  const events = playCard(run, shot.iid);
  const call = events.find((e) => e.type === "play_call");
  assert.equal(call.name, "Swing-Swing");
  assert.ok(events.findIndex((e) => e.type === "play_call") < events.findIndex((e) => e.type === "shot"));
  assert.equal(run.stats.plays, 1);
  // Plays are per turn.
  endTurn(run);
  if (!m.over) {
    assert.equal(m.turnCards.length, 0);
    assert.equal(status(run, "swing_swing").done, 0);
  }
});

test("plays: Drive & Kick needs Drive then Pass then a three, and halves their DEF", () => {
  const run = matchVs({ defense: 20 });
  run.match.openness = 0;
  run.match.energy = 99;
  const three = giveCard(run, "corner_three");
  const two = giveCard(run, "pull_up_jumper");
  const base3 = calcShot(run, three).pct;
  // Wrong order does nothing for Drive & Kick.
  play(run, "swing_pass");
  play(run, "iso");
  assert.notEqual(playFor(run, content.cards.corner_three)?.id, "drive_and_kick");

  const r2 = matchVs({ defense: 20 });
  r2.match.openness = 0;
  r2.match.energy = 99;
  const t2 = giveCard(r2, "corner_three");
  play(r2, "iso"); // Drive-tagged
  play(r2, "swing_pass"); // the kick-out
  r2.match.openness = 0;
  const s = calcShot(r2, t2);
  assert.equal(s.play.id, "drive_and_kick");
  assert.equal(s.defense, 10, "DEF 20 counts half");
  assert.equal(s.pct, base3 + 15 + 10);
  // It is a three-point play: a two only gets the smaller Give & Go.
  assert.equal(playFor(r2, content.cards.pull_up_jumper).id, "give_and_go");
  assert.ok(two);
});

test("plays: a Screen card then a two is a Pick & Roll Finish", () => {
  const run = newMatch();
  play(run, "pick_and_roll");
  assert.equal(playFor(run, content.cards.pull_up_jumper).id, "pick_and_roll_finish");
  assert.equal(playFor(run, content.cards.corner_three), null, "not for threes");
});

// ---------- Bait and read ----------

test("read: a coached opponent picks its next play from the Contest you showed", () => {
  const team = {
    coach: { aggression: 0.5, hint: "test" },
    intents: [{ name: "Two", points: 2, pct: 66, tags: ["drive"] }, { name: "Three", points: 3, pct: 50, tags: ["three"] }],
  };
  // You showed no defense last possession -> the three is worth more -> they take it.
  let run = matchVs(team, 4);
  assert.equal(opponentPreview(run).intent.name, "Two", "first possession: nothing to read yet");
  run.match.contest = 0;
  run.match.score.opp = 0;
  endTurn(run);
  run.match.score.opp = 0;
  // Next in the cycle is "Three" anyway; show light defense again and check the following pick.
  run.match.contest = 0;
  endTurn(run);
  run.match.score.opp = 0;
  // Cycle would be "Two" (66%) now. Against 0 Contest: 2 x 66 = 132 vs 3 x 50 = 150 -> they skip to the three.
  let pre = opponentPreview(run);
  assert.equal(pre.intent.name, "Three");
  assert.ok(pre.notes.some((n) => n.label === "Coach read" && /light defense/.test(n.text)), "the read is shown");

  // Bait: having shown nothing, you now contest the three hard.
  run.match.contest = 40;
  assert.equal(opponentPreview(run).pct, 10, "the baited three is a bad shot");
  endTurn(run);
  run.match.score.opp = 0;
  // They saw 40 Contest: 2 x 26 = 52 vs 3 x 10 = 30 -> the surer two.
  pre = opponentPreview(run);
  assert.equal(pre.intent.name, "Two");

  // Aggressive coaches lean toward the three, conservative ones away from it.
  const pickAfter = (aggression, contest) => {
    const r = matchVs({ ...team, coach: { aggression, hint: "x" } }, 4);
    r.match.contest = contest;
    r.match.score.opp = 0;
    endTurn(r); // Two taken
    r.match.contest = contest;
    r.match.score.opp = 0;
    endTurn(r); // Three taken
    return opponentPreview(r).intent.name;
  };
  assert.equal(pickAfter(1.0, 18), "Three");
  assert.equal(pickAfter(0.0, 18), "Two");

  // Teams without a coach (and OPPONENT_READS: false) keep the plain cycle.
  run = matchVs({ intents: team.intents }, 4);
  const names = [];
  for (let i = 0; i < 4; i++) {
    names.push(opponentPreview(run).intent.name);
    run.match.contest = 0;
    run.match.score.opp = 0;
    endTurn(run);
  }
  assert.deepEqual(names, ["Two", "Three", "Two", "Three"]);
  run = matchVs(team, 4, { ...CONFIG, OPPONENT_READS: false });
  run.match.contest = 0;
  endTurn(run);
  run.match.contest = 0;
  run.match.score.opp = 0;
  endTurn(run);
  assert.equal(run.match.opp.pick, null);
});

// ---------- Timeouts ----------

test("timeouts: three per game, each with a real effect", () => {
  const run = newMatch();
  const m = run.match;
  assert.equal(m.timeouts, 3);
  assert.deepEqual(actionList(run).filter((a) => a.action.group === "timeout").map((a) => a.ok), [true, true, true]);

  // Regroup: new hand of 5.
  const before = m.hand.map((c) => c.iid);
  let events = useAction(run, "regroup");
  assert.ok(events.some((e) => e.type === "coach_action" && e.group === "timeout"));
  assert.equal(m.hand.length, 5);
  assert.equal(m.hand.some((c) => before.includes(c.iid)), false);
  assert.equal(m.timeouts, 2);

  // Ice: -10% on their attempt this possession only, once per possession.
  const pct = opponentPreview(run).pct;
  useAction(run, "ice");
  assert.equal(opponentPreview(run).pct, pct - 10);
  assert.ok(opponentPreview(run).notes.some((n) => n.label === "Iced"));
  assert.equal(canUseAction(run, "ice").ok, false);
  assert.equal(m.timeouts, 1);

  // Breather: +8 seconds on top of the normal clock.
  useAction(run, "breather");
  assert.equal(m.energy, 32);
  assert.equal(m.timeouts, 0);

  // None left.
  assert.equal(canUseAction(run, "regroup").ok, false);
  assert.match(canUseAction(run, "regroup").reason, /No timeouts/);
  assert.deepEqual(useAction(run, "regroup"), []);

  endTurn(run);
  if (!m.over) {
    assert.equal(m.timeouts, 0, "timeouts do not come back");
    assert.equal(m.mods.ice, 0, "the ice wore off");
    assert.equal(m.energy, 24 + 8, "a fresh 24, plus the 8 unspent seconds that were banked");
  }
  // Timeout is no longer a card.
  assert.equal(content.cards.timeout, undefined);
  assert.equal(newRun().deck.length, 20);
});

// ---------- Closing time ----------

test("closing: options appear only late, once each", () => {
  const run = newMatch();
  const m = run.match;
  assert.equal(isClosingTime(run), false);
  for (const id of ["foul", "hold", "two_for_one"]) {
    assert.equal(canUseAction(run, id).ok, false);
    assert.match(canUseAction(run, id).reason, /closing time/);
  }
  m.score.opp = 11;
  assert.equal(isClosingTime(run), true);
  assert.equal(canUseAction(run, "foul").ok, true);
  m.score.opp = 0;
  m.score.player = 11;
  assert.equal(isClosingTime(run), true);
});

test("closing: intentional foul swaps their play for two free throws", () => {
  let made = 0;
  let total = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const run = matchVs({ intents: [{ name: "Bomb", points: 3, pct: 95, tags: ["three"] }] }, seed);
    const m = run.match;
    m.score.player = 11;
    const events0 = useAction(run, "foul");
    assert.ok(events0.some((e) => e.type === "foul_set"));
    assert.equal(m.energy, 16, "costs 8 seconds");
    assert.deepEqual(opponentPreview(run).foul, { shots: 2, pct: 70 });
    const attempt = endTurn(run).find((e) => e.type === "opp_attempt");
    assert.equal(attempt.foul, true);
    assert.ok(attempt.ftMade >= 0 && attempt.ftMade <= 2);
    assert.equal(m.score.opp, attempt.ftMade, "at most 2 points instead of a 95% three");
    made += attempt.ftMade;
    total += 2;
    if (!m.over) assert.equal(canUseAction(run, "foul").ok, false, "once per game");
  }
  assert.ok(made / total > 0.6 && made / total < 0.8, `free throws: ${made}/${total}`);
});

test("closing: Hold boosts the shot and ends the turn; Two-for-One allows a second shot", () => {
  // Hold for the last shot.
  let run = newMatch(7);
  let m = run.match;
  m.score.opp = 11;
  const shot = giveCard(run, "pull_up_jumper");
  const base = calcShot(run, shot).pct;
  useAction(run, "hold");
  assert.equal(calcShot(run, shot).pct, Math.min(95, base + 15));
  assert.ok(calcShot(run, shot).notes.some((n) => n.label === "Coach call" && n.value === 15));
  const turn = m.turn;
  const events = playCard(run, shot.iid);
  assert.ok(events.some((e) => e.type === "shot"));
  assert.ok(events.some((e) => e.type === "opp_attempt"), "the turn ended with the shot");
  if (!m.over) assert.equal(m.turn, turn + 1);
  // Not after you have already shot.
  run = newMatch(8);
  run.match.score.opp = 11;
  play(run, "pull_up_jumper");
  if (!run.match.over) assert.equal(canUseAction(run, "hold").ok, false);

  // Two-for-one.
  run = newMatch(9);
  m = run.match;
  m.score.opp = 11;
  const a = giveCard(run, "pull_up_jumper");
  const b = giveCard(run, "pull_up_jumper");
  const plain = calcShot(run, a).pct;
  useAction(run, "two_for_one");
  assert.equal(m.shotsAllowed, 2);
  assert.equal(calcShot(run, a).pct, plain - 12);
  playCard(run, a.iid);
  if (m.over) return;
  m.energy = 99;
  assert.equal(canPlay(run, b.iid).ok, true, "second shot allowed");
  playCard(run, b.iid);
  if (m.over) return;
  assert.equal(m.shotsTaken, 2);
  assert.equal(canPlay(run, giveCard(run, "pull_up_jumper").iid).ok, false);
});

// ---------- Lineup shapes ----------

test("lineup shapes: recognised automatically, each with a bonus and a weakness", () => {
  const shapes = (run) => activeShapes(run).map((s) => s.id);
  // The starting five (one of each archetype) has no shape.
  let run = newMatch();
  assert.deepEqual(shapes(run), []);
  for (const s of content.lineups) {
    assert.ok(s.name && s.text && s.effects.length >= 2, `${s.id} has a bonus and a weakness`);
    assert.match(s.text, /, but /, `${s.id} states its weakness`);
  }

  // Small Ball: no Big. Threes +6%, their post-ups +8%.
  const post = { intents: [{ name: "Post-Up", points: 2, pct: 50, tags: ["post"] }, { name: "Three", points: 3, pct: 40, tags: ["three"] }] };
  run = matchVs(post);
  run.match.openness = 0;
  run.match.contest = 0;
  const three = giveCard(run, "corner_three");
  const p3 = calcShot(run, three).pct;
  assert.equal(opponentPreview(run).pct, 50);
  replacePlayer(run, 2, "player_02"); // the Big out, a Sniper in
  assert.deepEqual(shapes(run), ["small_ball"]);
  assert.equal(calcShot(run, three).pct, p3 + 6 + 5, "+6 Small Ball, +5 Sniper chemistry");
  assert.ok(calcShot(run, three).notes.some((n) => n.label === "Small Ball" && n.value === 6));
  assert.equal(opponentPreview(run).pct, 58);
  assert.ok(opponentPreview(run).notes.some((n) => n.label === "Small Ball" && n.value === 8));

  // Twin Towers: two Bigs. Their post-ups -8%, your threes -5%.
  run = matchVs(post);
  run.match.openness = 0;
  run.match.contest = 0;
  const t3 = giveCard(run, "corner_three");
  replacePlayer(run, 4, "player_08"); // Lockdown out, second Big in
  assert.deepEqual(shapes(run), ["twin_towers"]);
  assert.equal(opponentPreview(run).pct, 42);
  assert.ok(calcShot(run, t3).notes.some((n) => n.label === "Twin Towers" && n.value === -5));

  // Defensive Five: average DEF 3.6+ gives +6 Contest every turn.
  run = newRun();
  replacePlayer(run, 0, "player_14");
  replacePlayer(run, 3, "player_15");
  startMatch(run);
  assert.ok(shapes(run).includes("defensive_five"));
  assert.equal(run.match.contest, passiveContest(run) + 6);

  // Bench Mob: three signings draw an extra card.
  run = newRun();
  replacePlayer(run, 0, "player_02");
  replacePlayer(run, 1, "player_05");
  replacePlayer(run, 3, "player_11");
  startMatch(run);
  assert.ok(shapes(run).includes("bench_mob"));
  assert.equal(run.match.hand.length, 6);
});

// ---------- Lives ----------

test("lives: a loss before the Finals costs a life, a rematch and the reward", () => {
  const run = createRun(league, REAL_CONFIG, 11);
  assert.equal(run.lives, 2);
  const first = run.schedule[0].teamId;
  startMatch(run);
  let events = debugAddPoints(run, 15, "opp");
  assert.equal(run.phase, "map", "the run goes on");
  assert.equal(run.lives, 1);
  assert.equal(run.round, 0, "same stop: a rematch");
  assert.equal(events.find((e) => e.type === "match_end").lifeLost, true);
  startMatch(run);
  assert.equal(run.match.teamId, first);
  debugAddPoints(run, 15, "player");
  assert.equal(run.phase, "map", "won the rematch, but no reward");
  assert.equal(run.rewards, null);
  assert.equal(run.round, 1);

  // Second life.
  startMatch(run);
  debugAddPoints(run, 15, "opp");
  assert.equal(run.lives, 0);
  assert.equal(run.phase, "map");
  // No lives left: the next loss ends the run.
  startMatch(run);
  debugAddPoints(run, 15, "opp");
  assert.equal(run.phase, "gameover");

  // Lives do not apply in the Finals: losing the series ends the run.
  const fin = createRun(league, REAL_CONFIG, 12);
  fin.round = 3;
  startMatch(fin);
  debugAddPoints(fin, 15, "opp");
  assert.equal(fin.lives, 2);
  startMatch(fin);
  debugAddPoints(fin, 15, "opp");
  assert.equal(fin.phase, "gameover");
  assert.equal(fin.lives, 2);
});
