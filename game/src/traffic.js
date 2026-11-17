// Traffic and pedestrians: the town alive. Traffic cars follow the road network
// on simple loops; pedestrians stroll the sidewalks and the motel strip.
import { mulberry32, range, pick, clamp, angleDelta } from './random.js';
import { createCar, stepCar, TRAFFIC_COLORS } from './cars.js';
import { WALK } from './config.js';

/** Road waypoints traffic loops along: the interstate, Main Street and the grid. */
const LOOPS = [
  // Interstate east-west.
  [[100, 1420], [3700, 1420]],
  [[3700, 1420], [100, 1420]],
  // Main Street north-south.
  [[1900, 300], [1900, 2600]],
  [[1900, 2600], [1900, 300]],
  // Frontage Road.
  [[400, 1035], [2800, 1035]],
  [[2800, 1035], [400, 1035]],
  // Cactus Road.
  [[400, 1935], [2800, 1935]],
  [[2800, 1935], [400, 1935]],
];

export function createTraffic(world) {
  const rng = mulberry32(2024);
  const cars = [];
  const models = ['coyote', 'sidewinder', 'burro', 'duster'];
  for (let i = 0; i < 14; i += 1) {
    const loop = LOOPS[i % LOOPS.length];
    const t = rng();
    const x = loop[0][0] + (loop[1][0] - loop[0][0]) * t;
    const y = loop[0][1] + (loop[1][1] - loop[0][1]) * t;
    const angle = Math.atan2(loop[1][1] - loop[0][1], loop[1][0] - loop[0][0]);
    const car = createCar(pick(rng, models), x, y, angle);
    car.color = pick(rng, TRAFFIC_COLORS);
    car.fuel = Infinity; // traffic never runs dry
    car.speed = range(rng, 120, 220);
    car.loop = loop;
    car.loopIndex = i % LOOPS.length;
    car.cruise = range(rng, 140, 240);
    cars.push(car);
  }
  const peds = [];
  const spots = [
    [1750, 1600], [2100, 1600], [1850, 1850], [1500, 1050], [2400, 1050],
    [600, 1180], [2500, 1000], [1900, 1200], [1900, 2100], [1500, 1950],
  ];
  for (let i = 0; i < 10; i += 1) {
    const s = spots[i % spots.length];
    peds.push({
      x: s[0] + range(rng, -40, 40),
      y: s[1] + range(rng, -40, 40),
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 30, 60),
      timer: range(rng, 1, 4),
      color: pick(rng, ['#d9a05a', '#7a9cc9', '#c96f6f', '#8fb573', '#b5a08f']),
      down: false,
    });
  }
  return { cars, peds, rng };
}

/** One step for every traffic car: follow its loop, slow for the car ahead. */
export function stepTraffic(traffic, dt, world, playerCar) {
  for (const car of traffic.cars) {
    if (car.stolen) continue;
    const loop = LOOPS[car.loopIndex];
    const target = loop[1];
    const dx = target[0] - car.x;
    const dy = target[1] - car.y;
    const want = Math.atan2(dy, dx);
    const d = angleDelta(car.angle, want);
    const steer = clamp(d * 2, -1, 1);
    let throttle = 1;
    // Slow down for the player's car or another car ahead.
    const aheadX = car.x + Math.cos(car.angle) * 90;
    const aheadY = car.y + Math.sin(car.angle) * 90;
    for (const other of traffic.cars) {
      if (other === car || other.stolen) continue;
      if (Math.hypot(other.x - aheadX, other.y - aheadY) < 46) { throttle = 0; break; }
    }
    if (playerCar && Math.hypot(playerCar.x - aheadX, playerCar.y - aheadY) < 46) throttle = 0;
    const speedBefore = car.speed;
    stepCar(car, { throttle: throttle * 0.55, steer, brake: throttle === 0 }, dt, world);
    // Cruise control: hold the loop speed, never race.
    if (car.speed > car.cruise) car.speed = Math.max(car.cruise, car.speed - 200 * dt);
    if (car.speed < 0) car.speed = 0;
    if (Math.hypot(target[0] - car.x, target[1] - car.y) < 60) {
      car.loopIndex = (car.loopIndex + 1) % LOOPS.length;
      const next = LOOPS[car.loopIndex];
      car.angle = Math.atan2(next[1][1] - next[0][1], next[1][0] - next[0][0]);
      car.x = next[0][0];
      car.y = next[0][1];
    }
    void speedBefore;
  }
  for (const ped of traffic.peds) {
    if (ped.down) continue;
    ped.timer -= dt;
    if (ped.timer <= 0) {
      ped.angle = range(traffic.rng, 0, Math.PI * 2);
      ped.timer = range(traffic.rng, 2, 6);
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (world.insideWorld(nx, ny) && !world.hitsBuilding(nx, ny, 10)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.angle += Math.PI / 2;
    }
  }
}

/** Knock a pedestrian down (a crime: police.js raises wanted for it). */
export function knockPed(ped) {
  ped.down = true;
}

export { WALK };
