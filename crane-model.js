/** True dimensional tower crane. All scene primitives are locally constructed. */
export function buildCrane(THREE) {
  const group = new THREE.Group();
  group.name = 'Enjaz tower crane';
  const materials = {
    orange: new THREE.MeshStandardMaterial({ color: '#ed7648', roughness: .48, metalness: .38 }),
    highlight: new THREE.MeshStandardMaterial({ color: '#ffac73', roughness: .46, metalness: .34 }),
    darkOrange: new THREE.MeshStandardMaterial({ color: '#b84e29', roughness: .58, metalness: .34 }),
    teal: new THREE.MeshStandardMaterial({ color: '#12393c', roughness: .43, metalness: .5 }),
    mint: new THREE.MeshStandardMaterial({ color: '#85bcb6', roughness: .55, metalness: .22 }),
    steel: new THREE.MeshStandardMaterial({ color: '#526362', roughness: .43, metalness: .76 }),
    cable: new THREE.MeshStandardMaterial({ color: '#344744', roughness: .6, metalness: .62 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#b3bab0', roughness: .94, metalness: .02 }),
    concreteEdge: new THREE.MeshStandardMaterial({ color: '#88998e', roughness: .91, metalness: .02 }),
    glass: new THREE.MeshStandardMaterial({ color: '#5d9ca4', roughness: .18, metalness: .25, transparent: true, opacity: .76 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#223432', roughness: .86, metalness: .12 })
  };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const roundGeometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);
  const batches = new Map();
  const up = new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  function addInstance(geometry, material, pos, size, rotation = null) {
    const key = geometry.uuid + '/' + material.uuid;
    if (!batches.has(key)) batches.set(key, { geometry, material, matrices: [] });
    position.set(...pos); scale.set(...size);
    if (rotation) quaternion.setFromEuler(new THREE.Euler(...rotation)); else quaternion.identity();
    matrix.compose(position, quaternion, scale);
    batches.get(key).matrices.push(matrix.clone());
  }
  function box(pos, size, material = materials.orange, rotation = null) {
    addInstance(boxGeometry, material, pos, size, rotation);
  }
  function beam(a, b, radius = .025, material = materials.orange) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const length = delta.length();
    if (length < .0001) return;
    const key = beamGeometry.uuid + '/' + material.uuid;
    if (!batches.has(key)) batches.set(key, { geometry: beamGeometry, material, matrices: [] });
    position.copy(start).add(end).multiplyScalar(.5);
    quaternion.setFromUnitVectors(up, delta.multiplyScalar(1 / length));
    scale.set(radius, length, radius);
    matrix.compose(position, quaternion, scale);
    batches.get(key).matrices.push(matrix.clone());
  }
  function cylinder(pos, radius, length, material, rotation = null) {
    addInstance(roundGeometry, material, pos, [radius, length, radius], rotation);
  }

  // Four grounded steel outriggers and concrete pads give the mast real weight.
  const mastX = 3.5;
  const half = .285;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = mastX + sx * .64, z = sz * .64;
    box([x, .055, z], [.49, .11, .49], materials.concrete);
    box([x, .125, z], [.32, .03, .32], materials.steel);
    beam([mastX, .26, 0], [x, .165, z], .065, materials.teal);
    cylinder([x, .17, z], .023, .065, materials.steel);
  }
  box([mastX, .25, 0], [.84, .18, .84], materials.teal);
  box([mastX, .365, 0], [.7, .05, .7], materials.steel);

  // Square lattice mast: cylindrical chords and cross braces on all four faces.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    beam([mastX + sx * half, .36, sz * half], [mastX + sx * half, 4.4, sz * half], .047, materials.orange);
  }
  const levels = 7;
  const y0 = .42, step = 3.85 / levels;
  for (let level = 0; level <= levels; level++) {
    const y = y0 + level * step;
    for (const s of [-1, 1]) {
      beam([mastX - half, y, s * half], [mastX + half, y, s * half], .03, materials.orange);
      beam([mastX + s * half, y, -half], [mastX + s * half, y, half], .03, materials.orange);
    }
    if (level === levels) continue;
    const top = y + step;
    for (const s of [-1, 1]) {
      beam([mastX - half, y, s * half], [mastX + half, top, s * half], .022, materials.highlight);
      beam([mastX + half, y, s * half], [mastX - half, top, s * half], .022, materials.orange);
      beam([mastX + s * half, y, -half], [mastX + s * half, top, half], .022, materials.highlight);
      beam([mastX + s * half, y, half], [mastX + s * half, top, -half], .022, materials.orange);
    }
    // Visible bolted connector plates along the mast joints.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box([mastX + sx * half, y + .02, sz * half], [.11, .14, .075], materials.darkOrange);
      cylinder([mastX + sx * half, y + .025, sz * (half + .046)], .018, .035, materials.steel, [Math.PI / 2, 0, 0]);
    }
  }
  // Narrow ladder and intermediate landings, kept clear of the hoist face.
  for (const x of [mastX - .1, mastX + .1]) beam([x, .42, -.055], [x, 4.15, -.055], .013, materials.steel);
  for (let y = .5; y < 4.12; y += .145) beam([mastX - .1, y, -.055], [mastX + .1, y, -.055], .011, materials.steel);
  for (const y of [1.52, 2.63, 3.73]) box([mastX, y, -.015], [.42, .025, .38], materials.teal);

  // Slewing ring, turntable and maintenance platform below the jib.
  cylinder([mastX, 4.29, 0], .44, .15, materials.teal);
  cylinder([mastX, 4.39, 0], .39, .055, materials.steel);
  box([mastX, 4.45, 0], [1.03, .09, .89], materials.orange);
  box([mastX + .15, 4.18, -.54], [1.4, .055, .39], materials.steel);
  for (const x of [mastX - .5, mastX + .25, mastX + .85]) {
    beam([x, 4.2, -.72], [x, 4.56, -.72], .016, materials.teal);
  }
  beam([mastX - .5, 4.56, -.72], [mastX + .85, 4.56, -.72], .017, materials.teal);

  // Full three-dimensional, four-chord lattice jib with underside bracing.
  const jibStart = -5, jibEnd = 5, lower = 4.17, upper = 4.62, depth = .26;
  for (const y of [lower, upper]) for (const z of [-depth, depth]) {
    beam([jibStart, y, z], [jibEnd, y, z], .037, y === upper ? materials.highlight : materials.orange);
  }
  const bayCount = 20, bay = (jibEnd - jibStart) / bayCount;
  for (let i = 0; i <= bayCount; i++) {
    const x = jibStart + i * bay;
    for (const z of [-depth, depth]) beam([x, lower, z], [x, upper, z], .024, materials.orange);
    for (const y of [lower, upper]) beam([x, y, -depth], [x, y, depth], .022, materials.orange);
    if (i === bayCount) continue;
    const nx = x + bay;
    for (const z of [-depth, depth]) beam([x, i % 2 ? upper : lower, z], [nx, i % 2 ? lower : upper, z], .022, materials.orange);
    beam([x, upper, -depth], [nx, upper, depth], .018, materials.highlight);
    beam([x, lower, depth], [nx, lower, -depth], .018, materials.orange);
  }
  // Rounded end caps and an underslung trolley rail.
  for (const x of [jibStart, jibEnd]) box([x, 4.39, 0], [.09, .54, .62], materials.darkOrange);
  for (const z of [-.145, .145]) box([0, 4.135, z], [9.8, .035, .035], materials.steel);
  // Small caution blocks along the jib, modeled rather than textured.
  for (const x of [-4.75, -2.75, -.75, 1.25]) {
    box([x, 4.4, depth + .018], [.13, .12, .018], materials.mint);
  }

  // A-frame mast head and four taut structural stays.
  for (const z of [-.23, .23]) {
    beam([mastX - .38, 4.57, z], [mastX, 5.7, 0], .047, materials.orange);
    beam([mastX + .36, 4.57, z], [mastX, 5.7, 0], .047, materials.highlight);
  }
  beam([mastX, 5.7, 0], [-4.8, upper, -.18], .015, materials.cable);
  beam([mastX, 5.7, 0], [-4.8, upper, .18], .015, materials.cable);
  beam([mastX, 5.66, 0], [4.92, upper, -.18], .018, materials.cable);
  beam([mastX, 5.66, 0], [4.92, upper, .18], .018, materials.cable);
  cylinder([mastX, 5.7, 0], .075, .14, materials.teal, [Math.PI / 2, 0, 0]);
  cylinder([mastX, 5.75, 0], .029, .11, materials.steel);

  // Solid counterweights have individual visible edges and hanging supports.
  for (const x of [4.05, 4.39, 4.73]) {
    box([x, 3.95, 0], [.3, .66, .7], materials.concrete);
    box([x, 3.95, .36], [.26, .53, .025], materials.concreteEdge);
    for (const z of [-.32, .32]) beam([x, 4.18, z], [x, 4.58, z], .025, materials.steel);
  }
  box([4.4, 3.6, 0], [1.14, .07, .78], materials.teal);

  // Operator cabin: glazed front and side faces with slim structural framing.
  box([3.03, 3.93, .51], [.69, .67, .58], materials.teal);
  box([2.67, 4.0, .51], [.025, .38, .47], materials.glass);
  box([3.03, 4.0, .811], [.57, .38, .025], materials.glass);
  box([3.03, 4.295, .51], [.81, .06, .7], materials.orange);
  box([3.03, 3.59, .51], [.76, .065, .65], materials.steel);
  for (const x of [2.7, 3.36]) beam([x, 3.65, .81], [x, 4.24, .81], .023, materials.orange);
  beam([3.03, 3.79, .825], [3.03, 4.22, .825], .017, materials.teal);
  beam([2.7, 3.79, .825], [3.36, 3.79, .825], .018, materials.orange);
  box([3.13, 3.86, .53], [.19, .29, .2], materials.rubber);
  box([2.82, 3.91, .53], [.18, .055, .28], materials.steel);

  // Trolley, pulley wheels and suspended anchor directly below the lower rail.
  const trolleyX = -.5;
  box([trolleyX, 4.235, 0], [.42, .15, .46], materials.teal);
  for (const x of [trolleyX - .15, trolleyX + .15]) for (const z of [-.21, .21]) {
    cylinder([x, 4.23, z], .067, .04, materials.steel, [Math.PI / 2, 0, 0]);
    cylinder([x, 4.23, z * 1.12], .028, .045, materials.orange, [Math.PI / 2, 0, 0]);
  }
  box([trolleyX, 4.16, 0], [.31, .085, .31], materials.orange);
  const hoist = new THREE.Object3D();
  hoist.name = 'Trolley cable anchor';
  hoist.position.set(trolleyX, 4.17, 0);
  group.add(hoist);

  // A separate winch/drum group allows subtle mechanical rotation on demand.
  const drum = new THREE.Group();
  drum.name = 'Hoist winch drum';
  drum.position.set(3.89, 4.8, 0);
  const drumMesh = new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, .36, 12), materials.steel);
  drumMesh.rotation.x = Math.PI / 2;
  drumMesh.castShadow = drumMesh.receiveShadow = true;
  drum.add(drumMesh);
  for (const z of [-.2, .2]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(.145, .145, .027, 12), materials.teal);
    flange.rotation.x = Math.PI / 2; flange.position.z = z;
    flange.castShadow = flange.receiveShadow = true;
    drum.add(flange);
  }
  group.add(drum);
  for (const z of [-.22, .22]) box([3.89, 4.68, z], [.33, .05, .055], materials.orange);
  box([4.26, 4.8, 0], [.28, .22, .28], materials.teal);

  // Batch repeated structural primitives: detailed model, few draw calls.
  let instanceCount = 0;
  batches.forEach(({ geometry, material, matrices }) => {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = material !== materials.glass;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    instanceCount += matrices.length;
  });
  group.userData.primitiveCount = instanceCount + 3;
  group.userData.batchCount = batches.size + 3;
  return { group, hoist, drum, materials };
}
