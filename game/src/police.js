// The law: Sheriff Boone's cruisers, the wanted level, busts and escapes. A
// crime raises wanted; cruisers hunt the player while it is up; stay out of their
// sight and it cools off. Getting busted costs cash and the mission's progress.
import { WANTED, POLICE } from './config.js';
import { clamp, dist } from './random.js';
import { createCar, stepCar } from './cars.js';

export function createPolice() {
  return {
    wanted: 0,
    cruisers: [],
    decayTimer: 0,
    bustTimer: 0,
    sirenTimer: 0,
    lastCrimeAt: 0,
  };
}

/** Raise wanted by `amount` (max 5), and note the time for the decay clock. */
export function addWanted(police, amount, now) {
  police.wanted = clamp(police.wanted + amount, 0, 5);
  police.decayTimer = POLICE.decaySeconds;
  police.lastCrimeAt = now;
  police.bustTimer = 0;
}

export function setWanted(police, level, now) {
  police.wanted = clamp(level, 0, 5);
  police.decayTimer = POLICE.decaySeconds;
  police.lastCrimeAt = now;
  police.bustTimer = 0;
}

/** Spawn cruisers up to the wanted level's count, near the player but off-screen. */
export function syncCruisers(police, player, world, rng) {
  const want = WANTED[police.wanted].cruisers;
  while (police.cruisers.length < want) {
    let cx = 0;
    let cy = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = rng() * Math.PI * 2;
      const x = player.x + Math.cos(angle) * 700;
      const y = player.y + Math.sin(angle) * 700;
      cx = clamp(x, 60, 3780);
      cy = clamp(y, 60, 2820);
      if (!world.hitsBuilding(cx, cy, 30)) break;
    }
    const car = createCar('cruiser', cx, cy, Math.atan2(player.y - cy, player.x - cx));
    car.isPolice = true;
    car.fuel = Infinity; // cruisers never run dry
    police.cruisers.push(car);
  }
  while (police.cruisers.length > want) police.cruisers.pop();
}

/**
 * One step: cruisers chase, ram, and bust; wanted decays when the player is
 * unseen. Returns {busted: bool}.
 */
export function stepPolice(police, player, dt, world, now, stormOn, onEvent) {
  syncCruisers(police, player, world, Math.random);
  const px = player.onFoot ? player.x : player.car.x;
  const py = player.onFoot ? player.y : player.car.y;
  const speedMul = WANTED[police.wanted].speedMul;
  let nearest = Infinity;
  let busted = false;

  for (const cruiser of police.cruisers) {
    const d = dist(cruiser.x, cruiser.y, px, py);
    nearest = Math.min(nearest, d);
    const wantAngle = Math.atan2(py - cruiser.y, px - cruiser.x);
    const diff = ((wantAngle - cruiser.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const steer = clamp(diff * 2.2, -1, 1);
    // In a dust storm the cruisers lose the trail and drive slower.
    const throttle = stormOn ? 0.55 : 0.95;
    stepCar(cruiser, { throttle, steer, brake: false }, dt, world);
    if (cruiser.speed > cruiser.def.top * speedMul * (stormOn ? 0.8 : 1)) {
      cruiser.speed = cruiser.def.top * speedMul * (stormOn ? 0.8 : 1);
    }
    // Ram the player's car.
    if (!player.onFoot && player.car && d < 62 && Math.abs(player.car.speed) > 60) {
      player.car.damage = Math.min(100, player.car.damage + POLICE.ramDamage * dt * 4);
      if (onEvent) onEvent('ram');
    }
  }

  // Bust: a cruiser close by while the player is slow or on foot.
  const playerSpeed = player.onFoot ? player.speed : Math.abs(player.car.speed);
  const sight = stormOn ? POLICE.sightRange * 0.55 : POLICE.sightRange;
  if (police.wanted > 0 && nearest < POLICE.bustRange && playerSpeed < 90) {
    police.bustTimer += dt;
    if (police.bustTimer >= POLICE.bustTime) busted = true;
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }

  // Decay: no crime for a while and no cruiser in sight, wanted cools off.
  if (police.wanted > 0) {
    if (nearest > sight || stormOn) {
      police.decayTimer -= dt;
      if (police.decayTimer <= 0) {
        police.wanted -= 1;
        police.decayTimer = POLICE.decaySeconds;
        if (onEvent) onEvent('cooldown');
      }
    } else {
      police.decayTimer = POLICE.decaySeconds;
    }
  }

  police.sirenTimer -= dt;
  if (police.wanted > 0 && police.sirenTimer <= 0) {
    police.sirenTimer = 1.6;
    if (onEvent) onEvent('siren');
  }
  return { busted, nearest };
}

/** Clear the law entirely (mission complete, safehouse, fresh start). */
export function clearPolice(police) {
  police.wanted = 0;
  police.cruisers = [];
  police.bustTimer = 0;
  police.decayTimer = 0;
}
