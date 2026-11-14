// Procedural 3D players built from a player's `look` with simple geometry.
// Athletic proportions (long legs, small head), height by position, a sleeveless
// jersey and long shorts with white trim, name and number on the back, sneakers.
// The arms and legs hang from pivots (the returned `rig`) so scene/players.js
// can pose them: idle breathing, dribble, shooting form, defensive stance.
// Front of the figure is +Z. Throws on failure; callers fall back to a capsule.
import { normalizeLook, safeColor, SKIN_TONES, HAIR_COLOR } from "../look.js";

// width, uniform scale, height scale, arm thickness
const BUILD = {
  lean: { w: 0.88, s: 1.0, h: 1.0, arm: 0.9 },
  average: { w: 1.0, s: 1.0, h: 1.0, arm: 1.0 },
  strong: { w: 1.22, s: 1.0, h: 1.02, arm: 1.3 },
  tall: { w: 1.0, s: 1.03, h: 1.08, arm: 1.0 },
};
// Guards are shorter than centres.
export const POSITION_HEIGHT = { PG: 0.94, SG: 0.97, SF: 1.01, PF: 1.05, C: 1.1 };

/** Number (front) or surname + number (back) as a texture. */
function jerseyTexture(THREE, number, name) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const g = c.getContext("2d");
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  const draw = (text, y, size, stroke) => {
    g.font = `bold ${size}px 'Bebas Neue', Impact, 'Arial Narrow', sans-serif`;
    g.lineWidth = stroke;
    g.strokeStyle = "#0a0c11";
    g.strokeText(text, 128, y, 240);
    g.fillStyle = "#ffffff";
    g.fillText(text, 128, y, 240);
  };
  if (name) {
    draw(name, 36, 46, 8);
    draw(String(number), 122, 118, 12);
  } else {
    draw(String(number), 100, 150, 14);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const surname = (name) => {
  const parts = String(name || "").trim().split(/\s+/);
  return (parts[parts.length - 1] || "").replace(/[^\p{L}'-]/gu, "").toUpperCase().slice(0, 12);
};

/**
 * Build the body group for one player.
 * opts: { color (jersey), number, look, position, name }
 *   ->  { body: THREE.Group, height, rig: { upper, armL, armR, legL, legR, head } }
 */
export function buildFigurineBody(THREE, { color, number, look, position, name } = {}) {
  const L = normalizeLook(look);
  const b = BUILD[L.build] || BUILD.average;
  const ph = POSITION_HEIGHT[position] || 1;
  const has = (a) => L.accessories.includes(a);
  const jerseyColor = new THREE.Color(safeColor(color));
  const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.03, ...extra });

  const M = {
    skin: std(SKIN_TONES[L.skinTone]),
    jersey: std(jerseyColor),
    shorts: std(jerseyColor.clone().multiplyScalar(0.62)),
    hair: std(HAIR_COLOR, { roughness: 0.95 }),
    shoe: std(L.shoes, { roughness: 0.45 }),
    white: std(0xf5f7fb),
    dark: std(0x151a26),
    ink: new THREE.MeshBasicMaterial({ color: 0x0a0c11 }),
  };

  const body = new THREE.Group();
  const upper = new THREE.Group(); // everything above the hips
  body.add(upper);
  const add = (geo, mat, x, y, z, parent = upper) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const pivot = (x, y, parent) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    parent.add(g);
    return g;
  };

  const HIP = 1.02;
  const legX = 0.15 * b.w;
  const shoulder = 0.35 * b.w;
  const depth = 0.6;

  // Legs hang from the hips: long, with a sneaker (upper, white sole, toe cap).
  const legs = [-1, 1].map((s) => {
    const leg = pivot(s * legX, HIP, body);
    add(new THREE.CylinderGeometry(0.105, 0.075, 0.9, 10), M.skin, 0, -0.45, 0, leg);
    add(new THREE.BoxGeometry(0.2, 0.12, 0.42), M.shoe, 0, -0.9, 0.07, leg);
    add(new THREE.BoxGeometry(0.21, 0.04, 0.44), M.white, 0, -0.98, 0.07, leg);
    add(new THREE.BoxGeometry(0.2, 0.07, 0.1), M.white, 0, -0.93, 0.25, leg);
    add(new THREE.CylinderGeometry(0.082, 0.08, 0.1, 10), M.white, 0, -0.8, 0, leg); // sock
    return leg;
  });

  // Long shorts to just above the knee, with a waistband and a trimmed hem.
  const shorts = add(new THREE.CylinderGeometry(0.265 * b.w, 0.315 * b.w, 0.56, 16), M.shorts, 0, 0.96, 0);
  shorts.scale.z = depth + 0.08;
  const hem = add(new THREE.CylinderGeometry(0.32 * b.w, 0.32 * b.w, 0.045, 16), M.white, 0, 0.7, 0);
  hem.scale.z = depth + 0.08;
  const waist = add(new THREE.CylinderGeometry(0.272 * b.w, 0.272 * b.w, 0.05, 16), M.white, 0, 1.24, 0);
  waist.scale.z = depth + 0.04;

  // Sleeveless jersey: a tapered torso, bare shoulders, a trimmed collar.
  const torso = add(new THREE.CylinderGeometry(shoulder, 0.265 * b.w, 0.74, 18), M.jersey, 0, 1.61, 0);
  torso.scale.z = depth;
  const collar = add(new THREE.TorusGeometry(0.125, 0.026, 8, 20), M.white, 0, 1.985, 0);
  collar.rotation.x = Math.PI / 2;
  collar.scale.y = 0.8;

  // Arms hang from shoulder pivots. The figure's left arm (+X) wears the sleeve, the right wrist the wristband.
  const armR = 0.078 * b.arm;
  const arms = [-1, 1].map((s) => {
    const armMat = s === 1 && has("sleeve") ? M.dark : M.skin;
    const arm = pivot(s * (shoulder + 0.045), 1.9, upper);
    add(new THREE.SphereGeometry(armR * 1.3, 10, 8), armMat, 0, 0, 0, arm);
    add(new THREE.CylinderGeometry(armR, armR * 0.8, 0.8, 10), armMat, 0, -0.4, 0, arm);
    add(new THREE.SphereGeometry(armR * 1.1, 10, 8), M.skin, 0, -0.84, 0, arm);
    if (s === -1 && has("wristband")) add(new THREE.CylinderGeometry(armR * 1.08, armR * 1.08, 0.1, 12), M.white, 0, -0.7, 0, arm);
    arm.rotation.z = s * 0.1;
    return arm;
  });

  // Neck + head. The head keeps its own units and is scaled down to athletic proportions.
  add(new THREE.CylinderGeometry(0.085 * (b.arm > 1.1 ? 1.2 : 1), 0.1, 0.16, 10), M.skin, 0, 2.03, 0);
  const R = 0.29;
  const HEAD = 0.74;
  const hy = 2.3;
  const head = new THREE.Group();
  head.position.set(0, hy, 0);
  head.scale.setScalar(HEAD);
  upper.add(head);
  const skull = add(new THREE.SphereGeometry(R, 20, 14), M.skin, 0, 0, 0, head);
  skull.scale.y = 1.1;
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.036, 8, 6), M.ink, s * 0.105, 0.03, R * 0.93, head);

  // Hair. A "cap" is the top slice of a sphere, tilted back so the face stays clear.
  const cap = (scale, slice, tilt, mat = M.hair, yScale = 1.1) => {
    const m = add(new THREE.SphereGeometry(R * scale, 20, 12, 0, Math.PI * 2, 0, slice), mat, 0, 0, 0, head);
    m.scale.y = yScale;
    m.rotation.x = -tilt;
    return m;
  };
  let top = hy + R * 1.1 * HEAD;
  switch (L.hair) {
    case "buzz":
      cap(1.035, 1.42, 0.34);
      break;
    case "afro":
      cap(1.46, 1.78, 0.44, M.hair, 1.05);
      top += 0.1;
      break;
    case "braids":
      cap(1.06, 1.5, 0.36);
      for (let i = 0; i < 7; i++) {
        const a = -1.25 + (i * 2.5) / 6;
        const strand = add(new THREE.CylinderGeometry(0.034, 0.026, 0.58, 6), M.hair, Math.sin(a) * R * 0.98, -0.2, -Math.cos(a) * R * 0.98, head);
        strand.rotation.x = -0.08;
      }
      break;
    case "long": {
      cap(1.07, 1.6, 0.4);
      const back = add(new THREE.SphereGeometry(R, 14, 10), M.hair, 0, -0.26, -0.17, head);
      back.scale.set(1.04, 1.6, 0.56);
      break;
    }
    case "bun":
      cap(1.045, 1.5, 0.36);
      add(new THREE.SphereGeometry(0.13, 12, 10), M.hair, 0, R * 1.1 + 0.05, -0.1, head);
      top += 0.1;
      break;
    default: // bald
      break;
  }

  // Beard: the bottom slice of a sphere, tilted forward onto the jaw.
  const jaw = (scale, slice, tilt, mat, yScale) => {
    const m = add(new THREE.SphereGeometry(R * scale, 18, 10, 0, Math.PI * 2, Math.PI - slice, slice), mat, 0, 0, 0, head);
    m.scale.y = yScale;
    m.rotation.x = -tilt;
  };
  if (L.beard === "stubble") {
    jaw(1.025, 1.12, 0.56, std(HAIR_COLOR, { transparent: true, opacity: 0.4, roughness: 0.95 }), 1.1);
  } else if (L.beard === "full") {
    jaw(1.09, 1.2, 0.6, M.hair, 1.24);
  }

  // Head accessories.
  if (has("headband")) {
    const band = add(new THREE.TorusGeometry(R * 1.02, 0.034, 8, 24), M.white, 0, 0.115, 0, head);
    band.rotation.x = Math.PI / 2 - 0.1;
  }
  if (has("goggles")) {
    const strap = add(new THREE.TorusGeometry(R * 1.01, 0.017, 6, 24), M.dark, 0, 0.03, 0, head);
    strap.rotation.x = Math.PI / 2;
    const lens = std(0x7dd3fc, { transparent: true, opacity: 0.75, roughness: 0.2 });
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.125, 0.08, 0.05), lens, s * 0.1, 0.03, R * 0.96, head);
  }

  // Number on the chest; surname and number on the back.
  const digits = String(number ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  if (digits) {
    const z = 0.325 * b.w * depth + 0.016;
    const front = new THREE.MeshBasicMaterial({ map: jerseyTexture(THREE, digits, ""), transparent: true, depthWrite: false });
    add(new THREE.PlaneGeometry(0.42, 0.315), front, 0, 1.66, z);
    const backMat = new THREE.MeshBasicMaterial({ map: jerseyTexture(THREE, digits, surname(name)), transparent: true, depthWrite: false });
    const back = add(new THREE.PlaneGeometry(0.56, 0.42), backMat, 0, 1.66, -z);
    back.rotation.y = Math.PI;
  }

  const wide = b.s * (0.55 + 0.45 * ph);
  body.scale.set(wide, b.h * ph, wide);
  return { body, height: top * b.h * ph, rig: { upper, armL: arms[1], armR: arms[0], legL: legs[1], legR: legs[0], head } };
}
