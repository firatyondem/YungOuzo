// Contextual tutorial for the first match: short coach tips + highlights.
// Uses the normal seeded draws. Each tip is ticked off when the player actually
// does the thing (or presses NEXT); the box always shows the first tip that is
// still open and relevant right now. Skippable at any time.
import { getCard } from "../engine/rules.js";
import { $, $$ } from "./dom.js";

const STEPS = [
  {
    id: "openness",
    title: "GET OPEN",
    text: "<b class='o'>Offense</b> cards build <b class='o'>OPENNESS</b>. Every point is +1% on your next shot. Play one!",
    fallback: "No Offense card this turn? That's fine, go straight to your shot.",
    cardType: "Offense",
    highlight: [".bar.openness"],
    beforeShotOnly: true,
    doneOn: (ev) => ev.type === "openness" || (ev.type === "card_played" && ev.cardType === "Offense"),
  },
  {
    id: "shot",
    title: "TAKE THE SHOT",
    text: "<b class='y'>Shot</b> cards score. The big <b>%</b> is your live chance to make it. One shot per turn. Let it fly!",
    fallback: "No Shot card in hand? End the turn to draw new cards.",
    cardType: "Shot",
    highlight: [],
    beforeShotOnly: true,
    doneOn: (ev) => ev.type === "shot",
  },
  {
    id: "defense",
    title: "DEFEND",
    text: "Top right: what the opponent will try next. <b class='b'>Defense</b> cards add <b class='b'>CONTEST</b> and cut their %.",
    fallback: "No Defense card right now? Your lineup still contests a little every turn.",
    cardType: "Defense",
    highlight: [".intent-box", ".bar.contest"],
    doneOn: (ev) => ev.type === "contest" || ev.type === "steal_set" || (ev.type === "card_played" && ev.cardType === "Defense"),
  },
  {
    id: "clock",
    title: "BEAT THE CLOCK",
    text: "Cards cost 8, 16 or 24 seconds of the <b>24s shot clock</b>, so you play 2 or 3 a turn, never the whole hand. Up to 8 unspent seconds carry over, and you can <b>HOLD</b> one card. Then hit <b>END TURN</b> and they shoot. First to 15 wins!",
    cardType: null,
    highlight: [".shotclock", "#btn-endturn"],
    // Ending a turn only counts once this tip has actually been on screen.
    doneOn: (ev, shown) => ev.type === "opp_attempt" && shown,
  },
];
const MAX_TURNS_PER_TIP = 2; // never nag: a tip retires after being shown on 2 turns

export function createTutorial(app) {
  let running = false;
  let box = null;
  let done = new Set();
  let seenTurns = {}; // step id -> Set of turn numbers it was displayed on
  let shownId = null;

  function clearHighlights() {
    for (const el of $$(".tut-hl")) el.classList.remove("tut-hl");
  }

  function hideBox() {
    clearHighlights();
    if (box) box.remove();
    box = null;
    shownId = null;
  }

  function stop(markDone = true) {
    running = false;
    hideBox();
    if (markDone) app.tutorialDone = true;
  }

  function start() {
    if (app.tutorialDone) return;
    running = true;
    done = new Set();
    seenTurns = {};
    draw();
  }

  /** First open tip that makes sense in the current state. */
  function pick(m) {
    for (const step of STEPS) {
      if (done.has(step.id)) continue;
      if (step.beforeShotOnly && m.shotsTaken > 0) continue;
      const turns = (seenTurns[step.id] ??= new Set());
      if (!turns.has(m.turn) && turns.size >= MAX_TURNS_PER_TIP) {
        done.add(step.id);
        continue;
      }
      return step;
    }
    return null;
  }

  function draw() {
    if (!running) return;
    const run = app.run;
    const m = run?.match;
    if (!m || m.over) return stop(false);
    if (done.size >= STEPS.length) return stop();
    const step = pick(m);
    if (done.size >= STEPS.length) return stop();
    if (!step) return hideBox(); // nothing relevant right now; comes back next turn
    clearHighlights();
    seenTurns[step.id].add(m.turn);
    shownId = step.id;
    if (!box) {
      box = document.createElement("div");
      box.className = "tut-box";
      ($("#screen-game .left-col") || $("#g-court")).appendChild(box);
      box.addEventListener("click", (e) => {
        const act = e.target.dataset.act;
        if (act === "skip") stop();
        else if (act === "next" && shownId) {
          done.add(shownId);
          draw();
        }
      });
    }
    // Highlight matching cards in hand + HUD elements.
    let hasCard = !step.cardType;
    if (step.cardType) {
      m.hand.forEach((inst, i) => {
        if (getCard(run, inst).type === step.cardType) {
          hasCard = true;
          $("#g-hand").children[i]?.classList.add("tut-hl");
        }
      });
    }
    for (const sel of step.highlight) $(sel)?.classList.add("tut-hl");
    const n = STEPS.indexOf(step) + 1;
    const last = done.size === STEPS.length - 1;
    box.innerHTML = `
      <div class="tut-head"><span class="tut-step">TIP ${n}/${STEPS.length}</span><b>${step.title}</b></div>
      <p>${step.text}</p>
      ${!hasCard && step.fallback ? `<p class="tut-fallback">${step.fallback}</p>` : ""}
      <div class="tut-actions">
        <button class="btn btn-small" data-act="skip">Skip tips</button>
        <button class="btn btn-small btn-primary" data-act="next">${last ? "GOT IT" : "NEXT"}</button>
      </div>`;
  }

  return {
    start,
    stop,
    active: () => running,
    onEvent(ev) {
      if (!running) return;
      if (ev.type === "match_end") return stop();
      for (const step of STEPS) {
        if (!done.has(step.id) && step.doneOn(ev, shownId === step.id)) done.add(step.id);
      }
    },
    onRender() {
      if (running) draw();
    },
  };
}
