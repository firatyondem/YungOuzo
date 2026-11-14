// Hard-mode core turn: you cannot do everything. Economy, banking, holding,
// card identities and real drawbacks.
import test from "node:test";
import assert from "node:assert/strict";
import { content, CONFIG, newRun, newMatch, matchVs, giveCard } from "./helpers.js";
import { playCard, endTurn, toggleHold } from "../src/engine/turnLoop.js";
import { calcShot, canPlay, getCardCost, opponentPreview } from "../src/engine/rules.js";

const cards = content.cardList;
const byId = content.cards;
const play = (run, cardId, source = "starter") => playCard(run, giveCard(run, cardId, source).iid);

// ---------- Economy ----------

test("economy: the shot clock is 24 and a turn fits two or three cards, never the whole hand", () => {
  assert.equal(CONFIG.MAX_ENERGY, 24, "the shot clock stays 24");
  const real = cards.filter((c) => !c.status);
  for (const c of real) assert.ok(c.cost >= 4 && c.cost <= 24 && c.cost % 4 === 0, `${c.id} costs ${c.cost}`);
  // Every shot costs at least 16 of the 24 seconds, except a follow-up shot after a miss.
  for (const c of real.filter((x) => x.type === "Shot" && !x.ignoresShotLimit)) assert.ok(c.cost >= 16, `${c.id}`);
  // The reference turn: a setup card and a two, or a two and a contest, or one three.
  assert.equal(byId.swing_pass.cost + byId.pull_up_jumper.cost, 24);
  assert.equal(byId.contest.cost + byId.pull_up_jumper.cost, 24);
  assert.equal(byId.catch_and_shoot_3.cost, 24);
  assert.ok(byId.swing_pass.cost + byId.pull_up_jumper.cost + byId.contest.cost > 24, "setup + shot + defense does not fit");

  // Over many opening hands: the hand can never be played out, and 2-3 cards is the norm.
  let total = 0;
  let turns = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const run = newMatch(seed);
    const m = run.match;
    const costs = m.hand.map((c) => getCardCost(run, byId[c.cardId])).sort((a, b) => a - b);
    assert.ok(costs.reduce((s, c) => s + c, 0) > 24, "the whole hand never fits");
    // Most cards you could play this turn, cheapest first.
    let spent = 0;
    let n = 0;
    for (const c of costs) if (spent + c <= 24) { spent += c; n++; }
    assert.ok(n <= 4, `at most 4 cheap cards fit, got ${n}`);
    // A realistic turn includes a shot.
    const shot = Math.min(...m.hand.filter((c) => byId[c.cardId].type === "Shot").map((c) => getCardCost(run, byId[c.cardId])));
    if (Number.isFinite(shot)) {
      let left = 24 - shot;
      let withShot = 1;
      for (const c of m.hand.filter((x) => byId[x.cardId].type !== "Shot").map((x) => getCardCost(run, byId[x.cardId])).sort((a, b) => a - b)) {
        if (c <= left) { left -= c; withShot++; }
      }
      total += withShot;
      turns++;
    }
  }
  const avg = total / turns;
  assert.ok(avg >= 1.5 && avg <= 3, `a turn with a shot plays ${avg.toFixed(2)} cards on average`);
});

