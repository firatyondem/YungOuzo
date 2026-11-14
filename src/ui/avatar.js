// 2D player portraits, generated locally as SVG strings from the player's `look`.
// No images, no network requests. Pure string building (also runs in Node).
// The same look data drives the 3D figurines (scene/figurine.js).
import { portraitHTML } from "./images.js";
import { normalizeLook, safeColor, SKIN_TONES, HAIR_COLOR } from "../look.js";

const INK = "#0a0c11";
const OUT = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;

const escAttr = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two hex colours (t = 0 -> a, t = 1 -> b). */
export function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const r1 = (n) => Math.round(n * 10) / 10;

// Proportions per build: shoulder half-width, neck half-width, head radii, head centre y, arm radius.
const BUILDS = {
  lean: { sh: 30, nw: 6.2, rx: 16, ry: 19.5, cy: 43, arm: 8 },
  average: { sh: 34, nw: 7.5, rx: 17, ry: 20, cy: 43, arm: 9.5 },
  strong: { sh: 40, nw: 9.8, rx: 17.6, ry: 20, cy: 43.5, arm: 12 },
  tall: { sh: 35, nw: 7, rx: 15.8, ry: 21.5, cy: 40, arm: 9.5 },
};

function hairBack(hair, cx, cy, rx, ry) {
  const H = HAIR_COLOR;
  switch (hair) {
    case "afro":
      return `<circle cx="${cx}" cy="${r1(cy - 8)}" r="${r1(rx + 11.5)}" fill="${H}" ${OUT}/>`;
    case "long":
      return `<path d="M${r1(cx - rx - 4)} ${r1(cy - 6)} Q${r1(cx - rx - 10)} ${r1(cy + 20)} ${r1(cx - rx - 6)} 82 L${r1(cx + rx + 6)} 82 Q${r1(cx + rx + 10)} ${r1(cy + 20)} ${r1(cx + rx + 4)} ${r1(cy - 6)} Q${cx} ${r1(cy - ry - 15)} ${r1(cx - rx - 4)} ${r1(cy - 6)}Z" fill="${H}" ${OUT}/>`;
    case "braids": {
      let s = "";
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const x0 = cx + side * (rx - 3 + i * 3);
          const x1 = cx + side * (rx + 1 + i * 4.2);
          s += `<path d="M${r1(x0)} ${r1(cy - 8)} Q${r1(x1 + side * 2)} ${r1(cy + 10)} ${r1(x1)} ${78 - i * 3}" fill="none" stroke="${INK}" stroke-width="6.2" stroke-linecap="round"/>`;
          s += `<path d="M${r1(x0)} ${r1(cy - 8)} Q${r1(x1 + side * 2)} ${r1(cy + 10)} ${r1(x1)} ${78 - i * 3}" fill="none" stroke="${H}" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="3.4 1.6"/>`;
        }
      }
      return s;
    }
    case "bun":
      return `<circle cx="${cx}" cy="${r1(cy - ry - 5.5)}" r="8.5" fill="${H}" ${OUT}/>`;
    default:
      return "";
  }
}

