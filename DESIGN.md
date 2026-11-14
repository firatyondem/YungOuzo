# BALLIN — Design System

Art direction: **Bright Arena Trading Cards.** A packed arena under bright lights, collectible trading cards, modern TV broadcast graphics. Energetic, saturated, high contrast.

Everything visual is built from the tokens and components below. If a new screen needs something that is not here, add it here first.

## Rules of thumb

- Bright fills always carry navy ink text (`--navy-ink`). Light text only goes on navy surfaces.
- No dark-grey-on-dark-grey, no translucent text, no frosted or blurred panels.
- No emoji. Icons come from `src/ui/icons.js`.
- No text below 12px. Sizes come from the type scale.
- Three radii only: cards 14px, panels 6px, pills fully round.
- Spacing on an 8px grid.
- Motion is under 400ms and never blocks input. `prefers-reduced-motion` turns it off.

`tests/design.test.js` enforces the token values, contrast, the emoji ban, the 12px minimum, icon coverage and card markup.

## Tokens (`src/ui/theme.css`)

| Group | Token | Value |
|---|---|---|
| Surfaces | `--bg` | `#0B1426` deep navy, with a warm spotlight glow behind the court |
| | `--surface` / `--surface-2` | `#16233D` / `#1F3157` panels and raised panels |
| | `--line` / `--line-soft` | `#3A5486` / `#2A3F68` borders |
| Hardwood | `--wood-1` → `--wood-2` | `#E8A35C` → `#C97A3A` |
| Brand | `--orange` | `#FF6B1A` Hot Orange: primary actions, your team |
| | `--yellow` | `#FFD23F` Electric Yellow: highlights, headings, rewards |
| | `--white` | `#FFF8EC` Court White: text on navy, card faces |
| Text | `--text` / `--muted` | `#FFF8EC` / `#A9B8D6` |
| | `--ink` / `--navy-ink` | `#1A1A1A` on cream, `#0B1426` on bright fills |
| Card types | `--t-offense` | `#2EA8FF` Sky Blue |
| | `--t-shot` | `#FF3B3B` Flame Red |
| | `--t-defense` | `#1FD18A` Emerald |
| | `--t-buff`, `--t-utility` | `#9B5CFF` Violet |
| | `--t-hustle` | `#FFB800` Gold |
| Semantic | `--good` / `--bad` / `--warn` | emerald / red / yellow |
| Shape | `--r-card` / `--r-panel` / `--r-pill` | 14px / 6px / 999px |
| Type scale | `--fs-12` … `--fs-64` | 12 / 14 / 16 / 20 / 28 / 40 / 64 |

Contrast (WCAG AA): body pairs are at least 4.5:1, large coloured display text at least 3:1.

Every team has `colors.primary` and `colors.secondary` in `content/teams.json`. The score bug, intent banner and map panel take the opponent's primary colour; it must be bright enough for navy ink text (tested).

## Typography

- **Display:** Bebas Neue — scores, names, headlines, card costs. Always uppercase.
- **Body:** Inter — 400 for text, 600–800 for labels. Tabular numerals everywhere.

## Card anatomy (`src/ui/cards.js`, `src/ui/cards.css`)

Base size 180×252px. In the hand it lifts, scales to 1.25× and tilts toward the cursor on hover.

1. **Type band** across the top in the type colour, with the type icon and name.
2. **Cost badge** top-left: a navy shot-clock circle ringed in the type colour. Green when discounted.
3. **Art window:** a chalkboard play diagram on a type-tinted board. Diagrams are generated from the card's data (`src/ui/playDiagram.js`): O = your players, X = defenders, solid arrow = movement, dashed arrow = pass, dotted arc = shot.
4. **Name** in the display font, uppercase, auto-shrinking so it is never cut off.
5. **Effect text** on the cream face in dark ink. Key numbers are bold and tinted; keywords (Openness, Contest, Pass, Drive) are chips with tooltips.
6. **Live % badge** on shot cards: red below 35%, yellow 35–60%, green above 60%. It bumps when the value changes.
7. **Owner strip:** the portrait and number of the player who performs the card, or "Team play".

States:

- **Playable:** glow in the type colour.
- **Hover / focus:** lift, tilt, ring in the type colour, shot breakdown tooltip.
- **Unplayable:** desaturated, a lock chip with the reason ("Need 6s", "Shot taken"). Never just dimmed.
- **Played:** the card flies to the player who performs it and bursts into type-coloured particles.
- **Dealt:** new cards fly in from the deck, staggered.

Rarity is the frame: **Common** silver, **Rare** blue foil, **Legendary** an animated holographic foil whose highlight follows the cursor.

The hand is a fanned arc. Cards overlap only as much as needed to fit; the hovered card pushes its neighbours aside.

## Components

| Component | Where | Notes |
|---|---|---|
| Button | `.btn`, `.btn-primary`, `.btn-small`, `.btn-big`, `.icon-btn` | Chunky slab with a hard drop edge. Primary is orange with navy text. |
| Panel | `.side`, `.panel`, `.overlay-box` | Navy surface, 6px radius, solid border. |
| Chip / tag | `.tag`, `.chip`, `.kw` | Fully round, uppercase, navy text on a bright fill. |
| Score bug | `#g-scorebug` | Two skewed team slabs around the target score. Counts up and flashes on scoring; "ON FIRE" edge after three straight makes. |
| Intent banner | `.lt` | Angled lower-third in the opponent's colour: portrait, play, points, live %, chips. |
| Meter | `.meter` | Thick 12-segment bar (5 points per segment) with the number on it. |
| Lineup tile | `.lp` | Portrait with number badge, name, archetype, four ratings. The tile of the player performing the hovered card gets a spotlight ring. |
| Ticker | `.log` | Last five plays; the latest is a white slab. |
| Caption | `.caption-box` | Announcer line as a white lower-third with an orange "COURTSIDE" tab. |
| Player card | `.pcard` | Cream card with a team-colour header, portrait, rating pips, signature card chips. |
| Bracket panel | `.bnode` | Team-colour header slab, DEF pill, intents, roster portraits, state. |
| Reward pack | `.reward` | Yellow header slab; the same card and player-card components inside. |
| Portrait | `.av` | Generated SVG (`src/ui/avatar.js`), sizes xs / sm / md / lg / xl. |

## Motion

Card hover tilt, deal animation, score count-up, screen shake scaled by points, crowd flash on a three, confetti on the title and championship screens, holographic shimmer on Legendary frames, "ON FIRE" edge on the score bug.

## Icons (`src/ui/icons.js`)

24×24 grid, 2px round strokes, `currentColor`, no fills.

Card types: offense, shot, defense, buff, utility, hustle. Player state: stamina, foul, wear, injury. Tactics: mismatch, doubleTeam, clutch, capSpace, relic, scouting. UI: soundOn, soundOff, help, close, trophy, ball, lock, check, mic, arrows, swap, deck, play, target, star, users, skip.

Each card type has its own icon, so types can be told apart without colour.

## Design QA checklist

Before committing a visual change, at 1920×1080 and 1366×768:

- Nothing dim or unreadable; hierarchy reads score → intent → hand.
- No overlapping elements, no horizontal scroll, important controls visible.
- Spacing, radii and fonts match the tokens.
- `node --test tests/*.test.js` passes.
