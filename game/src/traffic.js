// traffic.js — AI traffic cars driving the street grid + pedestrians walking sidewalks.
import * as THREE from 'three';
import { mulberry32, pick, randRange, clamp, angleDiff } from './utils.js';
import { streetLines } from './city.js';
import { buildCarMesh } from './vehicles.js';

const PED_COLORS = [0xe07a5f, 0x81b29a, 0xf2cc8f, 0x6d9dc5, 0xc77dff, 0x90be6d];

export function spawnTraffic(scene, seed) {
  const rng = mulberry32(seed + 31);
  const lines = streetLines();
  const cars = [];
  for (let i = 0; i < 7; i++) {
    const horizontal = rng() < 0.5;
    const street = pick(rng, lines);
    const along = randRange(rng, -130, 130);
    const { group, wheels } = buildCarMesh(pick(rng, [0x9aa5b1, 0x5b7fa6, 0xc9a227, 0x7a9e7e, 0xb56576]));
    const x = horizontal ? along : street + (rng() < 0.5 ? 3.2 : -3.2);
    const z = horizontal ? street + (rng() < 0.5 ? 3.2 : -3.2) : along;
    group.position.set(x, 0, z);
    scene.add(group);
    cars.push({
      group, wheels, horizontal, street,
      pos: new THREE.Vector3(x, 0, z),
      dir: rng() < 0.5 ? 1 : -1,
      speed: randRange(rng, 6, 10),
      yaw: 0,
    });
  }
  return cars;
}

export function updateTraffic(cars, dt, playerPos) {
  const half = 165;
  for (const c of cars) {
    // cruise along its street; turn around at the city edge
    if (c.horizontal) {
      c.pos.x += c.dir * c.speed * dt;
      c.yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (c.pos.x > half || c.pos.x < -half) c.dir *= -1;
    } else {
      c.pos.z += c.dir * c.speed * dt;
      c.yaw = c.dir > 0 ? 0 : Math.PI;
      if (c.pos.z > half || c.pos.z < -half) c.dir *= -1;
    }
    // slow down if the player is right in front
    const d = Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z);
    const sp = d < 8 ? c.speed * 0.3 : c.speed;
    c.group.position.copy(c.pos);
    c.group.rotation.y = c.yaw;
    for (const w of c.wheels) w.rotation.x += sp * dt * 2;
  }
}

export function spawnPedestrians(scene, seed) {
  const rng = mulberry32(seed + 55);
  const lines = streetLines();
  const peds = [];
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PED_COLORS) });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.75, 4, 8), shirt);
    body.position.y = 1.0;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 1.85;
    g.add(head);
    const street = pick(rng, lines);
    const x = randRange(rng, -140, 140);
    const z = street + (rng() < 0.5 ? 8.5 : -8.5);
    g.position.set(x, 0, z);
    scene.add(g);
    peds.push({
      group: g, pos: new THREE.Vector3(x, 0, z),
      yaw: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 1.2, 2.2),
      walkPhase: rng() * 6,
      alive: true, scared: 0,
      axis: rng() < 0.5 ? 'x' : 'z',
      dir: rng() < 0.5 ? 1 : -1,
      lane: street + (rng() < 0.5 ? 8.5 : -8.5),
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, playerPos, danger) {
  for (const p of peds) {
    if (!p.alive) continue;
    // flee from gunfire / a speeding car nearby
    const d = Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z);
    if (danger && d < 14) p.scared = 2.5;
    const speed = p.scared > 0 ? 5.5 : p.speed;
    if (p.scared > 0) {
      p.scared -= dt;
      const a = Math.atan2(p.pos.x - playerPos.x, p.pos.z - playerPos.z);
      p.pos.x += Math.sin(a) * speed * dt;
      p.pos.z += Math.cos(a) * speed * dt;
      p.yaw = a;
    } else if (p.axis === 'x') {
      p.pos.x += p.dir * speed * dt;
      p.yaw = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (p.pos.x > 150 || p.pos.x < -150) p.dir *= -1;
    } else {
      p.pos.z += p.dir * speed * dt;
      p.yaw = p.dir > 0 ? 0 : Math.PI;
      if (p.pos.z > 150 || p.pos.z < -150) p.dir *= -1;
    }
    p.pos.x = clamp(p.pos.x, -155, 150);
    p.pos.z = clamp(p.pos.z, -155, 155);
    p.walkPhase += dt * speed * 4;
    p.group.position.set(p.pos.x, Math.abs(Math.sin(p.walkPhase)) * 0.05, p.pos.z);
    p.group.rotation.y = p.yaw;
  }
}

// A pedestrian hit by a shot falls over and stays down.
export function knockDownPed(ped) {
  ped.alive = false;
  ped.group.rotation.x = -Math.PI / 2;
  ped.group.position.y = 0.3;
}
