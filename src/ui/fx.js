// Non-blocking visual feedback: floating text, screen shake, flashes, card fly
// with a particle burst, confetti. Nothing here ever blocks input, and every
// animation is under 400ms except the celebratory text and confetti.
import { $ } from "./dom.js";

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Big floating text over the court. cls: good | bad | opp | steal | big | small */
export function pop(text, cls = "") {
  const layer = $("#g-fx");
  if (!layer) return;
  const el = document.createElement("div");
  el.className = `fx-pop ${cls}`;
  el.textContent = text;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

/** Screen shake scaled by the points scored (2 = soft, 3+ = hard). */
export function shake(strength = "soft") {
  const el = $("#screen-game");
  if (!el || reduced()) return;
  el.classList.remove("shake-soft", "shake-hard");
  void el.offsetWidth; // restart the animation
  el.classList.add(strength === "hard" ? "shake-hard" : "shake-soft");
  setTimeout(() => el.classList.remove("shake-soft", "shake-hard"), 500);
}

export function flash(cls = "flash-white") {
  const court = $("#g-court");
  if (!court || reduced()) return;
  const el = document.createElement("div");
  el.className = `fx-flash ${cls}`;
  court.appendChild(el);
  setTimeout(() => el.remove(), 450);
}

/** Type-coloured particles bursting from a screen point. */
export function burst(x, y, color = "#FFD23F", count = 12) {
  if (reduced()) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("i");
    s.className = "fx-spark";
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const d = 40 + Math.random() * 50;
    s.style.left = x - 5 + "px";
    s.style.top = y - 5 + "px";
    s.style.setProperty("--c", i % 3 === 0 ? "#FFF8EC" : color);
    s.style.setProperty("--dx", Math.cos(a) * d + "px");
    s.style.setProperty("--dy", Math.sin(a) * d + "px");
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 420);
  }
}

/**
 * Clone a card, fly it to a target point (default: the middle of the court)
 * and burst into particles in the card's type colour.
 */
export function flyCard(cardEl, target = null) {
  const court = $("#g-court");
  if (!cardEl || !court) return;
  const from = cardEl.getBoundingClientRect();
  const to = court.getBoundingClientRect();
  const tx = target ? target.x : to.left + to.width / 2;
  const ty = target ? target.y : to.top + to.height * 0.55;
  const color = getComputedStyle(cardEl).getPropertyValue("--tc").trim() || "#FFD23F";
  if (reduced()) return;
  const ghost = cardEl.cloneNode(true);
  ghost.classList.add("card-ghost");
  ghost.classList.remove("unplayable", "dealt", "kbd");
  Object.assign(ghost.style, {
    position: "fixed",
    left: from.left + "px",
    top: from.top + "px",
    width: from.width + "px",
    height: from.height + "px",
    margin: 0,
    zIndex: 60,
    pointerEvents: "none",
    transform: "none",
    animation: "none",
  });
  document.body.appendChild(ghost);
  const dx = tx - (from.left + from.width / 2);
  const dy = ty - (from.top + from.height / 2);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ghost.remove();
    burst(tx, ty, color);
  };
  try {
    const anim = ghost.animate(
      [
        { transform: "translate(0,0) scale(1.05)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.22) rotate(10deg)`, opacity: 0.9 },
      ],
      { duration: 300, easing: "cubic-bezier(.3,.7,.3,1)" }
    );
    anim.onfinish = finish;
  } catch {
    /* no WAAPI */
  }
  setTimeout(finish, 380);
}

export function nudge(el) {
  if (!el) return;
  el.classList.remove("nudge");
  void el.offsetWidth;
  el.classList.add("nudge");
}

const CONFETTI_COLORS = ["#FF6B1A", "#FFD23F", "#FFF8EC", "#2EA8FF", "#1FD18A", "#FF3B3B", "#9B5CFF"];

/** Falling confetti inside `host` (title screen, championship). Pure CSS animation. */
export function confetti(host, count = 60) {
  if (!host || reduced()) return;
  host.querySelector(".confetti")?.remove();
  const box = document.createElement("div");
  box.className = "confetti";
  let html = "";
  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-random spread: purely decorative.
    const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    html += `<i style="--x:${(r(1) * 100).toFixed(1)}%;--c:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};--t:${(4 + r(2) * 5).toFixed(2)}s;--dl:${(-r(3) * 9).toFixed(2)}s;--r:${Math.round(r(4) * 360)}deg"></i>`;
  }
  box.innerHTML = html;
  host.prepend(box);
}
