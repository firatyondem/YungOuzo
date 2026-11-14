// Shared helpers for tests and the balance simulator (Node only).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CONFIG } from "../src/config.js";
import { buildContent, createRun } from "../src/engine/gameState.js";
import { startMatch } from "../src/engine/turnLoop.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

// Three plain opponents for engine tests, so rule tests do not depend on league data.
// (No tiers: they are played in this order, one game each.)
export const FIXTURE_TEAMS = [
  {
    id: "rookies", name: "Rookies", round: "Round 1", defense: 5, color: "#34d399",
    intents: [{ name: "Drive", points: 2, pct: 55, tags: ["drive"] }, { name: "Mid-Range", points: 2, pct: 50, tags: ["mid"] }],
  },
  {
    id: "run_and_gun", name: "Run & Gun", round: "Semifinals", defense: 12, color: "#60a5fa",
    intents: [
      { name: "Three", points: 3, pct: 50, tags: ["three"] },
      { name: "Three", points: 3, pct: 50, tags: ["three"] },
      { name: "Transition Three", points: 3, pct: 65, tags: ["three", "transition"] },
    ],
  },
  {
    id: "dynasty", name: "The Dynasty", round: "Finals", defense: 22, color: "#e4b53a",
    clutch: { within: 2, bonus: 10 },
    intents: [
      { name: "Post-Up", points: 2, pct: 75, tags: ["post"] },
      { name: "Three", points: 3, pct: 60, tags: ["three"] },
      { name: "Iso", points: 2, pct: 75, tags: ["iso"] },
      { name: "SUPERTEAM", points: 3, pct: 90, tags: ["three"], unblockableBySteal: true },
    ],
  },
];

/** Game content. `teams` defaults to the real league (content/teams.json). */
export function loadContent({ teams = null, playerFile = "league" } = {}) {
  return buildContent({
    cards: readJson("content/cards.json"),
    players: readJson(`content/players.${playerFile}.json`),
    teams: teams || readJson("content/teams.json"),
    chemistry: readJson("content/chemistry.json"),
    rewards: readJson("content/rewards.json"),
    plays: readJson("content/plays.json"),
    actions: readJson("content/coach_actions.json"),
    lineups: readJson("content/lineups.json"),
  });
}

/** Engine tests run against the fixture teams. */
export const content = loadContent({ teams: FIXTURE_TEAMS });
/** The real 16-team league. */
export const league = loadContent();

// Tests use exact hand sizes and fixed opponents, so the "no dead hands" redraw
// league scouting and lives are off unless a test enables them.
const REAL_CONFIG = CONFIG;
const TEST_CONFIG = { ...CONFIG, NO_SHOT_REDRAWS: 0, LEAGUE_SCOUTING: null, LIVES: 0 };
export { TEST_CONFIG as CONFIG, REAL_CONFIG };

export function newRun(seed = 12345, round = 0, config = TEST_CONFIG, withContent = content) {
  const run = createRun(withContent, config, seed);
  run.round = round;
  return run;
}

export function newMatch(seed = 12345, round = 0) {
  const run = newRun(seed, round);
  startMatch(run);
  return run;
}

/** A match against one custom team (merged over a plain baseline). */
export function matchVs(team = {}, seed = 12345, config = TEST_CONFIG) {
  const base = {
    id: "test_team", name: "Test Team", defense: 10, color: "#888888",
    intents: [{ name: "Drive", points: 2, pct: 50, tags: ["drive"] }, { name: "Three", points: 3, pct: 40, tags: ["three"] }],
  };
  const run = createRun(loadContent({ teams: [{ ...base, ...team }] }), config, seed);
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
