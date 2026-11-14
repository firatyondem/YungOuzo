// Game screen controller: input -> engine -> events -> animations -> render.
import { playCard, endTurn } from "../engine/turnLoop.js";
import { canPlay, getTeam } from "../engine/rules.js";
import { $, sleep } from "./dom.js";
import { renderHand } from "./cards.js";
import * as hud from "./hud.js";
import * as fx from "./fx.js";

export function createGame(app) {
  const root = $("#screen-game");
  const handEl = $("#g-hand");
  const endBtn = $("#btn-endturn");
  let gamePointCalled = false;

  function render() {
    const run = app.run;
    if (!run || !run.match) return;
    hud.renderScore(app);
    hud.renderClock(app);
    hud.renderBars(app);
    hud.renderLineup(app);
    hud.renderChem(app);
    hud.renderIntent(app);
    hud.renderLog(app);
    hud.renderPiles(app);
    hud.renderEndHint(app);
    renderHand(app);
    const m = run.match;
    const anyPlayable = m.hand.some((c) => canPlay(run, c.iid).ok);
    endBtn.classList.toggle("pulse", !m.over && (!anyPlayable || m.shotsTaken > 0));
    endBtn.disabled = m.over;
    app.tutorial?.onRender();
  }

  /** Called when a match starts (new court, fresh HUD). */
  function begin() {
    const run = app.run;
    hud.resetScoreMemory();
    gamePointCalled = false;
    app.court?.setTeams(run.lineup, getTeam(run));
    render();
  }

  function setLocked(v) {
    app.locked = v;
    root.classList.toggle("locked", v);
  }

  async function processEvents(events) {
    const run = app.run;
    const cfg = run.config;
    setLocked(true);
    try {
      for (const ev of events) {
        app.tutorial?.onEvent(ev);
        switch (ev.type) {
          case "card_played":
            if (ev.cardType !== "Shot") app.sfx("squeak");
            // Live update of the HUD while the rest of the card resolves.
            hud.renderClock(app);
            break;
          case "shot": {
            const slot = Math.max(0, run.lineup.findIndex((p) => p.id === ev.shooterId));
            await app.court?.shoot({ side: "player", slot, made: ev.made, points: ev.points }, cfg.SHOT_ANIM_MS);
            if (ev.made) {
              const three = ev.points === 3;
              fx.pop(three ? "SPLASH! +3" : "BUCKET! +2", three ? "good big" : "good");
              fx.shake(three ? "hard" : "soft");
              app.sfx("swish");
              app.announce(ev.audio || (three ? "made3" : "made2"));
            } else {
              fx.pop("CLANK!", "bad");
              app.sfx("clank");
              app.announce("miss");
            }
            hud.renderScore(app, ev.score);
            break;
          }
          case "violation":
            fx.pop("SHOT-CLOCK VIOLATION", "bad small");
            app.sfx("buzzer");
            app.announce("shotclock");
            await sleep(650);
            break;
          case "steal":
            if (ev.success) {
              fx.pop("STEAL!", "steal big");
              fx.flash("flash-blue");
              app.announce("steal");
              await sleep(550);
            } else if (ev.blocked) {
              fx.pop("CAN'T STEAL THAT", "bad small");
              await sleep(350);
            }
            break;
          case "opp_attempt": {
            if (!ev.stolen) {
              const slot = run.match.intentIndex % 5;
              await app.court?.shoot({ side: "opp", slot, made: ev.made, points: ev.points }, cfg.OPP_ANIM_MS);
              if (ev.made) {
                fx.pop(`${getTeam(run).name.toUpperCase()} +${ev.points}`, "opp");
                app.sfx("swish");
                app.sfx("crowd");
              } else {
                fx.pop("THEY MISS!", "good small");
                app.sfx("clank");
                if (run.match.contest >= 30) app.announce("block");
              }
            }
            hud.renderScore(app, ev.score);
            await sleep(420);
            break;
          }
          case "match_end":
            fx.pop(ev.winner === "player" ? "YOU WIN!" : "DEFEAT", ev.winner === "player" ? "good big" : "bad big");
            app.sfx("buzzer");
            app.announce(ev.winner === "player" ? "win" : "loss");
            break;
        }
      }
    } catch (err) {
      console.warn("fx error (ignored)", err);
    }
    render();
    const m = run.match;
    if (m && !m.over && !gamePointCalled && (m.score.player >= m.target - 2 || m.score.opp >= m.target - 2)) {
      gamePointCalled = true;
      app.announce("gamepoint");
    }
    if (m && m.over) {
      await sleep(1300);
      setLocked(false);
      app.onMatchEnd();
      return;
    }
    setLocked(false);
  }

  function tryPlay(iid, cardEl) {
    const run = app.run;
    if (app.locked || !run?.match || run.match.over) return;
    const check = canPlay(run, iid);
    if (!check.ok) {
      fx.nudge(cardEl);
      return;
    }
    fx.flyCard(cardEl);
    if (cardEl) cardEl.style.visibility = "hidden";
    const events = playCard(run, iid);
    processEvents(events);
  }

  function tryEndTurn() {
    const run = app.run;
    if (app.locked || !run?.match || run.match.over) return;
    const events = endTurn(run);
    processEvents(events);
  }

  handEl.addEventListener("click", (e) => {
    const cardEl = e.target.closest(".card");
    if (cardEl) tryPlay(cardEl.dataset.iid, cardEl);
  });
  endBtn.addEventListener("click", tryEndTurn);

  document.addEventListener("keydown", (e) => {
    if (root.hidden || e.target.matches?.("input, select, textarea")) return;
    if (!$("#overlay").hidden) return;
    if (e.code === "Space") {
      e.preventDefault();
      tryEndTurn();
    } else if (/^[1-9]$/.test(e.key)) {
      const cardEl = handEl.children[Number(e.key) - 1];
      if (cardEl) tryPlay(cardEl.dataset.iid, cardEl);
    }
  });

  return { render, begin, processEvents };
}
