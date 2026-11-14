import test from "node:test";
import assert from "node:assert/strict";
import { content, CONFIG, newRun, newMatch, giveCard } from "./helpers.js";
import { createRun } from "../src/engine/gameState.js";
import { startMatch, playCard, endTurn, debugAddPoints } from "../src/engine/turnLoop.js";
import {
  calcShot,
  canPlay,
  opponentPreview,
  getActiveChemistry,
  getCardCost,
  passiveContest,
  passiveOpenness,
} from "../src/engine/rules.js";
import { drawCards } from "../src/engine/deck.js";
import { replacePlayer, applyReward, generateRewards } from "../src/engine/rewards.js";
import { nextFloat, hashSeed } from "../src/engine/rng.js";

const allIids = (m) => [...m.draw, ...m.hand, ...m.discard, ...m.exhaust].map((c) => c.iid);

test("content is consistent", () => {
  assert.equal(content.playerList.length, 15);
  for (const p of content.playerList) {
    assert.equal(p.signatureCards.length, 2);
    for (const id of p.signatureCards) assert.ok(content.cards[id], `missing card ${id}`);
    for (const r of Object.values(p.ratings)) assert.ok(r >= 1 && r <= 5);
  }
  for (const id of content.rewards.cards) assert.ok(content.cards[id], `missing reward card ${id}`);
  for (const id of content.rewards.players) assert.ok(content.players[id], `missing reward player ${id}`);
  assert.equal(content.teams.length, 3);
});

test("starting deck: exactly 20 cards, 10 signature, one of each archetype", () => {
  const run = newRun();
  assert.equal(run.deck.length, 20);
  assert.equal(run.deck.filter((c) => c.source !== "starter").length, 10);
  assert.equal(new Set(run.deck.map((c) => c.iid)).size, 20);
  assert.equal(new Set(run.lineup.map((p) => p.archetype)).size, 5);
});

test("turn start: 24 energy, 5 cards, passive bonuses applied", () => {
  const run = newMatch();
  const m = run.match;
  assert.equal(m.energy, 24);
  assert.equal(m.hand.length, 5);
  assert.equal(m.openness, passiveOpenness(run));
  assert.equal(m.contest, passiveContest(run));
  assert.ok(m.openness > 0 && m.contest > 0);
});

test("shot probability: base + openness + rating*5 - defense", () => {
  const run = newMatch(); // Rookies, DEF 5
  const m = run.match;
  m.openness = 10;
  const two = giveCard(run, "pull_up_jumper"); // unowned -> best INS (5)
  const s2 = calcShot(run, two);
  assert.equal(s2.shooter.ratings.INS, 5);
  assert.equal(s2.pct, 45 + 10 + 5 * 5 - 5);

  const three = giveCard(run, "corner_three"); // 3PT, +5 bonus, best SHT (5)
  assert.equal(calcShot(run, three).pct, 30 + 10 + 5 * 5 - 5 + 5);

  // Owner shoots their own signature card even if they are not the best shooter.
  const owned = giveCard(run, "pull_up_jumper", "player_10"); // INS 2
  assert.equal(calcShot(run, owned).pct, 45 + 10 + 2 * 5 - 5);
});

test("shot modifiers: pass bonus, ignore DEF (min 0), rating multiplier", () => {
  const run = newMatch(1, 0);
  const m = run.match;
  m.openness = 0;
  const cs = giveCard(run, "catch_and_shoot_3");
  assert.equal(calcShot(run, cs).pct, 30 + 25 - 5);
  m.playedTags.push("Pass");
  assert.equal(calcShot(run, cs).pct, 30 + 25 - 5 + 10);

  // Step-Back ignores 10 DEF but Rookies only have 5: no bonus from over-ignoring.
  const sb = giveCard(run, "step_back_3");
  assert.equal(calcShot(run, sb).defense, 0);
  assert.equal(calcShot(run, sb).pct, 30 + 25);

  const drive = giveCard(run, "drive_and_finish"); // INS 5 x 10
  assert.equal(calcShot(run, drive).pct, 45 + 50 - 5);
});

