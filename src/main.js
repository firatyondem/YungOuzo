// Entry point: load content, wire the screens, own the `app` object.
import { CONFIG } from "./config.js";
import { buildContent, createRun } from "./engine/gameState.js";
import { startMatch } from "./engine/turnLoop.js";
import { skipReward } from "./engine/rewards.js";
import { randomSeed } from "./engine/rng.js";
import { $, esc } from "./ui/dom.js";
import { showScreen, hideOverlay } from "./ui/screens.js";
import { createGame } from "./ui/game.js";
import { createCssCourt } from "./ui/cssCourt.js";
import { renderMap } from "./ui/map.js";
import { renderRewards } from "./ui/rewards.js";
import { renderEnd } from "./ui/endscreen.js";
import { createDebug } from "./ui/debug.js";

const app = {
  config: CONFIG,
  content: null,
  run: null,
  court: null,
  game: null,
  tutorial: null,
  debug: null,
  locked: false,
  sfx() {},
  announce() {},
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

// ---------- Flow ----------

app.startRun = (seed = CONFIG.SEED ?? randomSeed()) => {
  app.run = createRun(app.content, CONFIG, seed);
  app.locked = false;
  app.goMap();
};

app.goMap = () => {
  hideOverlay();
  renderMap(app);
  showScreen("map");
  app.debug?.render();
};

app.beginMatch = () => {
  hideOverlay();
  startMatch(app.run);
  showScreen("game");
  app.game.begin();
  app.debug?.render();
};

app.onMatchEnd = () => {
  const run = app.run;
  if (run.phase === "reward") {
    renderRewards(app);
    showScreen("reward");
  } else {
    renderEnd(app);
    showScreen("end");
  }
  app.debug?.render();
};

app.skipReward = () => {
  skipReward(app.run);
  app.goMap();
};

app.goTitle = () => app.startRun();

// ---------- Boot ----------

async function boot() {
  try {
    app.content = await loadContent();
  } catch (err) {
    $("#boot").innerHTML = `<div>Could not load game data.<br><small>${esc(err.message)}</small><br><small>Serve the folder over HTTP: <code>npx serve .</code></small></div>`;
    console.error(err);
    return;
  }
  app.court = createCssCourt($("#css-court"));
  app.game = createGame(app);
  app.debug = createDebug(app);

  document.addEventListener("keydown", (e) => {
    if (e.target.matches?.("input, select, textarea")) return;
    if (e.key === "d" || e.key === "D") app.debug.toggle();
  });

  app.startRun();
}

boot();