function hairFront(hair, cx, cy, rx, ry) {
  const H = HAIR_COLOR;
  if (hair === "bald") {
    return `<path d="M${r1(cx - rx * 0.55)} ${r1(cy - ry * 0.72)} Q${r1(cx - rx * 0.2)} ${r1(cy - ry * 0.95)} ${r1(cx + rx * 0.15)} ${r1(cy - ry * 0.9)}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  // A cap from temple to temple; `lift` is how far it rises above the scalp.
  const lift = { buzz: 2.5, afro: 9, braids: 4, long: 6, bun: 4.5 }[hair] ?? 3;
  const line = { buzz: 0.6, afro: 0.5, braids: 0.56, long: 0.5, bun: 0.6 }[hair] ?? 0.58; // hairline height
  const yT = cy - 3;
  const cap = `<path d="M${r1(cx - rx - 0.8)} ${r1(yT)} C${r1(cx - rx - 2.5)} ${r1(cy - ry - lift - 4)} ${r1(cx + rx + 2.5)} ${r1(cy - ry - lift - 4)} ${r1(cx + rx + 0.8)} ${r1(yT)} C${r1(cx + rx - 2)} ${r1(cy - ry * line - 4)} ${r1(cx - rx + 2)} ${r1(cy - ry * line - 4)} ${r1(cx - rx - 0.8)} ${r1(yT)}Z" fill="${H}" ${hair === "buzz" ? 'fill-opacity="0.88" ' : ""}${OUT}/>`;
  if (hair !== "braids") return cap;
  let rows = "";
  for (const dx of [-8, -2.7, 2.7, 8]) {
    rows += `<path d="M${r1(cx + dx)} ${r1(cy - ry * 0.62)} L${r1(cx + dx * 1.15)} ${r1(cy - ry - 2)}" fill="none" stroke="#5b4a40" stroke-width="1.3" stroke-linecap="round"/>`;
  }
  return cap + rows;
}

function beard(kind, cx, cy, rx, ry) {
  if (kind === "stubble") {
    return `<path d="M${r1(cx - rx + 1.6)} ${r1(cy + 3)} Q${r1(cx - rx + 2)} ${r1(cy + ry + 0.5)} ${cx} ${r1(cy + ry - 0.6)} Q${r1(cx + rx - 2)} ${r1(cy + ry + 0.5)} ${r1(cx + rx - 1.6)} ${r1(cy + 3)} Q${r1(cx + rx - 6)} ${r1(cy + 12)} ${r1(cx + 5)} ${r1(cy + 7.5)} Q${cx} ${r1(cy + 6)} ${r1(cx - 5)} ${r1(cy + 7.5)} Q${r1(cx - rx + 6)} ${r1(cy + 12)} ${r1(cx - rx + 1.6)} ${r1(cy + 3)}Z" fill="${HAIR_COLOR}" fill-opacity="0.32"/>`;
  }
  if (kind === "full") {
    return (
      `<path d="M${r1(cx - rx)} ${r1(cy + 1)} Q${r1(cx - rx - 1)} ${r1(cy + ry + 5)} ${cx} ${r1(cy + ry + 6.5)} Q${r1(cx + rx + 1)} ${r1(cy + ry + 5)} ${r1(cx + rx)} ${r1(cy + 1)} Q${r1(cx + rx - 5)} ${r1(cy + 9)} ${r1(cx + 6)} ${r1(cy + 6.6)} Q${cx} ${r1(cy + 4.8)} ${r1(cx - 6)} ${r1(cy + 6.6)} Q${r1(cx - rx + 5)} ${r1(cy + 9)} ${r1(cx - rx)} ${r1(cy + 1)}Z" fill="${HAIR_COLOR}" ${OUT}/>` +
      `<path d="M${r1(cx - 4)} ${r1(cy + 11.5)} Q${cx} ${r1(cy + 13.5)} ${r1(cx + 4)} ${r1(cy + 11.5)}" fill="none" stroke="#e8b4a0" stroke-width="1.8" stroke-linecap="round"/>`
    );
  }
  return "";
}

/**
 * Portrait for a player. Returns an SVG string.
 * opts: { color (jersey/team colour override), number (override), className, label }
 * Never throws: missing or invalid data falls back to defaults.
 */
export function generatePlayerAvatar(player, opts = {}) {
  const p = player && typeof player === "object" ? player : {};
  const o = opts && typeof opts === "object" ? opts : {};
  const look = normalizeLook(p.look);
  const jersey = safeColor(o.color ?? p.color);
  const skin = SKIN_TONES[look.skinTone];
  const skinShade = mix(skin, "#3a1f10", 0.22);
  const number = String(o.number ?? p.jersey ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  const b = BUILDS[look.build] || BUILDS.average;
  const cx = 50;
  const { sh, nw, rx, ry, cy, arm } = b;
  const has = (a) => look.accessories.includes(a);

  const bg = mix(jersey, "#0b0d12", 0.6);
  const bgStripe = mix(jersey, "#0b0d12", 0.38);
  const trim = mix(jersey, "#ffffff", 0.78);
  const jerseyDark = mix(jersey, "#000000", 0.28);
  const shoulderY = look.build === "tall" ? 73.5 : 72;

  const parts = [];
  // 1. Team-colour panel with a diagonal broadcast stripe.
  parts.push(`<rect width="100" height="100" fill="${bg}"/>`);
  parts.push(`<path d="M-5 100 L45 0 L72 0 L22 100Z" fill="${bgStripe}"/>`);
  parts.push(`<path d="M80 0 L88 0 L38 100 L30 100Z" fill="${bgStripe}" fill-opacity="0.6"/>`);

  // 2. Hair behind the head.
  parts.push(hairBack(look.hair, cx, cy, rx, ry));

  // 3. Arms (viewer's right arm wears the sleeve).
  const armY = 93;
  parts.push(`<ellipse cx="${r1(cx - sh)}" cy="${armY}" rx="${arm}" ry="17" fill="${skin}" ${OUT}/>`);
  parts.push(
    `<ellipse cx="${r1(cx + sh)}" cy="${armY}" rx="${arm}" ry="17" fill="${has("sleeve") ? "#151a26" : skin}" ${OUT}/>`
  );
  if (has("sleeve")) {
    parts.push(`<path d="M${r1(cx + sh - arm + 2)} 84 Q${r1(cx + sh)} 81 ${r1(cx + sh + arm - 2)} 84" fill="none" stroke="#f5f7fb" stroke-width="1.6" stroke-linecap="round"/>`);
  }

  // 4. Neck.
  parts.push(`<path d="M${r1(cx - nw)} ${r1(cy + ry - 8)} L${r1(cx - nw - 1)} ${shoulderY + 6} L${r1(cx + nw + 1)} ${shoulderY + 6} L${r1(cx + nw)} ${r1(cy + ry - 8)}Z" fill="${skinShade}" ${OUT}/>`);

  // 5. Jersey with trim and number.
  const jl = cx - sh + 5;
  const jr = cx + sh - 5;
  parts.push(
    `<path d="M${r1(jl - 1)} 101 L${r1(jl + 1)} ${shoulderY + 8} Q${r1(jl + 3)} ${shoulderY + 1} ${r1(cx - nw - 6)} ${shoulderY - 1} Q${cx} ${shoulderY + 13} ${r1(cx + nw + 6)} ${shoulderY - 1} Q${r1(jr - 3)} ${shoulderY + 1} ${r1(jr - 1)} ${shoulderY + 8} L${r1(jr + 1)} 101Z" fill="${jersey}" ${OUT}/>`
  );
  parts.push(`<path d="M${r1(cx - nw - 6)} ${shoulderY - 1} Q${cx} ${shoulderY + 13} ${r1(cx + nw + 6)} ${shoulderY - 1}" fill="none" stroke="${trim}" stroke-width="2.6" stroke-linecap="round"/>`);
  parts.push(`<path d="M${r1(jl + 1)} ${shoulderY + 9} L${r1(jl)} 101" fill="none" stroke="${jerseyDark}" stroke-width="2.4"/>`);
  parts.push(`<path d="M${r1(jr - 1)} ${shoulderY + 9} L${r1(jr)} 101" fill="none" stroke="${jerseyDark}" stroke-width="2.4"/>`);
  if (number) {
    parts.push(
      `<text x="${cx}" y="98" text-anchor="middle" font-family="'Bebas Neue', Impact, 'Arial Narrow', sans-serif" font-weight="700" font-size="17" fill="#ffffff" stroke="${INK}" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">${number}</text>`
    );
  }

  // 6. Ears + head.
  for (const side of [-1, 1]) {
    parts.push(`<ellipse cx="${r1(cx + side * rx)}" cy="${r1(cy + 1)}" rx="3.2" ry="4.6" fill="${skinShade}" ${OUT}/>`);
  }
  parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}" ${OUT}/>`);

  // 7. Beard.
  parts.push(beard(look.beard, cx, cy, rx, ry));

  // 8. Face.
  for (const side of [-1, 1]) {
    parts.push(`<ellipse cx="${r1(cx + side * 6.8)}" cy="${r1(cy - 0.5)}" rx="2.1" ry="2.7" fill="${INK}"/>`);
    parts.push(`<path d="M${r1(cx + side * 3.6)} ${r1(cy - 6.2)} L${r1(cx + side * 10)} ${r1(cy - 6.8)}" fill="none" stroke="${HAIR_COLOR}" stroke-width="2" stroke-linecap="round"/>`);
  }
  parts.push(`<path d="M${cx} ${r1(cy + 1.5)} L${r1(cx - 1.4)} ${r1(cy + 5.2)} L${r1(cx + 1)} ${r1(cy + 5.4)}" fill="none" stroke="${skinShade}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (look.beard !== "full") {
    parts.push(`<path d="M${r1(cx - 4.6)} ${r1(cy + 10)} Q${cx} ${r1(cy + 13.2)} ${r1(cx + 4.6)} ${r1(cy + 10)}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`);
  }

  // 9. Hair in front.
  parts.push(hairFront(look.hair, cx, cy, rx, ry));

  // 10. Head accessories.
  if (has("headband")) {
    parts.push(
      `<path d="M${r1(cx - rx - 1)} ${r1(cy - 12.5)} Q${cx} ${r1(cy - 17)} ${r1(cx + rx + 1)} ${r1(cy - 12.5)} L${r1(cx + rx + 1)} ${r1(cy - 7)} Q${cx} ${r1(cy - 11.5)} ${r1(cx - rx - 1)} ${r1(cy - 7)}Z" fill="#f5f7fb" ${OUT}/>`
    );
  }
  if (has("goggles")) {
    parts.push(`<path d="M${r1(cx - rx)} ${r1(cy - 1)} L${r1(cx - 13)} ${r1(cy - 1)} M${r1(cx + 13)} ${r1(cy - 1)} L${r1(cx + rx)} ${r1(cy - 1)} M${r1(cx - 2.2)} ${r1(cy - 1)} L${r1(cx + 2.2)} ${r1(cy - 1)}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`);
    for (const side of [-1, 1]) {
      parts.push(`<rect x="${r1(cx + (side < 0 ? -13 : 2.2))}" y="${r1(cy - 5.4)}" width="10.8" height="8.8" rx="3.2" fill="#7dd3fc" fill-opacity="0.5" ${OUT}/>`);
    }
  }

  // 11. Wristband: a raised fist in the lower-left corner.
  if (has("wristband")) {
    parts.push(`<rect x="6" y="88" width="12" height="14" fill="${skin}" ${OUT}/>`);
    parts.push(`<rect x="4.6" y="85.5" width="14.8" height="6.4" rx="2" fill="#f5f7fb" ${OUT}/>`);
    parts.push(`<circle cx="12" cy="79.5" r="7.2" fill="${skin}" ${OUT}/>`);
    parts.push(`<path d="M7.4 78.6 L16.6 78.6 M8.2 81.6 L15.8 81.6" fill="none" stroke="${skinShade}" stroke-width="1.3" stroke-linecap="round"/>`);
  }

  const cls = ["avatar", o.className].filter(Boolean).join(" ");
  const label = escAttr(o.label ?? p.name ?? "Player");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="${escAttr(cls)}" role="img" aria-label="${label}">${parts.join("")}</svg>`;
}

/**
 * Portrait wrapped for the UI: circular/rounded frame in the player's colour,
 * optionally with a jersey-number badge. opts: { color, size ("sm"|"md"|"lg"|"xl"), badge, round }
 */
export function avatarHTML(player, opts = {}) {
  const p = player && typeof player === "object" ? player : {};
  const color = safeColor(opts.color ?? p.color);
  const number = String(p.jersey ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  const cls = ["av", `av-${opts.size || "md"}`, opts.round === false ? "av-square" : ""].filter(Boolean).join(" ");
  return `<span class="${cls}" style="--pc:${color}" title="${escAttr(p.name ?? "")}">${generatePlayerAvatar(p, { color })}${portraitHTML(p)}${
    opts.badge && number ? `<i class="av-num">${number}</i>` : ""
  }</span>`;
}
