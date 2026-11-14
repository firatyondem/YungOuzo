// Procedural chalkboard play diagrams, generated from card DATA (type, tags,
// effects, requirements) - there is no per-card drawing code. O = your players,
// X = defenders, solid arrow = movement, dashed arrow = pass, dotted arc = shot.
// Pure string output (viewBox 0 0 160 100, hoop at top centre).
const CHALK = "#FFF8EC";
const r1 = (n) => Math.round(n * 10) / 10;

function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const HOOP = [80, 13];

function court() {
  return (
    `<g fill="none" stroke="${CHALK}" stroke-opacity="0.34" stroke-width="1.4" stroke-linecap="round">` +
    `<path d="M6 4h148"/><path d="M62 4v38h36V4"/><path d="M68 42a12 12 0 0 0 24 0"/>` +
    `<path d="M20 4v13A62 62 0 0 0 140 17V4"/><path d="M72 7.500h16"/>` +
    `</g><circle cx="${HOOP[0]}" cy="${HOOP[1]}" r="3.400" fill="none" stroke="${CHALK}" stroke-opacity="0.75" stroke-width="1.600"/>`
  );
}

const O = (x, y, ball = false) =>
  `<circle cx="${r1(x)}" cy="${r1(y)}" r="5.400" fill="${ball ? CHALK : "none"}" fill-opacity="${ball ? 0.9 : 0}" stroke="${CHALK}" stroke-width="2"/>`;
const X = (x, y) =>
  `<path d="M${r1(x - 4.4)} ${r1(y - 4.4)}l8.800 8.800M${r1(x + 4.4)} ${r1(y - 4.4)}l-8.800 8.800" fill="none" stroke="${CHALK}" stroke-width="2.200" stroke-linecap="round"/>`;

