// Three.js half-court. An enhancement only: if anything here throws, the game
// keeps using the CSS court. Same interface as ui/cssCourt.js.
import { createFigurines } from "./players.js";
import { createBall } from "./ball.js";
import { hasAsset } from "../assets.js";

// World units ~ metres. Baseline at z = 0, half-court line at z = 14.
const COURT = { width: 15, length: 14, hoop: { x: 0, y: 3.05, z: 1.6 } };
const MODEL_DIR = "assets/models/";

function floorTexture(THREE) {
  const W = 1024;
  const H = Math.round((W * COURT.length) / COURT.width);
  const s = W / COURT.width; // px per metre
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const X = (x) => (x + COURT.width / 2) * s;
  const Z = (z) => z * s;

  // Wood planks.
  g.fillStyle = "#c58a4c";
  g.fillRect(0, 0, W, H);
  const plank = W / 30;
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(${i % 2 ? 0 : 255},${i % 2 ? 0 : 230},${i % 2 ? 0 : 190},${0.03 + ((i * 7) % 5) * 0.012})`;
    g.fillRect(i * plank, 0, plank, H);
    g.fillStyle = "rgba(60,30,5,0.28)";
    g.fillRect(i * plank, 0, 1.5, H);
  }

  // Painted areas + lines.
  g.fillStyle = "rgba(240, 96, 12, 0.78)";
  g.fillRect(X(-2.45), Z(0), 4.9 * s, 5.8 * s);
  g.strokeStyle = "#ffffff";
  g.lineWidth = 7;
  g.lineJoin = "round";
  g.strokeRect(3.5, 3.5, W - 7, H - 7);
  g.strokeRect(X(-2.45), Z(0), 4.9 * s, 5.8 * s);
  g.beginPath();
  g.arc(X(0), Z(5.8), 1.8 * s, 0, Math.PI * 2);
  g.stroke();
  // Three-point line: corner straights + arc.
  const r3 = 6.75;
  const cornerX = 6.6;
  const dz = Math.sqrt(r3 * r3 - cornerX * cornerX);
  const a = Math.atan2(dz, cornerX);
  g.beginPath();
  g.moveTo(X(cornerX), Z(0));
  g.lineTo(X(cornerX), Z(COURT.hoop.z + dz));
  g.arc(X(0), Z(COURT.hoop.z), r3 * s, a, Math.PI - a);
  g.lineTo(X(-cornerX), Z(0));
  g.stroke();
  // Restricted area + centre circle.
  g.beginPath();
  g.arc(X(0), Z(COURT.hoop.z), 1.25 * s, 0, Math.PI);
  g.stroke();
  g.beginPath();
  g.arc(X(0), Z(COURT.length), 1.8 * s, Math.PI, Math.PI * 2);
  g.stroke();
  // Court branding.
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.font = "bold 92px 'Bebas Neue', Impact, sans-serif";
  g.textAlign = "center";
  g.fillText("FULL COURT RUN", X(0), Z(10.9));

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function crowdTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#05070c");
  grad.addColorStop(1, "#151c2c");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 256);
  // Deterministic "crowd" dots (presentation only, no gameplay RNG involved).
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cols = ["#ff7a1a", "#ffd9b0", "#ffffff", "#7c8aa5", "#3b9dff", "#444c60"];
  for (let row = 0; row < 11; row++) {
    for (let i = 0; i < 90; i++) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.globalAlpha = 0.25 + rnd() * 0.5;
      g.beginPath();
      g.arc(i * 11.4 + (row % 2) * 5 + rnd() * 3, 40 + row * 19 + rnd() * 4, 3.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildHoop(THREE) {
  const g = new THREE.Group();
  const h = COURT.hoop;
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6fb, roughness: 0.4 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 0.06), white);
  board.position.set(0, 3.55, h.z - 0.42);
  const square = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.5, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xff5a12 })
  );
  square.position.set(0, 3.36, h.z - 0.38);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.02), new THREE.MeshBasicMaterial({ color: 0xf4f6fb }));
  inner.position.set(0, 3.36, h.z - 0.37);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.035, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xff4a12, roughness: 0.4, emissive: 0x551400 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(h.x, h.y, h.z);
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.18, 0.5, 12, 3, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.85 })
  );
  net.position.set(h.x, h.y - 0.27, h.z);
  const dark = new THREE.MeshStandardMaterial({ color: 0x232a3a, roughness: 0.6 });
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.6, 0.22), dark);
  pole.position.set(0, 1.8, h.z - 1.5);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.1), dark);
  arm.position.set(0, 3.45, h.z - 0.98);
  g.add(board, square, inner, rim, net, pole, arm);
  return { group: g, rim, net };
}

/**
 * Create the 3D court. Throws if Three.js / WebGL is unavailable.
 * opts: { canvas, wrap, manifest, config }
 */
export async function createThreeCourt({ canvas, wrap, manifest = null, config = {} }) {
  const THREE = await import("three");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x080a10, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x080a10, 30, 60);
  const camera = new THREE.PerspectiveCamera(36, 1.6, 0.1, 120);

  // Lights.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3350, 1.9));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(5, 16, 12);
  const fill = new THREE.DirectionalLight(0xa9c8ff, 0.9);
  fill.position.set(-8, 9, 3);
  scene.add(key, fill);

  // Floor + apron + backdrop.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width, COURT.length),
    new THREE.MeshStandardMaterial({ map: floorTexture(THREE), roughness: 0.55, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, COURT.length / 2);
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x121829, roughness: 0.9 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, -0.02, 8);
  const crowd = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 13),
    new THREE.MeshBasicMaterial({ map: crowdTexture(THREE), fog: false })
  );
  crowd.position.set(0, 5.6, -7);
  const sideMat = new THREE.MeshBasicMaterial({ map: crowd.material.map, fog: false, color: 0x8892a8 });
  const left = new THREE.Mesh(new THREE.PlaneGeometry(40, 13), sideMat);
  left.position.set(-17, 5.6, 8);
  left.rotation.y = Math.PI / 2.6;
  const right = new THREE.Mesh(new THREE.PlaneGeometry(40, 13), sideMat);
  right.position.set(17, 5.6, 8);
  right.rotation.y = -Math.PI / 2.6;
  const procedural = new THREE.Group();
  procedural.add(floor);
  scene.add(procedural, apron, crowd, left, right);

  const hoop = buildHoop(THREE);
  scene.add(hoop.group);

  const figs = createFigurines(THREE, scene, COURT);
  const ball = createBall(THREE, scene);

  // Optional models. Listed in the manifest -> load; no manifest -> try silently.
  const wanted = (file) => hasAsset(manifest, "models", file) !== false;
  const modelUrlFor = (p) => {
    const file = p.model || `${String(p.archetype).toLowerCase()}.glb`;
    return wanted(file) ? MODEL_DIR + file : null;
  };
  async function loadOptional(file) {
    if (hasAsset(manifest, "models", file) !== true) return null; // only when known to exist
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      return (await new GLTFLoader().loadAsync(MODEL_DIR + file)).scene;
    } catch {
      return null;
    }
  }
  loadOptional("ball.glb").then((obj) => {
    if (!obj) return;
    try {
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const s = 0.54 / Math.max(size.x, size.y, size.z);
      obj.scale.multiplyScalar(s);
      const centre = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      obj.position.sub(centre);
      ball.setModel(obj);
    } catch {}
  });
  if (config.USE_COURT_MODEL) {
    loadOptional("court.glb").then((obj) => {
      if (!obj) return;
      try {
        // Fit the model's footprint to the playing area and rest it on the ground.
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        obj.scale.multiplyScalar(COURT.width / size.x);
        const b2 = new THREE.Box3().setFromObject(obj);
        const centre = b2.getCenter(new THREE.Vector3());
        obj.position.x -= centre.x;
        obj.position.z += COURT.length / 2 - centre.z;
        obj.position.y -= b2.max.y; // top surface at y = 0
        scene.add(obj);
        procedural.visible = false;
      } catch {}
    });
  }

  // Sizing (handles CSS zoom on big screens).
  function resize() {
    const w = Math.max(1, wrap.clientWidth);
    const h = Math.max(1, wrap.clientHeight);
    const rect = wrap.getBoundingClientRect();
    const zoom = rect.width / w || 1;
    renderer.setPixelRatio(Math.min(2.5, (window.devicePixelRatio || 1) * zoom));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // Narrower views pull the camera back so the whole half-court stays visible.
    const back = Math.max(0, 1.62 - aspect) * 11;
    camera.position.set(0, 12.4 + back * 0.5, 19.2 + back);
    camera.lookAt(0, 0.9, 5.6);
    camera.updateProjectionMatrix();
  }
  resize();
  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(resize);
    ro.observe(wrap);
  }
  window.addEventListener("resize", resize);

  // Render loop (only draws while the court is on screen).
  let active = true;
  let raf = 0;
  let netPulse = -1;
  let rimShake = -1;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!active || canvas.hidden || canvas.offsetParent === null) return;
    figs.update(now);
    ball.update(now);
    if (netPulse >= 0) {
      const t = (now - netPulse) / 420;
      hoop.net.scale.y = t >= 1 ? 1 : 1 + Math.sin(t * Math.PI) * 0.5;
      if (t >= 1) netPulse = -1;
    }
    if (rimShake >= 0) {
      const t = (now - rimShake) / 380;
      hoop.rim.rotation.y = t >= 1 ? 0 : Math.sin(t * 30) * 0.08 * (1 - t);
      if (t >= 1) rimShake = -1;
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  let lost = false;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    court.onContextLost?.();
  });

  const court = {
    kind: "three",
    onContextLost: null,
    setTeams(lineup, team) {
      figs.setTeams(lineup, team, modelUrlFor);
    },
    /** Animate a shot. Resolves when the ball reaches the rim. */
    shoot({ side, slot = 0, made, points = 2 }, ms = 700) {
      if (lost) return Promise.resolve();
      const now = performance.now();
      figs.jump(side, slot, now);
      const from = figs.releasePoint(side, slot);
      return ball
        .shoot({ from, hoop: COURT.hoop, made, dir: slot % 2 === 0 ? 1 : -1, ms })
        .then(() => {
          if (made) netPulse = performance.now();
          else rimShake = performance.now();
        });
    },
    /** Screen position of a figurine's chest, for effects. */
    screenPoint(side, slot) {
      const p = figs.releasePoint(side, slot);
      p.y = 1.5;
      p.project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
    },
    setVisible(v) {
      active = v;
      canvas.hidden = !v;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", resize);
      renderer.dispose();
    },
  };
  // First frame right away so a broken context shows up as an exception here.
  renderer.render(scene, camera);
  return court;
}
