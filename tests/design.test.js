// Design-system checks: contrast of the main token pairs, no emoji, minimum
// type size, icon coverage, and that play diagrams / card markup stay valid.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { content } from "./helpers.js";
import { icon, ICON_NAMES, TYPE_ICON } from "../src/ui/icons.js";
import { playDiagramSVG } from "../src/ui/playDiagram.js";
import { cardHTML, richText, pctClass, TYPE_COLOR } from "../src/ui/cards.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

// ---------- Tokens + contrast ----------

const theme = read("src/ui/theme.css");
const tokens = {};
for (const m of theme.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2];

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("design: required colour tokens exist with the specified values", () => {
  const expected = {
    bg: "#0B1426", surface: "#16233D", "surface-2": "#1F3157", "wood-1": "#E8A35C", "wood-2": "#C97A3A",
    orange: "#FF6B1A", yellow: "#FFD23F", white: "#FFF8EC",
    "t-offense": "#2EA8FF", "t-shot": "#FF3B3B", "t-defense": "#1FD18A", "t-buff": "#9B5CFF", "t-hustle": "#FFB800",
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.equal((tokens[name] || "").toUpperCase(), value, `--${name}`);
  }
  // The JS-side type colours match the CSS tokens.
  for (const [type, hex] of Object.entries(TYPE_COLOR)) {
    assert.equal(hex.toUpperCase(), tokens[`t-${type.toLowerCase()}`].toUpperCase(), `${type} colour`);
  }
});

test("design: main text/background pairs meet WCAG AA", () => {
  const body = [
    // [foreground, background] - body text needs 4.5:1
    ["text", "bg"], ["text", "surface"], ["text", "surface-2"],
    ["muted", "bg"], ["muted", "surface"], ["muted", "surface-2"],
    ["ink", "white"], // card effect text on the cream face
    // bright fills always carry navy ink text
    ["navy-ink", "orange"], ["navy-ink", "yellow"], ["navy-ink", "white"],
    ["navy-ink", "t-offense"], ["navy-ink", "t-shot"], ["navy-ink", "t-defense"], ["navy-ink", "t-buff"], ["navy-ink", "t-hustle"],
    ["navy-ink", "good"], ["navy-ink", "bad"], ["navy-ink", "warn"],
  ];
  for (const [fg, bg] of body) {
    const ratio = contrast(tokens[fg], tokens[bg]);
    assert.ok(ratio >= 4.5, `${fg} on ${bg}: ${ratio.toFixed(2)}:1 (needs 4.5)`);
  }
  const large = [
    // coloured display text on dark surfaces - large text needs 3:1
    ["orange", "bg"], ["yellow", "bg"], ["yellow", "surface"], ["good", "surface"], ["bad", "surface"],
    ["t-offense", "bg"], ["t-buff", "bg"], ["t-shot", "bg"],
  ];
  for (const [fg, bg] of large) {
    const ratio = contrast(tokens[fg], tokens[bg]);
    assert.ok(ratio >= 3, `${fg} on ${bg}: ${ratio.toFixed(2)}:1 (needs 3)`);
  }
});

