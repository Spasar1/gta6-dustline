// The player: Jesse "Dusty" Kane, long-haul driver turned smuggler. On foot he
// walks, runs and punches; in a car he drives it. Entering and leaving cars is
// the hinge the whole game turns on.
import { WALK } from './config.js';
import { clamp, dist } from './random.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    onFoot: true,
    car: null,
    cash: 0,
    speed: 0,
    punchTimer: 0,
    punchAnim: 0,
    busted: false,
    wasted: false,
    // Last safe spot, for the busted/wasted respawn.
    safeX: x,
    safeY: y,
  };
}

/** Step the player on foot. `move` is {x, y} unit-ish, `run` is shift. */
export function stepOnFoot(player, move, run, dt, world) {
  const speed = run ? WALK.runSpeed : WALK.walkSpeed;
  const len = Math.hypot(move.x, move.y);
  let nx = player.x;
  let ny = player.y;
  if (len > 0.01) {
    nx = player.x + (move.x / len) * speed * dt;
    ny = player.y + (move.y / len) * speed * dt;
    player.angle = Math.atan2(move.y, move.x);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  if (world.insideWorld(nx, ny) && !world.hitsBuilding(nx, ny, WALK.radius)) {
    player.x = nx;
    player.y = ny;
  } else if (world.insideWorld(nx, player.y) && !world.hitsBuilding(nx, player.y, WALK.radius)) {
    player.x = nx;
  } else if (world.insideWorld(player.x, ny) && !world.hitsBuilding(player.x, ny, WALK.radius)) {
    player.y = ny;
  }
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.punchAnim > 0) player.punchAnim -= dt;
}

/** Nearest car the player can enter (within 70 px). */
export function nearestCar(player, cars) {
  let best = null;
  let bestD = 70;
  for (const car of cars) {
    const d = dist(player.x, player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Put the player into a car (stealing it: that is a crime, handled by police.js). */
export function enterCar(player, car) {
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
}

/** Leave the car beside it, on foot. */
export function exitCar(player) {
  if (!player.car) return;
  const car = player.car;
  const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
  player.car = null;
  player.onFoot = true;
  player.x = side.x;
  player.y = side.y;
  player.angle = car.angle;
}

export { clamp };
