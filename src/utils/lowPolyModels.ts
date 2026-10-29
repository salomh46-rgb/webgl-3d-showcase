import * as THREE from 'three';
import { CELL_WORLD_SIZE } from './mazeGenerator';

/**
 * Creates a procedural low-poly tile texture for the corridor floor.
 */
export function createFloorTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base warm stone slate
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 256);

  // Inner beveled tile squares (2x2 per cell)
  const tileSize = 128;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const px = x * tileSize;
      const py = y * tileSize;

      ctx.fillStyle = (x + y) % 2 === 0 ? '#243247' : '#202d40';
      ctx.fillRect(px + 6, py + 6, tileSize - 12, tileSize - 12);

      // Subtle playful corner notch highlight
      ctx.fillStyle = '#334155';
      ctx.fillRect(px + 10, py + 10, tileSize - 20, 4);
      ctx.fillRect(px + 10, py + 10, 4, tileSize - 20);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Creates a composite 5-part low-poly Collectible Relic Group:
 * 1. Pedestal base ring (grounded at y=0)
 * 2. Floating faceted Octahedron crystal core
 * 3. Tilted outer gyroscopic ring 1
 * 4. Tilted outer gyroscopic ring 2
 * 5. Orbiting top crown gem
 */
export function createRelicGroup(accentColorHex: number): THREE.Group {
  const group = new THREE.Group();

  // 1. Grounded floor pedestal base (sits flush at y=0)
  const baseGeo = new THREE.CylinderGeometry(0.48, 0.58, 0.14, 6);
  baseGeo.translate(0, 0.07, 0);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7,
    metalness: 0.25,
    flatShading: true,
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Inner glowing pad on pedestal
  const padGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.06, 6);
  padGeo.translate(0, 0.15, 0);
  const padMat = new THREE.MeshStandardMaterial({
    color: accentColorHex,
    emissive: accentColorHex,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.1,
    flatShading: true,
  });
  const padMesh = new THREE.Mesh(padGeo, padMat);
  group.add(padMesh);

  // Floating bobbing sub-group (named 'floatingCore' for animation)
  const floatingCore = new THREE.Group();
  floatingCore.name = 'floatingCore';
  floatingCore.position.set(0, 1.25, 0);

  // 2. Primary silhouette: Faceted Octahedron Crystal
  const coreGeo = new THREE.OctahedronGeometry(0.42, 0);
  coreGeo.scale(1, 1.35, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.65,
    flatShading: true,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.castShadow = true;
  floatingCore.add(coreMesh);

  // 3. Secondary read: Outer Low-Poly Gyro Ring A
  const ringAGeo = new THREE.TorusGeometry(0.62, 0.045, 6, 8);
  const ringAMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.8,
    flatShading: true,
  });
  const ringAMesh = new THREE.Mesh(ringAGeo, ringAMat);
  ringAMesh.name = 'ringA';
  ringAMesh.rotation.x = Math.PI / 3;
  floatingCore.add(ringAMesh);

  // 4. Secondary read: Outer Low-Poly Gyro Ring B
  const ringBGeo = new THREE.TorusGeometry(0.52, 0.035, 6, 6);
  const ringBMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.5,
    metalness: 0.4,
    flatShading: true,
  });
  const ringBMesh = new THREE.Mesh(ringBGeo, ringBMat);
  ringBMesh.name = 'ringB';
  ringBMesh.rotation.y = Math.PI / 4;
  floatingCore.add(ringBMesh);

  // 5. Accent detail: Crown satellite tetrahedron
  const crownGeo = new THREE.TetrahedronGeometry(0.14, 0);
  const crownMesh = new THREE.Mesh(crownGeo, padMat);
  crownMesh.position.set(0, 0.72, 0);
  crownMesh.name = 'crown';
  floatingCore.add(crownMesh);

  group.add(floatingCore);
  return group;
}