test("economy: unspent seconds are lost, except up to 8 that are banked for the next turn", () => {
  assert.equal(CONFIG.CARRY_MAX, 8);
  // Spend 16 of 24: 8 left -> banked.
  let run = newMatch(3);
  let m = run.match;
  play(run, "pull_up_jumper");
  if (m.over) return;
  assert.equal(m.energy, 8);
  endTurn(run);
  if (m.over) return;
  assert.equal(m.banked, 8);
  assert.equal(m.energy, 32, "24 + 8 banked");
  assert.equal(m.maxEnergy, 24, "the shot clock itself is still 24");
  // The bank is used or lost: it never grows past 8.
  endTurn(run);
  if (m.over) return;
  assert.equal(m.energy, 32);

  // Spend everything: nothing to bank.
  run = newMatch(4);
  m = run.match;
  play(run, "swing_pass");
  play(run, "pull_up_jumper");
  if (m.over) return;
  assert.equal(m.energy, 0);
  endTurn(run);
  if (!m.over) assert.equal(m.energy, 24);

  // Banking is what makes the big turn possible: a pass AND a catch-and-shoot three.
  assert.ok(byId.swing_pass.cost + byId.catch_and_shoot_3.cost > 24);
  assert.ok(byId.swing_pass.cost + byId.catch_and_shoot_3.cost <= 24 + CONFIG.CARRY_MAX);
});

test("hold: you may keep one unplayed card for next turn, at the price of a draw", () => {
  assert.equal(CONFIG.HOLD_MAX, 1);
  const run = newMatch(5);
  const m = run.match;
  const [a, b] = m.hand;
  assert.equal(toggleHold(run, a.iid).held, true);
  assert.deepEqual(m.held, [a.iid]);
  // Holding a second card releases the first.
  assert.equal(toggleHold(run, b.iid).held, true);
  assert.deepEqual(m.held, [b.iid]);
  // Toggle off and on again.
  assert.equal(toggleHold(run, b.iid).held, false);
  assert.deepEqual(m.held, []);
  toggleHold(run, a.iid);
  assert.equal(toggleHold(run, "nope").ok, false);

  const discardBefore = m.discard.length;
  endTurn(run);
  if (m.over) return;
  assert.ok(m.hand.some((c) => c.iid === a.iid), "the held card is still in hand");
  assert.equal(m.hand.length, 5, "hand is refilled to 5: holding costs you one new card");
  assert.equal(m.discard.length, discardBefore + 4, "the other four were discarded");
  assert.deepEqual(m.held, [], "holding is chosen again every turn");
  const ids = [...m.draw, ...m.hand, ...m.discard, ...m.exhaust].map((c) => c.iid);
  assert.equal(new Set(ids).size, ids.length, "no card is duplicated");
  // A held card that you play is simply played.
  toggleHold(run, m.hand[0].iid);
  m.energy = 99;
  if (canPlay(run, m.hand[0].iid).ok) {
    const iid = m.hand[0].iid;
    playCard(run, iid);
    assert.equal(m.held.includes(iid), false);
  }
});

// ---------- Card identities ----------

test("cards: every card has a category, and at least six have a drawback that changes play", () => {
  const categories = new Set(cards.map((c) => c.category));
  for (const cat of ["Setup", "Finishing", "Defensive", "High-risk", "Status"]) assert.ok(categories.has(cat), cat);
  for (const c of cards) {
    assert.ok(c.category, `${c.id} has a category`);
    assert.ok(Array.isArray(c.keywords));
  }
  // Setup cards never score; finishing cards always do.
  for (const c of cards.filter((x) => x.category === "Setup")) assert.equal(c.effects.some((e) => e.type === "shoot"), false, c.id);
  for (const c of cards.filter((x) => x.category === "Finishing")) assert.ok(c.effects.some((e) => e.type === "shoot"), c.id);
  for (const c of cards.filter((x) => x.category === "Defensive")) assert.equal(c.type, "Defense", c.id);

  const drawback = (c) =>
    !!c.onMiss || !!c.exhaust || !!c.escalate ||
    c.effects.some((e) => e.type === "add_status" || (e.type === "steal_attempt" && (e.onFail || []).length) || (e.type === "add_buff" && e.buff === "threeMissPenalty"));
  const withDrawback = cards.filter((c) => !c.status && drawback(c));
  assert.ok(withDrawback.length >= 6, `cards with drawbacks: ${withDrawback.map((c) => c.id).join(", ")}`);
  // The drawback is always written on the card.
  for (const c of withDrawback) assert.ok(c.keywords.length > 0 && c.text.length > 20, `${c.id} explains its drawback`);
  for (const kw of ["Exhaust", "Fatigue", "Risk", "Escalating"]) assert.ok(cards.some((c) => c.keywords.includes(kw)), `keyword ${kw} is used`);
});

