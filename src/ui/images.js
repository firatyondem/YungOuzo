// Optional image slots. A team may have a `logo` and a player a `portrait`
// (paths under assets/teams/ and assets/players/). An image is only used when
// assets/manifest.json lists the file (run `node tools/update-assets.js` after
// adding images), so a missing image costs no request and no 404: the game
// silently keeps the generated crest or portrait.
// No official league or team logos ship with the game; the folders are
// gitignored so private images stay local.
let listed = null; // { teams: Set<string>, players: Set<string> } | null

export function setImageManifest(manifest) {
  listed = manifest || null;
}

/** The path if that image exists (according to the manifest), else null. */
export function imageFor(path) {
  if (!path || !listed) return null;
  const m = /^assets\/(teams|players)\/([A-Za-z0-9._-]+)$/.exec(String(path));
  if (!m || !listed[m[1]] || !listed[m[1]].has(m[2])) return null;
  return m[0];
}

/** <img> for a team logo, or "" when there is none. A broken file removes itself. */
export function logoHTML(team, cls = "") {
  const src = imageFor(team && team.logo);
  return src ? `<img class="team-logo ${cls}" src="${src}" alt="" loading="lazy" onerror="this.remove()">` : "";
}

/** <img> laid over the generated portrait, or "". */
export function portraitHTML(player) {
  const src = imageFor(player && player.portrait);
  return src ? `<img class="av-photo" src="${src}" alt="" loading="lazy" onerror="this.remove()">` : "";
}
