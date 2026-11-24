// shots.js — deterministic screenshot staging for ?shot=start|drive|chase|mission.
// Each shot starts the real game and stages a real scene (no fake renders): the same seed
// always gives the same city, cars and pedestrians.
import { setStars } from './police.js';

export function stageShot(name, G) {
  // G is the game object built by main.js (see applyShotStage there).
  if (name === 'start') {
    G.screen = 'title';
    G.camOrbit = true;
    return;
  }
  G.startGame();
  if (name === 'drive') {
    // put the player in the nearest car and drive it down the avenue with traffic around
    const car = G.cars[0];
    G.enterCar(car);
    car.pos.set(-20, 0, -28);
    car.yaw = Math.PI / 2;
    car.speed = 14;
    G.player.pos.set(-20, 0, -28);
  } else if (name === 'chase') {
    const car = G.cars[1];
    G.enterCar(car);
    car.pos.set(0, 0, 0);
    car.yaw = 0;
    car.speed = 16;
    G.player.pos.set(0, 0, 0);
    setStars(3);
    G.updatePoliceNow();
  } else if (name === 'mission') {
    // mission 1 active, player on foot near the marina beacon, car beside him
    G.player.pos.set(120, 0, 20);
    G.player.group.position.copy(G.player.pos);
    G.cars[2].pos.set(124, 0, 26);
    G.cars[2].group.position.copy(G.cars[2].pos);
  }
  G.screen = 'play';
}