test("probabilities clamp to 5-95", () => {
  const run = newMatch();
  const m = run.match;
  const shot = giveCard(run, "pull_up_jumper");
  m.openness = 500;
  assert.equal(calcShot(run, shot).pct, 95);
  m.openness = -500;
  assert.equal(calcShot(run, shot).pct, 5);
  m.contest = 500;
  assert.equal(opponentPreview(run).pct, 5);
  m.contest = -500;
  assert.equal(opponentPreview(run).pct, 95);
});

test("energy: unaffordable cards are unplayable, energy never negative", () => {
  const run = newMatch();
  const m = run.match;
  const card = giveCard(run, "swing_pass", "starter", true);
  m.energy = 2;
  assert.equal(canPlay(run, card.iid).ok, false);
  assert.deepEqual(playCard(run, card.iid), []);
  assert.equal(m.energy, 2);
  assert.equal(m.hand.length, 1);
  m.energy = 3;
  assert.equal(canPlay(run, card.iid).ok, true);
  playCard(run, card.iid);
  assert.equal(m.energy, 0);
  assert.equal(m.openness, passiveOpenness(run) + 10);
  assert.ok(m.energy >= 0);
});

test("drawing reshuffles the discard pile without duplicating or losing cards", () => {
  const run = newMatch();
  const m = run.match;
  for (let i = 0; i < 12; i++) {
    endTurn(run);
    if (m.over) break;
    const ids = allIids(m);
    assert.equal(ids.length, 20);
    assert.equal(new Set(ids).size, 20);
    assert.equal(m.hand.length, 5);
  }
  // Force an explicit reshuffle with an empty draw pile.
  m.discard.push(...m.draw);
  m.draw = [];
  const drawn = drawCards(run, 3);
  assert.equal(drawn.length, 3);
  assert.equal(new Set(allIids(m)).size, 20);
  assert.equal(m.discard.length, 0);
});

test("one shot per turn (unless a card explicitly allows another)", () => {
  const run = newMatch();
  const m = run.match;
  const a = giveCard(run, "pull_up_jumper", "starter", true);
  const b = giveCard(run, "pull_up_jumper");
  const events = playCard(run, a.iid);
  assert.ok(events.some((e) => e.type === "shot"));
  assert.equal(m.shotsTaken, 1);
  assert.equal(m.openness, 0, "a shot consumes all Openness");
  const check = canPlay(run, b.iid);
  assert.equal(check.ok, false);
  assert.equal(check.reason, "One shot per turn");
  assert.deepEqual(playCard(run, b.iid), []);

  // Putback is only playable after a miss, and bypasses the limit.
  const put = giveCard(run, "putback");
  m.missedShotThisTurn = false;
  assert.equal(canPlay(run, put.iid).ok, false);
  m.missedShotThisTurn = true;
  assert.equal(canPlay(run, put.iid).ok, true);

  endTurn(run);
  if (!m.over) assert.equal(m.shotsTaken, 0);
});

test("no shot = shot-clock violation, opponent still attempts", () => {
  const run = newMatch();
  const events = endTurn(run);
  assert.ok(events.some((e) => e.type === "violation"));
  assert.ok(events.some((e) => e.type === "opp_attempt"));
  assert.equal(run.match.turn, 2);
});

