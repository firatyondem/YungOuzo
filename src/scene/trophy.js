// Optional rotating 3D trophy for the victory screen (assets/models/trophy.glb).
// Any failure rejects and the emoji trophy simply stays.
export async function mountTrophy(container, url) {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(2.2 / Math.max(size.x, size.y, size.z));
  const centre = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  model.position.sub(centre);
  const pivot = new THREE.Group();
  pivot.add(model);

  const px = Math.max(140, Math.min(300, Math.round(window.innerHeight * 0.26)));
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(px, px, false);
  canvas.style.width = canvas.style.height = px + "px";

  const scene = new THREE.Scene();
  scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x554422, 2.2));
  const key = new THREE.DirectionalLight(0xfff2cc, 3);
  key.position.set(3, 5, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.6, 5);
  camera.lookAt(0, 0, 0);

  container.replaceChildren(canvas);
  container.classList.add("has-model");
  function frame(now) {
    if (!canvas.isConnected) {
      renderer.dispose();
      return;
    }
    pivot.rotation.y = now / 900;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
