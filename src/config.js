// Global tuning + setup. Everything gameplay-related that is not card/player/team
// data lives here so it can be tweaked without touching the engine.
export const CONFIG = {
  // Which player file to load: "league" (fictional names) or "real" (fill in yourself).
  PLAYER_FILE: "league",

  // One player of each archetype. IDs must exist in the chosen player file.
  STARTING_LINEUP: ["player_01", "player_04", "player_07", "player_10", "player_13"],

  // Non-signature starter cards (signature cards come from the lineup: 2 per player).
  STARTER_CARDS: [
    { id: "swing_pass", count: 4 },
    { id: "pull_up_jumper", count: 3 },
    { id: "contest", count: 3 },
  ],

  TEAM_NAME: "YOU",
  TARGET_SCORE: 15,
  MAX_ENERGY: 24, // the shot clock
  HAND_SIZE: 5,
  // No dead hands: if a new hand has no shot card, draw up to this many extra
  // cards until one shows up (still the normal seeded draw order). 0 = off.
  NO_SHOT_REDRAWS: 3,

  // makePct = BASE_PCT[points] + openness + rating * RATING_MULT - opponentDefense
  BASE_PCT: { 2: 45, 3: 30 },
  SHOT_RATING: { 2: "INS", 3: "SHT" },
  RATING_MULT: 5,
  PCT_MIN: 5,
  PCT_MAX: 95,

  // Passive bonuses each turn = lineup average rating * multiplier (floats).
  // 1 = the literal rule. Raise it to make lineup ratings matter more.
  PASSIVE_OPENNESS_MULT: 1, // average PLY -> Openness
  PASSIVE_CONTEST_MULT: 1, // average DEF -> Contest

  // Pacing of the presentation layer (ms). Engine ignores these.
  SHOT_ANIM_MS: 750,
  OPP_ANIM_MS: 800,

  // Fixed seed for demos/tests; null = new random seed each run.
  SEED: null,
};
