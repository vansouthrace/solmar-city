// main.js — Solmar City boot + game loop: city, player, cars, traffic, police, missions, HUD.
// ?seed=N fixes the city layout. ?shot=start|drive|chase|mission stages that scene for a
// screenshot and sets window.__shotReady once it has painted.
import * as THREE from 'three';
import { buildCity, cityHalf } from './city.js';
import { createPlayer, updatePlayerOnFoot, makeTracer } from './player.js';
import { spawnCars, driveCar, nearestCar } from './vehicles.js';
import { spawnTraffic, updateTraffic, spawnPedestrians, updatePedestrians, knockDownPed } from './traffic.js';
import { wanted, addHeat, setStars, decayWanted, updatePolice, clearPolice } from './police.js';
import { createMissionState, currentMission, missionObjectiveText, placeBeaconForMission, updateBeacon } from './missions.js';
import { initHud, drawMinimap, setStars as hudStars, setCash, setHealth, setObjective, setSpeed, setPrompt, setCrosshair, setArrowAngle, showScreen } from './hud.js';
import { initInput, consumeMouse, isDown } from './input.js';
import { initAudio, resumeAudio, playGunshot, playPickup, playClick, playCrash, playHorn, playMission, playBusted, startEngine, setEngine, startSiren, stopSiren } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';
import { clamp, dist2D, angleDiff, el, showToast } from './utils.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

