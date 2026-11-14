// Player models: which GLB a player uses, and how an instance is prepared.
//
// Lookup, most specific first (a file counts only if assets/manifest.json lists it):
//   1. assets/models/players/<playerId>.glb      a model made for that one player
//   2. assets/models/<archetype>_<n>.glb         a variant, chosen by the player's id
//   3. assets/models/<archetype>.glb             the archetype's base model
//   4. null                                      -> the procedural figurine
// Opponents have a position instead of an archetype; POSITION_ARCHETYPE maps it.
// The first half of this file is pure (tested in Node); the rest needs THREE.

export const POSITION_ARCHETYPE = { PG: "floorgeneral", SG: "sniper", SF: "slasher", PF: "lockdown", C: "big" };
export const VARIANTS = 3; // <archetype>.glb, <archetype>_2.glb, <archetype>_3.glb

/** Small stable hash of a string (same player id -> same variant, on every machine). */
export function hashId(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export function archetypeOf(player) {
  return String((player && (player.archetype || POSITION_ARCHETYPE[player.position])) || "").toLowerCase();
}

/**
 * The model file for a player, relative to assets/models/, or null.
 * `has(file)` says whether that file exists (from the asset manifest).
 */
export function modelFileFor(player, has) {
  if (!player || typeof has !== "function") return null;
  if (player.model && has(player.model)) return player.model; // explicit override in the roster
  if (player.id && has(`players/${player.id}.glb`)) return `players/${player.id}.glb`;
  const arch = archetypeOf(player);
  if (!arch) return null;
  const files = [];
  for (let n = 1; n <= VARIANTS; n++) {
    const file = n === 1 ? `${arch}.glb` : `${arch}_${n}.glb`;
    if (has(file)) files.push(file);
  }
  return files.length ? files[hashId(player.id || arch) % files.length] : null;
}

// Which animation clip plays for which game moment. Names are matched loosely,
// because clip names come from the generator's animation library.
export const CLIP_PATTERNS = {
  idle: /idle/i,
  dribble: /dribbl/i,
  shoot: /throw|shoot|shot/i,
  layup: /lay.?up|run_and_jump|jump/i,
  defend: /stance|defen|guard/i,
  celebrate: /victory|cheer|fist|celebrat/i,
};

/** { idle: clip, shoot: clip, ... } for the clips that exist; missing ones are simply absent. */
export function mapClips(clips) {
  const out = {};
  for (const [key, re] of Object.entries(CLIP_PATTERNS)) {
    const clip = (clips || []).find((c) => c && re.test(c.name || ""));
    if (clip) out[key] = clip;
  }
  // A model with a single unnamed clip: treat it as the idle.
  if (!out.idle && (clips || []).length === 1) out.idle = clips[0];
  return out;
}

// ---------- THREE helpers ----------

/** True when the object contains a skinned mesh (needs SkeletonUtils.clone). */
export function isRigged(obj) {
  let rigged = false;
  obj.traverse((o) => {
    if (o.isSkinnedMesh) rigged = true;
  });
  return rigged;
}

const tintCache = new Map(); // texture uuid + colour -> CanvasTexture

/**
 * Recolour the white kit. With several materials, the largest near-white one
 * gets the team colour. With one textured material (the usual case for generated
 * models), the near-white texels of its texture are multiplied by the team colour
 * instead, so skin, hair and shoes keep their own colours. Materials are cloned
 * first: instances never share a tint. Never throws.
 */
export function tintKit(THREE, obj, color) {
  try {
    const team = new THREE.Color(color);
    const meshes = [];
    obj.traverse((o) => {
      if (o.isMesh && o.material) meshes.push(o);
    });
    const count = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count);
    const nearWhite = (c) => c.r > 0.78 && c.g > 0.78 && c.b > 0.78;
    const plain = meshes.filter((m) => !Array.isArray(m.material) && !m.material.map && nearWhite(m.material.color)).sort((a, b) => count(b) - count(a));
    if (plain.length) {
      plain[0].material = plain[0].material.clone();
      plain[0].material.color.copy(team);
      return "material";
    }
    const textured = meshes.filter((m) => !Array.isArray(m.material) && m.material.map && m.material.map.image).sort((a, b) => count(b) - count(a));
    if (!textured.length) return null;
    const mesh = textured[0];
    const map = mesh.material.map;
    const key = `${map.uuid}|${team.getHexString()}`;
    if (!tintCache.has(key)) {
      const img = map.image;
      const size = Math.min(1024, img.width || 1024);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = Math.round(size * ((img.height || size) / (img.width || size)));
      const g = canvas.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = g.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const lo = Math.min(px[i], px[i + 1], px[i + 2]);
        const hi = Math.max(px[i], px[i + 1], px[i + 2]);
        if (lo > 150 && hi - lo < 38) {
          // near-white cloth: keep its shading, take the team's hue
          px[i] = px[i] * team.r;
          px[i + 1] = px[i + 1] * team.g;
          px[i + 2] = px[i + 2] * team.b;
        }
      }
      g.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = map.colorSpace;
      tex.flipY = map.flipY;
      tex.wrapS = map.wrapS;
      tex.wrapT = map.wrapT;
      tintCache.set(key, tex);
    }
    mesh.material = mesh.material.clone();
    mesh.material.map = tintCache.get(key);
    mesh.material.needsUpdate = true;
    return "texture";
  } catch {
    return null; // keep the white kit
  }
}
