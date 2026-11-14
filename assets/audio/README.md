# Audio files (for Emre)

Put files in this folder with exactly these names, then run `node tools/update-assets.js` so the game knows they exist.
Every file is optional: a missing file falls back to a small synthesized sound (or silence) and never breaks the game.
Format: MP3, 44.1 kHz, normalised to about -14 LUFS, no leading silence. Several numbered files for one event are picked at random.

| File | Kind | Trigger | Length | Loop? |
|---|---|---|---|---|
| `made2_1.mp3` | Announcer | You make a two | 1-2 s | no |
| `made2_2.mp3` | Announcer | You make a two | 1-2 s | no |
| `made2_3.mp3` | Announcer | You make a two | 1-2 s | no |
| `made3_1.mp3` | Announcer | You make a three | 1-2 s | no |
| `made3_2.mp3` | Announcer | You make a three | 1-2 s | no |
| `made3_3.mp3` | Announcer | You make a three | 1-2 s | no |
| `deep3_1.mp3` | Announcer | You make the Logo Shot | 2-3 s | no |
| `deep3_2.mp3` | Announcer | You make the Logo Shot | 2-3 s | no |
| `miss_1.mp3` | Announcer | You miss a shot | 1-2 s | no |
| `miss_2.mp3` | Announcer | You miss a shot | 1-2 s | no |
| `miss_3.mp3` | Announcer | You miss a shot | 1-2 s | no |
| `block_1.mp3` | Announcer | They miss against 30+ Contest | 1-2 s | no |
| `block_2.mp3` | Announcer | They miss against 30+ Contest | 1-2 s | no |
| `steal_1.mp3` | Announcer | A steal succeeds | 1-2 s | no |
| `steal_2.mp3` | Announcer | A steal succeeds | 1-2 s | no |
| `alleyoop_1.mp3` | Announcer | Alley-Oop goes in | 2-3 s | no |
| `alleyoop_2.mp3` | Announcer | Alley-Oop goes in | 2-3 s | no |
| `shotclock_1.mp3` | Announcer | Turn ends without a shot | 1-2 s | no |
| `shotclock_2.mp3` | Announcer | Turn ends without a shot | 1-2 s | no |
| `gamepoint_1.mp3` | Announcer | Either team gets within 2 of 15 (once per game) | 2-3 s | no |
| `gamepoint_2.mp3` | Announcer | Either team gets within 2 of 15 (once per game) | 2-3 s | no |
| `win_1.mp3` | Announcer | You win a game | 2-3 s | no |
| `win_2.mp3` | Announcer | You win a game | 2-3 s | no |
| `loss_1.mp3` | Announcer | You lose a game | 2-3 s | no |
| `loss_2.mp3` | Announcer | You lose a game | 2-3 s | no |
| `title_1.mp3` | Announcer | Title screen, first click | 2-3 s | no |
| `title_2.mp3` | Announcer | Title screen, first click | 2-3 s | no |
| `swish_1.mp3` | SFX | Any made shot | 0.3-0.5 s | no |
| `swish_2.mp3` | SFX | Any made shot | 0.3-0.5 s | no |
| `clank_1.mp3` | SFX | Any missed shot, a picked-off pass | 0.2-0.4 s | no |
| `clank_2.mp3` | SFX | Any missed shot, a picked-off pass | 0.2-0.4 s | no |
| `buzzer_1.mp3` | SFX | Violation, halftime, timeout, opponent adjusts, final horn | 0.6-1 s | no |
| `squeak_1.mp3` | SFX | Holding a card (sneaker squeak) | 0.1-0.2 s | no |
| `squeak_2.mp3` | SFX | Holding a card (sneaker squeak) | 0.1-0.2 s | no |
| `crowd_1.mp3` | SFX | A made three | 1-1.5 s | no |
| `crowd_2.mp3` | SFX | A made three | 1-1.5 s | no |
| `card_play_1.mp3` | SFX (new hook) | Every card you play | 0.1-0.2 s | no |
| `card_play_2.mp3` | SFX (new hook) | Every card you play | 0.1-0.2 s | no |
| `combo_tick_1.mp3` | SFX (new hook) | The combo counter grows (2nd, 3rd... card in a turn); should feel good to stack | 0.05-0.15 s | no |
| `reward_pick_1.mp3` | SFX (new hook) | A reward is chosen | 0.4-0.8 s | no |
| `gamepoint_tension_1.mp3` | SFX (new hook) | Just before a shot that can end the game (300 ms slow motion follows) | 0.3-0.5 s | no |
| `music_loop.mp3` | Music | Plays under every screen after the first click | 60-120 s | yes (seamless) |

Notes

- `card_play` and `combo_tick` can fire several times a second: keep them short and dry.
- `gamepoint_tension` is followed immediately by the shot and then `swish` or `clank`: a rising swell that cuts off works best.
- Announcer captions are shown on screen even without a voice file (texts in `content/announcer.json`).
- To add a variation, add a numbered line for that event in `content/announcer.json` (for example `swish_3.mp3`).