test("opponent intents cycle, contest lowers their %, clutch adds +10", () => {
  const run = newMatch(7, 2); // Dynasty
  const m = run.match;
  const team = content.teams[2];
  m.contest = 0;
  assert.equal(opponentPreview(run).intent.name, team.intents[0].name);
  const first = team.intents[0].pct;
  assert.equal(opponentPreview(run).pct, first);
  m.contest = 15;
  assert.equal(opponentPreview(run).pct, first - 15);
  m.contest = 0;

  // Clutch when either side is within 2 of 15.
  m.score.player = 13;
  let pre = opponentPreview(run);
  assert.equal(pre.clutch, true);
  assert.equal(pre.basePct, first + team.clutch.bonus);
  assert.equal(pre.pct, Math.min(95, first + team.clutch.bonus));
  m.score.player = 12;
  m.score.opp = 13;
  assert.equal(opponentPreview(run).clutch, true);
  m.score.opp = 12;
  assert.equal(opponentPreview(run).clutch, false);

  // Intents cycle in order, wrapping around.
  const seen = [];
  m.score.opp = 0;
  m.score.player = 0;
  for (let i = 0; i < 5 && !m.over; i++) {
    seen.push(opponentPreview(run).intent.name);
    m.score.opp = 0; // keep the match alive
    endTurn(run);
  }
  assert.deepEqual(seen, [...team.intents.map((i) => i.name), team.intents[0].name]);

  // No clutch for teams without it.
  const r1 = newMatch(7, 0);
  r1.match.score.player = 14;
  assert.equal(opponentPreview(r1).clutch, false);
});

test("opponent attempt resolves against the effective percentage", () => {
  // With the % clamped to 5 (huge contest) the opponent should almost never score;
  // with it clamped to 95 they almost always do.
  let scoredLow = 0;
  let scoredHigh = 0;
  for (let seed = 0; seed < 200; seed++) {
    const a = newMatch(seed);
    a.match.contest = 999;
    if (endTurn(a).find((e) => e.type === "opp_attempt").made) scoredLow++;
    const b = newMatch(seed);
    b.match.contest = -999;
    const ev = endTurn(b).find((e) => e.type === "opp_attempt");
    if (ev.made) {
      scoredHigh++;
      assert.equal(b.match.score.opp, ev.points);
    }
  }
  assert.ok(scoredLow < 30, `low: ${scoredLow}`);
  assert.ok(scoredHigh > 170, `high: ${scoredHigh}`);
});

test("steal cancels the attempt, but not an unblockable intent", () => {
  let steals = 0;
  for (let seed = 0; seed < 300; seed++) {
    const run = newMatch(seed);
    const sw = giveCard(run, "swipe", "starter", true);
    playCard(run, sw.iid);
    const events = endTurn(run);
    const opp = events.find((e) => e.type === "opp_attempt");
    if (opp.stolen) {
      steals++;
      assert.equal(run.match.score.opp, 0);
      assert.equal(run.match.lastOppFailed, true);
      assert.equal(run.match.hand.length, 7, "draw 2 extra next turn");
    }
  }
  assert.ok(steals > 60 && steals < 150, `steals: ${steals}`); // ~35%

  for (let seed = 0; seed < 50; seed++) {
    const run = newMatch(seed, 2);
    run.match.intentIndex = 3; // SUPERTEAM, unblockableBySteal
    const sw = giveCard(run, "swipe", "starter", true);
    playCard(run, sw.iid);
    const events = endTurn(run);
    assert.equal(events.find((e) => e.type === "opp_attempt").stolen, false);
    assert.ok(events.some((e) => e.type === "steal" && e.blocked));
  }
});

