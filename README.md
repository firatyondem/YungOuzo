# 🏀 Full Court Run

A basketball roguelike deckbuilder: build a five-player squad, spend your 24-second shot clock on cards, and outscore three increasingly tough opponents.
Win all three games to take the title. Lose once and the run is over.

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

## Controls

| Input | Action |
|---|---|
| Click a card | Play it |
| `1`–`9` | Play the card in that hand slot |
| `Space` | End turn |
| `M` | Mute / unmute |
| `D` | Debug panel |
| `Esc` | Close a dialog |
| `Enter` (title) | Play |

## How it plays

- **First to 15** wins a game. Three games: Round 1 (Rookies, DEF 5), Semifinals (Run & Gun, DEF 12), Finals (The Dynasty, DEF 22).
- Each turn you get **24 seconds** of shot clock and draw 5 cards. Every card costs seconds.
- **Offense** cards add **Openness** (+1% per point on your next shot). **Shot** cards score 2 or 3; the live make % is printed on the card. One shot per turn. A shot uses up all Openness.
- `make % = base (45 for 2PT, 30 for 3PT) + Openness + shooter rating × 5 − opponent DEF`, clamped to 5–95%.
  3PT shots use SHT, 2PT shots use INS. A signature card is shot by the player who owns it; other shots go to your best-rated player.
- The opponent always shows its next **intent**. **Defense** cards add **Contest**, which is subtracted from their %. They shoot when you end your turn.
- No shot in a turn = **shot-clock violation** (no points, they still shoot).
- Lineup averages give passive bonuses each turn: average PLY → Openness, average DEF → Contest.
- **Chemistry**: two players of the same archetype unlock a team bonus.
- After each win pick **one reward**: a new card, a new player (replaces a starter and swaps their signature cards), or +1 to a rating.
- The Dynasty gets **Clutch** (+10% on every intent) once either team is within 2 points of 15.

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
  ui/                screens, cards, HUD, tutorial, CSS court, debug panel
  scene/             Three.js court, figurines, ball, trophy (optional)
  audio/AudioManager.js
content/             cards, players, teams, chemistry, rewards, announcer (all JSON)
assets/              models/ + audio/ + manifest.json
tests/engine.test.js tools/ (serve, sim, update-assets)
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

- `type`: `Offense`, `Shot`, `Defense`, `Buff`, `Utility` (controls colour only).
- Optional: `requires` (list of conditions), `exhaust: true` (once per game), `ignoresShotLimit: true`, `audio` (announcer event for a made shot).
- Effect types: `add_openness`, `add_contest`, `draw`, `discard_hand`, `gain_energy`, `add_buff`, `steal_attempt` (`chance`, `onSuccess`), `on_opponent_fail` (`effects`), `next_turn_draw`, `next_turn_openness`, `shoot`.
- `shoot` takes `points` (2 or 3) and `modifiers`: `bonus` (`value`), `ignore_defense` (`value`), `rating_multiplier` (`value`).
- Any effect or modifier can carry a `condition`: `archetype_in_lineup`, `tag_played_this_turn`, `opponent_last_failed`, `missed_shot_this_turn`.
- To make a card obtainable, add its id to `content/rewards.json` → `cards` or to a player's `signatureCards`.

### Players — `content/players.league.json`

15 fictional players, three per archetype (`Sniper`, `Slasher`, `Big`, `FloorGeneral`, `Lockdown`), ratings 1–5, two `signatureCards` each. `model` can name a specific GLB in `assets/models/`. Add the id to `rewards.json` → `players` to make a player draftable. The starting five and starter cards are set in `src/config.js`.

**Switching the player file:** `players.real.json` has the same ids and stats with every name set to `"TODO"`. Fill in the names, then set `PLAYER_FILE: "real"` in `src/config.js`.

### Teams — `content/teams.json`

Array order is the tournament order. Each team has `defense`, `color`, an `intents` cycle (`name`, `points`, `pct`, optional `unblockableBySteal`) and an optional `clutch: { "within": 2, "bonus": 10 }`.

### Chemistry — `content/chemistry.json`

Keyed by archetype: `threshold`, `name`, `text`, and one `effect` of type `shot_bonus`, `draw_on_opponent_fail`, `tag_cost_reduction`, `extra_draw` or `passive_contest`.

