// The ball: arcs to the hoop; makes drop through the net, misses bounce off the rim.

function ballTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#e8650f";
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#3a1500";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, 64);
  g.lineTo(256, 64);
  for (const x of [64, 192]) {
    g.moveTo(x, 0);
    g.lineTo(x, 128);
  }
  g.moveTo(0, 0);
  g.bezierCurveTo(40, 50, 40, 78, 0, 128);
  g.moveTo(128, 0);
  g.bezierCurveTo(168, 50, 168, 78, 128, 128);
  g.moveTo(128, 0);
  g.bezierCurveTo(88, 50, 88, 78, 128, 128);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBall(THREE, scene) {
  const holder = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 20, 14),
    new THREE.MeshStandardMaterial({ map: ballTexture(THREE), roughness: 0.75 })
  );
  holder.add(mesh);
  holder.visible = false;
  scene.add(holder);

  let anim = null; // { phases: [{ from, to, arc, ms }], index, start, onArrive }

  /** Replace the procedural sphere with a loaded model (ball.glb). */
  function setModel(obj) {
    holder.remove(mesh);
    holder.add(obj);
  }

  /**
   * from: Vector3, hoop: {x,y,z}. Resolves when the ball reaches the rim
   * (a timeout guarantees it resolves even if no frames are rendered).
   */
  function shoot({ from, hoop, made, dir = 1, ms = 700 }) {
    return new Promise((resolve) => {
      const rim = new THREE.Vector3(hoop.x, hoop.y + 0.12, hoop.z);
      const dist = from.distanceTo(rim);
      const target = made ? rim : rim.clone().add(new THREE.Vector3(dir * 0.16, 0.05, 0.2));
      const phases = [{ from: from.clone(), to: target, arc: 0.9 + dist * 0.13, ms }];
      if (made) {
        phases.push({ from: target, to: new THREE.Vector3(hoop.x, 0.3, hoop.z + 0.1), arc: 0, ms: 330 });
        phases.push({ from: new THREE.Vector3(hoop.x, 0.3, hoop.z + 0.1), to: new THREE.Vector3(hoop.x, 0.3, hoop.z + 1.2), arc: 0.7, ms: 300 });
      } else {
        phases.push({ from: target, to: new THREE.Vector3(hoop.x + dir * 2.6, 0.3, hoop.z + 3.2), arc: 1.3, ms: 520 });
      }
      let arrived = false;
      const onArrive = () => {
        if (arrived) return;
        arrived = true;
        resolve();
      };
      anim = { phases, index: 0, start: performance.now(), onArrive };
      holder.position.copy(from);
      holder.visible = true;
      setTimeout(onArrive, ms + 120);
    });
  }

  function update(now) {
    if (!anim) return;
    let phase = anim.phases[anim.index];
    let t = (now - anim.start) / phase.ms;
    while (t >= 1) {
      if (anim.index === 0) anim.onArrive();
      anim.index++;
      if (anim.index >= anim.phases.length) {
        anim = null;
        holder.visible = false;
        return;
      }
      anim.start += phase.ms;
      phase = anim.phases[anim.index];
      t = (now - anim.start) / phase.ms;
    }
    holder.position.lerpVectors(phase.from, phase.to, t);
    holder.position.y += phase.arc * 4 * t * (1 - t);
    holder.rotation.x -= 0.25;
    holder.rotation.z += 0.07;
  }

  return { shoot, update, setModel, isBusy: () => !!anim };
}
