// Entry point: load content, wire the screens, own the `app` object.
import { CONFIG } from "./config.js";
import { buildContent, createRun } from "./engine/gameState.js";
import { startMatch } from "./engine/turnLoop.js";
import { randomSeed } from "./engine/rng.js";
import { getTeam } from "./engine/rules.js";
import { $, esc } from "./ui/dom.js";
import { showScreen, showOverlay, hideOverlay } from "./ui/screens.js";
import { createGame } from "./ui/game.js";
import { createCssCourt } from "./ui/cssCourt.js";

const app = {
  config: CONFIG,
  content: null,
  run: null,
  court: null,
  game: null,
  tutorial: null,
  locked: false,
  sfx() {},
  announce() {},
  onMatchEnd() {},
};
window.fcr = app; // handy in the console

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

async function loadContent() {
  const [cards, players, teams, chemistry, rewards] = await Promise.all([
    loadJson("content/cards.json"),
    loadJson(`content/players.${CONFIG.PLAYER_FILE}.json`),
    loadJson("content/teams.json"),
    loadJson("content/chemistry.json"),
    loadJson("content/rewards.json"),
  ]);
  return buildContent({ cards, players, teams, chemistry, rewards });
}

function newRun(seed = CONFIG.SEED ?? randomSeed()) {
  app.run = createRun(app.content, CONFIG, seed);
  beginMatch();
}

function beginMatch() {
  hideOverlay();
  startMatch(app.run);
  showScreen("game");
  app.game.begin();
}

app.onMatchEnd = () => {
  const run = app.run;
  const m = run.match;
  const team = getTeam(run);
  const won = m.winner === "player";
  const o = showOverlay(`
    <h2 class="${won ? "good" : "bad"}">${won ? "YOU WIN!" : "GAME OVER"}</h2>
    <p>${esc(CONFIG.TEAM_NAME)} ${m.score.player} – ${m.score.opp} ${esc(team.name)}</p>
    <button class="btn btn-primary" id="ov-again">PLAY AGAIN</button>`);
  $("#ov-again", o).addEventListener("click", () => newRun());
};

async function boot() {
  try {
    app.content = await loadContent();
  } catch (err) {
    $("#boot").innerHTML = `Could not load game data.<br><small>${esc(err.message)}</small><br><small>Serve the folder over HTTP: <code>npx serve .</code></small>`;
    console.error(err);
    return;
  }
  app.court = createCssCourt($("#css-court"));
  app.game = createGame(app);
  newRun();
}

boot();
