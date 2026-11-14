// League polish: every name is built from one nationality, nothing matches the
// blocklist of known real athletes, and every club has its own identity.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { league } from "./helpers.js";
import { NATIONS, REAL_NAMES, HEIGHT, CLUBS, LEAGUE, NICKNAMES } from "../tools/league-names.js";

const readJson = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const everyone = [...league.playerList, ...league.teams.flatMap((t) => t.players)];

test("names: first name and surname come from the same nationality, never mixed", () => {
  const seen = new Set();
  for (const p of everyone) {
    const nation = NATIONS[p.nationality];
    assert.ok(nation, `${p.id}: unknown nationality ${p.nationality}`);
    const [first, ...rest] = p.name.split(" ");
    const last = rest.join(" ");
    assert.ok(nation.first.includes(first), `${p.name}: ${first} is not a ${p.nationality} first name`);
    assert.ok(nation.last.includes(last), `${p.name}: ${last} is not a ${p.nationality} surname`);
    assert.ok(nation.cities.includes(p.birthplace), `${p.name}: ${p.birthplace} is not in that country`);
    assert.ok(nation.tones.includes(p.look.skinTone), `${p.name}: look does not fit ${p.nationality}`);
    assert.ok(!REAL_NAMES.has(p.name), `${p.name} is on the real-names blocklist`);
    assert.ok(!seen.has(p.name), `duplicate name ${p.name}`);
    seen.add(p.name);
    assert.ok(p.age >= 19 && p.age <= 36, `${p.name} age`);
    const [lo, hi] = HEIGHT[p.position];
    assert.ok(p.heightCm >= lo - 2 && p.heightCm <= hi + 4, `${p.name} height ${p.heightCm} for a ${p.position}`);
    assert.ok(p.blurb && p.blurb.length < 110, `${p.name} has a one-line scouting note`);
  }
  // The league is spread over all fourteen nationalities plus imports.
  assert.equal(new Set(everyone.map((p) => p.nationality)).size, Object.keys(NATIONS).length);
});

test("clubs: an invented home, an arena, a history line, colours and a rival", () => {
  const ids = new Set(league.teams.map((t) => t.id));
  const names = new Set();
  for (const t of league.teams) {
    assert.equal(t.name, CLUBS[t.id].name);
    assert.ok(t.city && t.country && t.arena && t.history, `${t.id} club details`);
    assert.ok(t.history.length < 120, `${t.id} history is one line`);
    assert.ok(ids.has(t.rival) && t.rival !== t.id, `${t.id} rival`);
    assert.ok(t.colors.primary && t.colors.secondary);
    assert.ok(!names.has(t.name));
    names.add(t.name);
    const star = t.players.find((p) => p.id === t.star.playerId);
    assert.ok(NICKNAMES.includes(star.nickname), `${t.id}: the star has an original nickname`);
  }
  const info = readJson("content/league.json");
  assert.equal(info.name, LEAGUE.name);
  assert.ok(info.short && info.logoText);
});
