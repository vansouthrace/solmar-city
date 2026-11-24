// city.js — procedural Solmar City: street grid, buildings, sidewalks, palms, beach and ocean.
// All geometry and textures are generated in code; nothing is loaded from the network.
import * as THREE from 'three';
import { mulberry32, randRange, pick } from './utils.js';

export const CITY = {
  blocks: 5,          // blocks per side
  blockSize: 42,      // block footprint
  streetWidth: 14,    // street width
  beachX: 150,        // east edge: sand starts here
};

export function gridPitch() { return CITY.blockSize + CITY.streetWidth; }
export function cityHalf() { return (CITY.blocks * gridPitch() + CITY.streetWidth) / 2; }

// Street center lines (x or z) for the grid, used by traffic and the minimap.
export function streetLines() {
  const lines = [];
  const p = gridPitch();
  const half = cityHalf();
  for (let i = 0; i <= CITY.blocks; i++) {
    const c = -half + CITY.streetWidth / 2 + i * p;
    lines.push(c);
  }
  return lines;
}

function makeWindowTexture(rng, baseColor, litColor) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 8;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? litColor : '#1a2b3d';
      g.fillRect(10 + col * 30, 12 + r * 30, 20, 18);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.5, 6), trunkMat);
  trunk.position.y = 2.75;
  trunk.rotation.z = randRange(rng, -0.08, 0.08);
  palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    palm.add(leaf);
  }
  return palm;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const p = gridPitch();
  const half = cityHalf();

  // Sky, sun and lighting
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0x9fd0ea, 220, 520);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cf, 1.9);
  sun.position.set(120, 180, 60);
  sun.castShadow = false;
  scene.add(sun);

  // Ground: grass-green base under the city
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x5da24a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // Streets (dark asphalt) + sidewalks (light) as flat planes
  const streetMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  const lines = streetLines();
  for (const c of lines) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CITY.streetWidth, half * 2 + 60), streetMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0, 0); scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 60, CITY.streetWidth), streetMat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.01, c); scene.add(ew);
    // sidewalk strips along each street
    const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(3, half * 2 + 60), walkMat);
    sw1.rotation.x = -Math.PI / 2; sw1.position.set(c + CITY.streetWidth / 2 + 1.5, 0.02, 0); scene.add(sw1);
    const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(3, half * 2 + 60), walkMat);
    sw2.rotation.x = -Math.PI / 2; sw2.position.set(c - CITY.streetWidth / 2 - 1.5, 0.02, 0); scene.add(sw2);
  }

  // Beach + ocean on the east edge
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 700), new THREE.MeshLambertMaterial({ color: 0xe8d49a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(CITY.beachX + 60, 0.03, 0); scene.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(260, 700), new THREE.MeshLambertMaterial({ color: 0x1e7fb8 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(CITY.beachX + 190, 0.0, 0); scene.add(ocean);

  // Buildings: 1-3 towers per block, varied heights and pastel colors
  const palette = ['#e8b48a', '#d9a0a8', '#a8c8e0', '#c8d9a8', '#e0d0a8', '#b8a8d8', '#f0c8a0', '#9fc8c0'];
  const litPalette = ['#ffe9a8', '#a8e8ff', '#ffd0a8'];
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const cx = -half + CITY.streetWidth + p * bx + CITY.blockSize / 2;
      const cz = -half + CITY.streetWidth + p * bz + CITY.blockSize / 2;
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const w = randRange(rng, 10, 18);
        const d = randRange(rng, 10, 18);
        const h = randRange(rng, 10, 46);
        const ox = (k % 2 === 0 ? -1 : 1) * randRange(rng, 4, 10);
        const oz = (k < 2 ? -1 : 1) * randRange(rng, 4, 10);
        const x = cx + ox, z = cz + oz;
        if (x + w / 2 > CITY.beachX - 6) continue;
        const tex = makeWindowTexture(rng, pick(rng, palette), pick(rng, litPalette));
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2, z);
        scene.add(b);
        // roof slab
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1, d + 1), new THREE.MeshLambertMaterial({ color: 0x6b5a4a }));
        roof.position.set(x, h + 0.5, z);
        scene.add(roof);
        colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4 });
      }
      // Palm trees on block corners
      if (rng() < 0.8) {
        const palm = makePalm(rng);
        palm.position.set(cx - CITY.blockSize / 2 + 3, 0, cz - CITY.blockSize / 2 + 3);
        scene.add(palm);
      }
      if (rng() < 0.6) {
        const palm = makePalm(rng);
        palm.position.set(cx + CITY.blockSize / 2 - 3, 0, cz + CITY.blockSize / 2 - 3);
        scene.add(palm);
      }
    }
  }

  // Marina pier on the beach
  const pier = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 6), new THREE.MeshLambertMaterial({ color: 0x8a6b48 }));
  pier.position.set(CITY.beachX + 40, 0.6, 20);
  scene.add(pier);

  // Street lamps along the main avenue
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  for (const c of lines) {
    for (let t = -half; t < half; t += 56) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
      pole.position.set(c + CITY.streetWidth / 2 + 3.4, 3, t);
      scene.add(pole);
    }
  }

  return { colliders, rng };
}

// True if point (x,z) with radius r hits a building or is out of the playable bounds.
export function hitsBuilding(colliders, x, z, r) {
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
  }
  if (x < -cityHalf() - 20 || x > CITY.beachX + 110 || z < -cityHalf() - 20 || z > cityHalf() + 20) return true;
  return false;
}

// Snap a position out of a building collider (push along smallest penetration axis).
export function resolveCollision(colliders, pos, r) {
  for (const c of colliders) {
    if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
      const dxl = pos.x + r - c.minX, dxr = c.maxX - (pos.x - r);
      const dzl = pos.z + r - c.minZ, dzr = c.maxZ - (pos.z - r);
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) pos.x = c.minX - r;
      else if (m === dxr) pos.x = c.maxX + r;
      else if (m === dzl) pos.z = c.minZ - r;
      else pos.z = c.maxZ + r;
      return true;
    }
  }
  return false;
}
