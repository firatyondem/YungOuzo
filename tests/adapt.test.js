// Hard mode, part 2: opponents adapt to repeated habits (always warned first,
// always answerable), and misses have basketball consequences.
import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, REAL_CONFIG, matchVs, giveCard, league } from "./helpers.js";
import { playCard, endTurn } from "../src/engine/turnLoop.js";
import { calcShot, opponentPreview } from "../src/engine/rules.js";
import { adaptStatus, adaptThreshold, HABITS } from "../src/engine/adapt.js";

const ADAPT = REAL_CONFIG.ADAPT;
const MISS = REAL_CONFIG.MISS;
const cfg = (extra = {}) => ({ ...CONFIG, ADAPT, MISS: null, ...extra });
// A team that never scores and never ends the game early, so only habits change.
const DUMMY = { defense: 10, intents: [{ name: "Brick", points: 2, pct: 5, tags: ["drive"] }] };

/** One turn: play these cards (with unlimited seconds, the test is about habits), then end it. */
function turn(run, ids) {
  const m = run.match;
  m.energy = 99;
  m.score.player = 0; // keep the game going
  const events = [];
  for (const id of ids) events.push(...playCard(run, giveCard(run, id).iid));
  m.score.player = 0;
  events.push(...endTurn(run));
  return events;
}
const active = (run) => run.match.adapt.active;
const warned = (run) => run.match.adapt.warned;

test("adapt: three threes in a row tighten the perimeter, with a warning one turn earlier", () => {
  const run = matchVs(DUMMY, 5, cfg());
  assert.equal(adaptThreshold(run, "three"), 3);
  const shotPct = () => calcShot(run, giveCard(run, "catch_and_shoot_3", "starter", true)).pct;
  const base = shotPct();

  let ev = turn(run, ["swing_pass", "catch_and_shoot_3", "contest"]);
  assert.deepEqual(active(run), []);
  assert.ok(!warned(run).includes("three"));
  ev = turn(run, ["swing_pass", "catch_and_shoot_3", "contest"]);
  assert.ok(warned(run).includes("three"), "after two in a row you are warned");
  assert.ok(ev.some((e) => e.type === "adjust_warn" && e.key === "three" && e.text.length < 90));
  assert.equal(shotPct(), base, "a warning costs nothing yet");

  ev = turn(run, ["swing_pass", "catch_and_shoot_3", "contest"]);
  assert.ok(active(run).includes("three"));
  assert.ok(ev.some((e) => e.type === "adjust" && e.on && e.key === "three"));
  assert.equal(shotPct(), base + ADAPT.three, "threes are now harder");
  assert.ok(calcShot(run, giveCard(run, "catch_and_shoot_3", "starter", true)).notes.some((n) => n.label === "Perimeter tightened"));
  // Twos are untouched: the player can respond.
  const two = calcShot(run, giveCard(run, "pull_up_jumper", "starter", true));
  assert.ok(!two.notes.some((n) => n.label === "Perimeter tightened"));

  // Change it up and they relax.
  ev = turn(run, ["swing_pass", "pull_up_jumper", "contest"]);
  assert.ok(!active(run).includes("three"), "one turn of something else pulls them back");
  assert.ok(ev.some((e) => e.type === "adjust" && !e.on && e.key === "three"));
  assert.equal(shotPct(), base);
});

test("adapt: every adjustment is announced before it applies", () => {
  // Whatever the player does, a habit is warned on an earlier turn than it becomes active.
  for (let seed = 1; seed <= 40; seed++) {
    const run = matchVs(DUMMY, seed, cfg());
    const warnedAt = {};
    const pool = ["swing_pass", "catch_and_shoot_3", "pull_up_jumper", "iso", "euro_step", "swipe", "contest", "drive_and_finish"];
    for (let t = 1; t <= 14 && !run.match.over; t++) {
      for (const k of warned(run)) warnedAt[k] ??= run.match.turn;
      for (const k of active(run)) assert.ok(warnedAt[k] != null && warnedAt[k] < run.match.turn, `${k} applied on turn ${run.match.turn} without an earlier warning (seed ${seed})`);
      const a = pool[(seed * 7 + t * 3) % pool.length];
      const b = pool[(seed + t * 5) % pool.length];
      turn(run, a === b ? [a] : [a, b]);
    }
  }
});

test("adapt: drives pack the paint, one-on-one play draws a double team", () => {
  let run = matchVs(DUMMY, 9, cfg());
  const twoPct = () => calcShot(run, giveCard(run, "pull_up_jumper", "starter", true)).pct;
  const base = twoPct();
  for (let i = 0; i < 3; i++) turn(run, ["swing_pass", "euro_step", "contest"]);
  assert.ok(active(run).includes("paint"));
  assert.equal(twoPct(), base + ADAPT.paint);
  turn(run, ["swing_pass", "pull_up_jumper", "contest"]); // no Drive card
  assert.ok(!active(run).includes("paint"));

  run = matchVs(DUMMY, 9, cfg());
  for (let i = 0; i < 3; i++) turn(run, ["pull_up_jumper", "contest"]); // shots without a pass
  assert.ok(active(run).includes("iso"));
  const m = run.match;
  m.energy = 99;
  const lonelyShot = calcShot(run, giveCard(run, "pull_up_jumper", "starter", true));
  assert.ok(lonelyShot.notes.some((n) => n.label === "Double team" && n.value === ADAPT.double));
  const lonely = lonelyShot.pct;
  playCard(run, giveCard(run, "swing_pass").iid);
  const shared = calcShot(run, giveCard(run, "pull_up_jumper", "starter", true));
  const lonelyNotes = calcShot(run, giveCard(run, "pull_up_jumper", "starter", true));
  assert.ok(shared.pct >= lonely - ADAPT.double + 10, "a Pass card beats the double team (and adds its 10 Openness)");
  assert.ok(lonelyNotes.pct === shared.pct, "same shot, same number");
  assert.ok(!shared.notes.some((n) => n.label === "Double team"));
});

