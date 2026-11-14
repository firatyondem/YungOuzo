# 🏀 Full Court Run

A basketball roguelike deckbuilder: build a five-player squad, spend your 24-second shot clock on cards, and survive a season against a 16-team league.
Beat one opponent per act, then win the best-of-3 Finals against Krunograd Dynasty.

## Run it

```bash
npx serve .
```

Then open the printed URL. No build step, no install, no backend.
Offline alternative with zero dependencies: `node tools/serve.js` → http://localhost:5177

It must be served over HTTP (ES modules + `fetch`), so opening `index.html` from disk will not work.

### GitHub Pages

Live at **https://firatyondem.github.io/YungOuzo/**

The site is published from the `gh-pages` branch, which is a copy of `main`. To update the live game after pushing to `main`:

```bash
git push origin main:gh-pages
```

(Or switch the source once in **Settings → Pages → Deploy from a branch → `main` / root**, after which every push to `main` deploys by itself.)
All paths are relative, so the game works under `https://<user>.github.io/<repo>/` with no build step.
If you add audio or models, run `node tools/update-assets.js` and commit `assets/manifest.json` before pushing.

## Feel

- The **Openness meter** glows from +20 and pulses from +35; every card's make % ticks when it changes.
- A **combo counter** (x2, x3...) counts the cards chained in a turn; a make with 25+ Openness is a **WIDE OPEN** hit with a flash and a hard shake.
- A shot that can end the game gets about 300 ms of slow motion first. No single effect holds input for more than 800 ms, and all motion is off with `prefers-reduced-motion`.
- The end screen says in one line what decided the run (violations, cold shooting, defense, predictability, turnovers or a coin-flip finish).
- `?seed=123` fixes a run: same opponents, same draws, same dice for the same choices.

## Controls

| Input | Action |
|---|---|
| Click a card | Play it |
| `1`–`9` | Play the card in that hand slot |
| `Shift` + `1`–`9`, right-click, or the HOLD tab | Hold that card for next turn (one card) |
| `Space` | End turn |
| `M` | Mute / unmute |
| `T` | Coach's call: timeouts and closing-time options |
| `P` | Game plan (during a game) |
| `D` | Debug panel |
| `Esc` | Close a dialog |
| `Enter` (title) | Play |

## How it plays