test("win and loss conditions", () => {
  // Win: reaching 15 ends the match immediately and opens rewards.
  const run = newMatch();
  run.match.score.player = 13;
  run.match.openness = 999;
  let won = false;
  for (let i = 0; i < 40 && !won; i++) {
    const shot = giveCard(run, "pull_up_jumper");
    const events = playCard(run, shot.iid);
    won = events.some((e) => e.type === "match_end");
    if (!won) {
      endTurn(run);
      run.match.score.opp = 0;
      run.match.openness = 999;
    }
  }
  assert.equal(won, true);
  assert.equal(run.match.over, true);
  assert.equal(run.match.winner, "player");
  assert.equal(run.phase, "reward");
  assert.equal(run.rewards.length, 3);
  assert.deepEqual(playCard(run, run.match.hand[0]?.iid), [], "no cards after the match ends");
  assert.deepEqual(endTurn(run), []);

  // Loss: opponent reaching 15 ends the run.
  const lose = newMatch(99);
  let guard = 0;
  while (!lose.match.over && guard++ < 200) endTurn(lose);
  assert.equal(lose.match.winner, "opp");
  assert.equal(lose.phase, "gameover");
  assert.ok(lose.match.score.opp >= 15);

  // Winning the last round = champion.
  const fin = newMatch(5, 2);
  debugAddPoints(fin, 15);
  assert.equal(fin.phase, "victory");
});

test("rewards: three valid options, applying advances the tournament", () => {
  const run = newMatch(3);
  debugAddPoints(run, 15);
  assert.equal(run.phase, "reward");
  const kinds = run.rewards.map((r) => r.kind);
  assert.deepEqual(kinds, ["card", "player", "upgrade"]);
  const up = run.rewards[2];
  const target = run.lineup.find((p) => p.id === up.playerId);
  const before = target.ratings[up.rating];
  assert.ok(before < 5);
  assert.equal(applyReward(run, 2), true);
  assert.equal(target.ratings[up.rating], before + 1);
  assert.equal(run.round, 1);
  assert.equal(run.phase, "map");

  // Card reward adds exactly one instance.
  const r2 = newMatch(4);
  debugAddPoints(r2, 15);
  applyReward(r2, 0);
  assert.equal(r2.deck.length, 21);
  assert.equal(r2.deck.at(-1).source, "reward");

  // Upgrades never offered at the cap.
  const r3 = newRun(8);
  for (const p of r3.lineup) for (const k of Object.keys(p.ratings)) p.ratings[k] = 5;
  assert.equal(generateRewards(r3).some((o) => o.kind === "upgrade"), false);
});

test("player replacement removes only that player's signature instances", () => {
  const run = newRun();
  const old = run.lineup[0]; // player_01: catch_and_shoot_3 + step_back_3
  // An unrelated copy of one of the old player's signature cards must survive.
  run.deck.push({ iid: "extra", cardId: old.signatureCards[0], source: "reward" });
  const sizeBefore = run.deck.length;
  assert.equal(replacePlayer(run, 0, "player_02"), true);
  assert.equal(run.lineup[0].id, "player_02");
  assert.equal(run.deck.some((c) => c.source === old.id), false);
  assert.ok(run.deck.some((c) => c.iid === "extra"));
  assert.equal(run.deck.filter((c) => c.source === "player_02").length, 2);
  assert.equal(run.deck.length, sizeBefore);
  assert.equal(run.deck.filter((c) => c.source === "starter").length, 10);
  assert.equal(new Set(run.deck.map((c) => c.iid)).size, run.deck.length);
});

test("chemistry activates with two of an archetype and is recalculated", () => {
  const run = newRun();
  assert.equal(getActiveChemistry(run).length, 0);
  const baseContest = passiveContest(run);

  replacePlayer(run, 0, "player_14"); // second Lockdown
  const chem = getActiveChemistry(run);
  assert.deepEqual(chem.map((c) => c.archetype), ["Lockdown"]);
  assert.ok(passiveContest(run) >= baseContest + 10);

  const r2 = newRun();
  replacePlayer(r2, 0, "player_05"); // second Slasher: Drive cards cost 1 less
  assert.equal(getCardCost(r2, content.cards.drive_and_finish), 6);
  assert.equal(getCardCost(r2, content.cards.swing_pass), 3);

  const r3 = newRun();
  replacePlayer(r3, 0, "player_11"); // second FloorGeneral: +1 card per turn
  startMatch(r3);
  assert.equal(r3.match.hand.length, 6);

  const r4 = newRun();
  replacePlayer(r4, 1, "player_02"); // second Sniper: +5% on 3PT
  startMatch(r4);
  r4.match.openness = 0;
  const three = giveCard(r4, "corner_three");
  assert.equal(calcShot(r4, three).pct, 30 + 25 - 5 + 5 + 5);
});