test("adapt: no defense makes them attack; gambling for steals makes them protect the ball", () => {
  let run = matchVs(DUMMY, 3, cfg());
  const before = opponentPreview(run).pct;
  const need = adaptThreshold(run, "nodef");
  assert.equal(need, 4, "you get one more turn of slack on defense: you do not always draw one");
  for (let i = 0; i < need; i++) turn(run, ["swing_pass", "pull_up_jumper"]);
  assert.ok(active(run).includes("nodef"));
  run.match.contest = 0;
  const pre = opponentPreview(run);
  assert.ok(pre.notes.some((n) => n.label === "They attack" && n.value === ADAPT.attack), "shown in their intent before you act");
  turn(run, ["swing_pass", "pull_up_jumper", "contest"]);
  assert.ok(!active(run).includes("nodef"));
  assert.ok(before > 0);

  run = matchVs(DUMMY, 3, cfg());
  for (let i = 0; i < adaptThreshold(run, "steal"); i++) turn(run, ["swing_pass", "pull_up_jumper", "swipe"]);
  assert.ok(active(run).includes("steal"));
  run.match.energy = 99;
  const ev = playCard(run, giveCard(run, "swipe").iid);
  assert.equal(ev.find((e) => e.type === "steal_set").chance, 35 + ADAPT.steal);
});

test("adapt: teams have a signature speed, and the HUD gets an icon and one line per adjustment", () => {
  const speeds = league.teams.map((t) => t.adaptAt);
  assert.ok(speeds.every((n) => n >= 2 && n <= 5), "every team has an adaptAt");
  assert.ok(new Set(speeds).size >= 3, "speeds differ across the league");
  assert.equal(league.teams.find((t) => t.tier === "boss").adaptAt, 2, "the Dynasty reads you fastest");

  const quick = matchVs({ ...DUMMY, adaptAt: 2 }, 4, cfg());
  turn(quick, ["swing_pass", "catch_and_shoot_3", "contest"]);
  assert.ok(warned(quick).includes("three"));
  turn(quick, ["swing_pass", "catch_and_shoot_3", "contest"]);
  assert.ok(active(quick).includes("three"), "a quick team needs only two");
  const status = adaptStatus(quick);
  const row = status.find((s) => s.key === "three");
  assert.equal(row.state, "active");
  assert.ok(row.icon && row.name && row.text.length < 110);
  for (const h of HABITS) {
    assert.ok(h.icon && h.name && h.warn.length < 90, h.key);
    assert.ok(h.text(ADAPT).length < 110, h.key);
  }
  // Switched off by config.
  const off = matchVs(DUMMY, 4, cfg({ ADAPT: null }));
  for (let i = 0; i < 5; i++) turn(off, ["catch_and_shoot_3"]);
  assert.deepEqual(active(off), []);
  assert.deepEqual(adaptStatus(off), []);
});

test("miss: a missed three is a long rebound for them, unless you boxed out", () => {
  let long = 0;
  let boxed = 0;
  for (let seed = 1; seed <= 150; seed++) {
    for (const withBox of [false, true]) {
      const run = matchVs({ defense: 40 }, seed, cfg({ ADAPT: null, MISS }));
      const m = run.match;
      m.energy = 99;
      m.contest = 0;
      const before = opponentPreview(run).pct;
      if (withBox) playCard(run, giveCard(run, "box_out").iid);
      const ev = playCard(run, giveCard(run, "catch_and_shoot_3").iid);
      const shot = ev.find((e) => e.type === "shot");
      const line = ev.find((e) => e.type === "consequence");
      if (shot.made) {
        assert.equal(line, undefined, "a make has no consequence");
        continue;
      }
      assert.ok(line && line.text.length < 100, "explained in one short line");
      if (withBox) {
        boxed++;
        assert.equal(opponentPreview(run).pct, before);
        assert.equal(line.good, true);
      } else {
        long++;
        assert.equal(opponentPreview(run).pct, before + MISS.longRebound);
        assert.ok(opponentPreview(run).notes.some((n) => n.label === "Long rebound"));
      }
    }
  }
  assert.ok(long > 20 && boxed > 20);
});

test("miss: a missed two can be an offensive rebound; Bigs and Box Out raise the odds", () => {
  const rate = (withBox) => {
    let misses = 0;
    let orebs = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const run = matchVs({ defense: 60 }, seed, cfg({ ADAPT: null, MISS }));
      const m = run.match;
      m.energy = 99;
      if (withBox) playCard(run, giveCard(run, "box_out").iid);
      const left = m.energy - 16;
      const ev = playCard(run, giveCard(run, "pull_up_jumper").iid);
      if (ev.find((e) => e.type === "shot").made) continue;
      misses++;
      if (ev.some((e) => e.type === "consequence" && /Offensive rebound/.test(e.text))) {
        orebs++;
        assert.equal(m.shotsAllowed, 2, "you may shoot again this turn");
        assert.equal(m.energy, left + MISS.orebSeconds);
      } else {
        assert.equal(m.shotsAllowed, 1);
      }
    }
    return orebs / misses;
  };
  const plain = rate(false);
  const boxed = rate(true);
  // The starting five has one Big: 10% alone, 35% with a Box Out.
  assert.ok(plain > 0.04 && plain < 0.18, `plain ${plain}`);
  assert.ok(boxed > 0.25 && boxed < 0.46, `boxed ${boxed}`);
});