test("design: no emoji anywhere in the UI, content or page", () => {
  const files = [...walk("src"), ...walk("content"), "index.html"].filter((f) => /\.(js|css|json|html)$/.test(f));
  const emoji = /\p{Extended_Pictographic}/u;
  for (const f of files) {
    const text = read(f);
    const hit = text.split("\n").findIndex((line) => emoji.test(line.replace(/[#*0-9©®]/g, "")));
    assert.equal(hit, -1, `${f}:${hit + 1} contains an emoji`);
  }
});

test("design: no text below 12px, shared radii come from tokens", () => {
  for (const f of walk("src").filter((x) => x.endsWith(".css"))) {
    for (const m of read(f).matchAll(/font-size:\s*([0-9.]+)px/g)) {
      assert.ok(Number(m[1]) >= 12, `${f}: font-size ${m[1]}px is below 12px`);
    }
  }
  assert.match(theme, /--r-card:\s*14px/);
  assert.match(theme, /--r-panel:\s*6px/);
  assert.match(theme, /--r-pill:\s*999px/);
  assert.match(theme, /prefers-reduced-motion/);
});

// ---------- Icons ----------

test("design: icon set covers every required icon and card type", () => {
  const required = [
    "offense", "shot", "defense", "buff", "hustle", "stamina", "foul", "wear", "injury",
    "mismatch", "doubleTeam", "clutch", "capSpace", "relic", "scouting",
  ];
  for (const name of required) assert.ok(ICON_NAMES.includes(name), `icon "${name}"`);
  const seen = new Set();
  for (const name of ICON_NAMES) {
    const svg = icon(name);
    assert.ok(svg.startsWith("<svg ") && svg.endsWith("</svg>"));
    assert.ok(svg.includes('stroke="currentColor"') && svg.includes('fill="none"'), "one stroke style");
    seen.add(svg);
  }
  assert.equal(seen.size, ICON_NAMES.length, "every icon is different");
  // Every card type in the content has its own icon, so types read without colour.
  const types = new Set(content.cardList.map((c) => c.type));
  const icons = new Set();
  for (const t of types) {
    assert.ok(TYPE_ICON[t] && ICON_NAMES.includes(TYPE_ICON[t]), `type ${t} has an icon`);
    icons.add(t === "Buff" || t === "Utility" ? TYPE_ICON[t] : TYPE_ICON[t]);
  }
  assert.equal(icons.size, types.size, "card types are distinguishable in grayscale");
});

// ---------- Cards + diagrams ----------

function assertSvg(svg) {
  assert.ok(svg.startsWith("<svg ") && svg.endsWith("</svg>"));
  assert.ok(!/undefined|NaN|\[object/.test(svg), "no leaked values");
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    if (m[4]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2]);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
}

test("design: every card gets a valid, data-driven play diagram", () => {
  const seen = new Map();
  for (const card of content.cardList) {
    const svg = playDiagramSVG(card, TYPE_COLOR[card.type]);
    assertSvg(svg);
    seen.set(card.id, svg);
  }
  // Different plays draw differently (cards with identical data may share a picture).
  assert.ok(new Set(seen.values()).size >= content.cardList.length - 4);
  assert.notEqual(seen.get("swing_pass"), seen.get("pull_up_jumper"));
  assert.notEqual(seen.get("contest"), seen.get("swipe"));
  assert.notEqual(seen.get("pick_and_roll"), seen.get("iso"));
  // Broken data never throws.
  for (const bad of [undefined, null, {}, 7, { type: "Shot", effects: "x" }, { effects: [{ type: "shoot" }] }, { type: "Offense", tags: null }]) {
    assertSvg(playDiagramSVG(bad));
  }
});

test("design: card markup has the full anatomy and safe text", () => {
  for (const card of content.cardList) {
    const html = cardHTML(card);
    for (const part of ["card-band", "card-cost", "card-art", "card-name", "card-text", "card-owner"]) {
      assert.ok(html.includes(part), `${card.id} has ${part}`);
    }
    assert.ok(html.includes(`rar-${card.rarity}`), `${card.id} rarity frame`);
    assert.ok(["common", "rare", "legendary"].includes(card.rarity));
    assert.ok(html.includes(`type-${card.type.toLowerCase()}`));
  }
  // Unplayable cards say why, with a lock.
  const locked = cardHTML(content.cards.swing_pass, { playable: false, reason: "Need 3s" });
  assert.ok(locked.includes("unplayable") && locked.includes("card-lock") && locked.includes("Need 3s"));
  // Live % badge is colour-coded.
  assert.equal(pctClass(20), "pct-red");
  assert.equal(pctClass(50), "pct-yellow");
  assert.equal(pctClass(75), "pct-green");
  assert.ok(cardHTML(content.cards.pull_up_jumper, { pct: 72 }).includes("pct-green"));
  // Keywords become chips, numbers are emphasised, markup is escaped.
  const rich = richText("+10 Openness. <b>x</b> Contest");
  assert.ok(rich.includes('class="kw kw-openness"') && rich.includes('class="kw kw-contest"'));
  assert.ok(rich.includes('<b class="num">+10</b>'));
  assert.ok(!rich.includes("<b>x</b>") && rich.includes("&lt;b&gt;"));
});

test("design: every team has primary and secondary colours", () => {
  for (const t of content.teams) {
    assert.match(t.colors.primary, /^#[0-9a-fA-F]{6}$/, `${t.id} primary`);
    assert.match(t.colors.secondary, /^#[0-9a-fA-F]{6}$/, `${t.id} secondary`);
    // Team slabs carry navy ink text, so the primary must be bright enough.
    assert.ok(contrast(tokens["navy-ink"], t.colors.primary) >= 4.5, `${t.id} slab contrast`);
  }
});