/** Curved arrow from a to b. kind: "move" (solid) | "pass" (dashed) | "shot" (dotted). */
function arrow(a, b, { kind = "move", bend = 0.18, color = CHALK, head = true } = {}) {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = (x1 + x2) / 2 - dy * bend;
  const cy = (y1 + y2) / 2 + dx * bend;
  const dash = kind === "pass" ? ' stroke-dasharray="5 4"' : kind === "shot" ? ' stroke-dasharray="1.200 4.200"' : "";
  const w = kind === "shot" ? 2.4 : 2.2;
  let s = `<path d="M${r1(x1)} ${r1(y1)}Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${dash}/>`;
  if (head) {
    const ang = Math.atan2(y2 - cy, x2 - cx);
    const L = 6.2;
    const p = (da) => `${r1(x2 - L * Math.cos(ang + da))} ${r1(y2 - L * Math.sin(ang + da))}`;
    s += `<path d="M${p(0.5)}L${r1(x2)} ${r1(y2)}L${p(-0.5)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return s;
}

const target = (color) =>
  `<circle cx="${HOOP[0]}" cy="${HOOP[1]}" r="7.500" fill="none" stroke="${color}" stroke-width="2"/>`;
const screenBar = (x, y, horizontal = true) =>
  horizontal
    ? `<path d="M${r1(x - 7)} ${r1(y)}h14" stroke="${CHALK}" stroke-width="3" stroke-linecap="round"/>`
    : `<path d="M${r1(x)} ${r1(y - 7)}v14" stroke="${CHALK}" stroke-width="3" stroke-linecap="round"/>`;
const burst = (x, y, color) => {
  let s = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    s += `M${r1(x + Math.cos(a) * 4)} ${r1(y + Math.sin(a) * 4)}L${r1(x + Math.cos(a) * 9)} ${r1(y + Math.sin(a) * 9)}`;
  }
  return `<path d="${s}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
};

/**
 * Diagram for a card. `accent` is the card's type colour.
 * Reads: card.type, card.tags, card.effects (+ modifiers/conditions), card.requires.
 */
export function playDiagramSVG(card, accent = "#FFD23F") {
  const c = card && typeof card === "object" ? card : {};
  const effects = Array.isArray(c.effects) ? c.effects : [];
  const tags = Array.isArray(c.tags) ? c.tags : [];
  const reqs = Array.isArray(c.requires) ? c.requires : [];
  const eff = (t) => effects.find((e) => e && e.type === t);
  const req = (t) => reqs.some((q) => q && q.type === t);
  const side = hash(c.id || c.name || "") % 2 ? 1 : -1; // mirror for variety
  const mx = (x) => 80 + side * x; // x offset from the middle
  const parts = [court()];

  const shoot = eff("shoot");
  if (shoot) {
    const mods = Array.isArray(shoot.modifiers) ? shoot.modifiers : [];
    const mod = (t) => mods.find((m) => m && m.type === t);
    const three = shoot.points >= 3;
    parts.push(target(accent));
    if (req("archetype_in_lineup") && !three) {
      // Lob: passer on the wing, finisher at the rim.
      const passer = [mx(48), 62];
      const big = [mx(-12), 30];
      parts.push(O(...passer, true), O(...big), X(mx(40), 52));
      parts.push(arrow(passer, [mx(-3), 19], { kind: "pass", bend: -0.2 }));
      parts.push(arrow(big, [mx(-4), 19], { bend: 0.3, color: accent }));
    } else if (req("missed_shot_this_turn")) {
      // Putback: crash the glass.
      const p = [mx(16), 34];
      parts.push(O(...p), X(mx(8), 24));
      parts.push(arrow([mx(4), 16], [mx(12), 26], { kind: "shot", head: false }));
      parts.push(arrow(p, [mx(3), 17], { bend: -0.25, color: accent }));
    } else if (tags.includes("Drive")) {
      const start = [mx(50), 64];
      parts.push(O(...start, true), X(mx(34), 50), O(mx(-50), 58), O(mx(-18), 84));
      parts.push(arrow(start, [mx(5), 20], { bend: side * 0.22, color: accent }));
    } else if (three) {
      let spot = [mx(52), 60];
      if (mod("ignore_defense")) {
        // Step-back: retreat, then shoot.
        const from = [mx(30), 56];
        spot = [mx(46), 74];
        parts.push(X(mx(24), 46));
        parts.push(arrow(from, spot, { bend: side * -0.3 }));
        parts.push(O(...from, true));
      } else if (mods.some((m) => m && m.condition && m.condition.type === "tag_played_this_turn")) {
        // Catch and shoot: a pass arrives first.
        const passer = [mx(-10), 84];
        parts.push(O(...passer, true), X(mx(34), 48));
        parts.push(arrow(passer, [spot[0] - side * 7, spot[1] + 4], { kind: "pass", bend: side * 0.12 }));
      } else if (mod("bonus")) {
        spot = [mx(66), 14]; // corner
        parts.push(X(mx(46), 22));
      } else {
        parts.push(X(mx(38), 50));
      }
      parts.push(O(...spot));
      parts.push(arrow(spot, HOOP, { kind: "shot", bend: side * -0.34, color: accent }));
    } else {
      const spot = [mx(26), 46];
      parts.push(O(...spot, true), X(mx(18), 36));
      parts.push(arrow(spot, HOOP, { kind: "shot", bend: side * -0.4, color: accent }));
    }
  } else if (c.type === "Defense" || eff("steal_attempt") || eff("on_opponent_fail")) {
    if (eff("steal_attempt")) {
      const a = [mx(-40), 62];
      const b = [mx(40), 62];
      const mid = [80, 56];
      parts.push(O(...a, true), O(...b));
      parts.push(arrow(a, b, { kind: "pass", bend: 0.14 }));
      parts.push(arrow([80, 34], [80, 50], { bend: 0, color: accent }));
      parts.push(X(80, 30), burst(mid[0], mid[1] + 3, accent));
    } else if (eff("on_opponent_fail")) {
      const o = [mx(14), 36];
      const x = [mx(7), 25];
      parts.push(O(...o), X(...x));
      parts.push(`<path d="M${r1(x[0] - 9)} ${r1(x[1] + 9)}A11 11 0 0 0 ${r1(x[0] + 9)} ${r1(x[1] + 9)}" fill="none" stroke="${accent}" stroke-width="2.600" stroke-linecap="round"/>`);
      parts.push(arrow([mx(-2), 16], [mx(-12), 30], { kind: "shot", head: false }));
    } else {
      const value = (eff("add_contest") || {}).value || 0;
      const shooter = [mx(50), 60];
      parts.push(O(...shooter, true));
      parts.push(arrow([mx(14), 34], [mx(40), 54], { bend: side * 0.14, color: accent }));
      parts.push(X(mx(43), 55));
      if (value >= 30) {
        parts.push(arrow([mx(4), 62], [mx(38), 68], { bend: side * -0.14, color: accent }));
        parts.push(X(mx(42), 68));
      }
      if (value >= 45) parts.push(burst(shooter[0] + side * 4, shooter[1] - 12, accent));
      else parts.push(`<path d="M${r1(shooter[0] - 8)} ${r1(shooter[1] - 9)}h16" stroke="${accent}" stroke-width="2.600" stroke-linecap="round"/>`);
    }
  } else if (c.type === "Offense") {
    if (req("opponent_last_failed")) {
      // Transition: sprint the floor.
      parts.push(O(mx(-30), 92, true), O(mx(26), 88), X(mx(-48), 96));
      parts.push(arrow([mx(-30), 88], [mx(-6), 22], { bend: side * -0.14, color: accent }));
      parts.push(arrow([mx(26), 84], [mx(44), 40], { bend: side * 0.1 }));
    } else if (tags.includes("Screen") || (eff("add_openness") && eff("add_contest"))) {
      // Screen action: handler uses the pick, screener rolls.
      const handler = [mx(-6), 82];
      const screener = [mx(14), 62];
      parts.push(O(...handler, true), O(...screener), X(mx(2), 70), screenBar(mx(10), 68));
      parts.push(arrow(handler, [mx(40), 46], { bend: side * -0.34, color: accent }));
      parts.push(arrow(screener, [mx(4), 24], { kind: "pass", bend: side * 0.2 }));
    } else if (tags.includes("Pass")) {
      const a = [mx(-50), 58];
      const b = [mx(0), 84];
      const d = [mx(50), 58];
      const two = ((eff("add_openness") || {}).value || 0) >= 10;
      parts.push(O(...a, true), O(...b), X(mx(-36), 46));
      parts.push(arrow(a, [b[0] - side * 7, b[1] - 3], { kind: "pass", bend: side * 0.2, color: accent }));
      if (two) {
        parts.push(O(...d), X(mx(30), 44));
        parts.push(arrow([b[0] + side * 7, b[1] - 3], [d[0] - side * 5, d[1] + 5], { kind: "pass", bend: side * 0.2, color: accent }));
      }
      if (eff("gain_energy")) parts.push(arrow(a, [mx(-8), 22], { bend: side * 0.2 })); // give and go: cut
    } else {
      // Isolation: clear out and attack one-on-one.
      parts.push(O(mx(0), 78, true), X(mx(0), 64), O(mx(64), 14), O(mx(-64), 14), O(mx(56), 62), O(mx(-56), 62));
      parts.push(arrow([mx(0), 73], [mx(22), 50], { bend: side * -0.3, color: accent }));
    }
  } else if (c.type === "Buff") {
    const spot = [mx(52), 62];
    parts.push(O(...spot, true), target(accent));
    for (const bend of [-0.5, -0.3, -0.12]) parts.push(arrow(spot, HOOP, { kind: "shot", bend: side * bend, color: accent, head: bend === -0.3 }));
  } else {
    // Utility: huddle around the clipboard.
    const cx = 80;
    const cy = 56;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      parts.push(O(cx + Math.cos(a) * 26, cy + Math.sin(a) * 22));
    }
    parts.push(`<rect x="${cx - 9}" y="${cy - 11}" width="18" height="22" rx="2.500" fill="none" stroke="${accent}" stroke-width="2.200"/>`);
    parts.push(`<path d="M${cx - 4.5} ${cy - 4}h9M${cx - 4.5} ${cy + 1}h9M${cx - 4.5} ${cy + 6}h5" stroke="${accent}" stroke-width="1.800" stroke-linecap="round"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" class="play-diagram" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${parts.join("")}</svg>`;
}
