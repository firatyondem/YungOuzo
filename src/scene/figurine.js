// Procedural 3D figurines built from a player's `look` with simple geometry.
// Front of the figure is +Z. Throws on failure; callers fall back to a capsule.
import { normalizeLook, safeColor, SKIN_TONES, HAIR_COLOR } from "../look.js";

// width, uniform scale, height scale, arm thickness
const BUILD = {
  lean: { w: 0.86, s: 1.0, h: 1.0, arm: 0.9 },
  average: { w: 1.0, s: 1.0, h: 1.0, arm: 1.0 },
  strong: { w: 1.25, s: 1.0, h: 1.03, arm: 1.3 },
  tall: { w: 1.0, s: 1.06, h: 1.16, arm: 1.0 },
};

function numberTexture(THREE, number) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 96;
  const g = c.getContext("2d");
  g.font = "bold 88px 'Bebas Neue', Impact, 'Arial Narrow', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 12;
  g.lineJoin = "round";
  g.strokeStyle = "#0a0c11";
  g.strokeText(String(number), 64, 52);
  g.fillStyle = "#ffffff";
  g.fillText(String(number), 64, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Build the body group for one player.
 * opts: { color (jersey), number, look }  ->  { body: THREE.Group, height }
 */
export function buildFigurineBody(THREE, { color, number, look } = {}) {
  const L = normalizeLook(look);
  const b = BUILD[L.build] || BUILD.average;
  const has = (a) => L.accessories.includes(a);
  const jerseyColor = new THREE.Color(safeColor(color));
  const std = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.03, ...extra });

  const M = {
    skin: std(SKIN_TONES[L.skinTone]),
    jersey: std(jerseyColor),
    shorts: std(jerseyColor.clone().multiplyScalar(0.55)),
    hair: std(HAIR_COLOR, { roughness: 0.95 }),
    shoe: std(L.shoes, { roughness: 0.45 }),
    white: std(0xf5f7fb),
    dark: std(0x151a26),
    ink: new THREE.MeshBasicMaterial({ color: 0x0a0c11 }),
  };

  const body = new THREE.Group();
  const add = (geo, mat, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const legX = 0.17 * b.w;
  const torsoTop = 0.37 * b.w;
  const depth = 0.62;

  // Shoes, legs, shorts.
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.25, 0.15, 0.46), M.shoe, s * legX, 0.075, 0.07);
    add(new THREE.CylinderGeometry(0.1, 0.085, 0.64, 10), M.skin, s * legX, 0.46, 0);
  }
  const shorts = add(new THREE.CylinderGeometry(0.3 * b.w, 0.34 * b.w, 0.46, 14), M.shorts, 0, 0.93, 0);
  shorts.scale.z = depth + 0.06;

  // Torso (jersey).
  const torso = add(new THREE.CylinderGeometry(torsoTop, 0.29 * b.w, 0.78, 16), M.jersey, 0, 1.5, 0);
  torso.scale.z = depth;

  // Arms: the figure's left arm (+X) wears the sleeve, the right wrist the wristband.
  const armR = 0.085 * b.arm;
  for (const s of [-1, 1]) {
    const armMat = s === 1 && has("sleeve") ? M.dark : M.skin;
    const x = s * (torsoTop + 0.06 + armR * 0.4);
    add(new THREE.SphereGeometry(armR * 1.25, 10, 8), armMat, x - s * 0.02, 1.83, 0);
    const arm = add(new THREE.CylinderGeometry(armR, armR * 0.86, 0.72, 10), armMat, x + s * 0.035, 1.47, 0);
    arm.rotation.z = s * 0.1;
    add(new THREE.SphereGeometry(armR * 1.15, 10, 8), M.skin, x + s * 0.075, 1.07, 0);
    if (s === -1 && has("wristband")) {
      const band = add(new THREE.CylinderGeometry(armR * 1.12, armR * 1.12, 0.1, 12), M.white, x + s * 0.062, 1.2, 0);
      band.rotation.z = s * 0.1;
    }
  }

  // Neck + head.
  add(new THREE.CylinderGeometry(0.1 * (b.arm > 1.1 ? 1.25 : 1), 0.115, 0.16, 10), M.skin, 0, 1.95, 0);
  const R = 0.29;
  const hy = 2.26;
  const head = new THREE.Group();
  head.position.set(0, hy, 0);
  body.add(head);
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
  let top = hy + R * 1.1;
  switch (L.hair) {
    case "buzz":
      cap(1.035, 1.42, 0.34);
      break;
    case "afro":
      cap(1.46, 1.78, 0.44, M.hair, 1.05);
      top += 0.14;
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
      top += 0.14;
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

  // Jersey number on chest and back.
  const digits = String(number ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  if (digits) {
    const numMat = new THREE.MeshBasicMaterial({ map: numberTexture(THREE, digits), transparent: true, depthWrite: false });
    const z = 0.345 * b.w * depth + 0.014;
    add(new THREE.PlaneGeometry(0.4, 0.3), numMat, 0, 1.6, z);
    const back = add(new THREE.PlaneGeometry(0.4, 0.3), numMat, 0, 1.6, -z);
    back.rotation.y = Math.PI;
  }

  body.scale.set(b.s, b.h, b.s);
  return { body, height: top * b.h };
}
