// Entry point: load content, wire the screens, own the `app` object.
import { CONFIG } from "./config.js";
import { buildContent, createRun } from "./engine/gameState.js";
import { startMatch } from "./engine/turnLoop.js";
import { skipReward } from "./engine/rewards.js";
import { randomSeed } from "./engine/rng.js";
import { getTeam } from "./engine/rules.js";
import { $, $$, esc } from "./ui/dom.js";
import { showScreen, showOverlay, hideOverlay, currentScreen } from "./ui/screens.js";
import { createGame } from "./ui/game.js";
import { createCssCourt } from "./ui/cssCourt.js";
import { renderMap } from "./ui/map.js";
import { renderRewards } from "./ui/rewards.js";
import { renderEnd } from "./ui/endscreen.js";
import { createDebug } from "./ui/debug.js";
import { renderTitle, renderHowTo, showHowToOverlay, soundButtonHTML } from "./ui/title.js";
import { createTutorial } from "./ui/tutorial.js";
import { loadManifest } from "./assets.js";

function readMuted() {
  try {
    return localStorage.getItem("fcr_muted") === "1";
  } catch {
    return false;
  }
}

const app = {
  config: CONFIG,
  content: null,
  run: null,
  court: null,
  game: null,
  tutorial: null,
  tutorialDone: false, // per page load: a fresh visitor always gets the tips once
  debug: null,
  audio: null,
  locked: false,
  muted: readMuted(),
  /** Short sound effect (swish, clank, buzzer...). Never throws. */
  sfx(name) {
    try {
      app.audio?.play(name);
    } catch {}
  },
  /** Announcer line: audio if available + on-screen caption. Never throws. */
  announce(name) {
    try {
      app.audio?.announce(name);
    } catch {}
  },
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

app.goTitle = () => {
  hideOverlay();
  app.tutorial?.stop(false);
  renderTitle(app);
  showScreen("title");
  app.audio?.setScene("title");
};

app.goHowTo = () => {
  renderHowTo(app);
  showScreen("howto");
};

app.startRun = (seed = CONFIG.SEED ?? randomSeed()) => {
  app.tutorial?.stop(false);
  app.run = createRun(app.content, CONFIG, seed);
  app.locked = false;
  app.goMap();
};

app.goMap = () => {
  hideOverlay();
  renderMap(app);
  showScreen("map");
  app.audio?.setScene("map");
  app.debug?.render();
};

app.beginMatch = () => {
  hideOverlay();
  startMatch(app.run);
  showScreen("game");
  app.game.begin();
  app.audio?.setScene("game");
  if (app.run.round === 0 && !app.tutorialDone) app.tutorial.start();
  app.debug?.render();
};

app.onMatchEnd = () => {
  const run = app.run;
  app.tutorial?.stop(false);
  if (run.phase === "reward") {
    renderRewards(app);
    showScreen("reward");
  } else {
    renderEnd(app);
    showScreen("end");
  }
  app.audio?.setScene(run.phase);
  app.debug?.render();
};

app.skipReward = () => {
  skipReward(app.run);
  app.goMap();
};

app.toggleMute = () => {
  app.muted = !app.muted;
  try {
    localStorage.setItem("fcr_muted", app.muted ? "1" : "0");
  } catch {}
  for (const b of $$(".sound-toggle")) b.textContent = app.muted ? "🔇" : "🔊";
  app.audio?.setMuted(app.muted);
};

function confirmQuit() {
  const o = showOverlay(`
    <h3 class="ov-title">QUIT THIS RUN?</h3>
    <p>Your tournament progress will be lost.</p>
    <div class="page-actions">
      <button class="btn" id="ov-no">KEEP PLAYING</button>
      <button class="btn btn-primary" id="ov-yes">QUIT TO TITLE</button>
    </div>`);
  $("#ov-no", o).addEventListener("click", hideOverlay);
  $("#ov-yes", o).addEventListener("click", () => app.goTitle());
}

// ---------- 3D court (optional) ----------

async function initThreeCourt() {
  const params = new URLSearchParams(location.search);
  if (!CONFIG.USE_THREE || params.has("css")) return;
  const canvas = $("#three-canvas");
  const cssCourt = app.court;
  try {
    const manifest = await loadManifest();
    const { createThreeCourt } = await import("./scene/court.js");
    const three = await createThreeCourt({ canvas, wrap: $("#g-court"), manifest, config: CONFIG });
    const useCss = () => {
      three.setVisible(false);
      cssCourt.setVisible(true);
      app.court = cssCourt;
      if (app.run?.match) cssCourt.setTeams(app.run.lineup, getTeam(app.run));
    };
    three.onContextLost = useCss;
    cssCourt.setVisible(false);
    three.setVisible(true);
    app.court = three;
    if (app.run?.match) three.setTeams(app.run.lineup, getTeam(app.run));
  } catch (err) {
    canvas.hidden = true;
    cssCourt.setVisible(true);
    app.court = cssCourt;
    console.info("3D court unavailable, using the CSS court:", err?.message || err);
  }
}

/** Victory screen: swap the emoji for assets/models/trophy.glb when it exists. */
app.mountTrophy = async (el) => {
  try {
    if (!CONFIG.USE_THREE || !el) return;
    const manifest = await loadManifest();
    if (!manifest || !manifest.models.has("trophy.glb")) return;
    const { mountTrophy } = await import("./scene/trophy.js");
    await mountTrophy(el, "assets/models/trophy.glb");
  } catch {
    /* keep the emoji */
  }
};

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
  app.tutorial = createTutorial(app);
  app.debug = createDebug(app);

  $("#g-tools").innerHTML = `
    <button class="btn icon-btn" id="tool-help" title="How to play">?</button>
    ${soundButtonHTML(app)}
    <button class="btn icon-btn" id="tool-quit" title="Quit to title">✕</button>`;
  $("#tool-help").addEventListener("click", () => showHowToOverlay(app));
  $("#tool-quit").addEventListener("click", confirmQuit);

  document.addEventListener("click", (e) => {
    if (e.target.closest?.(".sound-toggle")) app.toggleMute();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.matches?.("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "d") app.debug.toggle();
    else if (k === "m") app.toggleMute();
    else if (k === "escape" && !$("#overlay").hidden) hideOverlay();
    else if (k === "enter" && currentScreen() === "title") app.startRun();
  });

  app.goTitle();
  initThreeCourt(); // async, never blocks the game
}

boot();
