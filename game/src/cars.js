// Cars: one entity shape for the player, traffic and police. A car is a point with
// a heading, a speed and a model; physics are arcade: throttle accelerates,
// steering turns harder at low speed, sand and damage slow it down.
import { CARS, FUEL } from './config.js';
import { clamp, angleDelta } from './random.js';

let nextId = 1;

export function createCar(model, x, y, angle) {
  const def = CARS[model];
  return {
    id: nextId += 1,
    model,
    def,
    x, y,
    angle: angle || 0,
    speed: 0,
    fuel: FUEL.max,
    damage: 0,
    damageTimer: 0,
    color: def.color,
    length: def.length,
    width: def.width,
    stalled: false,
    smokeTimer: 0,
  };
}

/** Front, centre and rear sample points, for building collision. */
export function carPoints(car) {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const half = car.length / 2;
  return [
    { x: car.x + cos * half, y: car.y + sin * half },
    { x: car.x, y: car.y },
    { x: car.x - cos * half, y: car.y - sin * half },
  ];
}

/**
 * Drive a car one step. `drive` is {throttle: -1..1, steer: -1..1, brake: bool}.
 * Returns {crashed: bool} when a building stop happened this step.
 */
export function stepCar(car, drive, dt, world) {
  const def = car.def;
  car.damageTimer = Math.max(0, (car.damageTimer || 0) - dt);
  const onRoad = world.isOnRoad(car.x, car.y, 4);
  const top = def.top * (onRoad ? 1 : 0.55) * (1 - car.damage * 0.004);
  if (car.stalled || car.fuel <= 0) {
    car.speed *= Math.max(0, 1 - 3 * dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  } else {
    const accel = drive.throttle * def.accel * dt;
    car.speed += accel;
    if (drive.brake) car.speed *= Math.max(0, 1 - 4 * dt);
    // Drag and rolling resistance.
    car.speed -= car.speed * 0.35 * dt;
    car.speed = clamp(car.speed, -top * 0.45, top);
    if (drive.throttle === 0 && Math.abs(car.speed) < 6) car.speed = 0;
    car.fuel = Math.max(0, car.fuel - (FUEL.drainPerSecond + Math.abs(car.speed) * FUEL.drainPerSpeed) * dt);
    if (car.fuel <= 0) car.stalled = true;
  }
  // Steering: stronger when slow, weaker flat-out; reversing flips it.
  const steerAuthority = clamp(1 - Math.abs(car.speed) / (def.top * 1.6), 0.35, 1);
  car.angle += drive.steer * def.turn * steerAuthority * clamp(Math.abs(car.speed) / 60, 0, 1) * Math.sign(car.speed || 1) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let crashed = false;
  if (!world.insideWorld(nx, ny)) {
    car.speed *= -0.3;
    crashed = true;
  } else {
    const points = carPoints({ ...car, x: nx, y: ny });
    let hit = null;
    for (const p of points) {
      hit = world.hitsBuilding(p.x, p.y, car.width / 2 - 2);
      if (hit) break;
    }
    if (hit) {
      // Wall-slide: try moving along one axis only before giving up.
      const xPoints = carPoints({ ...car, x: nx, y: car.y });
      const yPoints = carPoints({ ...car, x: car.x, y: ny });
      const xHit = xPoints.some((p) => world.hitsBuilding(p.x, p.y, car.width / 2 - 2));
      const yHit = yPoints.some((p) => world.hitsBuilding(p.x, p.y, car.width / 2 - 2));
      if (!xHit && world.insideWorld(nx, car.y)) {
        car.x = nx;
      } else if (!yHit && world.insideWorld(car.x, ny)) {
        car.y = ny;
      } else {
        car.speed *= -0.25;
        // Damage is rate-limited: a car pinned against a wall does not die
        // in a second from repeated taps; each real hit still hurts.
        if (car.damageTimer <= 0) {
          car.damage = Math.min(100, car.damage + 4);
          car.damageTimer = 0.5;
        }
        crashed = true;
      }
    } else {
      car.x = nx;
      car.y = ny;
    }
  }
  if (car.damage > 60 && car.smokeTimer <= 0) car.smokeTimer = 0.4;
  return { crashed };
}

/** Parked-car colours: traffic cars reuse the model palette with variation. */
export const TRAFFIC_COLORS = ['#b8452a', '#3a6ea5', '#e0a32e', '#7a7d84', '#4a6b4f', '#8c3a5a', '#5a7a8c', '#c9c9c9'];