const canvas = el('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const { colliders } = buildCity(scene, seed);
const player = createPlayer(scene);
const cars = spawnCars(scene, seed, colliders);
const trafficCars = spawnTraffic(scene, seed);
const peds = spawnPedestrians(scene, seed);
const police = [];
const mission = createMissionState();
placeBeaconForMission(scene, mission);
initHud();

const saved = loadSave();
const G = {
  screen: 'title',
  cash: saved ? saved.cash : 0,
  bestWanted: saved ? saved.bestWanted : 0,
  inCar: false,
  currentCar: null,
  camYaw: 0.6,
  camPitch: 0.32,
  camOrbit: false,
  player, cars, trafficCars, peds, police, mission,
  time: 0,
  ramCooldown: 0,
  shootCooldown: 0,
  danger: false,
};

function saveProgress() {
  writeSave({ cash: G.cash, missionsDone: mission.done, bestWanted: G.bestWanted });
}

// ---- game flow ----
function startGame() {
  G.screen = 'play';
  showScreen(null);
  setObjective(missionObjectiveText(mission));
  resumeAudio();
  startEngine();
  if (wanted.stars > 0) startSiren();
  saveProgress();
}
G.startGame = startGame;

function gameOver(title, text) {
  G.screen = 'over';
  el('overTitle').textContent = title;
  el('overText').textContent = text;
  showScreen('overScreen');
  stopSiren();
  setEngine(0, false);
  playBusted();
  saveProgress();
}

function completeMission() {
  const m = currentMission(mission);
  if (!m) return;
  G.cash += m.reward;
  mission.done += 1;
  showToast(`Mission complete: ${m.title}  +$${m.reward}`);
  playMission();
  mission.index += 1;
  mission.pickedPackage = false;
  mission.mission3Armed = false;
  if (mission.index === 2) {
    // mission 3 starts hot
    setStars(3);
    mission.mission3Armed = true;
    startSiren();
    showToast('The pickup went loud — 3 stars! Lose the cops!');
  }
  placeBeaconForMission(scene, mission);
  setObjective(missionObjectiveText(mission));
  saveProgress();
  if (!currentMission(mission)) {
    showToast('All missions complete! Solmar City is yours, Rico.');
  }
}

function enterCar(car) {
  G.inCar = true;
  G.currentCar = car;
  player.group.visible = false;
  if (!car.stolen) {
    car.stolen = true;
    addHeat(20); // stealing a car is a crime
    showToast(`You stole the ${car.name}! +1 wanted star`);
    if (wanted.stars > 0) startSiren();
    playHorn();
  }
  setCrosshair(false);
}
G.enterCar = enterCar;

function exitCar() {
  if (!G.currentCar) return;
  const c = G.currentCar;
  const bx = c.pos.x - Math.sin(c.yaw) * 2.5;
  const bz = c.pos.z - Math.cos(c.yaw) * 2.5;
  player.pos.set(bx, 0, bz);
  player.group.position.copy(player.pos);
  player.group.visible = true;
  G.inCar = false;
  G.currentCar = null;
  setCrosshair(true);
}

// ---- combat ----
const tracers = [];
function shoot() {
  if (G.screen !== 'play' || G.inCar || G.shootCooldown > 0) return;
  G.shootCooldown = 0.35;
  playGunshot();
  addHeat(10);
  if (wanted.stars > 0) startSiren();
  G.danger = true;
  setTimeout(() => { G.danger = false; }, 1200);
  const from = player.pos.clone(); from.y = 1.5;
  // aim along camera yaw
  const dir = new THREE.Vector3(-Math.sin(G.camYaw), 0, -Math.cos(G.camYaw));
  let hitPed = null, hitD = 60;
  for (const p of peds) {
    if (!p.alive) continue;
    const to = new THREE.Vector3(p.pos.x - from.x, 0, p.pos.z - from.z);
    const d = to.length();
    if (d > 45) continue;
    const ang = Math.abs(angleDiff(Math.atan2(dir.x, dir.z), Math.atan2(to.x, to.z)));
    if (ang < 0.22 && d < hitD) { hitD = d; hitPed = p; }
  }
  const to = from.clone().addScaledVector(dir, hitPed ? hitD : 45);
  const tr = makeTracer(scene, from, to);
  tracers.push(tr);
  if (hitPed) {
    knockDownPed(hitPed);
    addHeat(15);
    showToast('Pedestrian down! The cops are coming.');
  }
}

// ---- input wiring ----
initInput(canvas, {
  onShoot: shoot,
  onKey: (code) => {
    if (code === 'KeyE' && G.screen === 'play') {
      if (G.inCar) exitCar();
      else {
        const car = nearestCar(cars, player.pos.x, player.pos.z, 5);
        if (car) enterCar(car);
      }
    }
    if (code === 'KeyM' && G.screen === 'play') {
      setObjective(missionObjectiveText(mission));
      showToast(currentMission(mission) ? `Mission: ${currentMission(mission).title}` : 'All missions done!');
    }
    if ((code === 'Escape' || code === 'KeyP') && (G.screen === 'play' || G.screen === 'paused')) {
      if (G.screen === 'play') { G.screen = 'paused'; showScreen('pauseScreen'); }
      else { G.screen = 'play'; showScreen(null); }
    }
  },
});
el('startBtn').addEventListener('click', () => { playClick(); startGame(); });
el('resumeBtn').addEventListener('click', () => { playClick(); G.screen = 'play'; showScreen(null); });
el('restartBtn').addEventListener('click', () => { playClick(); location.reload(); });
el('againBtn').addEventListener('click', () => { playClick(); location.reload(); });
if (saved && (saved.cash > 0 || saved.missionsDone > 0)) {
  el('saveLine').textContent = `Save found: $${saved.cash} cash, ${saved.missionsDone} mission(s) done.`;
  mission.done = saved.missionsDone;
  mission.index = Math.min(saved.missionsDone, 2);
  placeBeaconForMission(scene, mission);
}

// ---- camera ----
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const m = consumeMouse();
  G.camYaw -= m.dx * 0.0032;
  G.camPitch = clamp(G.camPitch + m.dy * 0.0022, -0.15, 0.9);
  const target = G.inCar && G.currentCar ? G.currentCar.pos : player.pos;
  camTarget.set(target.x, target.y + 2.2, target.z);
  const dist = G.inCar ? 11 : 8;
  const cx = camTarget.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cz = camTarget.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cy = camTarget.y + Math.sin(G.camPitch) * dist + 1.2;
  camera.position.set(cx, cy, cz);
  camera.lookAt(camTarget);
}

// ---- main loop ----
let last = performance.now();
let frames = 0;

