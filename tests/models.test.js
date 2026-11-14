// Player model lookup and animation clip mapping (the pure half of scene/models.js),
// and the generator's job list.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { league } from "./helpers.js";
import { modelFileFor, mapClips, archetypeOf, hashId, POSITION_ARCHETYPE } from "../src/scene/models.js";

const readJson = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const has = (...files) => (f) => files.includes(f);

test("models: players/<id>.glb, then an archetype variant, then the base model, then procedural", () => {
  const p = { id: "player_01", archetype: "Sniper" };
  assert.equal(modelFileFor(p, has()), null, "nothing listed -> procedural figurine");
  assert.equal(modelFileFor(p, has("sniper.glb")), "sniper.glb");
  assert.equal(modelFileFor(p, has("sniper.glb", "players/player_01.glb")), "players/player_01.glb", "a model made for the player wins");
  // Variants are spread by player id, and the choice never changes.
  const all = has("sniper.glb", "sniper_2.glb", "sniper_3.glb");
  const picks = new Set();
  for (let i = 1; i <= 40; i++) {
    const q = { id: `x_${i}`, archetype: "Sniper" };
    const file = modelFileFor(q, all);
    assert.equal(modelFileFor(q, all), file, "deterministic");
    picks.add(file);
  }
  assert.deepEqual([...picks].sort(), ["sniper.glb", "sniper_2.glb", "sniper_3.glb"]);
  assert.equal(modelFileFor(p, has("sniper_3.glb")), "sniper_3.glb", "a lone variant is still used");
  assert.equal(modelFileFor(p, has("big.glb")), null, "another archetype's model is never borrowed");
  assert.equal(hashId("player_01"), hashId("player_01"));
});

test("models: opponents map their position to an archetype, and stars get their own file", () => {
  assert.deepEqual(Object.keys(POSITION_ARCHETYPE).sort(), ["C", "PF", "PG", "SF", "SG"]);
  const centre = league.teams[0].players.find((x) => x.position === "C");
  assert.equal(archetypeOf(centre), "big");
  assert.equal(modelFileFor(centre, has("big.glb")), "big.glb");
  for (const t of league.teams) {
    const star = t.players.find((x) => x.id === t.star.playerId);
    assert.equal(modelFileFor(star, has(`players/${star.id}.glb`, "sniper.glb", "big.glb")), `players/${star.id}.glb`);
  }
});

test("models: clips are matched by name and missing ones are ignored", () => {
  const clip = (name) => ({ name });
  const m = mapClips([clip("Idle"), clip("Over_Shoulder_Throw"), clip("Run_and_Jump"), clip("Combat_Stance"), clip("Victory_Fist_Pump")]);
  assert.deepEqual(Object.keys(m).sort(), ["celebrate", "defend", "idle", "layup", "shoot"]);
  assert.equal(m.shoot.name, "Over_Shoulder_Throw");
  assert.deepEqual(mapClips([]), {});
  assert.deepEqual(Object.keys(mapClips([clip("Armature|mixamo")])), ["idle"], "a single unnamed clip is the idle");
  assert.equal(mapClips([clip("Idle")]).dribble, undefined);
});

test("meshy jobs: generic prompts, unique outputs, a star model for every opponent, within the documented limits", () => {
  const cfg = readJson("tools/meshy-jobs.json");
  const outputs = new Set();
  for (const j of cfg.jobs) {
    assert.ok(j.id && j.output.startsWith("assets/models/") && j.output.endsWith(".glb"), j.id);
    assert.ok(!outputs.has(j.output), `duplicate output ${j.output}`);
    outputs.add(j.output);
    const prompt = `${j.style === false ? "" : cfg.style + ", "}${j.prompt}`;
    assert.ok(prompt.length <= 800, `${j.id} prompt fits the 800-character limit`);
  }
  for (const arch of ["sniper", "slasher", "big", "floorgeneral", "lockdown"]) {
    for (const f of [`${arch}.glb`, `${arch}_2.glb`, `${arch}_3.glb`]) assert.ok(outputs.has(`assets/models/${f}`), f);
  }
  for (const t of league.teams) assert.ok(outputs.has(`assets/models/players/${t.star.playerId}.glb`), `${t.id} star`);
  for (const f of ["ball", "trophy", "hoop", "coach"]) assert.ok(outputs.has(`assets/models/${f}.glb`));
  // No player or club name ever goes into a prompt.
  const names = [...league.teams.flatMap((t) => [t.name, ...t.players.map((p) => p.name)]), ...league.playerList.map((p) => p.name)];
  const text = JSON.stringify(cfg);
  for (const n of names) assert.ok(!text.includes(n), `${n} must not be sent to the generator`);
  assert.match(read(".gitignore"), /^\.env$/m);
});

function read(p) {
  return readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
}