/**
 * Creates a composite 8-part low-poly Exit Portal Shrine (THREE.Group) grounded at y=0:
 * 1. Stepped octagonal temple base
 * 2. Left stone obelisk pillar
 * 3. Right stone obelisk pillar
 * 4. Top arch lintel beam
 * 5. Left & Right crystal sconces
 * 6. Central swirling vortex ring
 * 7. Inner glowing portal energy core
 * 8. Floating victory beacon diamond above the lintel
 */
export function createExitPortalGroup(): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.75,
    metalness: 0.15,
    flatShading: true,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.4,
    metalness: 0.5,
    flatShading: true,
  });

  const portalEnergyMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.2,
    flatShading: true,
  });

  // 1. Stepped octagonal base platform
  const step1Geo = new THREE.CylinderGeometry(1.45, 1.6, 0.16, 8);
  step1Geo.translate(0, 0.08, 0);
  const step1 = new THREE.Mesh(step1Geo, stoneMat);
  step1.receiveShadow = true;
  group.add(step1);

  const step2Geo = new THREE.CylinderGeometry(1.15, 1.3, 0.14, 8);
  step2Geo.translate(0, 0.23, 0);
  const step2 = new THREE.Mesh(step2Geo, trimMat);
  step2.receiveShadow = true;
  group.add(step2);

  // 2 & 3. Left & Right Obelisk Pillars
  const pillarGeo = new THREE.CylinderGeometry(0.18, 0.25, 2.5, 6);
  pillarGeo.translate(0, 1.45, 0);

  const leftPillar = new THREE.Mesh(pillarGeo, stoneMat);
  leftPillar.position.set(-0.92, 0, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, stoneMat);
  rightPillar.position.set(0.92, 0, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  // 4. Top Arch Lintel
  const lintelGeo = new THREE.BoxGeometry(2.35, 0.34, 0.52);
  const lintel = new THREE.Mesh(lintelGeo, trimMat);
  lintel.position.set(0, 2.75, 0);
  lintel.castShadow = true;
  group.add(lintel);

  // 5. Left & Right glowing crystal sconces on pillars
  const sconceGeo = new THREE.OctahedronGeometry(0.16, 0);
  const leftSconce = new THREE.Mesh(sconceGeo, portalEnergyMat);
  leftSconce.position.set(-0.92, 1.85, 0.24);
  group.add(leftSconce);

  const rightSconce = new THREE.Mesh(sconceGeo, portalEnergyMat);
  rightSconce.position.set(0.92, 1.85, 0.24);
  group.add(rightSconce);

  // 6. Central spinning portal ring
  const vortexRingGeo = new THREE.TorusGeometry(0.68, 0.08, 6, 8);
  const vortexRing = new THREE.Mesh(vortexRingGeo, portalEnergyMat);
  vortexRing.position.set(0, 1.5, 0);
  vortexRing.name = 'portalRing';
  group.add(vortexRing);

  // 7. Inner portal core icosahedron
  const innerCoreGeo = new THREE.IcosahedronGeometry(0.42, 0);
  const innerCoreMat = new THREE.MeshStandardMaterial({
    color: 0x6ee7b7,
    emissive: 0x10b981,
    emissiveIntensity: 1.1,
    roughness: 0.1,
    metalness: 0.3,
    flatShading: true,
  });
  const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
  innerCore.position.set(0, 1.5, 0);
  innerCore.name = 'portalCore';
  group.add(innerCore);

  // 8. Crown beacon above arch (visible over corridor distances)
  const beaconGeo = new THREE.OctahedronGeometry(0.28, 0);
  beaconGeo.scale(1, 1.5, 1);
  const beacon = new THREE.Mesh(beaconGeo, innerCoreMat);
  beacon.position.set(0, 3.45, 0);
  beacon.name = 'portalBeacon';
  group.add(beacon);

  return group;
}

/**
 * Creates a composite 3-part low-poly Wall Block geometry or instanced meshes
 * so walls look like playful stylized architectural blocks (base plinth, main wall body, top cap).
 */
