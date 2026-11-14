// Hard mode, part 3: every reward is a sacrifice. New card / upgrade / cut /
// front-office deal or signing, deck summary, card archetypes, image slots.
import test from "node:test";
import assert from "node:assert/strict";
import { content, CONFIG, newMatch, newRun, matchVs, giveCard, league } from "./helpers.js";
import { debugAddPoints, startMatch, playCard } from "../src/engine/turnLoop.js";
import { applyReward, generateRewards, deckSummary, upgradable, removable } from "../src/engine/rewards.js";
import { calcShot, getCard, getCardCost, opponentPreview } from "../src/engine/rules.js";
import { activeRules } from "../src/engine/teamRules.js";

function atReward(seed = 3) {
  const run = newMatch(seed);
  debugAddPoints(run, 15);
  assert.equal(run.phase, "reward");
  return run;
}
const indexOf = (run, kind) => run.rewards.findIndex((r) => r.kind === kind);

test("rewards: a new card, an upgrade, a cut, and one front-office option", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const run = atReward(seed);
    const kinds = run.rewards.map((r) => r.kind);
    assert.deepEqual(kinds.slice(0, 3), ["card", "upgrade", "remove"]);
    assert.equal(kinds.length, 4);
    assert.ok(["deal", "player"].includes(kinds[3]));
    seen.add(kinds[3]);
    // The new card is a strong one, never a starter-grade common.
    assert.notEqual(content.cards[run.rewards[0].cardId].rarity, "common");
  }
  assert.deepEqual([...seen].sort(), ["deal", "player"]);
});

test("rewards: a new card makes the deck bigger", () => {
  const run = atReward();
  const size = run.deck.length;
  assert.equal(applyReward(run, indexOf(run, "card")), true);
  assert.equal(run.deck.length, size + 1);
  assert.equal(run.round, 1);
});

test("rewards: an upgrade makes one card you own cheaper, and only that copy", () => {
  const run = atReward();
  const size = run.deck.length;
  const i = indexOf(run, "upgrade");
  assert.equal(applyReward(run, i), false, "you must choose the card");
  assert.equal(applyReward(run, i, { iid: "nope" }), false);
  assert.equal(run.phase, "reward");
  const target = run.deck.find((c) => c.cardId === "pull_up_jumper");
  const other = run.deck.find((c) => c.cardId === "pull_up_jumper" && c !== target);
  assert.equal(applyReward(run, i, { iid: target.iid }), true);
  assert.equal(run.deck.length, size, "no new tool");
  const up = getCard(run, target);
  assert.equal(up.name, "Pull-Up Jumper+");
  assert.equal(up.cost, content.cards.pull_up_jumper.cost - CONFIG.UPGRADE_DISCOUNT);
  assert.equal(getCard(run, other).cost, content.cards.pull_up_jumper.cost, "the other copy is unchanged");
  assert.ok(!upgradable(run).includes(target), "a card is upgraded once");
  // In a game the upgraded copy really costs less.
  startMatch(run);
  const inst = [...run.match.draw, ...run.match.hand].find((c) => c.iid === target.iid);
  assert.equal(inst.up, true);
  assert.equal(getCardCost(run, getCard(run, inst)), up.cost);
  run.match.hand.push(inst);
  run.match.energy = up.cost;
  assert.equal(playCard(run, inst.iid).length > 0, true, "playable with exactly the reduced cost");
});

