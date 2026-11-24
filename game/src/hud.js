// hud.js — HUD: minimap, health, cash, wanted stars, speed, objective, prompts.
import { el } from './utils.js';
import { cityHalf, streetLines, CITY } from './city.js';

const MAP_SIZE = 220;
let mapCtx = null;

export function initHud() {
  const c = el('minimap');
  mapCtx = c.getContext('2d');
}

function worldToMap(x, z) {
  const half = 190;
  const s = MAP_SIZE / (half * 2);
  return [MAP_SIZE / 2 + x * s, MAP_SIZE / 2 + z * s];
}

export function drawMinimap(playerPos, playerYaw, cars, police, peds, missionTarget, inCar) {
  if (!mapCtx) return;
  const g = mapCtx;
  g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
  // sea + sand
  g.fillStyle = '#1e7fb8';
  g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  g.fillStyle = '#5da24a';
  g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  const [bx] = worldToMap(CITY.beachX, 0);
  g.fillStyle = '#e8d49a';
  g.fillRect(bx, 0, MAP_SIZE - bx, MAP_SIZE);
  // streets
  g.strokeStyle = '#2e3138';
  g.lineWidth = 7;
  for (const c of streetLines()) {
    const [mx] = worldToMap(c, 0);
    const [, mz] = worldToMap(0, c);
    g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, MAP_SIZE); g.stroke();
    g.beginPath(); g.moveTo(0, mz); g.lineTo(MAP_SIZE, mz); g.stroke();
  }
  // mission marker
  if (missionTarget) {
    const [mx, mz] = worldToMap(missionTarget.x, missionTarget.z);
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.arc(mx, mz, 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
  }
  // traffic cars (white dots), police (blue/red)
  for (const c of cars) {
    const [mx, mz] = worldToMap(c.pos.x, c.pos.z);
    g.fillStyle = '#ffffff';
    g.fillRect(mx - 2, mz - 2, 4, 4);
  }
  for (const c of police) {
    const [mx, mz] = worldToMap(c.pos.x, c.pos.z);
    g.fillStyle = '#ff4040';
    g.beginPath(); g.arc(mx, mz, 4, 0, Math.PI * 2); g.fill();
  }
  // player arrow
  const [px, pz] = worldToMap(playerPos.x, playerPos.z);
  g.save();
  g.translate(px, pz);
  g.rotate(-playerYaw);
  g.fillStyle = inCar ? '#ffd23f' : '#37d67a';
  g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 7); g.lineTo(0, 4); g.lineTo(-6, 7); g.closePath(); g.fill();
  g.restore();
}

export function setStars(n) {
  const s = el('stars');
  let html = '';
  for (let i = 0; i < 5; i++) html += i < n ? '&#9733;' : '<span class="off">&#9733;</span>';
  s.innerHTML = html;
}

export function setCash(v) { el('cash').textContent = '$' + v.toLocaleString('en-US'); }
export function setHealth(v) {
  el('healthfill').style.width = Math.max(0, v) + '%';
  el('healthfill').style.background = v > 50 ? '#37d67a' : v > 25 ? '#ffb02e' : '#ff4040';
  el('healthtext').textContent = 'HEALTH ' + Math.max(0, Math.round(v));
}
export function setObjective(text) { el('objtext').textContent = text; }
export function setSpeed(kmh, inCar) {
  el('speed').textContent = inCar ? Math.round(kmh) + ' km/h' : '';
}
export function setPrompt(text) {
  const p = el('prompt');
  if (text) { p.textContent = text; p.style.display = 'block'; }
  else p.style.display = 'none';
}
export function setCrosshair(on) { el('crosshair').style.display = on ? 'block' : 'none'; }
export function setArrowAngle(visible, angleDeg) {
  const a = el('arrow');
  a.style.display = visible ? 'block' : 'none';
  if (visible) a.style.transform = `translateX(-50%) rotate(${angleDeg}deg)`;
}
export function showScreen(id) {
  for (const s of ['startScreen', 'pauseScreen', 'overScreen']) el(s).hidden = s !== id;
  if (!id) for (const s of ['startScreen', 'pauseScreen', 'overScreen']) el(s).hidden = true;
}
