// Roster selection. ALL roster loading goes through loadRoster().
//
//   default / anything else  -> content/players.league.json (public, fictional)
//   ?roster=real             -> content/players.real.json   (private, local only)
//
// The real roster is requested ONLY when the URL contains exactly ?roster=real.
// If it is missing or invalid we fall back to the league roster with a warning.
// The example file (players.real.example.json) is never loaded by the game.
export const LEAGUE_URL = "content/players.league.json";
export const REAL_URL = "content/players.real.json";

const RATINGS = ["SHT", "INS", "DEF", "PLY"];

/** Schema check for a roster. Returns { ok, reason }. */
export function validateRoster(data, requiredIds = []) {
  if (!Array.isArray(data) || data.length === 0) return { ok: false, reason: "not a list of players" };
  const ids = new Set();
  for (const p of data) {
    if (!p || typeof p !== "object") return { ok: false, reason: "a player entry is not an object" };
    if (typeof p.id !== "string" || !p.id) return { ok: false, reason: "a player has no id" };
    if (ids.has(p.id)) return { ok: false, reason: `duplicate id ${p.id}` };
    ids.add(p.id);
    if (typeof p.name !== "string" || !p.name.trim()) return { ok: false, reason: `${p.id} has no name` };
    if (p.name.trim().toUpperCase() === "TODO") return { ok: false, reason: `${p.id} still has a TODO name` };
    if (typeof p.archetype !== "string" || !p.archetype) return { ok: false, reason: `${p.id} has no archetype` };
    if (typeof p.position !== "string") return { ok: false, reason: `${p.id} has no position` };
    if (!Number.isFinite(Number(p.jersey))) return { ok: false, reason: `${p.id} has no jersey number` };
    if (!p.ratings || typeof p.ratings !== "object") return { ok: false, reason: `${p.id} has no ratings` };
    for (const r of RATINGS) {
      const v = p.ratings[r];
      if (!Number.isFinite(v) || v < 1 || v > 5) return { ok: false, reason: `${p.id} has an invalid ${r} rating` };
    }
    if (!Array.isArray(p.signatureCards)) return { ok: false, reason: `${p.id} has no signatureCards` };
  }
  for (const id of requiredIds) {
    if (!ids.has(id)) return { ok: false, reason: `starting player ${id} is missing` };
  }
  return { ok: true, reason: "" };
}

async function fetchJson(fetchFn, url) {
  const res = await fetchFn(url);
  if (!res || !res.ok) throw new Error(`${url} (${res ? res.status : "no response"})`);
  return res.json();
}

/**
 * Load the roster. Returns { players, source: "league" | "real", warning? }.
 * `search` is the URL query string, `fetchFn` is injectable for tests.
 */
export async function loadRoster({
  search = globalThis.location?.search ?? "",
  fetchFn = globalThis.fetch,
  requiredIds = [],
} = {}) {
  let wantsReal = false;
  try {
    wantsReal = new URLSearchParams(search).get("roster") === "real";
  } catch {
    wantsReal = false;
  }

  let warning;
  if (wantsReal) {
    try {
      const data = await fetchJson(fetchFn, REAL_URL);
      const check = validateRoster(data, requiredIds);
      if (check.ok) return { players: data, source: "real" };
      warning = `Private roster is invalid (${check.reason}). Using the league roster.`;
    } catch {
      warning = "Private roster not found (content/players.real.json). Using the league roster.";
    }
  }

  const players = await fetchJson(fetchFn, LEAGUE_URL);
  const result = { players, source: "league" };
  if (warning) result.warning = warning;
  return result;
}

// ---------- Private team names (same rule as the private roster) ----------
// content/teams.real.json is local only and gitignored. It is requested ONLY
// with ?roster=real, and may rename teams and their players and point to logo
// images:  { "<team id>": { "name": "...", "logo": "assets/teams/x.png", "players": ["name", ...] } }
// Anything missing or malformed is ignored and the fictional league stays.
export const REAL_TEAMS_URL = "content/teams.real.json";

export async function loadTeamOverlay({ search = globalThis.location ? globalThis.location.search : "", fetchFn = globalThis.fetch } = {}) {
  let wantsReal = false;
  try {
    wantsReal = new URLSearchParams(search).get("roster") === "real";
  } catch {
    wantsReal = false;
  }
  if (!wantsReal) return null;
  try {
    const res = await fetchFn(REAL_TEAMS_URL);
    if (!res || !res.ok) return null;
    const data = await res.json();
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

const cleanName = (v) => (typeof v === "string" && v.trim() && v.trim() !== "TODO" ? v.trim().slice(0, 40) : null);

/** Rename teams (and their players) in place from the private overlay. Returns how many teams changed. */
export function applyTeamOverlay(teams, overlay) {
  if (!overlay || !Array.isArray(teams)) return 0;
  let n = 0;
  for (const t of teams) {
    const o = overlay[t.id];
    if (!o || typeof o !== "object") continue;
    const name = cleanName(o.name);
    if (name) t.name = name;
    if (typeof o.logo === "string" && /^assets\/teams\/[A-Za-z0-9._-]+$/.test(o.logo)) t.logo = o.logo;
    if (Array.isArray(o.players)) {
      (t.players || []).forEach((p, i) => {
        const pn = cleanName(o.players[i]);
        if (pn) p.name = pn;
      });
    }
    n++;
  }
  return n;
}
