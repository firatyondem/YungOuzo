// Player figurines. Order of preference per player:
//   1. GLB model (assets/models/<archetype>.glb) when it exists
//   2. procedural figurine built from the player's `look` (scene/figurine.js)
//   3. plain coloured capsule (if procedural generation fails)
import { buildFigurineBody, jerseyTexture, POSITION_HEIGHT } from "./figurine.js";
import { isRigged, mapClips, tintKit } from "./models.js";

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

  function makeFigure({ color, number, look, isOpp, position, name }) {
    const g = new THREE.Group();
    let built;
    try {
      built = buildFigurineBody(THREE, { color, number, look, position, name });
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
    return { group: g, body, rig: built.rig || null };
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
            // Loaded once per file; every figure gets its own clone (see useModel).
            return { scene: gltf.scene, clips: gltf.animations || [], rigged: isRigged(gltf.scene) };
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
      const f = makeFigure({ color: p.color, number: p.jersey, look: p.look, isOpp: false, position: p.position, name: p.name });
      const pos = spotToWorld(i);
      f.group.position.copy(pos);
      // Figurines face the camera so their looks are visible; they turn to the hoop to shoot.
      const fig = { side: "player", slot: i, ...f, phase: i * 1.3, jumpAt: -1, ...facing(f.group, pos.x * 0.55, pos.z + 22) };
      root.add(f.group);
      figs.push(fig);
      useModel(fig, p, p.color, modelUrlFor(p), token);
    });
    for (let i = 0; i < SPOTS.length; i++) {
      const op = (team.players || [])[i] || {};
      const f = makeFigure({ color: team.color, number: op.jersey, look: op.look, isOpp: true, position: op.position || ["PG", "SG", "SF", "PF", "C"][i], name: op.name });
      f.group.position.copy(spotToWorld(i, 0.3));
      const guard = spotToWorld(i);
      root.add(f.group);
      const fig = { side: "opp", slot: i, ...f, phase: i * 2.1 + 1, jumpAt: -1, ...facing(f.group, guard.x, guard.z + 6) };
      figs.push(fig);
      if (op.id) useModel(fig, { ...op, position: op.position || ["PG", "SG", "SF", "PF", "C"][i] }, team.color, modelUrlFor({ ...op, position: op.position || ["PG", "SG", "SF", "PF", "C"][i] }), token);
    }
  }

  const BUILD_SCALE = { lean: [0.94, 1], average: [1, 1], strong: [1.1, 1.02], tall: [1, 1.07] };

  /**
   * Swap the procedural body for a loaded model, if there is one. One load per
   * file (cached), one clone per figure (SkeletonUtils for rigged models), kit
   * tinted to the team colour, number on chest and back, height from position
   * and build, feet on the floor, clips mapped to game moments. Any failure
   * keeps the procedural figure.
   */
  function useModel(fig, player, color, url, token) {
    if (!url) return;
    loadModel(url).then(async (model) => {
      if (!model || token !== setTeams.token) return;
      try {
        let clone;
        if (model.rigged) {
          if (!skeletonUtils) skeletonUtils = import("three/addons/utils/SkeletonUtils.js");
          clone = (await skeletonUtils).clone(model.scene);
        } else clone = model.scene.clone(true);
        if (token !== setTeams.token) return;
        const look = player.look || {};
        const [wide, tall] = BUILD_SCALE[look.build] || BUILD_SCALE.average;
        const height = 2.42 * (POSITION_HEIGHT[player.position] || 1) * tall;
        if (!normalize(clone, height)) return;
        clone.scale.x *= wide;
        clone.scale.z *= wide;
        tintKit(THREE, clone, color);
        const holder = new THREE.Group();
        holder.add(clone);
        // Number on chest and back, placed from the model's own size.
        const digits = String(player.jersey ?? "").replace(/[^0-9]/g, "").slice(0, 2);
        if (digits) {
          const box = new THREE.Box3().setFromObject(clone);
          const depth = Math.max(0.12, (box.max.z - box.min.z) * 0.32);
          const mat = new THREE.MeshBasicMaterial({ map: jerseyTexture(THREE, digits, ""), transparent: true, depthWrite: false });
          const front = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.255), mat);
          front.position.set(0, height * 0.66, depth);
          const back = front.clone();
          back.position.z = -depth;
          back.rotation.y = Math.PI;
          holder.add(front, back);
        }
        fig.body.clear();
        fig.body.scale.set(1, 1, 1);
        fig.body.add(holder);
        fig.rig = null; // a loaded model has no procedural rig
        // Animation clips, when the file has them. Missing clips are simply not used.
        const clips = mapClips(model.clips);
        if (Object.keys(clips).length) {
          fig.mixer = new THREE.AnimationMixer(clone);
          fig.actions = {};
          for (const [key, clip] of Object.entries(clips)) fig.actions[key] = fig.mixer.clipAction(clip);
          fig.current = null;
          playClip(fig, baseClip(fig));
        }
      } catch {
        /* keep the procedural figure */
      }
    });
  }
  let skeletonUtils = null;

  /** The clip a figure rests in: defenders hold a stance, the ball handler dribbles, everyone else idles. */
  function baseClip(fig) {
    const a = fig.actions || {};
    if (fig.side === "opp" && a.defend) return "defend";
    if (fig.side === "player" && fig.slot === 3 && a.dribble) return "dribble";
    return a.idle ? "idle" : null;
  }

  /** Cross-fade (0.2 s) to a clip; one-shot clips return to the resting clip. */
  function playClip(fig, name, once = false) {
    if (!fig.mixer || !name || !fig.actions[name]) return false;
    const next = fig.actions[name];
    if (fig.current === next && !once) return true;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    if (fig.current && fig.current !== next) next.crossFadeFrom(fig.current, 0.2, false);
    next.play();
    fig.current = next;
    if (once) {
      const dur = (next.getClip().duration || 1) * 1000;
      clearTimeout(fig.clipTimer);
      fig.clipTimer = setTimeout(() => playClip(fig, baseClip(fig)), Math.min(dur, 1600));
    }
    return true;
  }

  function celebrate(side, slot) {
    const f = find(side, slot);
    if (f) playClip(f, "celebrate", true);
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

  function jump(side, slot, now, { layup = false } = {}) {
    const f = find(side, slot);
    if (!f) return;
    f.jumpAt = now;
    // Models with clips: a lay-up on drives, otherwise the shooting clip.
    if (!(layup && playClip(f, "layup", true))) playClip(f, "shoot", true);
  }

  let lastNow = 0;
  function update(now) {
    const t = now / 1000;
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
    lastNow = now;
    for (const f of figs) {
      if (f.mixer) f.mixer.update(dt);
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
      if (f.rig) pose(f, t, f.jumpAt >= 0 ? (now - f.jumpAt) / 620 : -1);
    }
  }

  // Poses. Everything is a small rotation of the rig's pivots, so it costs nothing.
  // Your five: breathing, loose arms, and the player at the top of the key dribbles.
  // Their five: a defensive stance (wide base, arms out, a little slide).
  // Whoever shoots: both arms go up through the jump.
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function pose(f, t, jt) {
    const r = f.rig;
    const wave = still ? 0 : Math.sin(t * 1.9 + f.phase);
    let armLx = wave * 0.07;
    let armRx = -wave * 0.07;
    let armLz = 0.1;
    let armRz = -0.1;
    let legSpread = 0;
    let sink = 0;
    if (f.side === "opp") {
      legSpread = 0.26;
      sink = 0.07;
      armLz = 1.05 + wave * 0.08;
      armRz = -1.05 + wave * 0.08;
      armLx = armRx = -0.25;
    } else if (f.slot === 3 && !still) {
      // Dribble with the right hand.
      const d = Math.sin(t * 7.2 + f.phase);
      armRx = -0.55 + d * 0.3;
      armRz = -0.22;
    }
    if (jt >= 0 && jt < 1) {
      // Shooting form: up fast, hold the follow-through, come down.
      const k = jt < 0.25 ? jt / 0.25 : jt > 0.8 ? (1 - jt) / 0.2 : 1;
      armLx = armLx * (1 - k) - 2.75 * k;
      armRx = armRx * (1 - k) - 2.95 * k;
      armLz = armLz * (1 - k) + 0.12 * k;
      armRz = armRz * (1 - k) - 0.12 * k;
      legSpread *= 1 - k;
      sink *= 1 - k;
    }
    r.armL.rotation.set(armLx, 0, armLz);
    r.armR.rotation.set(armRx, 0, armRz);
    r.legL.rotation.z = legSpread;
    r.legR.rotation.z = -legSpread;
    r.upper.position.y = -sink;
    r.upper.scale.y = 1 + (still ? 0 : wave * 0.012); // breathing
    f.body.position.y -= legSpread ? 0.03 : 0;
  }

  /** World-space bounding boxes of the figures (body only: the floating number disc is not a model). */
  function boxes() {
    return figs.map((f) => {
      const box = new THREE.Box3().setFromObject(f.body);
      return { side: f.side, slot: f.slot, min: box.min, max: box.max, depth: f.group.position.z };
    });
  }

  return { setTeams, update, jump, releasePoint, boxes, celebrate };
}
