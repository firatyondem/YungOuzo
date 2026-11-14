// Player appearance ("look") data: allowed values, defaults and normalisation.
// Pure data helpers shared by the SVG portraits and the 3D figurines.
export const HAIR = ["buzz", "afro", "braids", "bald", "long", "bun"];
export const BEARD = ["none", "stubble", "full"];
export const BUILD = ["lean", "average", "strong", "tall"];
export const ACCESSORIES = ["headband", "sleeve", "goggles", "wristband"];

// Index 0 unused so skinTone 1-6 maps directly.
export const SKIN_TONES = [null, "#f7d9c1", "#eabf9b", "#d29d72", "#b07b52", "#8a5b3a", "#5e3c26"];
export const HAIR_COLOR = "#1c1512";

export const LOOK_DEFAULTS = Object.freeze({
  skinTone: 3,
  hair: "buzz",
  beard: "none",
  build: "average",
  accessories: [],
  shoes: "#ffffff",
});

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(v) {
  return typeof v === "string" && HEX.test(v.trim());
}

/** Any input (missing, partial, wrong types) -> a complete, valid look object. */
export function normalizeLook(look) {
  const src = look && typeof look === "object" && !Array.isArray(look) ? look : {};
  const tone = typeof src.skinTone === "number" || typeof src.skinTone === "string" ? Number(src.skinTone) : NaN;
  const accessories = Array.isArray(src.accessories)
    ? [...new Set(src.accessories.filter((a) => ACCESSORIES.includes(a)))]
    : [];
  return {
    skinTone: Number.isInteger(tone) && tone >= 1 && tone <= 6 ? tone : LOOK_DEFAULTS.skinTone,
    hair: HAIR.includes(src.hair) ? src.hair : LOOK_DEFAULTS.hair,
    beard: BEARD.includes(src.beard) ? src.beard : LOOK_DEFAULTS.beard,
    build: BUILD.includes(src.build) ? src.build : LOOK_DEFAULTS.build,
    accessories,
    shoes: isHexColor(src.shoes) ? src.shoes.trim() : LOOK_DEFAULTS.shoes,
  };
}

export function skinColor(look) {
  return SKIN_TONES[normalizeLook(look).skinTone];
}

/** A safe colour for jerseys/panels: falls back when the value is not a hex colour. */
export function safeColor(color, fallback = "#8892a8") {
  return isHexColor(color) ? color.trim() : fallback;
}
