// Hard mode, part 5: the facts the presentation layer needs (game point, how open
// a shot was), the audio hooks, and the line that explains what decided a run.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFIG, REAL_CONFIG, matchVs, giveCard, newRun } from "./helpers.js";
import { playCard, endTurn } from "../src/engine/turnLoop.js";
import { runVerdict } from "../src/engine/verdict.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("events: a shot reports how open it was and whether it can end the game", () => {
  const run = matchVs({}, 7);
  const m = run.match;
  m.energy = 99;
  m.openness = 31;
  let ev = playCard(run, giveCard(run, "pull_up_jumper").iid).find((e) => e.type === "shot");
  assert.equal(ev.openness, 31);
  assert.equal(ev.gamePoint, false);

  const late = matchVs({}, 8);
  late.match.energy = 99;
  late.match.score.player = late.match.target - 2;
  ev = playCard(late, giveCard(late, "pull_up_jumper").iid).find((e) => e.type === "shot");
  assert.equal(ev.gamePoint, true, "a two at 13 can win it");

  // Their game point is flagged the same way.
  const theirs = matchVs({ intents: [{ name: "Drive", points: 2, pct: 50, tags: ["drive"] }] }, 9);
  theirs.match.score.opp = theirs.match.target - 2;
  const att = endTurn(theirs).find((e) => e.type === "opp_attempt");
  assert.equal(att.gamePoint, true);
});

test("stats: violations, turnovers and their makes are counted for the end screen", () => {
  const run = matchVs({ defense: 60, intents: [{ name: "Drive", points: 2, pct: 50, tags: ["drive"] }] }, 3);
  endTurn(run); // no shot
  assert.equal(run.stats.violations, 1);
  assert.equal(run.stats.oppPlays, 1);
  assert.ok(run.stats.oppMakes <= 1);
  let turnovers = 0;
  for (let seed = 1; seed <= 30 && !turnovers; seed++) {
    const r = matchVs({ defense: 60 }, seed);
    r.match.energy = 99;
    const shot = playCard(r, giveCard(r, "drive_and_finish").iid).find((e) => e.type === "shot");
    if (!shot.made) {
      assert.equal(r.stats.turnovers, 1);
      turnovers++;
    }
  }
  assert.equal(turnovers, 1);
});

test("verdict: one line names what decided the run", () => {
  const base = () => {
    const run = newRun(1);
    run.phase = "gameover";
    run.results = [{ teamId: "x", label: "Act 1", game: 1, player: 9, opp: 15, won: false }];
    Object.assign(run.stats, { shots: 20, makes: 10, oppPlays: 20, oppMakes: 10, violations: 0, turnovers: 0, adjustments: 0 });
    return run;
  };
  let run = base();
  run.stats.violations = 4;
  assert.equal(runVerdict(run).key, "violations");
  run = base();
  run.stats.makes = 6;
  assert.equal(runVerdict(run).key, "cold");
  assert.match(runVerdict(run).line, /30%/);
  run = base();
  run.stats.oppMakes = 14;
  assert.equal(runVerdict(run).key, "defense");
  run = base();
  run.stats.adjustments = 4;
  assert.equal(runVerdict(run).key, "predictable");
  run = base();
  run.stats.turnovers = 5;
  assert.equal(runVerdict(run).key, "turnovers");
  run = base();
  run.results[0].player = 13;
  assert.equal(runVerdict(run).key, "close");
  run = base();
  assert.equal(runVerdict(run).key, "outplayed");
  // A title has a reason too.
  run = base();
  run.phase = "victory";
  run.stats.makes = 13;
  assert.equal(runVerdict(run).key, "shooting");
  for (const r of [base()]) assert.ok(runVerdict(r).line.length < 130, "one line");
});

test("audio: hooks for card play, combo tick, reward pick and game-point tension, each with a fallback", () => {
  const announcer = JSON.parse(read("content/announcer.json"));
  const manager = read("src/audio/AudioManager.js");
  const table = read("assets/audio/README.md");
  for (const ev of ["card_play", "combo_tick", "reward_pick", "gamepoint_tension"]) {
    assert.ok(announcer[ev] && announcer[ev].lines.length, `${ev} has a file slot`);
    for (const l of announcer[ev].lines) {
      assert.match(l.file, new RegExp(`^${ev}_\\d+\\.mp3$`));
      assert.ok(table.includes(l.file), `${l.file} is in the audio table`);
    }
    assert.match(manager, new RegExp(`${ev}: "`), `${ev} has a synth fallback`);
  }
  // Every file the game can ask for is listed for the sound designer.
  for (const [ev, entry] of Object.entries(announcer)) {
    if (!entry.lines) continue;
    for (const l of entry.lines) if (l.file) assert.ok(table.includes(l.file), `${ev}: ${l.file} missing from the table`);
  }
  assert.ok(table.includes("music_loop.mp3"));
});

test("config: hard-mode knobs live in config.js", () => {
  for (const key of ["MAX_ENERGY", "CARRY_MAX", "HOLD_MAX", "ADAPT", "MISS", "UPGRADE_DISCOUNT", "MIN_DECK", "MIN_SHOTS"]) assert.ok(key in REAL_CONFIG, key);
  assert.equal(REAL_CONFIG.MAX_ENERGY, 24);
  assert.equal(CONFIG.MAX_ENERGY, 24);
});
