// vehicles.js — drivable cars: build, enter/exit, arcade driving, building collision.
import * as THREE from 'three';
import { clamp, mulberry32, pick } from './utils.js';
import { resolveCollision, streetLines } from './city.js';

const CAR_COLORS = [0xd23c3c, 0x2e6fb0, 0xf0c040, 0x37b06a, 0x8a4fd0, 0xe0e0e0, 0x222831, 0xff7f2a];
const CAR_NAMES = ['Comet GT', 'Solmar Sedan', 'Palm Runner', 'Bay Cruiser', 'Sunset Coupe', 'Harbor Van', 'Vice Taxi', 'Marina Sport'];

export function buildCarMesh(color) {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), paint);
  body.position.y = 0.55;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cabin.position.set(0, 1.15, -0.2);
  car.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    car.add(w);
    wheels.push(w);
  }
  // headlights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
  for (const x of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), lightMat);
    l.position.set(x, 0.6, 2.22);
    car.add(l);
  }
  return { group: car, wheels };
}

export function spawnCars(scene, seed, colliders) {
  const rng = mulberry32(seed + 77);
  const lines = streetLines();
  const cars = [];
  const spots = [];
  // parked cars along streets
  for (let i = 0; i < 9; i++) {
    const street = pick(rng, lines);
    const along = (rng() * 2 - 1) * 120;
    const side = rng() < 0.5 ? 1 : -1;
    if (i % 2 === 0) spots.push({ x: street + side * 5.2, z: along, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    else spots.push({ x: along, z: street + side * 5.2, yaw: side > 0 ? 0 : Math.PI });
  }
  spots.forEach((s, i) => {
    const { group, wheels } = buildCarMesh(CAR_COLORS[i % CAR_COLORS.length]);
    group.position.set(s.x, 0, s.z);
    group.rotation.y = s.yaw;
    scene.add(group);
    cars.push({
      group, wheels, name: CAR_NAMES[i % CAR_NAMES.length],
      pos: new THREE.Vector3(s.x, 0, s.z), yaw: s.yaw,
      speed: 0, steer: 0, stolen: false, isPolice: false,
    });
  });
  return cars;
}

export function makePoliceCar(scene, x, z) {
  const { group, wheels } = buildCarMesh(0x1a1a2e);
  // police light bar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  bar.position.set(0, 1.55, -0.2);
  group.add(bar);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  bar2.position.set(0.7, 1.55, -0.2);
  group.add(bar2);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    group, wheels, name: 'Police Interceptor',
    pos: new THREE.Vector3(x, 0, z), yaw: 0,
    speed: 0, steer: 0, stolen: false, isPolice: true,
  };
}

// Arcade driving: W accelerate, S brake/reverse, A/D steer. Returns true if it hit a building.
export function driveCar(car, dt, throttle, steerInput, colliders) {
  const maxSpeed = car.isPolice ? 26 : 24;
  const accel = 16, brake = 26, drag = 4;
  if (throttle > 0) car.speed += accel * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= brake * dt;
    else car.speed -= 8 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * drag * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  car.speed = clamp(car.speed, -9, maxSpeed);
  const steerTarget = steerInput * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.steer += (steerTarget * 0.55 - car.steer) * Math.min(1, dt * 8);
  car.yaw += car.steer * dt * (car.speed >= 0 ? 1 : -1) * 1.6;
  const nx = Math.sin(car.yaw), nz = Math.cos(car.yaw);
  car.pos.x += nx * car.speed * dt;
  car.pos.z += nz * car.speed * dt;
  const hit = resolveCollision(colliders, car.pos, 1.6);
  if (hit) car.speed *= 0.4;
  car.pos.x = clamp(car.pos.x, -170, 265);
  car.pos.z = clamp(car.pos.z, -170, 170);
  car.group.position.copy(car.pos);
  car.group.rotation.y = car.yaw;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
  return hit;
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