test("drawback: Fatigue cards add Tired Legs, a dead card that costs a draw or 8 seconds", () => {
  const run = newMatch(6);
  const m = run.match;
  m.energy = 99;
  const deckBefore = run.deck.length;
  const events = play(run, "step_back_3");
  assert.ok(events.some((e) => e.type === "status_added" && e.cardId === "tired_legs"));
  assert.equal(m.discard.filter((c) => c.cardId === "tired_legs").length, 1);
  assert.equal(run.deck.length, deckBefore, "it only lasts this game");
  play(run, "chase_down_block");
  assert.equal(m.discard.filter((c) => c.cardId === "tired_legs").length, 2);
  // Tired Legs does nothing; you can spend 8s to remove it for the rest of the game.
  const tired = giveCard(run, "tired_legs", "status");
  const before = { o: m.openness, c: m.contest, s: { ...m.score } };
  m.energy = 8;
  playCard(run, tired.iid);
  assert.equal(m.energy, 0);
  assert.deepEqual({ o: m.openness, c: m.contest, s: m.score }, before);
  assert.ok(m.exhaust.some((c) => c.iid === tired.iid));
  // It is never offered as a reward.
  assert.equal(content.rewards.cards.includes("tired_legs"), false);
});

test("drawback: a missed Drive & Finish or Logo Shot is a turnover that helps their play", () => {
  for (const [cardId, bonus] of [["drive_and_finish", 10], ["logo_shot", 15]]) {
    let misses = 0;
    let makes = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const run = matchVs({ defense: 30 }, seed);
      const m = run.match;
      m.contest = 0;
      const before = opponentPreview(run).pct;
      const events = play(run, cardId);
      const shot = events.find((e) => e.type === "shot");
      if (m.over) continue;
      if (shot.made) {
        makes++;
        assert.equal(opponentPreview(run).pct, before, "no penalty on a make");
        assert.equal(events.some((e) => e.type === "consequence"), false);
      } else {
        misses++;
        assert.equal(opponentPreview(run).pct, before + bonus);
        assert.ok(opponentPreview(run).notes.some((n) => n.label === "Turnover" && n.value === bonus));
        assert.ok(events.some((e) => e.type === "consequence" && /turnover|rebound/i.test(e.text)), "explained in one line");
        // The penalty is for this possession only.
        endTurn(run);
        if (!m.over) assert.equal(m.mods.oppBonus.length, 0);
      }
    }
    assert.ok(misses > 10, `${cardId}: ${misses} misses, ${makes} makes`);
  }
  // Logo Shot is worth 4.
  const run = matchVs({ defense: 0 }, 1);
  run.match.openness = 200;
  const events = play(run, "logo_shot");
  const shot = events.find((e) => e.type === "shot");
  assert.equal(shot.points, 4);
  if (shot.made) assert.equal(run.match.score.player, 4);
});

test("drawback: a failed Swipe leaves you out of position (+10% for them)", () => {
  let failed = 0;
  let stolen = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const run = matchVs({ intents: [{ name: "Drive", points: 2, pct: 50, tags: ["drive"] }] }, seed);
    run.match.contest = 0;
    play(run, "swipe");
    const events = endTurn(run);
    const attempt = events.find((e) => e.type === "opp_attempt");
    if (attempt.stolen) {
      stolen++;
      assert.equal(events.some((e) => e.type === "consequence"), false);
    } else {
      failed++;
      assert.equal(Math.round(attempt.pct), 60, "50% becomes 60% when the gamble fails");
      assert.ok(attempt.notes.some((n) => n.label === "Out of position"));
      assert.ok(events.some((e) => e.type === "consequence" && /out of position/i.test(e.text)));
    }
  }
  assert.ok(stolen > 40 && failed > 90, `stolen ${stolen}, failed ${failed}`);
});

