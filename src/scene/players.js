// Player figurines. Order of preference per player:
//   1. GLB model (assets/models/<archetype>.glb) when it exists
//   2. procedural figurine built from the player's `look` (scene/figurine.js)
//   3. plain coloured capsule (if procedural generation fails)
import { buildFigurineBody } from "./figurine.js";

// Offense spots as (x%, y%) of the half-court, shared with the CSS court.
export const SPOTS = [
  [20, 58],
  [80, 58],
  [37, 33],
  [50, 82],
  [64, 35],
];

function numberTexture(THREE, number, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = "#ffffff";
  g.stroke();
  g.fillStyle = "#0a0c11";
  g.font = "bold 72px 'Bebas Neue', Impact, Arial Narrow, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(number), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFigurines(THREE, scene, court) {
  const root = new THREE.Group();
  scene.add(root);
  let figs = [];
  const modelCache = new Map(); // url -> Promise<Object3D | null>
  let loaderPromise = null;

  function spotToWorld(slot, towardHoop = 0) {
    const [px, py] = SPOTS[slot % SPOTS.length];
    let x = ((px - 50) / 100) * court.width;
    let z = (py / 100) * court.length;
    x += (court.hoop.x - x) * towardHoop;
    z += (court.hoop.z - z) * towardHoop;
    return new THREE.Vector3(x, 0, z);
  }

  /** Fallback body: the original capsule figurine. */
  function capsuleBody({ color, isOpp }) {
    const body = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 1.0, 6, 14), mat);
    capsule.position.y = 0.96;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 12),
      new THREE.MeshStandardMaterial({ color: isOpp ? 0x2a3142 : 0xf2d3b3, roughness: 0.7 })
    );
    head.position.y = 2.16;
    body.add(capsule, head);
    return { body, height: 2.46 };
  }

  function makeFigure({ color, number, look, isOpp }) {
    const g = new THREE.Group();
    let built;
    try {
      built = buildFigurineBody(THREE, { color, number, look });
    } catch {
      built = capsuleBody({ color, isOpp });
    }
    const body = built.body;
    g.add(body);

    // Soft blob shadow + (for your players) a white ring on the floor.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    if (!isOpp) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.66, 0.8, 28),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      g.add(ring);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(THREE, number, color), depthTest: false }));
      sprite.scale.set(0.95, 0.95, 1);
      sprite.position.y = built.height + 0.62;
      sprite.renderOrder = 5;
      g.add(sprite);
    } else {
      g.scale.setScalar(0.9);
    }
    return { group: g, body };
  }

  async function loadModel(url) {
    if (!modelCache.has(url)) {
      modelCache.set(
        url,
        (async () => {
          try {
            if (!loaderPromise) loaderPromise = import("three/addons/loaders/GLTFLoader.js");
            const { GLTFLoader } = await loaderPromise;
            const gltf = await new GLTFLoader().loadAsync(url);
            return gltf.scene;
          } catch {
            return null; // missing or broken model: keep the capsule
          }
        })()
      );
    }
    return modelCache.get(url);
  }

  /** Scale a model to a target height, centre it and stand it on the floor. */
  function normalize(obj, height) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    if (!isFinite(size.y) || size.y <= 0) return false;
    const s = height / size.y;
    obj.scale.multiplyScalar(s);
    const b2 = new THREE.Box3().setFromObject(obj);
    const centre = b2.getCenter(new THREE.Vector3());
    obj.position.x -= centre.x;
    obj.position.z -= centre.z;
    obj.position.y -= b2.min.y;
    return true;
  }

  /**
   * lineup: players, team: opponent team, modelUrlFor(player) -> url | null.
   * Capsules appear immediately; models swap in when (and if) they load.
   */
  function setTeams(lineup, team, modelUrlFor = () => null) {
    root.clear();
    figs = [];
    const token = (setTeams.token = (setTeams.token || 0) + 1);
    lineup.forEach((p, i) => {
      const f = makeFigure({ color: p.color, number: p.jersey, look: p.look, isOpp: false });
      const pos = spotToWorld(i);
      f.group.position.copy(pos);
      // Figurines face the camera so their looks are visible; they turn to the hoop to shoot.
      const fig = { side: "player", slot: i, ...f, phase: i * 1.3, jumpAt: -1, ...facing(f.group, pos.x * 0.55, pos.z + 22) };
      root.add(f.group);
      figs.push(fig);
      const url = modelUrlFor(p);
      if (url) {
        loadModel(url).then((model) => {
          if (!model || token !== setTeams.token) return;
          try {
            const clone = model.clone(true);
            if (!normalize(clone, 2.45)) return;
            fig.body.clear();
            fig.body.scale.set(1, 1, 1);
            fig.body.add(clone);
          } catch {
            /* keep the capsule */
          }
        });
      }
    });
    for (let i = 0; i < SPOTS.length; i++) {
      const op = (team.players || [])[i] || {};
      const f = makeFigure({ color: team.color, number: op.jersey, look: op.look, isOpp: true });
      f.group.position.copy(spotToWorld(i, 0.3));
      const guard = spotToWorld(i);
      root.add(f.group);
      figs.push({ side: "opp", slot: i, ...f, phase: i * 2.1 + 1, jumpAt: -1, ...facing(f.group, guard.x, guard.z + 6) });
    }
  }

  /** Point the figure at (x, z) and remember that pose plus the pose facing the hoop. */
  function facing(group, x, z) {
    group.lookAt(court.hoop.x, group.position.y, court.hoop.z);
    const hoopQuat = group.quaternion.clone();
    group.lookAt(x, group.position.y, z);
    return { baseQuat: group.quaternion.clone(), hoopQuat };
  }

  function find(side, slot) {
    return figs.find((f) => f.side === side && f.slot === slot % SPOTS.length);
  }

  /** Where the ball leaves the shooter's hands. */
  function releasePoint(side, slot) {
    const f = find(side, slot);
    const p = f ? f.group.position.clone() : spotToWorld(slot);
    p.y = 2.8;
    return p;
  }

  function jump(side, slot, now) {
    const f = find(side, slot);
    if (f) f.jumpAt = now;
  }

  function update(now) {
    const t = now / 1000;
    for (const f of figs) {
      let y = Math.abs(Math.sin(t * 2.2 + f.phase)) * 0.06; // idle bounce
      if (f.jumpAt >= 0) {
        const jt = (now - f.jumpAt) / 620;
        if (jt >= 1) {
          f.jumpAt = -1;
          f.group.quaternion.copy(f.baseQuat);
        } else {
          y += Math.sin(Math.min(1, jt * 1.2) * Math.PI) * 0.75;
          // Turn to the hoop for the shot, then back.
          const k = jt < 0.75 ? Math.min(1, jt * 6) : (1 - jt) * 4;
          f.group.quaternion.copy(f.baseQuat).slerp(f.hoopQuat, k);
        }
      }
      f.body.position.y = y;
    }
  }

  return { setTeams, update, jump, releasePoint };
}