test("rewards: a cut removes one card for good, but never guts the deck", () => {
  const run = atReward();
  const size = run.deck.length;
  const i = indexOf(run, "remove");
  const target = run.deck.find((c) => c.cardId === "swing_pass");
  assert.equal(applyReward(run, i, { iid: target.iid }), true);
  assert.equal(run.deck.length, size - 1);
  assert.ok(!run.deck.includes(target));

  // Floors: MIN_DECK cards and MIN_SHOTS shot cards.
  const small = newRun(5);
  small.deck = small.deck.slice(0, CONFIG.MIN_DECK);
  assert.equal(removable(small).length, 0);
  small.phase = "reward";
  assert.equal(generateRewards(small).some((o) => o.kind === "remove"), false);
  const thin = newRun(6);
  const isShot = (c) => (content.cards[c.cardId].effects || []).some((e) => e.type === "shoot");
  const shots = thin.deck.filter(isShot);
  thin.deck = [...thin.deck.filter((c) => !isShot(c)), ...shots.slice(0, CONFIG.MIN_SHOTS)];
  assert.ok(removable(thin).every((c) => !isShot(c)), "the last shot cards cannot be cut");
});

test("rewards: front-office deals are permanent trade-offs made of normal rules", () => {
  const deals = content.rewards.deals;
  assert.deepEqual(deals.map((d) => d.name).sort(), ["Defensive Specialist", "Microwave Scorer", "Rim Protector", "Supermax Star", "Veteran Leader"]);
  for (const d of deals) {
    assert.ok(d.gain && d.price, `${d.id} states its gain and its price`);
    assert.ok(d.effects.length >= 2, `${d.id} has an upside and a downside`);
  }
  // Take Microwave Scorer: more Openness for you, an easier play for them, all run long.
  const run = atReward(3);
  run.rewards = [{ kind: "deal", dealId: "microwave_scorer" }];
  assert.equal(applyReward(run, 0), true);
  assert.equal(run.perks.length, 1);
  const base = matchVs({}, 11);
  const withDeal = matchVs({}, 11);
  withDeal.perks = [...run.perks];
  // Re-read at the next turn start: compare the rules directly.
  assert.ok(activeRules(withDeal).some((r) => r.type === "openness_start" && r.value === 8 && r.label === "Microwave Scorer"));
  assert.equal(opponentPreview(withDeal).pct, opponentPreview(base).pct + 6);
  // A deal is offered once.
  const again = atReward(3);
  again.perks = deals.map((d) => ({ id: d.id, name: d.name, text: d.text, effects: [] }));
  assert.equal(generateRewards(again).some((o) => o.kind === "deal"), false);

  // Rim Protector: Contest up, threes down.
  const rim = matchVs({}, 12);
  const plain = calcShot(rim, giveCard(rim, "catch_and_shoot_3", "starter", true)).pct;
  rim.perks = [deals.find((d) => d.id === "rim_protector")];
  assert.equal(calcShot(rim, giveCard(rim, "catch_and_shoot_3", "starter", true)).pct, plain - 8);
});

test("deck summary: size, mix, style and what the deck lacks", () => {
  const run = newRun(4);
  const d = deckSummary(run);
  assert.equal(d.size, run.deck.length);
  assert.equal(d.byCategory.Setup + d.byCategory.Finishing + d.byCategory.Defensive + d.byCategory["High-risk"], d.size);
  assert.ok(d.hint.length > 10);
  // Strip the defense: the hint says so.
  run.deck = run.deck.filter((c) => content.cards[c.cardId].type !== "Defense");
  const noD = deckSummary(run);
  assert.ok(noD.lacks.some((t) => /defense/.test(t)));
  assert.match(noD.hint, /lacks/);
  // Every real card belongs to one of the six archetypes.
  const names = Object.keys(content.rewards.archetypes);
  assert.equal(names.length, 6);
  for (const c of content.cardList.filter((x) => !x.status)) assert.ok(names.includes(c.archetype), `${c.id} archetype`);
  for (const a of names) assert.ok(content.cardList.some((c) => c.archetype === a), `${a} has cards`);
});

test("image slots: teams and players carry optional logo and portrait paths", () => {
  for (const t of league.teams) assert.equal(t.logo, `assets/teams/${t.id}.png`);
  for (const p of league.playerList) assert.equal(p.portrait, `assets/players/${p.id}.png`);
});
