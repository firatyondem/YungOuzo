// Game screen controller: input -> engine -> events -> animations -> render.
import { playCard, endTurn } from "../engine/turnLoop.js";
import { canPlay, getTeam } from "../engine/rules.js";
import { $, sleep } from "./dom.js";
import { renderHand, resetHandMemory, layoutHand } from "./cards.js";
import * as hud from "./hud.js";
import * as fx from "./fx.js";

export function createGame(app) {
  const root = $("#screen-game");
  const handEl = $("#g-hand");
  const endBtn = $("#btn-endturn");
  let gamePointCalled = false;
  let makeStreak = 0; // consecutive made shots (presentation only: "ON FIRE")

  function render() {
    const run = app.run;
    if (!run || !run.match) return;
    hud.renderScore(app);
    hud.renderClock(app);
    hud.renderBars(app);
    hud.renderLineup(app);
    hud.renderChem(app);
    hud.renderIntent(app);
    hud.renderOpponent(app);
    hud.renderLog(app);
    hud.renderPiles(app);
    hud.renderEndHint(app);
    renderHand(app);
    const m = run.match;
    const anyPlayable = m.hand.some((c) => canPlay(run, c.iid).ok);
    endBtn.classList.toggle("pulse", !m.over && (!anyPlayable || m.shotsTaken > 0));
    endBtn.disabled = m.over;
    hud.setOnFire(makeStreak >= 3);
    app.tutorial?.onRender();
  }

  /** Called when a match starts (new court, fresh HUD). */
  function begin() {
    const run = app.run;
    hud.resetScoreMemory();
    resetHandMemory();
    gamePointCalled = false;
    makeStreak = 0;
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
              makeStreak++;
              const three = ev.points >= 3;
              fx.pop(three ? `SPLASH! +${ev.points}` : "BUCKET! +2", three ? "good big" : "good");
              fx.shake(three ? "hard" : "soft");
              if (three) fx.flash("flash-crowd");
              app.sfx("swish");
              if (three) app.sfx("crowd");
              app.announce(ev.audio || (three ? "made3" : "made2"));
            } else {
              makeStreak = 0;
              fx.pop("CLANK!", "bad");
              app.sfx("clank");
              app.announce("miss");
            }
            hud.renderScore(app, ev.score);
            hud.setOnFire(makeStreak >= 3);
            break;
          }
          case "picked_off":
            fx.pop("PICKED OFF!", "bad small");
            fx.flash("flash-blue");
            app.sfx("clank");
            break;
          case "negated":
            fx.pop("SWITCHED! NO OPENNESS", "bad small");
            break;
          case "hot_start":
            fx.pop("THEY ARE HEATING UP", "bad small");
            await sleep(500);
            break;
          case "phase_shift":
            fx.banner(ev.name, ev.text);
            app.sfx("buzzer");
            await sleep(1900);
            break;
          case "adapt":
            fx.pop("COACH ADJUSTS", "bad small");
            await sleep(600);
            break;
          case "cooled":
            fx.pop("COOLED OFF", "good small");
            await sleep(400);
            break;
          case "box_out_stop":
            fx.pop("BOXED OUT!", "good small");
            await sleep(450);
            break;
          case "second_chance":
            fx.pop(ev.made ? "SECOND CHANCE +2" : "PUTBACK MISSES", ev.made ? "opp" : "good small");
            if (ev.made) app.sfx("swish");
            hud.renderScore(app, ev.score);
            await sleep(550);
            break;
          case "violation":
            makeStreak = 0;
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
              const slot = (((run.match.intentIndex - 1) % 5) + 5) % 5; // the intent that was just resolved
              await app.court?.shoot({ side: "opp", slot, made: ev.made, points: ev.points }, cfg.OPP_ANIM_MS);
              if (ev.made) {
                fx.pop(`${getTeam(run).name.toUpperCase()} +${ev.points + (ev.extra || 0)}${ev.extra ? " AND-ONE" : ""}`, "opp");
                app.sfx("swish");
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
            if (ev.series) fx.pop(`SERIES ${ev.series.wins}-${ev.series.losses}`, "small");
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
      hud.spotlightActor(null);
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
    // The card flies to the player who performs it (or to mid-court for team plays).
    let target = null;
    const actor = cardEl?.dataset.actor;
    if (actor) {
      const slot = run.lineup.findIndex((p) => p.id === actor);
      if (slot >= 0) {
        try {
          target = app.court?.screenPoint?.("player", slot) || null;
        } catch {
          target = null;
        }
      }
    }
    fx.flyCard(cardEl, target);
    if (cardEl) cardEl.style.visibility = "hidden";
    hud.spotlightActor(null);
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

  // Hover: tilt the card toward the cursor, move the foil highlight, and
  // spotlight the lineup tile of the player who will perform the card.
  let hovered = null;
  handEl.addEventListener("mousemove", (e) => {
    const cardEl = e.target.closest(".card");
    if (cardEl !== hovered) {
      if (hovered) {
        hovered.style.removeProperty("--rx");
        hovered.style.removeProperty("--ry");
      }
      hovered = cardEl;
      hud.spotlightActor(cardEl ? cardEl.dataset.actor : null);
    }
    if (!cardEl) return;
    const r = cardEl.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    cardEl.style.setProperty("--ry", `${((px - 0.5) * 16).toFixed(1)}deg`);
    cardEl.style.setProperty("--rx", `${((0.5 - py) * 12).toFixed(1)}deg`);
    cardEl.style.setProperty("--mx", `${(px * 100).toFixed(0)}%`);
    cardEl.style.setProperty("--my", `${(py * 100).toFixed(0)}%`);
  });
  handEl.addEventListener("mouseleave", () => {
    if (hovered) {
      hovered.style.removeProperty("--rx");
      hovered.style.removeProperty("--ry");
    }
    hovered = null;
    hud.spotlightActor(null);
  });
  window.addEventListener("resize", () => {
    if (!root.hidden) layoutHand(handEl);
  });

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
