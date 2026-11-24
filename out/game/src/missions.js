// missions.js — story missions for Solmar City: objectives, waypoints, rewards.
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 1,
    title: 'Borrow a Ride',
    brief: 'Delacroix needs wheels. Steal any car (press E near one) and drive to the meeting point at the marina.',
    target: { x: 150, z: 20 },
    reward: 500,
    check: (s) => s.inCar && s.nearTarget,
  },
  {
    id: 2,
    title: 'The Pickup',
    brief: 'Collect the package from the north-side drop and bring it back downtown. Grab it on foot.',
    target: { x: -60, z: -120 },
    reward: 800,
    check: (s) => s.pickedPackage && s.nearTarget,
  },
  {
    id: 3,
    title: 'Lose the Heat',
    brief: 'The pickup went loud — you are at 3 stars. Lose the cops: get your wanted level down to zero.',
    target: { x: 60, z: 110 },
    reward: 1500,
    check: (s) => s.wantedStars === 0 && s.mission3Armed,
  },
];

export function createMissionState() {
  return {
    index: 0,            // current mission (0-based)
    done: 0,             // missions completed
    started: false,
    pickedPackage: false,
    mission3Armed: false,
    beacon: null,
    packageMesh: null,
  };
}

export function currentMission(state) {
  return MISSIONS[state.index] || null;
}

export function missionObjectiveText(state) {
  const m = currentMission(state);
  if (!m) return 'All missions complete — Solmar City is yours, Rico.';
  return `Mission ${m.id}: ${m.title} — ${m.brief}`;
}

// Glowing waypoint beacon (cylinder + floating diamond) at the target.
export function buildBeacon(scene, x, z) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 30;
  g.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23f })
  );
  diamond.position.y = 6;
  g.add(diamond);
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

export function buildPackage(scene, x, z) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.9, 1.2),
    new THREE.MeshLambertMaterial({ color: 0xd9a441 })
  );
  box.position.set(x, 0.45, z);
  scene.add(box);
  return box;
}

export function placeBeaconForMission(scene, state) {
  if (state.beacon) { scene.remove(state.beacon); state.beacon = null; }
  if (state.packageMesh) { scene.remove(state.packageMesh); state.packageMesh = null; }
  const m = currentMission(state);
  if (!m) return;
  state.beacon = buildBeacon(scene, m.target.x, m.target.z);
  if (m.id === 2) state.packageMesh = buildPackage(scene, m.target.x, m.target.z);
}

export function updateBeacon(state, dt, t) {
  if (state.beacon) {
    state.beacon.rotation.y += dt * 1.2;
    const dia = state.beacon.children[1];
    if (dia) dia.position.y = 6 + Math.sin(t * 2) * 0.6;
  }
  if (state.packageMesh) {
    state.packageMesh.rotation.y += dt * 0.8;
  }
}
