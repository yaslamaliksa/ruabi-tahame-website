import * as THREE from './vendor/three.module.min.js';
import { buildCrane } from './crane-model.js';

// True WebGL geometry. The existing vector crane stays available if WebGL fails.
const intro = document.querySelector('#crane-intro');
if (intro) {
  let renderer;
  let stage;
  let ready = false;
  let frame = 0;
  let drawing = false;
  let width = 1, height = 1, scale = 1;
  let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0;
  let lift = null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  try {
    stage = document.createElement('div');
    stage.className = 'intro-three-stage';
    stage.hidden = true;
    stage.setAttribute('aria-hidden', 'true');
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth <= 600 ? 1.5 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.append(renderer.domElement);
    intro.append(stage);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
    const target = new THREE.Vector3(0, 2.75, 0);
    scene.add(new THREE.HemisphereLight(0xe6f6f5, 0x9b9478, 2.5));
    const key = new THREE.DirectionalLight(0xffeddb, 4.2);
    key.position.set(-5, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: .1, far: 40 });
    key.shadow.bias = -.0003;
    key.shadow.normalBias = .025;
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xa1d8d0, 2.1);
    rim.position.set(7, 5, -6);
    scene.add(rim);
    const crane = buildCrane(THREE);
    const root = new THREE.Group();
    root.add(crane.group);
    scene.add(root);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(19, 7), new THREE.ShadowMaterial({ opacity: .12, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -.07, 0);
    floor.receiveShadow = true;
    root.add(floor);

    const steel = new THREE.MeshStandardMaterial({ color: 0x284d47, roughness: .36, metalness: .72 });
    const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x385a50, roughness: .65, metalness: .4 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xed7648, roughness: .34, metalness: .26 });
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
    const segments = Array.from({ length: 4 }, () => {
      const mesh = new THREE.Mesh(cylinder, ropeMaterial);
      mesh.castShadow = true; mesh.visible = false; scene.add(mesh); return mesh;
    });
    const hookRoot = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .15), orange);
    block.castShadow = true; hookRoot.add(block);
    for (let i = -1; i <= 1; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.026, .21, .008), steel);
      stripe.position.set(i * .065, 0, .079); stripe.rotation.z = .3; hookRoot.add(stripe);
    }
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .19, 12), steel);
    wheel.rotation.x = Math.PI / 2; wheel.position.y = .01; hookRoot.add(wheel);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.085, .021, 6, 18, Math.PI * 1.6), steel);
    hook.position.y = -.18; hook.rotation.z = Math.PI * .05; hook.castShadow = true; hookRoot.add(hook);
    hookRoot.visible = false;
    scene.add(hookRoot);
    const up = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), diff = new THREE.Vector3();
    const anchor = new THREE.Vector3(), projected = new THREE.Vector3(), cameraUp = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    let anchorDepth = 0;

    function updateCamera() {
      const angle = .46 + yaw;
      camera.position.set(Math.sin(angle) * 18, 5.6 + pitch, Math.cos(angle) * 18);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
    }
    function fit() {
      width = Math.max(1, intro.clientWidth);
      height = Math.max(1, intro.clientHeight);
      renderer.setSize(width, height, false);
      root.position.set(0, 0, 0);
      scene.updateMatrixWorld(true);
      updateCamera();
      const box = new THREE.Box3().setFromObject(crane.group);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        tmp.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        minX = Math.min(minX, tmp.x); maxX = Math.max(maxX, tmp.x);
        minY = Math.min(minY, tmp.y); maxY = Math.max(maxY, tmp.y);
      }
      scale = Math.min(width * .89 / (maxX - minX), height * .42 / (maxY - minY));
      const halfW = width / (2 * scale), halfH = height / (2 * scale);
      const centerX = (minX + maxX) / 2;
      // Frame the entire crane above the introduction's lifting seam.
      const centerY = (minY + maxY) / 2 - halfH * .4;
      camera.left = centerX - halfW; camera.right = centerX + halfW;
      camera.top = centerY + halfH; camera.bottom = centerY - halfH;
      camera.updateProjectionMatrix();
      if (lift) applyCameraRise();
    }
    function applyCameraRise() {
      cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
      root.position.copy(cameraUp).multiplyScalar((lift?.cameraRise || 0) / scale);
      root.updateMatrixWorld(true);
    }
    function getAnchor() {
      // Return the neutral anchor, so the intro can solve its hoist travel exactly.
      const saved = root.position.clone();
      root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      crane.hoist.getWorldPosition(anchor);
      projected.copy(anchor).project(camera);
      anchorDepth = projected.z;
      const result = { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2 };
      root.position.copy(saved); root.updateMatrixWorld(true);
      return result;
    }
    function screenToWorld(x, y, output) {
      return output.set(x / width * 2 - 1, 1 - y / height * 2, anchorDepth).unproject(camera);
    }
    function segment(mesh, from, to, radius) {
      diff.subVectors(to, from);
      mesh.position.copy(from).add(to).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(up, diff.clone().normalize());
      mesh.scale.set(radius, Math.max(.001, diff.length()), radius);
    }
    function updateRopes() {
      if (!lift) return;
      const hookY = lift.hookY;
      const hookX = lift.hookX;
      // Keep the hook's visual size usable on small screens, independent of fit.
      const unit = 75 / scale;
      hookRoot.visible = true;
      segments.forEach(mesh => { mesh.visible = true; });
      const halfCable = 2.4;
      screenToWorld(hookX, hookY - 10, hookRoot.position);
      hookRoot.quaternion.copy(camera.quaternion);
      hookRoot.scale.setScalar(unit);
      for (let i = 0; i < 2; i++) {
        const x = hookX + (i ? halfCable : -halfCable);
        screenToWorld(x, lift.ropeTop, a);
        screenToWorld(x, hookY - 18, b);
        segment(segments[i], a, b, 1 / scale);
      }
      screenToWorld(hookX, hookY + 12, a);
      screenToWorld(lift.a.x, lift.a.y, b); segment(segments[2], a, b, .85 / scale);
      screenToWorld(lift.b.x, lift.b.y, b); segment(segments[3], a, b, .85 / scale);
      if (crane.drum) crane.drum.rotation.z = lift.progress * Math.PI * 8;
    }
    function fallback() {
      ready = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      intro.classList.remove('intro-3d-ready');
      stage.hidden = true;
      window.SiteCrane3D = undefined;
      window.SiteIntro?.refreshRig();
    }
    function draw() {
      frame = 0;
      if (!ready || intro.hidden || document.hidden) return;
      drawing = true;
      try {
        yaw += (targetYaw - yaw) * .15;
        pitch += (targetPitch - pitch) * .15;
        updateCamera();
        window.SiteIntro?.syncAnchor(getAnchor());
        applyCameraRise(); updateRopes();
        renderer.render(scene, camera);
      } catch { fallback(); }
      finally { drawing = false; }
      if (ready && !reduce.matches && (Math.abs(targetYaw - yaw) > .0003 || Math.abs(targetPitch - pitch) > .003)) request();
    }
    function request() {
      if (ready && !frame && !drawing && !intro.hidden && !document.hidden) frame = requestAnimationFrame(draw);
    }
    const api = {
      getAnchor,
      setLift(value) { lift = value; request(); },
      open() { targetYaw = targetPitch = yaw = pitch = 0; fit(); request(); },
      close() { if (frame) cancelAnimationFrame(frame); frame = 0; },
      resize() { fit(); request(); }
    };
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });
    intro.addEventListener('pointermove', event => {
      if (!ready || reduce.matches || !fine.matches || intro.classList.contains('is-dragging') || intro.classList.contains('is-lifting')) return;
      targetYaw = (event.clientX / width - .5) * .14;
      targetPitch = (event.clientY / height - .35) * .65;
      request();
    }, { passive: true });
    intro.addEventListener('pointerleave', () => { targetYaw = targetPitch = 0; request(); });
    reduce.addEventListener('change', () => { targetYaw = targetPitch = yaw = pitch = 0; request(); });
    fine.addEventListener('change', () => { targetYaw = targetPitch = 0; request(); });
    window.addEventListener('resize', () => { if (ready && !intro.hidden) { api.resize(); window.SiteIntro?.refreshRig(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) api.close(); else request(); });
    // Render successfully before swapping away from the working vector fallback.
    fit(); renderer.render(scene, camera);
    ready = true;
    window.SiteCrane3D = api;
    intro.classList.add('intro-3d-ready');
    stage.hidden = false;
    window.SiteIntro?.refreshRig();
    request();
  } catch {
    renderer?.dispose();
    stage?.remove();
    // Unsupported WebGL leaves the fully interactive vector version in place.
  }
}