function step(dt) {
  G.time += dt;
  G.shootCooldown = Math.max(0, G.shootCooldown - dt);
  G.ramCooldown = Math.max(0, G.ramCooldown - dt);

  // tracers fade
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].mesh);
      scene.remove(tracers[i].flash);
      tracers.splice(i, 1);
    }
  }

  if (G.screen === 'title') {
    // slow orbit over the city behind the title screen
    const t = G.time * 0.05;
    camera.position.set(Math.sin(t) * 90, 55, Math.cos(t) * 90);
    camera.lookAt(0, 8, 0);
    updateTraffic(trafficCars, dt, player.pos);
    updatePedestrians(peds, dt, player.pos, false);
    updateBeacon(mission, dt, G.time);
    return;
  }
  if (G.screen !== 'play') return;

  // movement input (camera-relative)
  const fwd = (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0);
  const strafe = (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0);
  const running = isDown('ShiftLeft') || isDown('ShiftRight');

  if (G.inCar && G.currentCar) {
    const car = G.currentCar;
    const hit = driveCar(car, dt, fwd, strafe, colliders);
    if (hit) playCrash();
    player.pos.copy(car.pos);
    // running over a pedestrian while driving
    for (const p of peds) {
      if (p.alive && dist2D(p.pos.x, p.pos.z, car.pos.x, car.pos.z) < 2 && Math.abs(car.speed) > 3) {
        knockDownPed(p);
        addHeat(20);
        showToast('You ran someone over! Wanted up.');
        if (wanted.stars > 0) startSiren();
      }
    }
    setEngine(Math.abs(car.speed) / 24, true);
    setSpeed(Math.abs(car.speed) * 3.6, true);
  } else {
    updatePlayerOnFoot(player, dt, G.camYaw, strafe, -fwd, running, isDown('Space'), colliders);
    setEngine(0, false);
    setSpeed(0, false);
  }

  updateTraffic(trafficCars, dt, player.pos);
  updatePedestrians(peds, dt, player.pos, G.danger);
  updateBeacon(mission, dt, G.time);
  decayWanted(dt);
  if (wanted.stars > G.bestWanted) G.bestWanted = wanted.stars;
  if (wanted.stars === 0) stopSiren();

  updatePolice(scene, police, dt, player.pos, G.inCar && G.currentCar ? Math.abs(G.currentCar.speed) : 0, colliders, (car) => {
    if (G.ramCooldown > 0) return;
    G.ramCooldown = 1.2;
    player.health -= 8;
    playCrash();
    if (player.health <= 0) gameOver('BUSTED', 'The Solmar police finally caught up with you.');
  });

  // health regen when calm
  if (wanted.stars === 0 && player.health < 100) player.health = Math.min(100, player.health + dt * 2);

  // mission logic
  const m = currentMission(mission);
  if (m) {
    const target = m.target;
    const d = dist2D(player.pos.x, player.pos.z, target.x, target.z);
    const near = d < 9;
    if (m.id === 2 && mission.packageMesh && !mission.pickedPackage &&
        dist2D(player.pos.x, player.pos.z, target.x, target.z) < 3.5 && !G.inCar) {
      mission.pickedPackage = true;
      scene.remove(mission.packageMesh);
      mission.packageMesh = null;
      playPickup();
      showToast('Package collected! Mission complete.');
    }
    let done = false;
    if (m.id === 1) done = G.inCar && near;
    else if (m.id === 2) done = mission.pickedPackage;
    else if (m.id === 3) done = wanted.stars === 0 && mission.mission3Armed;
    if (done) completeMission();
    // waypoint arrow: angle between camera forward and direction to target
    const wantAngle = Math.atan2(target.x - player.pos.x, target.z - player.pos.z);
    const camFwd = Math.atan2(-Math.sin(G.camYaw), -Math.cos(G.camYaw));
    const rel = angleDiff(camFwd, wantAngle);
    setArrowAngle(true, -rel * 180 / Math.PI);
  } else {
    setArrowAngle(false, 0);
  }

  // HUD
  hudStars(wanted.stars);
  setCash(G.cash);
  setHealth(player.health);
  setObjective(missionObjectiveText(mission));
  const tgt = currentMission(mission) ? currentMission(mission).target : null;
  drawMinimap(player.pos, G.camYaw, trafficCars, police, peds, tgt, G.inCar);
  if (!G.inCar) {
    const car = nearestCar(cars, player.pos.x, player.pos.z, 5);
    setPrompt(car ? `Press E to steal the ${car.name}` : '');
  } else setPrompt('');

  updateCamera(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  try { step(dt); } catch (e) { console.error(e); }
  renderer.render(scene, camera);
  frames += 1;
  if (shotName && frames >= 5) window.__shotReady = true;
}

// ---- screenshot staging ----
G.updatePoliceNow = () => {
  updatePolice(scene, police, 0.5, player.pos, 10, colliders, null);
  // pull police cars close for the shot
  police.forEach((c, i) => {
    c.pos.set(player.pos.x + (i % 2 ? 10 : -10), 0, player.pos.z - 14 - i * 6);
    c.group.position.copy(c.pos);
  });
};

if (shotName) {
  initAudio();
  stageShot(shotName, G);
  if (shotName === 'start') showScreen('startScreen');
  else showScreen(null);
  setObjective(missionObjectiveText(mission));
  hudStars(wanted.stars);
  setCash(G.cash);
  setHealth(player.health);
  drawMinimap(player.pos, G.camYaw, trafficCars, police, peds, currentMission(mission) ? currentMission(mission).target : null, G.inCar);
  setCrosshair(shotName !== 'start');
} else {
  showScreen('startScreen');
}

requestAnimationFrame(frame);