- **First to 15** wins a game. A season is four stops: Act 1, Act 2 and Act 3 (one game each, opponent drawn from that act's tier, so every run meets a different set), then the **Finals, a best-of-3 series** against Krunograd Dynasty. A loss before the Finals ends the run; in the Finals you can drop one game.
- Every opponent has a **star ability** and a **signature mechanic** (shown on the season map and in the Opponent panel during the game), and the Dynasty changes lineup and system mid-game.
- **Film study:** the league remembers what you lean on. From the second stop, a shot diet that is over 62% threes (or twos) gets defended 6% harder, and some teams tax your most-played card type. You are told before the game.
- Each turn you get **24 seconds** of shot clock and draw up to a hand of 5. Cards cost 8, 16 or 24 seconds (a few cost 4, 12 or 20), so a turn is two cards, three if you saved time: **you cannot do everything**. Setup + shot leaves no defense; shot + defense leaves no setup.
- **Saved seconds:** up to 8 unspent seconds carry over to your next turn (`CARRY_MAX`). **Hold:** keep one card instead of discarding it (`HOLD_MAX`): click its HOLD tab, right-click it, or press Shift + its number.
- **Card identities** (the band on each card): *Setup* builds Openness or draws, *Finishing* scores, *Defensive* adds Contest, *High-risk* pays off big but punishes failure. Drawbacks are real: **Exhaust** (once per game), **Fatigue** (adds a dead *Tired Legs* card to your deck for the game), **Escalating** (Iso costs 4s more each time), **Turnover** (a missed Drive & Finish or Logo Shot makes their next play easier), a failed Swipe leaves you out of position, and Heat Check turns a missed three into a cold spell.
- **Offense** cards add **Openness** (+1% per point on your next shot). **Shot** cards score 2 or 3; the live make % is printed on the card. One shot per turn. A shot uses up all Openness.
- `make % = base (45 for 2PT, 30 for 3PT) + Openness + shooter rating × 5 − opponent DEF`, clamped to 5–95%.
  3PT shots use SHT, 2PT shots use INS. A signature card is shot by the player who owns it; other shots go to your best-rated player.
- **Misses matter:** a missed three is a long rebound (their play is at +5%) unless you played Box Out; a missed two can be an offensive rebound (10% per Big in your five, +25% after a Box Out) that lets you shoot again this turn. Every consequence is explained on screen in one line.
- **Opponents adapt:** they count five habits: threes, Drive cards, shots without a Pass card, turns without a Defense card, and steal attempts. A habit counts up on a turn you do it and down on a turn you don't. One short of the team's threshold you get a yellow warning in the Opponent panel; at the threshold the adjustment applies from your next turn (threes -10%, twos -8%, unassisted shots -8%, their plays +6%, steals -20%) and it relaxes as soon as you change it up. Teams adapt at different speeds (`adaptAt` in `content/teams.json`: 5 for loose teams, 2 for film-room teams and the Dynasty). Knobs: `ADAPT` and `MISS` in `src/config.js`.
- The opponent always shows its next **intent**. **Defense** cards add **Contest**, which is subtracted from their %. They shoot when you end your turn.
- No shot in a turn = **shot-clock violation** (no points, they still shoot).
- Lineup averages give passive bonuses each turn: average PLY → Openness, average DEF → Contest.
- **Chemistry**: two players of the same archetype unlock a team bonus.
- After each win pick **one reward, and every one is a sacrifice**: **New card** (a strong one, but the deck grows and you see every card less often), **Upgrade** (one card you own costs 4 seconds less; no new tool), **Cut a card** (a tighter deck, one option fewer), or the **Front office**: a signing that replaces a starter, or one of five permanent deals with a price (Supermax Star, Defensive Specialist, Veteran Leader, Rim Protector, Microwave Scorer). The screen shows your deck size, its mix, its style (Perimeter shooting, Paint dominance, Defensive grind, Fast transition, Pick & Roll, Balanced offense) and the one thing it lacks.
- Krunograd Dynasty gets **Clutch** (+10% on every intent) once either team is within 2 points of 15.
- **Game plan:** before each game choose an **offensive system** (Balanced, Pace & Space, Motion Offense, Post Hub, Heliocentric, Pick & Roll Heavy), a **defensive scheme** (Man-to-Man, 2-3 Zone, Switch Everything, Drop Coverage, Full-Court Press) and a **pace** (Slow: one card fewer but stronger defense; Fast: one card more but weaker defense; the shot clock is always 24). Every option has strengths and a weakness, and the board rates each one against the opponent as favourable, even or unfavourable, with the reason. Changing the plan during a game is free once at halftime (when either team reaches 8) and otherwise costs a timeout. A team that locks the pace overrides yours.
- **Play calls:** the right cards in order within one turn trigger a named play that boosts the shot finishing it: Pass, Pass, shot = *Swing-Swing* (+10%); Drive, Pass, three = *Drive & Kick* (+15%, their DEF counts half); Screen, two = *Pick & Roll Finish* (+12%); Pass, two = *Give & Go* (+6%). The Playbook panel shows what is ready and what is one card away. Only the best play applies.
- **The coach reads you:** a coached opponent looks at the Contest you showed on the previous possession and picks, from its next two plays, the one worth more expected points against it. Show no defense and it goes for the bigger, lower-percentage shot, which you can then contest. The choice is always shown before you act.
- **Timeouts:** three per game (they are not cards). Regroup (new hand of 5), Ice the Shooter (their attempt at -10%), Breather (+8 seconds this turn).
- **Closing time:** once either team is within 4 points of 15, three one-time options open up: Intentional Foul (two free throws at 70% instead of their play), Hold for the Last Shot (+15%, but the turn ends when you shoot), Two-for-One (two shots this turn, both at -12%).
- **Lineup shapes:** your five are recognised automatically, each shape with a bonus and a weakness: Small Ball (no Big), Twin Towers (two Bigs), Defensive Five (average DEF 3.6+), Bench Mob (three or more signings).
- **Lives:** you have 2. A loss before the Finals costs one: you get a rematch against the same team, but no reward for that stop. With no lives left a loss ends the run. Lives do not apply in the Finals series.

### The league

The **Meridian Continental League (MCL)**: sixteen invented European clubs.

| Tier | Clubs |
|---|---|
| Act 1 | Marevo Port BC, Lumena Volt BC, KK Drinava, Marais Noir BC, Altınyaka Hawks, Nordtor Wolves |
| Act 2 | Mylos Owls, Valferro Forge, Bahía Luna CB, Kamenvrh Rams, BK Sudrabezers, Eiskamm Baskets |
| Act 3 | Negev Shemesh BC, Costarossa Rockets, Reyes del Sur CB |
| Finals | Krunograd Dynasty (two phases, best of 3) |

Every club has a home (an invented city or a generic region), an arena, a one-line history, colours and a rival. Every player has one nationality (Serbian, Croatian, Slovenian, Greek, Turkish, Spanish, French, Italian, German, Lithuanian, Latvian, Israeli, Senegalese, Nigerian or an American import), a first name and a surname from that nationality only, a birthplace in that country, an age, a height and a one-line scouting note; each club's star has a nickname.

All clubs, coaches, players and names are fictional. Names are common ones, built from the pools in `tools/league-names.js`; the same file holds a blocklist of name pairs that belong to known real athletes or public figures, which the generator never produces and `tests/league-names.test.js` checks. With common names a clash with a real person somewhere cannot be ruled out; if you spot one, add it to the blocklist and run `node tools/gen-league.js`. `content/teams.json` and `content/league.json` are generated by that script: team shapes, star abilities and signature mechanics are authored in it, rosters are generated with a fixed seed, and a per-tier balance layer sets overall strength.

## Project layout

```text
index.html
src/
  main.js            boot + screen flow
  config.js          all tuning knobs
  engine/            pure game logic (no DOM, runs in Node)
    gameState.js     state shape + public API docs (read this first)
    turnLoop.js      match flow    rules.js   shot %, costs, chemistry, playability
    effects.js       data-driven card effects  deck.js  piles  rng.js  seeded RNG
    rewards.js       rewards + player replacement
  roster.js          roster selection (league by default, private with ?roster=real)
  look.js            player appearance data: allowed values, defaults, normalizeLook()
  ui/                screens, cards, HUD, tutorial, CSS court, debug panel
                     theme.css (design tokens), cards.css, game.css, icons.js (SVG icon set),
                     playDiagram.js (chalkboard play diagrams), avatar.js (SVG portraits)
  scene/             Three.js court, procedural figurines, ball, trophy (optional)
  audio/AudioManager.js
content/             cards, players, teams, chemistry, rewards, announcer (all JSON)
assets/              models/ + audio/ + manifest.json
tests/               engine.test.js, roster.test.js, design.test.js
DESIGN.md            the design system: tokens, card anatomy, components
tools/               serve, sim, update-assets, check-private
.githooks/pre-commit blocks commits that include the private roster
```

## Adding content (JSON only)

### Cards — `content/cards.json`

```json
{
  "id": "swing_pass", "name": "Swing Pass", "cost": 3, "type": "Offense",
  "tags": ["Pass"], "text": "+10 Openness.",
  "effects": [{ "type": "add_openness", "value": 10 }]
}
```

- `type`: `Offense`, `Shot`, `Defense`, `Buff`, `Utility` (controls colour and icon only).
- `rarity`: `common`, `rare` or `legendary` (the card frame). The art on each card is a play diagram drawn from the card's own data, so new cards get one automatically.
- Optional: `requires` (list of conditions), `exhaust: true` (once per game), `ignoresShotLimit: true`, `audio` (announcer event for a made shot).
- Effect types: `add_openness`, `add_contest`, `draw`, `discard_hand`, `gain_energy`, `add_buff`, `steal_attempt` (`chance`, `onSuccess`), `on_opponent_fail` (`effects`), `next_turn_draw`, `next_turn_openness`, `shoot`.
- `shoot` takes `points` (2 or 3) and `modifiers`: `bonus` (`value`), `ignore_defense` (`value`), `rating_multiplier` (`value`).
- Any effect or modifier can carry a `condition`: `archetype_in_lineup`, `tag_played_this_turn`, `opponent_last_failed`, `missed_shot_this_turn`.
- To make a card obtainable, add its id to `content/rewards.json` → `cards` or to a player's `signatureCards`.

### Players — `content/players.league.json`

15 fictional players, three per archetype (`Sniper`, `Slasher`, `Big`, `FloorGeneral`, `Lockdown`), ratings 1–5, two `signatureCards` each. `model` can name a specific GLB in `assets/models/`. Add the id to `rewards.json` → `players` to make a player draftable. The starting five and starter cards are set in `src/config.js`.

Every player also has a `look` that drives both the 2D portrait and the 3D figurine:

```json
"look": { "skinTone": 1, "hair": "buzz", "beard": "none", "build": "lean", "accessories": ["headband"], "shoes": "#ff8800" }
```

| Field | Allowed values |
|---|---|
| `skinTone` | integer 1–6 |
| `hair` | `buzz`, `afro`, `braids`, `bald`, `long`, `bun` |
| `beard` | `none`, `stubble`, `full` |
| `build` | `lean`, `average`, `strong`, `tall` |
| `accessories` | any of `headband`, `sleeve`, `goggles`, `wristband` |
| `shoes` | hex colour |

Missing or invalid fields fall back to defaults (`normalizeLook` in `src/look.js`), so a broken look never breaks the game. Portraits are generated locally as SVG (`generatePlayerAvatar` in `src/ui/avatar.js`): no image files, no network requests.

### Teams — `content/teams.json`

Edit `tools/gen-league.js` and run it; do not hand-edit the JSON. Each team has `tier` (1, 2, 3 or `"boss"`), `defense`, `colors`, a `coach` profile, an `intents` cycle (`name`, `points`, `pct`, `tags`, optional `unblockableBySteal`), a `star` ability and a `signature` mechanic (each with `name`, `text` and a list of rule `effects`), optional `clutch`, optional `series` (best-of-N) and optional `phases`.
Each team lists eight `players` (`id`, `name`, `position`, `jersey`, `look`, `tendencies`). Players are visual only for now: portraits, figurines and who takes the shot in the intent banner.

Rule effects are data. The full list of rule types, with what each one does, is at the top of `src/engine/teamRules.js`. Examples: `intent_bonus`, `streak_bonus`, `hot_streak`, `mismatch_bonus`, `ignore_contest`, `every_nth_intent`, `second_chance` (denied by Box Out), `and_one`, `shot_mod`, `shot_mult`, `rating_cap`, `card_cost`, `pass_steal`, `negate_tag`, `energy_tax`, `pace`, `counter_favorite_type`. Every rule that changes a number is named next to that number in the UI.

### Plays, coach actions and lineup shapes

- `content/strategy.json` — offensive systems, defensive schemes and paces. Each option has `strengths`, `weaknesses` (shown to the player) and a list of rule `effects`; the matchup verdict is computed from those effects against the opponent's plays and rules, so new options are rated automatically.
- `content/plays.json` — each play has a `sequence` of steps (`tag:<Tag>`, `type:<CardType>`, then a final `shot`, `shot:2` or `shot:3`), a `bonus` and an optional `defenseMult`.
- `content/coach_actions.json` — timeouts (`group: "timeout"`) and closing-time options (`group: "closing"`), each a list of normal card effects plus an optional `cost` in seconds.
- `content/lineups.json` — lineup shapes: a `when` condition (`max_archetype`, `min_archetype`, `min_avg_rating`, `min_signings`) and a list of rule effects (the same rule types opponents use).

### Chemistry — `content/chemistry.json`

Keyed by archetype: `threshold`, `name`, `text`, and one `effect` of type `shot_bonus`, `draw_on_opponent_fail`, `tag_cost_reduction`, `extra_draw` or `passive_contest`.

## Rosters: public league and private roster

| Mode | File | When it loads |
|---|---|---|
| `league` | `content/players.league.json` (fictional, committed) | Always, by default |
| `real` | `content/players.real.json` (private, local only) | Only when the URL contains `?roster=real` **and** the file exists and is valid |

- Without `?roster=real` the game never requests `players.real.json`. Any other value (`?roster=league`, `?roster=REAL`, ...) loads the league roster.
- If `?roster=real` is set but the file is missing or invalid, the league roster loads and a small notice appears in the corner. The game keeps working.
- All of this lives in one place: `loadRoster()` in `src/roster.js`. The old `PLAYER_FILE` config value is ignored.

**Setting up the private roster on your machine**

1. Copy `content/players.real.example.json` to `content/players.real.json`.
2. Replace every `"TODO"` name and adjust the `look` of each player. Keep the ids, and keep the five starting ids from `src/config.js`. A file that still contains a `TODO` name is rejected.
3. Open the game with `?roster=real`, for example `http://localhost:3000/?roster=real`.

The example file is only a template. The game never loads it.

**Keeping it private**

- `content/players.real.json` is in `.gitignore`. GitHub Pages publishes only what is in git, so an untracked file is never deployed.
- Enable the pre-commit check once per clone:

```bash
git config core.hooksPath .githooks
```

  From then on every commit runs `tools/check-private.js`, which aborts the commit if the private roster is staged or tracked. You can also run it by hand:

```bash
node tools/check-private.js
```

- If the file ever gets tracked: `git rm --cached content/players.real.json` (the file stays on disk).
- **After every deploy**, check that the private file is not public. This URL must return 404:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://firatyondem.github.io/YungOuzo/content/players.real.json
```

## Team and player images (optional, local only)

Every team has a `logo` slot and every player a `portrait` slot (`assets/teams/<team id>.png`, `assets/players/<player id>.png`). Drop images there, run `node tools/update-assets.js`, and they replace the generated crest and portrait; anything missing silently falls back. Both folders are gitignored and no official league or team logos ship with the game.

Real team and player names work the same way as the private roster: copy `content/teams.real.example.json` to `content/teams.real.json` (gitignored, checked by `tools/check-private.js`), fill in names, and open the game with `?roster=real`. Without that parameter the file is never requested, and the public build stays fictional.

## 3D models (Meshy)

The game is complete without any model file. When models exist they are picked per player, most specific first:
`assets/models/players/<playerId>.glb` → `assets/models/<archetype>_2.glb` / `_3.glb` (variant chosen by the player's id) → `assets/models/<archetype>.glb` → the procedural figurine. Opponents map their position to an archetype (PG floor general, SG sniper, SF slasher, PF lockdown, C big). Each file is loaded once and cloned per player; the white kit is tinted to the team colour, a number is added on chest and back, and the model is scaled by position and build. Clips named like idle, throw, jump, stance and victory play at the matching moments with a 0.2 s cross-fade; missing clips are ignored.

Generate them with `tools/meshy-generate.mjs` (job list in `tools/meshy-jobs.json`):

```bash
node tools/meshy-generate.mjs --dry-run
```

```bash
node tools/meshy-generate.mjs --group archetypes
```

```bash
node tools/update-assets.js
```

The key is read from the environment variable `MESHY_API_KEY` or from a `MESHY_API_KEY=...` line in a `.env` file (gitignored); it is never printed. The script stops starting jobs at 1,000 credits (`--budget`) and records every task in `tools/meshy-ledger.json`. Other groups: `stars`, `variants`, `props`. **No models have been generated yet.**

## Assets (all optional)

The game is complete without any asset files: procedural figurines built from each player's `look`, synthesized sound effects and captions cover everything. A GLB for an archetype replaces the procedural figurine for those players; if procedural generation ever fails, a plain capsule is used.

| File | Used for |
|---|---|
| `assets/models/sniper.glb`, `slasher.glb`, `big.glb`, `floorgeneral.glb`, `lockdown.glb` | Player figurines by archetype |
| `assets/models/ball.glb`, `trophy.glb` | Ball, victory-screen trophy |
| `assets/models/court.glb` | Replaces the 3D floor (opt-in: `USE_COURT_MODEL: true`) |
| `assets/audio/<event>_<n>.mp3` | Announcer lines and SFX, e.g. `made3_1.mp3`, `made3_2.mp3`. The full list with trigger, length and loop flag is in [assets/audio/README.md](assets/audio/README.md) |
| `assets/audio/music_loop.mp3` | Background music |

Audio events: `made2`, `made3`, `deep3`, `miss`, `block`, `steal`, `alleyoop`, `shotclock`, `gamepoint`, `win`, `loss`, `title` (announcer) and `swish`, `clank`, `buzzer`, `squeak`, `crowd`, `card_play`, `combo_tick`, `reward_pick`, `gamepoint_tension` (SFX). Every one falls back to a synthesized sound when its file is missing.
`content/announcer.json` pairs each file with its caption, so it is also the voice-over script. Add more variations by adding lines there.

**After adding or removing files, run:**

```bash
node tools/update-assets.js
```

This rewrites `assets/manifest.json`. The game only requests files listed there, so missing assets never cause 404s or errors. A listed file that fails to load is skipped silently.

## Tests and tools

```bash
node --test tests/*.test.js
```

71 tests. Team strategy (7): every system, scheme and pace, the matchup reading, and plan changes (free before a game and at halftime, otherwise a timeout). Strategy (11): play calls, the coach's read, timeouts, closing-time options, lineup shapes, lives. League (12): the 16-team data, per-run schedule, the Finals series, boss phases, every rule type, film study, and a reproducible full season. Design system (8): token values, WCAG AA contrast of the main colour pairs, no emoji, no text under 12px, icon coverage, valid play diagrams and card markup. Engine (20): shot %, clamping, energy, draw and reshuffle, one-shot rule, intents and Clutch, steals, win/loss, rewards, player replacement, chemistry, seeded reproducibility. Roster and appearance (13): roster selection with a mocked fetch (the private file is never requested without `?roster=real`, missing and invalid files fall back), `normalizeLook` defaults, portraits stay valid SVG for broken data, and the private-file check.

```bash
node tools/sim.js 2000
```

A bot plays seeded seasons and prints how often each stop is cleared. Add `casual` for a bot that plays like a first-timer and `teams` for a per-team table: `node tools/sim.js 2000 casual teams`. `node tools/tune.js` searches for the per-tier strength that hits target win rates.

**Debug panel (`D`)**: +5 points, +5 opponent, win the game, add any card to hand, start a run with a given seed, live state. Every run is seeded; the seed is shown in the panel and on the end screen. Same seed + same actions = same game.
Add `?css=1` to the URL to force the CSS court (the automatic fallback when Three.js or WebGL is unavailable).

## Design decisions

- **Balance (hard mode)**: team strength per tier comes from the simulator, not from hand-picked numbers (`TUNE` and `ADJUST` in `tools/gen-league.js`, found with `tools/tune.js`). Over 1,000 seeded seasons the thorough bot (an expected-value planner that weighs every affordable set of cards, uses timeouts, saves seconds and holds a card) wins 83% / 57% / 44% of its games in Act 1 / 2 / 3 and 38% of Finals games, and takes the title in 20% of runs (20% to 24% depending on which rewards it takes; only taking new cards drops it to about 11%). A bot that plays random legal cards wins 7% of Act 1 games and never wins the title. Before hard mode the same kind of bot won the title in 56% of runs. `node tools/sim.js 1000 thorough cards` prints what winning decks added, upgraded and signed: no added card is in more than a quarter of winning decks, and the five deals sit between 11% and 29%.
- **The clock stays 24**: the redesign asked for about three resource per turn. The shot clock is the resource and its value does not change, so cards were re-costed in units of 8 seconds instead (24 seconds = three units). Pace options used to change the clock; they now change hand size and Contest.
- **Team strategy adapted to the current rules**: systems and schemes act on what the engine has. Full-Court Press costs 2 seconds a turn instead of draining stamina, Switch Everything works on play types rather than screens, Pick & Roll Heavy risks a 12% pick-off on Pass cards instead of a Blitz, and Heliocentric's Star gets +20% (no stamina yet). The default plan is Balanced / Man-to-Man / Normal, which changes nothing, so a first-time player can ignore the board. In the simulator the recommended plan is Drop Coverage in about 70% of games, because most league teams score mostly twos; that scheme may be too broadly good.
- **Strategy mechanics adapted to the current rules**: timeouts cannot change systems or refresh stamina (neither exists yet), so their three uses are Regroup, Ice and Breather. There is no game clock, so "the last possessions" became closing time (either team within 4 of the target). A loss costs a life and that stop's reward, standing in for Cap Space and morale. There are no Rival teams yet.
- **League mechanics adapted to the current rules**: some signature mechanics in the design brief depend on systems that do not exist yet (fouls, stamina, rebounding, double teams). They are implemented with the closest rule the engine has: for example the Gators' foul-drawing is an and-one point on made drives, the Rafters' offensive rebounding is a putback after a miss that Box Out denies, and Solar's star is cooled off by 30 or more Contest in a turn.

- **Passive bonuses** are the plain lineup average (about +3 each). `PASSIVE_*_MULT` in the config scales them.
- **No dead hands**: if a new hand has no shot card, you draw up to 3 extra cards until one appears (same seeded draw order). Set `NO_SHOT_REDRAWS: 0` for strict 5-card hands.
- A **steal counts as a failed attempt**, so it also triggers Fast Break, Box Out and the Big chemistry.
- **Timeout is no longer a card.** It was replaced by the three timeouts per game; the Floor Generals who had it now carry No-Look Dime or Give & Go. Iso is tagged Drive so it can start a Drive & Kick.
- **Big chemistry** ("draw 1 after an opponent miss") gives the extra card at the start of your next turn, because the opponent shoots after your turn ends.
- **Heat Check** stacks if you play it more than once.
- **Rewards** offer exactly one of each kind; the rating upgrade names a specific player and rating.
- Ten extra cards beyond the design table: No-Look Dime, Hard Screen, Clamp Down (signature) and Corner Three, Euro Step, Putback, Give & Go, Help Defense, Chase-Down Block, Film Study (rewards).

## Current limitations

- No save or resume: refreshing the page returns to the title screen.
- Desktop only (built for 1366×768 and 1920×1080, mouse and keyboard). No touch or mobile layout.
- Opponents follow a fixed intent cycle; there is no adaptive AI.
- Balance was checked with bot simulations only, not with human playtests. Round 1 is deliberately forgiving.
- No voice, music or 3D model files are in the repo yet; until they are added you get synthesized sound effects, captions and procedural figurines.
- GLB models are treated as static meshes (no skeletal animation) and are auto-scaled by bounding box. `court.glb` support is basic and opt-in.
- Fonts and Three.js load from CDNs. Offline, the game falls back to system fonts and the CSS court.
- Opponent players are visual only: there are no individual matchups, and opponents have no ratings. Coach profiles and player tendencies are in the data but the opponent still follows its intent cycle (plus its team rules); there is no adaptive coach AI yet beyond the Tides' adjustment, the Dynasty's phase change and film study.
- The private roster is protected by `.gitignore` plus an opt-in pre-commit hook. A clone that has not run `git config core.hooksPath .githooks` only has the `.gitignore` protection.

## Credits

- 3D models made with **Meshy**.
- Voices, sound effects and music made with **ElevenLabs**.
- Built with plain HTML, CSS and vanilla JavaScript, plus [Three.js](https://threejs.org/) for the 3D court.