test("card rules: heat check streak, fast break, alley-oop, timeout exhausts", () => {
  const run = newMatch();
  const m = run.match;
  m.openness = 0;
  const three = giveCard(run, "corner_three");
  const base = calcShot(run, three).pct;
  playCard(run, giveCard(run, "heat_check").iid);
  m.threeStreak = 2;
  assert.equal(calcShot(run, three).pct, Math.min(95, base + 30));
  m.threeStreak = 0;
  assert.equal(calcShot(run, three).pct, base);

  const fb = giveCard(run, "fast_break");
  m.lastOppFailed = false;
  assert.equal(canPlay(run, fb.iid).ok, false);
  m.lastOppFailed = true;
  assert.equal(canPlay(run, fb.iid).ok, true);

  const oop = giveCard(run, "alley_oop");
  assert.equal(canPlay(run, oop.iid).ok, true);
  const saved = run.lineup.find((p) => p.archetype === "Big").archetype;
  run.lineup.find((p) => p.archetype === "Big").archetype = "Sniper";
  assert.equal(canPlay(run, oop.iid).ok, false);
  run.lineup.find((p) => p.id === "player_07").archetype = saved;

  const to = giveCard(run, "timeout");
  playCard(run, to.iid);
  assert.equal(m.hand.length, 5);
  assert.ok(m.exhaust.some((c) => c.iid === to.iid));
  assert.equal(m.discard.some((c) => c.iid === to.iid), false);
});

test("no dead hands: a hand without a shot card draws extra until one appears", () => {
  const cfg = { ...CONFIG, NO_SHOT_REDRAWS: 3 };
  const isShot = (c) => content.cards[c.cardId].effects.some((e) => e.type === "shoot");
  let redraws = 0;
  for (let seed = 0; seed < 300; seed++) {
    const run = newRun(seed, 0, cfg);
    startMatch(run);
    const m = run.match;
    assert.ok(m.hand.length >= 5 && m.hand.length <= 8);
    if (m.hand.length > 5) {
      redraws++;
      assert.ok(m.hand.slice(0, 5).every((c) => !isShot(c)), "only redraw when the first 5 hold no shot");
      // Stops at the first shot card (or after 3 extra).
      assert.ok(isShot(m.hand.at(-1)) || m.hand.length === 8);
    } else {
      assert.ok(m.hand.some(isShot));
    }
    assert.equal(new Set(allIids(m)).size, 20);
  }
  assert.ok(redraws > 5, `redraws: ${redraws}`);
});

test("seeded RNG is reproducible", () => {
  const a = { rngState: hashSeed("abc") };
  const b = { rngState: hashSeed("abc") };
  const c = { rngState: hashSeed("abd") };
  const seqA = Array.from({ length: 20 }, () => nextFloat(a));
  const seqB = Array.from({ length: 20 }, () => nextFloat(b));
  const seqC = Array.from({ length: 20 }, () => nextFloat(c));
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  assert.ok(seqA.every((x) => x >= 0 && x < 1));

  // Same seed + same actions = same game.
  const play = (seed) => {
    const run = createRun(content, CONFIG, seed);
    startMatch(run);
    for (let t = 0; t < 30 && !run.match.over; t++) {
      for (const inst of [...run.match.hand]) {
        if (canPlay(run, inst.iid).ok) playCard(run, inst.iid);
        if (run.match.over) break;
      }
      endTurn(run);
    }
    return JSON.stringify(run);
  };
  assert.equal(play(2024), play(2024));
  assert.notEqual(play(2024), play(2025));
});
