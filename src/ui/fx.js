// Non-blocking visual feedback: floating text, screen shake, flashes, card fly.
import { $ } from "./dom.js";

/** Big floating text over the court. cls: good | bad | opp | steal | big */
export function pop(text, cls = "") {
  const layer = $("#g-fx");
  if (!layer) return;
  const el = document.createElement("div");
  el.className = `fx-pop ${cls}`;
  el.textContent = text;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

export function shake(strength = "soft") {
  const el = $("#screen-game");
  if (!el) return;
  el.classList.remove("shake-soft", "shake-hard");
  void el.offsetWidth; // restart the animation
  el.classList.add(strength === "hard" ? "shake-hard" : "shake-soft");
  setTimeout(() => el.classList.remove("shake-soft", "shake-hard"), 500);
}

export function flash(cls = "flash-white") {
  const court = $("#g-court");
  if (!court) return;
  const el = document.createElement("div");
  el.className = `fx-flash ${cls}`;
  court.appendChild(el);
  setTimeout(() => el.remove(), 450);
}

/** Clone a card element and fly it toward the court. */
export function flyCard(cardEl) {
  const court = $("#g-court");
  if (!cardEl || !court) return;
  const from = cardEl.getBoundingClientRect();
  const to = court.getBoundingClientRect();
  const ghost = cardEl.cloneNode(true);
  ghost.classList.add("card-ghost");
  ghost.classList.remove("unplayable");
  Object.assign(ghost.style, {
    position: "fixed",
    left: from.left + "px",
    top: from.top + "px",
    width: from.width + "px",
    height: from.height + "px",
    margin: 0,
    zIndex: 60,
    pointerEvents: "none",
  });
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height * 0.55 - (from.top + from.height / 2);
  const anim = ghost.animate(
    [
      { transform: "translate(0,0) scale(1.05)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.35) rotate(8deg)`, opacity: 0 },
    ],
    { duration: 420, easing: "cubic-bezier(.3,.7,.3,1)" }
  );
  anim.onfinish = () => ghost.remove();
  setTimeout(() => ghost.remove(), 600);
}

export function nudge(el) {
  if (!el) return;
  el.classList.remove("nudge");
  void el.offsetWidth;
  el.classList.add("nudge");
}
