// Contextual tutorial for the first match: short coach tips + highlights.
// Uses the normal seeded draws; advances on real player actions; skippable any time.
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
    advanceOn: (ev) => ev.type === "openness" || ev.type === "shot",
  },
  {
    id: "shot",
    title: "TAKE THE SHOT",
    text: "<b class='y'>Shot</b> cards score. The big <b>%</b> is your live chance to make it. One shot per turn. Let it fly!",
    fallback: "No Shot card in hand? End the turn to draw 5 new cards.",
    cardType: "Shot",
    highlight: [],
    advanceOn: (ev) => ev.type === "shot" || ev.type === "opp_attempt",
  },
  {
    id: "defense",
    title: "DEFEND",
    text: "Top right: what the opponent will try next. <b class='b'>Defense</b> cards add <b class='b'>CONTEST</b> and cut their %.",
    fallback: "No Defense card right now? Your lineup still contests a little every turn.",
    cardType: "Defense",
    highlight: [".intent-box", ".bar.contest"],
    advanceOn: (ev) => ev.type === "contest" || ev.type === "steal_set" || ev.type === "opp_attempt",
  },
  {
    id: "clock",
    title: "BEAT THE CLOCK",
    text: "Each card costs seconds from the <b>24s shot clock</b>. When you're done, hit <b>END TURN</b>. Then they shoot. First to 15 wins!",
    cardType: null,
    highlight: [".shotclock", "#btn-endturn"],
    advanceOn: (ev) => ev.type === "opp_attempt",
  },
];

export function createTutorial(app) {
  let index = -1; // -1 = inactive
  let box = null;

  function active() {
    return index >= 0 && index < STEPS.length;
  }

  function clearHighlights() {
    for (const el of $$(".tut-hl")) el.classList.remove("tut-hl");
  }

  function stop(markDone = true) {
    index = -1;
    clearHighlights();
    if (box) box.remove();
    box = null;
    if (markDone) app.tutorialDone = true;
  }

  function start() {
    if (app.tutorialDone) return;
    index = 0;
    draw();
  }

  function next() {
    index++;
    if (index >= STEPS.length) stop();
    else draw();
  }

  function draw() {
    clearHighlights();
    if (!active()) return;
    const run = app.run;
    const m = run?.match;
    if (!m || m.over) return stop(false);
    const step = STEPS[index];
    const court = $("#g-court");
    if (!box) {
      box = document.createElement("div");
      box.className = "tut-box";
      court.appendChild(box);
      box.addEventListener("click", (e) => {
        if (e.target.dataset.act === "next") next();
        else if (e.target.dataset.act === "skip") stop();
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
    box.innerHTML = `
      <div class="tut-head"><span class="tut-step">TIP ${index + 1}/${STEPS.length}</span><b>${step.title}</b></div>
      <p>${step.text}</p>
      ${!hasCard && step.fallback ? `<p class="tut-fallback">${step.fallback}</p>` : ""}
      <div class="tut-actions">
        <button class="btn btn-small" data-act="skip">Skip tips</button>
        <button class="btn btn-small btn-primary" data-act="next">${index === STEPS.length - 1 ? "GOT IT" : "NEXT"}</button>
      </div>`;
  }

  return {
    start,
    stop,
    active,
    onEvent(ev) {
      if (!active()) return;
      if (ev.type === "match_end") return stop();
      if (STEPS[index].advanceOn(ev)) {
        index++;
        if (index >= STEPS.length) stop();
      }
    },
    onRender() {
      if (active()) draw();
    },
  };
}
