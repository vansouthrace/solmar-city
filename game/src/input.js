// input.js — keyboard + mouse state for Solmar City.
export const keys = {};
export const mouse = { dx: 0, dy: 0, down: false, clicked: false };
export let paused = false;
export function setPaused(v) { paused = v; }

export function initInput(canvas, callbacks) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys[e.code] = true;
    if (callbacks.onKey) callbacks.onKey(e.code, true);
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true; mouse.clicked = true;
    if (callbacks.onShoot) callbacks.onShoot();
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  document.addEventListener('mousemove', (e) => {
    mouse.dx += e.movementX || 0;
    mouse.dy += e.movementY || 0;
  });
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch (err) { /* pointer lock optional */ }
    }
  });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement) { mouse.dx = 0; mouse.dy = 0; }
  });
}

export function consumeMouse() {
  const dx = mouse.dx, dy = mouse.dy;
  mouse.dx = 0; mouse.dy = 0;
  return { dx, dy };
}
export function consumeClick() {
  const c = mouse.clicked;
  mouse.clicked = false;
  return c;
}
export function isDown(code) { return !!keys[code]; }
