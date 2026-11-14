// Global tuning + setup. Everything gameplay-related that is not card/player/team
// data lives here so it can be tweaked without touching the engine.
export const CONFIG = {
  // Legacy setting, kept for compatibility. The roster is chosen in src/roster.js:
  // the public league roster by default, the private one only with ?roster=real
  // in the URL. This value can never load the private roster.
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
  MAX_ENERGY: 24, // the shot clock: always 24. Card costs are sized so a turn fits two or three cards.
  // Unspent seconds do not carry over, except that up to CARRY_MAX are banked for the next turn.
  CARRY_MAX: 8,
  // Rewards: an upgraded card costs this many seconds less; cutting cards stops at
  // MIN_DECK cards and MIN_SHOTS shot cards.
  UPGRADE_DISCOUNT: 4,
  MIN_DECK: 12,
  MIN_SHOTS: 4,
  // Opponents adapt to repeated habits (see src/engine/adapt.js). `at` = turns in a row
  // before an adjustment applies (a team's `adaptAt` overrides it); the rest are the
  // sizes of each adjustment in %. Set to null to switch adaptation off.
  ADAPT: { at: 3, three: -10, paint: -8, double: -8, attack: 6, steal: -20 },
  // What a missed shot leads to: a missed three is a long rebound (+% on their play),
  // a missed two can be an offensive rebound (% per Big, + Box Out, capped). null = off.
  MISS: { longRebound: 5, orebPerBig: 10, orebBoxOut: 25, orebMax: 45, orebSeconds: 8 },
  // At the end of your turn you may hold this many unplayed cards instead of discarding them.
  HOLD_MAX: 1,
  HAND_SIZE: 5,
  // No dead hands: if a new hand has no shot card, draw up to this many extra
  // cards until one shows up (still the normal seeded draw order). 0 = off.
  NO_SHOT_REDRAWS: 3,

  // makePct = BASE_PCT[points] + openness + rating * RATING_MULT - opponentDefense
  BASE_PCT: { 2: 45, 3: 30, 4: 10 },
  SHOT_RATING: { 2: "INS", 3: "SHT", 4: "SHT" },
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

  // Halftime (one free game-plan change) when either team first reaches this score.
  HALFTIME_AT: 8,
  // Lives: a loss before the Finals costs one (rematch, no reward) instead of ending the run.
  LIVES: 2,
  // Coach actions (content/coach_actions.json).
  TIMEOUTS_PER_MATCH: 3,
  CLOSING_WINDOW: 4, // closing time = either team within this many points of the target
  // Coached opponents read the Contest you showed last possession (see turnLoop.chooseIntent).
  OPPONENT_READS: true,

  // League film study: from the second stop on, opponents defend your favourite
  // shot type harder once it is this large a share of your shots. null = off.
  LEAGUE_SCOUTING: { minShots: 8, share: 0.62, defense: 6 },
  // Which tier each act draws its opponent from.
  LEAGUE_ACTS: [1, 2, 3],

  // 3D court (Three.js from a CDN). false, ?css=1 in the URL, or any load
  // failure -> the CSS court is used instead.
  USE_THREE: true,
  // Replace the procedural 3D floor with assets/models/court.glb (if present).
  // assets/models/hoop.glb replaces the pole and backboard when true (the game's own rim
  // and net always stay, so the rim is never hidden and the ball still drops through it).
  USE_HOOP_MODEL: false,
  USE_COURT_MODEL: false,

  // Synthesized fallback sounds when an SFX file is missing (assets/audio/).
  SYNTH_SFX: true,

  // Fixed seed for demos/tests; null = new random seed each run.
  SEED: null,
};
