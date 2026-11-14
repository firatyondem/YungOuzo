// Generates content/teams.json: the 16-team fictional league.
// Team identities, intents, star abilities and signature mechanics are authored
// below; the 8-player rosters (names, numbers, looks, tendencies) are generated
// with a fixed seed so the file is reproducible.
//   node tools/gen-league.js
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NATIONS, REAL_NAMES, HEIGHT, BLURB, NICKNAMES, CLUBS, LEAGUE } from "./league-names.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- deterministic helpers ----------
let seed = 20261114;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const take = (arr) => arr.splice(Math.floor(rnd() * arr.length), 1)[0];

// Invented surnames only, so no generated name can match a real player.
const FIRST = ["Aldo", "Bastian", "Cai", "Dorian", "Emeric", "Fintan", "Gideon", "Hollis", "Ignatius", "Jarek", "Kellan", "Leoric", "Mateo", "Nilo", "Orrin", "Piero", "Quillon", "Rafe", "Soren", "Tobin", "Ulric", "Vasco", "Wendell", "Xander", "Yorick", "Zeno", "Amadou", "Bruno", "Caspian", "Declan", "Elio", "Florian", "Gael", "Henrik", "Idris", "Joss", "Kasimir", "Lorcan", "Milan", "Nestor", "Osric", "Pavel", "Renzo", "Silas", "Teo", "Umar", "Viggo", "Wyatt", "Yusuf", "Zane", "Anselm", "Benno", "Cyrus", "Dario", "Eamon", "Falk", "Griffin", "Hugo", "Ivo", "Jonah"];
const LAST = ["Albrook", "Bellweather", "Castellane", "Dunmere", "Evershade", "Fallowmere", "Greywick", "Hartsell", "Inkwell", "Jessamy", "Kestrowe", "Larkhaven", "Marlowick", "Northcliff", "Oakhollow", "Pendrake", "Quillfeather", "Ravelin", "Stonebrook", "Thistlewood", "Umberfield", "Valewright", "Westermark", "Yarrowby", "Zephyrine", "Ashcombe", "Brackenridge", "Coldharbor", "Driftwood", "Elmsworth", "Fernhollow", "Glenhaven", "Highmoor", "Ironbridge", "Juniperfell", "Kingsmere", "Loxley", "Mossgrove", "Nettlefield", "Orchardson", "Pinewhistle", "Quarrymoor", "Redfernley", "Saltmarsh", "Tanglewood", "Underbough", "Vinterhall", "Willowmere", "Yewstead", "Amberlake", "Birchfall", "Copperfield", "Dawnbreak", "Eastmarch", "Foxglove", "Goldspire", "Hazelwick", "Ivybridge", "Larkspur", "Mistral", "Novak-Reyes", "Okonwe", "Petrakos", "Rosencrest", "Silvertree", "Talmadge", "Vandermeer", "Whitlowe", "Abernathy-Cole", "Brightmoor", "Calloway-Finch", "Delacroy", "Emberton", "Fairweather", "Galbraith", "Holloway-Marsh", "Islington", "Jarrowby", "Kilbride", "Lindqvist", "Montclare", "Nakamori", "Oyelade", "Pemberly", "Quintrell", "Rutherglen", "Sandoval-Ito", "Thackeray", "Ullesby", "Vasquenza", "Wetherby", "Yellowley", "Zubiri", "Adeyinka", "Bergholt", "Corrigan-Dey", "Dragomir", "Eskelund", "Farrowdale", "Grimshaw", "Hallworthy", "Ilesanmi", "Jovanic", "Kowalczyk-Bell", "Lambrou", "Mwangira", "Nordahl", "Obuya", "Przybyl", "Rainsford", "Szymborski", "Tavernier", "Uzoma", "Varkonyi", "Wojcik-Hale", "Xanthos", "Yamazoe", "Zielinski-Roe", "Arbuckle", "Blenkinsop", "Crowhurst", "Dunwoody", "Etheridge", "Fotheringay", "Gillingwater", "Haverford", "Inchbald", "Jellicoe", "Kettlewell", "Lumley", "Micklethwait", "Netherby"];
const POSITIONS = ["PG", "SG", "SF", "PF", "C", "PG", "SF", "C"];
const HAIR = ["buzz", "afro", "braids", "bald", "long", "bun"];
const BEARD = ["none", "none", "stubble", "stubble", "full"];
const ACC = ["headband", "sleeve", "goggles", "wristband"];
const SHOES = ["#ffffff", "#111827", "#facc15", "#f43f5e", "#38bdf8", "#f97316", "#34d399", "#a78bfa"];
const TENDENCIES = {
  PG: ["risky_passer", "off_ball", "clutch", "drives"],
  SG: ["corner_threes", "off_ball", "drives", "clutch"],
  SF: ["drives", "corner_threes", "aggressive_defender", "off_ball"],
  PF: ["post_up", "rebounder", "aggressive_defender", "poor_ft"],
  C: ["post_up", "rebounder", "poor_ft", "aggressive_defender"],
};