test("drawback: Heat Check pays for makes and punishes the miss with a cold spell", () => {
  const run = matchVs({ defense: 10 });
  const m = run.match;
  m.energy = 99;
  m.openness = 0;
  const three = giveCard(run, "catch_and_shoot_3");
  const base = calcShot(run, three).pct;
  play(run, "heat_check");
  m.threeStreak = 2;
  assert.equal(calcShot(run, three).pct, Math.min(95, base + 30));
  // A missed three resets the streak AND makes the next three colder.
  m.threeStreak = 0;
  m.threeCold = m.buffs.threeMissPenalty;
  assert.equal(m.threeCold, 10);
  const cold = calcShot(run, three);
  assert.equal(cold.pct, base - 10);
  assert.ok(cold.notes.some((n) => n.label === "Cold spell" && n.value === -10));
  // The cold spell lasts exactly one attempt.
  m.openness = -200; // force a miss; the penalty is re-armed by the miss itself
  playCard(run, three.iid);
  if (m.over) return;
  assert.equal(m.threeStreak, 0);
  assert.equal(m.threeCold, 10, "another miss, another cold spell");
  m.openness = 500;
  m.shotsTaken = 0;
  const events = play(run, "catch_and_shoot_3");
  if (events.find((e) => e.type === "shot").made) assert.equal(m.threeCold, 0, "a make ends it");
});

test("drawback: Iso costs more every time you lean on it; Alley-Oop is once per game", () => {
  const run = newMatch(7);
  const m = run.match;
  m.energy = 999;
  const base = byId.iso.cost;
  assert.equal(getCardCost(run, byId.iso), base);
  play(run, "iso");
  assert.equal(getCardCost(run, byId.iso), base + 4);
  play(run, "iso");
  assert.equal(getCardCost(run, byId.iso), base + 8);
  // Other cards are unaffected, and it resets with a new game.
  assert.equal(getCardCost(run, byId.swing_pass), byId.swing_pass.cost);
  assert.equal(getCardCost(newMatch(8), byId.iso), base);

  const oop = giveCard(run, "alley_oop");
  playCard(run, oop.iid);
  assert.ok(m.exhaust.some((c) => c.iid === oop.iid), "exhausted");
  assert.equal(m.discard.some((c) => c.iid === oop.iid), false);
});

test("defense competes with offense: every option leaves something on the table", () => {
  const run = matchVs({ defense: 12, intents: [{ name: "Drive", points: 2, pct: 62, tags: ["drive"] }] }, 9);
  const m = run.match;
  m.openness = 0;
  m.contest = 0;
  const two = giveCard(run, "pull_up_jumper");
  const three = giveCard(run, "catch_and_shoot_3");
  // All-offense: the three takes the whole clock and they shoot uncontested.
  assert.equal(getCardCost(run, byId.catch_and_shoot_3), 24);
  assert.equal(opponentPreview(run).pct, 62);
  // A two leaves 8 seconds: more Openness for you OR less for them, not both.
  const shotAlone = calcShot(run, two).pct;
  m.openness += 10;
  const shotWithSetup = calcShot(run, two).pct;
  m.openness -= 10;
  m.contest += 15;
  const themContested = opponentPreview(run).pct;
  assert.equal(shotWithSetup, shotAlone + 10);
  assert.equal(themContested, 47);
  assert.ok(byId.swing_pass.cost + byId.contest.cost + byId.pull_up_jumper.cost > 24);
  // All-defense: a turn of Lockdown + Contest scores nothing (shot-clock violation).
  assert.equal(byId.lockdown.cost + byId.contest.cost, 24);
  assert.ok(three);
});
