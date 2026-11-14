// CSS half-court: the always-available court (and the fallback if Three.js fails).
// Same interface as the Three.js court: setTeams(), shoot(), setVisible().
import { esc } from "./dom.js";
import { generatePlayerAvatar } from "./avatar.js";

// Offense spots (x%, y%) per lineup slot; hoop is top-centre.
const SPOTS = [
  [20, 58],
  [80, 58],
  [37, 33],
  [50, 82],
  [64, 35],
];
const HOOP = [50, 13.5];
const lerp = (a, b, t) => a + (b - a) * t;

export function createCssCourt(host) {
  host.innerHTML = `
    <div class="cc-floor">
      <div class="cc-line cc-three"></div>
      <div class="cc-line cc-paint"></div>
      <div class="cc-line cc-ft"></div>
      <div class="cc-line cc-center"></div>
      <div class="cc-backboard"></div>
      <div class="cc-hoop"></div>
    </div>
    <div class="cc-tokens"></div>
    <div class="cc-ball" hidden></div>`;
  const tokens = host.querySelector(".cc-tokens");
  const ball = host.querySelector(".cc-ball");
  const hoop = host.querySelector(".cc-hoop");

  function setTeams(lineup, team) {
    let html = "";
    lineup.forEach((p, i) => {
      const [x, y] = SPOTS[i % SPOTS.length];
      html += `<div class="cc-token me" data-side="player" data-slot="${i}" style="left:${x}%;top:${y}%;--pc:${p.color}" title="${esc(p.name)}">${generatePlayerAvatar(p)}<i class="cc-num">${esc(p.jersey)}</i></div>`;
    });
    SPOTS.forEach(([x, y], i) => {
      const dx = lerp(x, HOOP[0], 0.3);
      const dy = lerp(y, HOOP[1], 0.3);
      const op = (team.players || [])[i];
      html += `<div class="cc-token opp" data-side="opp" data-slot="${i}" style="left:${dx}%;top:${dy}%;--pc:${team.color}" title="${op ? esc(op.name) : ""}">${op ? generatePlayerAvatar(op, { color: team.color }) : ""}</div>`;
    });
    tokens.innerHTML = html;
  }

  /** Animate a shot. Resolves when the ball reaches the rim. */
  function shoot({ side, slot = 0, made, points = 2 }, ms = 700) {
    return new Promise((resolve) => {
      const token = tokens.querySelector(`.cc-token[data-side="${side}"][data-slot="${slot % SPOTS.length}"]`);
      let [x, y] = SPOTS[slot % SPOTS.length];
      if (side === "opp") {
        x = lerp(x, HOOP[0], 0.3);
        y = lerp(y, HOOP[1], 0.3);
      }
      if (token) {
        token.classList.remove("shooting");
        void token.offsetWidth;
        token.classList.add("shooting");
      }
      ball.hidden = false;
      const peak = points === 3 ? 2.1 : 1.7;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
        hoop.classList.remove("hit", "rattle");
        void hoop.offsetWidth;
        hoop.classList.add(made ? "hit" : "rattle");
        const dir = slot % 2 === 0 ? 1 : -1;
        const tail = made
          ? [
              { left: HOOP[0] + "%", top: HOOP[1] + "%", transform: "translate(-50%,-50%) scale(.9)", opacity: 1 },
              { left: HOOP[0] + "%", top: HOOP[1] + 9 + "%", transform: "translate(-50%,-50%) scale(.75)", opacity: 0 },
            ]
          : [
              { left: HOOP[0] + "%", top: HOOP[1] + "%", transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
              { left: HOOP[0] + dir * 16 + "%", top: HOOP[1] + 14 + "%", transform: "translate(-50%,-50%) scale(1.2)", opacity: 0 },
            ];
        try {
          const a2 = ball.animate(tail, { duration: 380, easing: "ease-out" });
          a2.onfinish = () => (ball.hidden = true);
        } catch {
          ball.hidden = true;
        }
        setTimeout(() => (ball.hidden = true), 450);
      };
      try {
        const anim = ball.animate(
          [
            { left: x + "%", top: y + "%", transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
            { left: lerp(x, HOOP[0], 0.55) + "%", top: lerp(y, HOOP[1], 0.55) - 6 + "%", transform: `translate(-50%,-50%) scale(${peak})`, opacity: 1, offset: 0.55 },
            { left: HOOP[0] + "%", top: HOOP[1] + "%", transform: "translate(-50%,-50%) scale(.95)", opacity: 1 },
          ],
          { duration: ms, easing: "linear", fill: "forwards" }
        );
        anim.onfinish = finish;
      } catch {
        /* no WAAPI: skip the animation */
      }
      setTimeout(finish, ms + 80); // safety net: never block gameplay on an animation
    });
  }

  return {
    kind: "css",
    setTeams,
    shoot,
    /** Screen position of a player token, for effects. */
    screenPoint(side, slot) {
      const t = tokens.querySelector(`.cc-token[data-side="${side}"][data-slot="${slot % SPOTS.length}"]`);
      if (!t) return null;
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    setVisible(v) {
      host.classList.toggle("tokens-hidden", !v);
    },
  };
}