## Assets (all optional)

The game is complete without any asset files: capsule figurines, synthesized sound effects and captions cover everything.

| File | Used for |
|---|---|
| `assets/models/sniper.glb`, `slasher.glb`, `big.glb`, `floorgeneral.glb`, `lockdown.glb` | Player figurines by archetype |
| `assets/models/ball.glb`, `trophy.glb` | Ball, victory-screen trophy |
| `assets/models/court.glb` | Replaces the 3D floor (opt-in: `USE_COURT_MODEL: true`) |
| `assets/audio/<event>_<n>.mp3` | Announcer lines and SFX, e.g. `made3_1.mp3`, `made3_2.mp3` |
| `assets/audio/music_loop.mp3` | Background music |

Audio events: `made2`, `made3`, `deep3`, `miss`, `block`, `steal`, `alleyoop`, `shotclock`, `gamepoint`, `win`, `loss`, `title` (announcer) and `swish`, `clank`, `buzzer`, `squeak`, `crowd` (SFX).
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

20 engine tests: shot %, clamping, energy, draw and reshuffle, one-shot rule, intents and Clutch, steals, win/loss, rewards, player replacement, chemistry, seeded reproducibility.

```bash
node tools/sim.js 2000
```

A bot plays seeded tournaments and prints win rates per round (useful when changing numbers). Add `casual` for a bot that plays like a first-timer: `node tools/sim.js 2000 casual`.

**Debug panel (`D`)**: +5 points, +5 opponent, win the game, add any card to hand, start a run with a given seed, live state. Every run is seeded; the seed is shown in the panel and on the end screen. Same seed + same actions = same game.
Add `?css=1` to the URL to force the CSS court (the automatic fallback when Three.js or WebGL is unavailable).

## Design decisions

- **Difficulty curve**: Round 1 uses the original design numbers and is forgiving. The Semifinals and Finals were made harder after bot simulations showed the original numbers were almost unlosable: Run & Gun is DEF 12 with threes at 50 / 50 / 65% (was DEF 10, 40 / 40 / 55%), The Dynasty is DEF 22 with 75 / 60 / 75 / 90% (was DEF 18, 60 / 45 / 60 / 75%). With these values a thorough bot wins the title about 86% of the time and a casual bot about 50%. All of it lives in `content/teams.json`.

- **Passive bonuses** are the plain lineup average (about +3 each). `PASSIVE_*_MULT` in the config scales them.
- **No dead hands**: if a new hand has no shot card, you draw up to 3 extra cards until one appears (same seeded draw order). Set `NO_SHOT_REDRAWS: 0` for strict 5-card hands.
- A **steal counts as a failed attempt**, so it also triggers Fast Break, Box Out and the Big chemistry.
- **Big chemistry** ("draw 1 after an opponent miss") gives the extra card at the start of your next turn, because the opponent shoots after your turn ends.
- **Heat Check** stacks if you play it more than once.
- **Rewards** offer exactly one of each kind; the rating upgrade names a specific player and rating.
- Ten extra cards beyond the design table: No-Look Dime, Hard Screen, Clamp Down (signature) and Corner Three, Euro Step, Putback, Give & Go, Help Defense, Chase-Down Block, Film Study (rewards).

## Current limitations

- No save or resume: refreshing the page returns to the title screen.
- Desktop only (built for 1366×768 and 1920×1080, mouse and keyboard). No touch or mobile layout.
- Opponents follow a fixed intent cycle; there is no adaptive AI.
- Balance was checked with bot simulations only, not with human playtests. Round 1 is deliberately forgiving.
- No voice, music or 3D model files are in the repo yet; until they are added you get synthesized sound effects, captions and capsule figurines.
- GLB models are treated as static meshes (no skeletal animation) and are auto-scaled by bounding box. `court.glb` support is basic and opt-in.
- Fonts and Three.js load from CDNs. Offline, the game falls back to system fonts and the CSS court.
- `players.real.json` names are placeholders (`TODO`).

## Credits

- 3D models made with **Meshy**.
- Voices, sound effects and music made with **ElevenLabs**.
- Built with plain HTML, CSS and vanilla JavaScript, plus [Three.js](https://threejs.org/) for the 3D court.
