// police.js — wanted level, police pursuit cars, ramming, and wanted decay.
import { clamp } from './utils.js';
import { makePoliceCar, driveCar } from './vehicles.js';
import { angleDiff } from './utils.js';

export const wanted = {
  stars: 0,
  heat: 0,        // 0..100, stars = ceil(heat/20)
  quietTimer: 0,  // seconds since last crime
};

export function addHeat(amount) {
  wanted.heat = clamp(wanted.heat + amount, 0, 100);
  wanted.stars = Math.ceil(wanted.heat / 20);
  wanted.quietTimer = 0;
}
export function setStars(n) {
  wanted.stars = clamp(n, 0, 5);
  wanted.heat = wanted.stars * 20;
  wanted.quietTimer = 0;
}
export function decayWanted(dt) {
  wanted.quietTimer += dt;
  if (wanted.quietTimer > 8) {
    wanted.heat = Math.max(0, wanted.heat - dt * 3.5);
    const s = Math.ceil(wanted.heat / 20);
    if (s !== wanted.stars) wanted.stars = s;
  }
}

export function spawnPolice(scene) {
  return [];
}

export function updatePolice(scene, police, dt, targetPos, targetSpeed, colliders, onRam) {
  // keep one police car per wanted star (max 5)
  while (police.length < wanted.stars) {
    const a = Math.random() * Math.PI * 2;
    const car = makePoliceCar(scene, targetPos.x + Math.sin(a) * 40, targetPos.z + Math.cos(a) * 40);
    police.push(car);
  }
  while (police.length > wanted.stars) {
    const car = police.pop();
    scene.remove(car.group);
  }
  for (const car of police) {
    // steer toward the target, faster than normal traffic
    const want = Math.atan2(targetPos.x - car.pos.x, targetPos.z - car.pos.z);
    const diff = angleDiff(car.yaw, want);
    const steer = clamp(diff * 1.4, -1, 1);
    const dist = Math.hypot(targetPos.x - car.pos.x, targetPos.z - car.pos.z);
    const throttle = dist > 4 ? 1 : 0;
    driveCar(car, dt, throttle, steer, colliders);
    // ram: damage the player when very close
    if (dist < 3.2 && onRam) onRam(car);
    // flashing light bar
    car.group.children.forEach((ch) => {
      if (ch.material && ch.material.color) {
        // light bar meshes are MeshBasicMaterial boxes at y 1.55
        if (ch.position.y > 1.5) ch.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2222 : 0x2244ff);
      }
    });
  }
}

export function clearPolice(scene, police) {
  for (const car of police) scene.remove(car.group);
  police.length = 0;
}
