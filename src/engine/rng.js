// Seeded RNG (mulberry32). The state is a plain integer stored on a "holder"
// object (the run) as `rngState`, so the whole game state stays serialisable
// and the same seed + the same actions always produce the same outcome.

export function hashSeed(seed) {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Next float in [0, 1). Advances holder.rngState. */
export function nextFloat(holder) {
  let t = (holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, n). */
export function nextInt(holder, n) {
  return Math.floor(nextFloat(holder) * n);
}

/** Float in [0, 100) - compare with a percentage: success if roll < pct. */
export function roll100(holder) {
  return nextFloat(holder) * 100;
}

export function pick(holder, arr) {
  return arr[nextInt(holder, arr.length)];
}

/** In-place Fisher-Yates shuffle. Returns the same array. */
export function shuffle(holder, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(holder, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Only used to pick a fresh seed for a new run - never for gameplay rolls. */
export function randomSeed() {
  return Math.floor(Math.random() * 900000) + 100000;
}
