// Shared helpers for tests and the balance simulator (Node only).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CONFIG } from "../src/config.js";
import { buildContent, createRun } from "../src/engine/gameState.js";
import { startMatch } from "../src/engine/turnLoop.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

export function loadContent(playerFile = CONFIG.PLAYER_FILE) {
  return buildContent({
    cards: readJson("content/cards.json"),
    players: readJson(`content/players.${playerFile}.json`),
    teams: readJson("content/teams.json"),
    chemistry: readJson("content/chemistry.json"),
    rewards: readJson("content/rewards.json"),
  });
}

export const content = loadContent();
// Tests use exact hand sizes, so the "no dead hands" redraw is off unless a test enables it.
const REAL_CONFIG = CONFIG;
const TEST_CONFIG = { ...CONFIG, NO_SHOT_REDRAWS: 0 };
export { TEST_CONFIG as CONFIG, REAL_CONFIG };

export function newRun(seed = 12345, round = 0, config = TEST_CONFIG) {
  const run = createRun(content, config, seed);
  run.round = round;
  return run;
}

export function newMatch(seed = 12345, round = 0) {
  const run = newRun(seed, round);
  startMatch(run);
  return run;
}

/** Put a specific card into the hand (replacing the hand if `only`). */
export function giveCard(run, cardId, source = "starter", only = false) {
  const inst = { iid: "t" + run.nextIid++, cardId, source };
  if (only) run.match.hand = [];
  run.match.hand.push(inst);
  return inst;
}