// Names and biographies use their own random stream, so adding them never moves
// the numbers, looks and tendencies that the first stream already produced.
let seed2 = 19940914;
const rnd2 = () => {
  seed2 = (seed2 + 0x6d2b79f5) >>> 0;
  let t = seed2;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick2 = (arr) => arr[Math.floor(rnd2() * arr.length)];
const takenNames = new Set(JSON.parse(readFileSync(join(root, "content/players.league.json"), "utf8")).map((p) => p.name)); // never reuse a name from your own squad

/** Nationality (plausible for the player's look, home country favoured), then a name from that nationality only. */
function biography(player, club, index) {
  const tone = player.look.skinTone;
  const fits = Object.keys(NATIONS).filter((n) => NATIONS[n].tones.includes(tone));
  const pool = [...fits];
  if (fits.includes(club.nation)) for (let i = 0; i < 5; i++) pool.push(club.nation); // most of a roster is local
  let nationality;
  let name;
  for (let tries = 0; tries < 200 && !name; tries++) {
    nationality = pick2(pool);
    const candidate = `${pick2(NATIONS[nationality].first)} ${pick2(NATIONS[nationality].last)}`;
    if (!REAL_NAMES.has(candidate) && !takenNames.has(candidate)) name = candidate;
  }
  if (!name) throw new Error("ran out of names for " + player.id);
  takenNames.add(name);
  const [lo, hi] = HEIGHT[player.position];
  const bio = {
    name,
    nationality,
    birthplace: pick2(NATIONS[nationality].cities),
    age: 19 + Math.floor(rnd2() * 17),
    heightCm: lo + Math.floor(rnd2() * (hi - lo + 1)) + (player.look.build === "tall" ? 2 : 0),
    blurb: BLURB[player.tendencies[0]] || "Does the small things that do not show up in the box score.",
  };
  return bio;
}

const usedNames = new Set();
function makeRoster(teamId) {
  const numbers = new Set();
  return POSITIONS.map((position, i) => {
    let name;
    do name = `${pick(FIRST)} ${pick(LAST)}`;
    while (usedNames.has(name));
    usedNames.add(name);
    let jersey;
    do jersey = Math.floor(rnd() * 56);
    while (numbers.has(jersey));
    numbers.add(jersey);
    const big = position === "C" || position === "PF";
    const build = big ? pick(["tall", "strong", "tall", "strong", "average"]) : pick(["lean", "average", "lean", "average", "strong"]);
    const acc = [];
    if (rnd() < 0.45) acc.push(pick(ACC));
    if (rnd() < 0.15) {
      const second = pick(ACC);
      if (!acc.includes(second)) acc.push(second);
    }
    const pool = [...TENDENCIES[position]];
    const tendencies = [take(pool)];
    if (rnd() < 0.5) tendencies.push(take(pool));
    return {
      id: `${teamId}_${i + 1}`,
      name,
      position,
      jersey,
      look: { skinTone: 1 + Math.floor(rnd() * 6), hair: pick(HAIR), beard: pick(BEARD), build, accessories: acc, shoes: pick(SHOES) },
      tendencies,
    };
  });
}

const I = (name, points, pct, tags, extra = {}) => ({ name, points, pct, tags, ...extra });
const coach = (style, aggression, adaptationSpeed, riskTolerance, rotationDepth, preferredPace, hint) => ({
  style, aggression, adaptationSpeed, riskTolerance, rotationDepth, preferredPace, hint,
});

// ---------- the league ----------
// tier 1 = Act 1 pool (weaker six), tier 2 = Act 2 pool, tier 3 = Act 3 pool, "boss" = Finals.
const TEAMS = [
  {
    id: "gulls", name: "Harbor City Gulls", tier: 1, defense: 5, colors: ["#38BDF8", "#FFF8EC"],
    identity: "Pace & Space", tagline: "They let it fly from everywhere.",
    coach: coach("aggressive", 0.8, 0.4, 0.7, 8, "fast", "Hunts threes early in the clock."),
    intents: [I("Three", 3, 34, ["three"]), I("Drive", 2, 50, ["drive"]), I("Pull-Up Three", 3, 36, ["three"]), I("Mid-Range", 2, 48, ["mid"])],
    star: { name: "Deep Range", text: "+10% on every three-point attempt.", effects: [{ type: "intent_bonus", tag: "three", value: 10 }] },
    signature: { name: "Run Out", text: "Every 3rd possession is a transition three.", effects: [{ type: "every_nth_intent", n: 3, intent: I("Transition Three", 3, 42, ["three", "transition"]) }] },
  },
  {
    id: "volts", name: "Neon District Volts", tier: 1, defense: 5, colors: ["#FDE047", "#9B5CFF"],
    identity: "Fast pace, chaotic", tagline: "Blink and they have already shot.",
    coach: coach("aggressive", 0.9, 0.3, 0.9, 9, "fast", "Pushes the pace no matter the score."),
    intents: [I("Drive", 2, 50, ["drive"]), I("Quick Three", 3, 36, ["three"]), I("Pull-Up", 2, 46, ["mid"]), I("Leak Out", 2, 54, ["transition"])],
    star: { name: "Spark", text: "Can catch fire at any time: +15% for two possessions.", effects: [{ type: "hot_streak", chance: 22, bonus: 15, length: 2 }] },
    signature: { name: "Track Meet", text: "Fast pace for both teams: you draw 1 extra card, and they shoot at +5%.", effects: [{ type: "pace", pace: "fast", draw: 1 }, { type: "intent_bonus", value: 5 }] },
  },
  {
    id: "rafters", name: "Riverbend Rafters", tier: 1, defense: 6, colors: ["#4ADE80", "#16233D"],
    identity: "Rebounding and hustle", tagline: "Every miss is a second chance for them.",
    coach: coach("conservative", 0.4, 0.4, 0.3, 9, "normal", "Sends everyone to the glass."),
    intents: [I("Post-Up", 2, 46, ["post"]), I("Drive", 2, 48, ["drive"]), I("Mid-Range", 2, 44, ["mid"]), I("Hook Shot", 2, 46, ["post"])],
    star: { name: "Glass Eater", text: "After a miss, 40% chance of a second-chance putback.", effects: [{ type: "second_chance", chance: 40, pct: 58 }] },
    signature: { name: "Crash the Boards", text: "A Box Out played that turn denies the second chance.", effects: [] },
  },
  {
    id: "gators", name: "Bayou Gators", tier: 1, defense: 7, colors: ["#34D399", "#FFD23F"],
    identity: "Physical, foul-heavy", tagline: "Every trip to the paint costs you something.",
    coach: coach("aggressive", 0.7, 0.3, 0.5, 8, "normal", "Attacks the rim to draw contact."),
    intents: [I("Drive", 2, 50, ["drive"]), I("Bully Drive", 2, 48, ["drive"]), I("Post-Up", 2, 46, ["post"]), I("Mid-Range", 2, 42, ["mid"])],
    star: { name: "And-One", text: "30% of made drives become three-point plays.", effects: [{ type: "and_one", chance: 30, tag: "drive" }] },
    signature: { name: "Bruisers", text: "Physical defense: your two-point shots are at -6%.", effects: [{ type: "shot_mod", points: 2, value: -6 }] },
  },
  {
    id: "hawks", name: "Skyline Hawks", tier: 1, defense: 5, colors: ["#F87171", "#FFF8EC"],
    identity: "Lob-heavy athletes", tagline: "Above the rim, all night.",
    coach: coach("aggressive", 0.7, 0.4, 0.7, 8, "fast", "Throws lobs whenever a big is free."),
    intents: [I("Alley-Oop", 2, 34, ["lob"]), I("Drive", 2, 48, ["drive"]), I("Three", 3, 33, ["three"]), I("Back-Door Lob", 2, 34, ["lob"])],
    star: { name: "Airborne", text: "+25% on every lob.", effects: [{ type: "intent_bonus", tag: "lob", value: 25 }] },
    signature: { name: "Out-Jumped", text: "Your Bigs shoot at -10%.", effects: [{ type: "shot_mod", archetype: "Big", value: -10 }] },
  },
  {
    id: "wolves", name: "Northgate Wolves", tier: 1, defense: 6, colors: ["#A5B4FC", "#16233D"],
    identity: "Full-court press", tagline: "They live in your passing lanes.",
    coach: coach("aggressive", 0.8, 0.5, 0.8, 10, "fast", "Jumps passing lanes for easy points."),
    intents: [I("Drive", 2, 50, ["drive"]), I("Three", 3, 35, ["three"]), I("Run-Out Layup", 2, 54, ["transition"]), I("Mid-Range", 2, 44, ["mid"])],
    star: { name: "Pickpocket", text: "25% chance to pick off each Pass card you play.", effects: [{ type: "pass_steal", chance: 25 }] },
    signature: { name: "Press", text: "Your Pass cards cost 4 seconds more.", effects: [{ type: "card_cost", tag: "Pass", value: 4 }] },
  },
  {
    id: "owls", name: "Old Mill Owls", tier: 2, defense: 11, colors: ["#D6B98C", "#16233D"],
    identity: "Veteran, smart", tagline: "They have seen every trick you know.",
    coach: coach("adaptive", 0.4, 0.9, 0.3, 8, "slow", "Takes away whatever you lean on."),
    intents: [I("Mid-Range", 2, 54, ["mid"]), I("Three", 3, 41, ["three"]), I("Post-Up", 2, 54, ["post"]), I("Corner Three", 3, 43, ["three"])],
    star: { name: "Film Study", text: "Your most-played card type this run costs 4 seconds more.", effects: [{ type: "counter_favorite_type", value: 4 }] },
    signature: { name: "Read and React", text: "Your lineup's passive Openness does not apply.", effects: [{ type: "no_passive_openness" }] },
  },
  {
    id: "forge", name: "Ironvale Forge", tier: 2, defense: 13, colors: ["#FB923C", "#16233D"],
    identity: "Defensive grind", tagline: "Low scores, long nights.",
    coach: coach("conservative", 0.2, 0.5, 0.2, 9, "slow", "Protects the paint and waits for mistakes."),
    intents: [I("Mid-Range", 2, 50, ["mid"]), I("Post-Up", 2, 52, ["post"]), I("Three", 3, 38, ["three"]), I("Drive", 2, 50, ["drive"])],
    star: { name: "Wall", text: "Your Drive cards shoot at -15%.", effects: [{ type: "shot_mod", tag: "Drive", value: -15 }] },
    signature: { name: "Set Defense", text: "You start every turn with 10 less Openness.", effects: [{ type: "openness_start", value: -10 }] },
  },
  {
    id: "tides", name: "Crescent Bay Tides", tier: 2, defense: 10, colors: ["#5EEAD4", "#16233D"],
    identity: "Motion offense, adaptive", tagline: "The ball never stops, and neither do they.",
    coach: coach("adaptive", 0.5, 1.0, 0.5, 9, "normal", "Finds what works and goes back to it."),
    intents: [I("Three", 3, 41, ["three"]), I("Back Cut", 2, 54, ["drive"]), I("Swing Three", 3, 42, ["three"]), I("Elbow Jumper", 2, 52, ["mid"])],
    star: { name: "Extra Pass", text: "Their shots get 3% better every possession (up to +15%).", effects: [{ type: "ramp_bonus", value: 3, cap: 15 }] },
    signature: { name: "Quick Study", text: "After 4 possessions they adapt: +10% on their best play type.", effects: [{ type: "adapt_after", n: 4, bonus: 10 }] },
  },
  {
    id: "rams", name: "Granite Peak Rams", tier: 2, defense: 12, colors: ["#C4B5FD", "#16233D"],
    identity: "Post Hub, bully ball", tagline: "They walk the ball into the paint.",
    coach: coach("conservative", 0.5, 0.4, 0.3, 8, "slow", "Feeds the post until you stop it."),
    intents: [I("Post-Up", 2, 56, ["post"]), I("Deep Seal", 2, 54, ["post"]), I("Drive", 2, 52, ["drive"]), I("Hook Shot", 2, 54, ["post"])],
    star: { name: "Post Titan", text: "Their two-point attempts ignore 15 Contest.", effects: [{ type: "ignore_contest", points: 2, value: 15 }] },
    signature: { name: "Second Effort", text: "After a miss, 35% chance of a putback. Box Out denies it.", effects: [{ type: "second_chance", chance: 35, pct: 55 }] },
  },
  {
    id: "swans", name: "Silverlake Swans", tier: 2, defense: 13, colors: ["#E2E8F0", "#2EA8FF"],
    identity: "Switch everything", tagline: "No screen frees you. No matchup favours you.",
    coach: coach("adaptive", 0.5, 0.7, 0.4, 8, "normal", "Switches every action and stays in front."),
    intents: [I("Three", 3, 41, ["three"]), I("Drive", 2, 52, ["drive"]), I("Iso", 2, 52, ["iso"]), I("Corner Three", 3, 43, ["three"])],
    star: { name: "Versatile", text: "No mismatches: your shooter's rating counts as 4 at most.", effects: [{ type: "rating_cap", value: 4 }] },
    signature: { name: "Switch Everything", text: "Your Screen cards create no Openness.", effects: [{ type: "negate_tag", tag: "Screen" }] },
  },
  {
    id: "polar", name: "Frostline Polar", tier: 2, defense: 11, colors: ["#BAE6FD", "#16233D"],
    identity: "Slow, control", tagline: "They shrink the game and win the last minute.",
    coach: coach("conservative", 0.3, 0.5, 0.2, 7, "slow", "Bleeds the clock and waits for the last shot."),
    intents: [I("Mid-Range", 2, 54, ["mid"]), I("Post-Up", 2, 54, ["post"]), I("Three", 3, 41, ["three"]), I("Elbow Jumper", 2, 54, ["mid"])],
    star: { name: "Ice Veins", text: "+20% when the game is within 3 points late.", effects: [{ type: "late_bonus", value: 20, within: 3, window: 6 }] },
    signature: { name: "Slow Burn", text: "Slow pace for both teams: you draw 1 card fewer.", effects: [{ type: "pace", pace: "slow", draw: -1 }] },
  },
  {
    id: "solar", name: "Sunreach Solar", tier: 3, defense: 15, colors: ["#FDBA74", "#16233D"],
    identity: "Heliocentric", tagline: "One star. Everything orbits him.",
    coach: coach("star", 0.7, 0.5, 0.6, 7, "normal", "Runs every possession through the star."),
    intents: [I("Star Iso", 2, 58, ["iso"]), I("Step-Back Three", 3, 43, ["three"]), I("Star Drive", 2, 58, ["drive"]), I("Deep Three", 3, 44, ["three"])],
    star: { name: "Supernova", text: "+5% for every make in a row (up to +25%).", effects: [{ type: "streak_bonus", value: 5, cap: 25, resetContest: 30 }] },
    signature: { name: "Double Him", text: "30 or more Contest in a turn cools him off, even if he scores.", effects: [] },
  },
  {
    id: "rockets", name: "Redline Rockets", tier: 3, defense: 15, colors: ["#F87171", "#16233D"],
    identity: "Iso-heavy", tagline: "They find your weakest defender. Every time.",
    coach: coach("aggressive", 0.8, 0.6, 0.7, 7, "normal", "Attacks your weakest defender."),
    intents: [I("Iso", 2, 56, ["iso"]), I("Pull-Up Three", 3, 43, ["three"]), I("Iso Drive", 2, 58, ["iso", "drive"]), I("Drive", 2, 56, ["drive"])],
    star: { name: "Ankle Breaker", text: "Every 4th possession ignores all of your Contest.", effects: [{ type: "ignore_all_contest_every", n: 4 }] },
    signature: { name: "Mismatch Hunters", text: "+3% for each point your weakest defender's DEF is below 5.", effects: [{ type: "mismatch_bonus", perPoint: 3 }] },
  },
  {
    id: "kings", name: "Desert Kings", tier: 3, defense: 16, colors: ["#FCD34D", "#16233D"],
    identity: "Drop coverage, rim protection", tagline: "Nothing easy at the rim. Beat them from deep.",
    coach: coach("conservative", 0.4, 0.5, 0.3, 8, "slow", "Protects the rim and gives up the three."),
    intents: [I("Post-Up", 2, 58, ["post"]), I("Mid-Range", 2, 56, ["mid"]), I("Three", 3, 43, ["three"]), I("Drive", 2, 56, ["drive"])],
    star: { name: "Rim Wall", text: "Your two-point shots are 25% less likely to go in.", effects: [{ type: "shot_mult", points: 2, value: 0.75 }] },
    signature: { name: "Drop Coverage", text: "They give up the perimeter: your threes shoot at +8%.", effects: [{ type: "shot_mod", points: 3, value: 8 }] },
  },
  {
    id: "dynasty", name: "The Dynasty", tier: "boss", defense: 19, colors: ["#E4B53A", "#16233D"],
    identity: "Elite, two-phase", tagline: "Stacked, disciplined, and deadly in the clutch.",
    coach: coach("adaptive", 0.6, 0.9, 0.5, 8, "normal", "Changes the whole plan when it matters."),
    clutch: { within: 2, bonus: 10 },
    series: 3,
    intents: [I("Post-Up", 2, 64, ["post"]), I("Three", 3, 46, ["three"]), I("Iso", 2, 64, ["iso"]), I("Elbow Jumper", 2, 62, ["mid"])],
    phases: [
      { name: "Balanced", text: "Inside-out basketball through the post.", effects: [] },
      {
        name: "Closing Lineup", at: 8,
        text: "Five shooters, switching everything: threes on offense, and your Screen cards stop working.",
        intents: [I("SUPERTEAM", 3, 62, ["three"], { unblockableBySteal: true }), I("Corner Three", 3, 50, ["three"]), I("Lob", 2, 66, ["lob"]), I("Pull-Up Three", 3, 50, ["three"])],
        effects: [{ type: "negate_tag", tag: "Screen" }],
      },
    ],
    star: { name: "Closing Lineup", text: "At 8 points (either team) they change lineup and system.", effects: [] },
    signature: { name: "Film Room", text: "In the Finals series, your most-played card type costs 4 seconds more from Game 2.", effects: [{ type: "counter_favorite_type", value: 4, fromGame: 2 }] },
  },
];

// ---------- balance ----------
// The authored numbers above describe each team's SHAPE. Their overall strength is
// set here: every intent gets +pct and the team gets +def, per tier, as found with
// tools/tune.js against the simulator (see README, Balance). ADJUST evens out teams
// whose mechanics make them stronger or weaker than their tier.
const TUNE = { 1: { pct: 13, def: 6 }, 2: { pct: 15, def: 7 }, 3: { pct: 14, def: 7 }, boss: { pct: 2, def: 1 } };
const ADJUST = { gulls: -5, volts: -7, rafters: 7, gators: 5, hawks: 2, rams: 8, swans: -3, tides: -7, forge: -6, owls: -5, rockets: -4, kings: 1 };
for (const t of TEAMS) {
  const tune = TUNE[t.tier];
  const p = tune.pct + (ADJUST[t.id] || 0);
  const bump = (i) => (i.pct = Math.min(92, i.pct + p));
  t.defense += tune.def;
  t.intents.forEach(bump);
  for (const ph of t.phases || []) (ph.intents || []).forEach(bump);
  for (const src of [t.star, t.signature]) for (const e of src.effects) if (e.intent) bump(e.intent);
}

// How fast a team adapts to your habits (turns in a row; see src/engine/adapt.js).
// Young, loose teams are slow; veteran and film-room teams are quick; the Dynasty is quickest.
const ADAPT_AT = { 1: 4, 2: 3, 3: 3, boss: 2 };
const ADAPT_TEAM = { owls: 2, forge: 2, volts: 5, gators: 5, solar: 2 };

const teams = TEAMS.map((t) => {
  const [primary, secondary] = t.colors;
  const club = CLUBS[t.id];
  const players = makeRoster(t.id).map((p, i) => {
    const bio = biography(p, club, i);
    const { id, position, jersey, look, tendencies } = p;
    const out = { id, ...bio, position, jersey, look, tendencies };
    if (i === 0) out.nickname = NICKNAMES[TEAMS.indexOf(t) % NICKNAMES.length]; // the team's star
    return out;
  });
  const out = {
    id: t.id, name: club.name, tier: t.tier, identity: t.identity, tagline: t.tagline,
    city: club.city, country: club.nation, arena: club.arena, history: club.history, rival: club.rival,
    logo: `assets/teams/${t.id}.png`,
    defense: t.defense, adaptAt: ADAPT_TEAM[t.id] ?? ADAPT_AT[t.tier], color: primary, colors: { primary, secondary },
    coach: t.coach,
  };
  if (t.clutch) out.clutch = t.clutch;
  if (t.series) out.series = t.series;
  out.intents = t.intents;
  if (t.phases) out.phases = t.phases;
  out.star = { playerId: players[0].id, ...t.star };
  out.signature = t.signature;
  out.players = players;
  return out;
});

const line = (o) => JSON.stringify(o);
const json =
  "[\n" +
  teams
    .map((t) => {
      const { players, intents, phases, ...head } = t;
      const parts = Object.entries(head).map(([k, v]) => `    ${JSON.stringify(k)}: ${line(v)}`);
      parts.push(`    "intents": [\n${intents.map((i) => "      " + line(i)).join(",\n")}\n    ]`);
      if (phases) parts.push(`    "phases": [\n${phases.map((p) => "      " + line(p)).join(",\n")}\n    ]`);
      parts.push(`    "players": [\n${players.map((p) => "      " + line(p)).join(",\n")}\n    ]`);
      return "  {\n" + parts.join(",\n") + "\n  }";
    })
    .join(",\n") +
  "\n]\n";
writeFileSync(join(root, "content/teams.json"), json);
writeFileSync(join(root, "content/league.json"), JSON.stringify({ ...LEAGUE, clubs: teams.length }, null, 2) + "\n");
console.log(`teams.json: ${teams.length} teams, ${teams.reduce((n, t) => n + t.players.length, 0)} players`);
