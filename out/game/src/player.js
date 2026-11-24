// player.js — third-person on-foot character: WASD movement, orbit camera, run, jump, shooting.
import * as THREE from 'three';
import { clamp } from './utils.js';
import { resolveCollision } from './city.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6fb0 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x222831 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), jacket);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 2.15;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
  cap.position.y = 2.38;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
  legL.position.set(-0.18, 0.35, 0); group.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; group.add(legR);
  // simple pistol in hand
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.45, 1.35, 0.3);
  group.add(gun);
  scene.add(group);
  return {
    group, mesh: group,
    pos: new THREE.Vector3(0, 0, 20),
    yaw: 0, velY: 0, grounded: true,
    health: 100, walkPhase: 0,
  };
}

export function updatePlayerOnFoot(p, dt, camYaw, moveX, moveZ, running, jump, colliders) {
  const speed = running ? 9 : 4.6;
  // moveX/moveZ are in camera space; rotate into world space
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  const wx = moveX * cos - moveZ * sin;
  const wz = moveX * sin + moveZ * cos;
  const len = Math.hypot(wx, wz);
  let moving = false;
  if (len > 0.01) {
    moving = true;
    const nx = wx / len, nz = wz / len;
    p.pos.x += nx * speed * dt;
    p.pos.z += nz * speed * dt;
    p.yaw = Math.atan2(nx, nz);
    p.walkPhase += dt * (running ? 14 : 9);
  }
  // gravity + jump
  if (jump && p.grounded) { p.velY = 6.5; p.grounded = false; }
  p.velY -= 18 * dt;
  p.pos.y += p.velY * dt;
  if (p.pos.y <= 0) { p.pos.y = 0; p.velY = 0; p.grounded = true; }
  resolveCollision(colliders, p.pos, 0.6);
  p.pos.x = clamp(p.pos.x, -170, 265);
  p.pos.z = clamp(p.pos.z, -170, 170);
  p.group.position.copy(p.pos);
  p.group.rotation.y = p.yaw;
  // walk bob
  p.group.position.y = p.pos.y + (moving ? Math.abs(Math.sin(p.walkPhase)) * 0.08 : 0);
  return moving;
}

// Tracer + muzzle flash for a hitscan shot. Returns the THREE objects to animate briefly.
export function makeTracer(scene, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(0.03, 0.03, len, 5);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  scene.add(m);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
  flash.position.copy(from);
  scene.add(flash);
  return { mesh: m, flash, life: 0.12 };
}