export function buildMazeWallsGroup(
  grid: number[][],
  wallColorHex: number
): THREE.Group {
  const mazeGroup = new THREE.Group();
  const size = grid.length;
  const half = (size * CELL_WORLD_SIZE) / 2;

  let wallCount = 0;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (grid[z][x] === 1) wallCount++;
    }
  }

  // Part 1: Main wall body
  const bodyGeo = new THREE.BoxGeometry(
    CELL_WORLD_SIZE * 0.96,
    3.1,
    CELL_WORLD_SIZE * 0.96
  );
  bodyGeo.translate(0, 1.75, 0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.12,
    flatShading: true,
  });

  // Part 2: Grounded stone plinth base (rougher, darker contrast)
  const plinthGeo = new THREE.BoxGeometry(
    CELL_WORLD_SIZE,
    0.35,
    CELL_WORLD_SIZE
  );
  plinthGeo.translate(0, 0.175, 0);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
    metalness: 0.2,
    flatShading: true,
  });

  // Part 3: Beveled top cornice cap
  const capGeo = new THREE.BoxGeometry(
    CELL_WORLD_SIZE * 1.01,
    0.26,
    CELL_WORLD_SIZE * 1.01
  );
  capGeo.translate(0, 3.43, 0);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.3,
    metalness: 0.25,
    flatShading: true,
  });

  const bodyInstanced = new THREE.InstancedMesh(bodyGeo, bodyMat, wallCount);
  const plinthInstanced = new THREE.InstancedMesh(plinthGeo, plinthMat, wallCount);
  const capInstanced = new THREE.InstancedMesh(capGeo, capMat, wallCount);

  bodyInstanced.castShadow = true;
  bodyInstanced.receiveShadow = true;
  plinthInstanced.receiveShadow = true;
  capInstanced.castShadow = true;

  const dummy = new THREE.Object3D();
  const baseColor = new THREE.Color(wallColorHex);
  const tempColor = new THREE.Color();

  let idx = 0;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (grid[z][x] !== 1) continue;

      const wx = x * CELL_WORLD_SIZE - half + CELL_WORLD_SIZE / 2;
      const wz = z * CELL_WORLD_SIZE - half + CELL_WORLD_SIZE / 2;

      // Subtle playful height variation (±6%) on wall blocks
      const heightVar = 0.96 + ((x * 7 + z * 13) % 9) * 0.012;
      dummy.position.set(wx, 0, wz);
      dummy.scale.set(1, heightVar, 1);
      dummy.updateMatrix();

      bodyInstanced.setMatrixAt(idx, dummy.matrix);
      plinthInstanced.setMatrixAt(idx, dummy.matrix);
      capInstanced.setMatrixAt(idx, dummy.matrix);

      // Subtle checkerboard hue/lightness variation for visual depth
      const hsl = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(hsl);
      const shift = ((x + z) % 2 === 0 ? 0.03 : -0.03) + (((x * 3 + z * 5) % 5) - 2) * 0.01;
      tempColor.setHSL(
        (hsl.h + shift * 0.25 + 1) % 1,
        Math.min(1, Math.max(0.2, hsl.s)),
        Math.min(0.85, Math.max(0.25, hsl.l + shift))
      );
      bodyInstanced.setColorAt(idx, tempColor);

      idx++;
    }
  }

  bodyInstanced.instanceMatrix.needsUpdate = true;
  if (bodyInstanced.instanceColor) bodyInstanced.instanceColor.needsUpdate = true;
  plinthInstanced.instanceMatrix.needsUpdate = true;
  capInstanced.instanceMatrix.needsUpdate = true;

  bodyInstanced.computeBoundingSphere();
  plinthInstanced.computeBoundingSphere();
  capInstanced.computeBoundingSphere();

  mazeGroup.add(plinthInstanced);
  mazeGroup.add(bodyInstanced);
  mazeGroup.add(capInstanced);

  return mazeGroup;
}
