// Screenshot scenes behind ?shot=cover|mission|chase|night. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// an autopilot that follows road waypoints, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { clamp, angleDelta, dist } from './random.js';

/** Waypoints along the roads, so the autopilot never has to cut through town. */
export function routeFor(missionId, stage) {
  if (missionId === 1 && stage === 0) {
    return [[1900, 1830], [1900, 1035], [250, 1035], [250, 1300], [460, 1300]];
  }
  if (missionId === 1 && stage === 1) {
    // Loop south into open sand first — no U-turn against the truck stop wall.
    return [[460, 1420], [250, 1420], [250, 1035], [1900, 1035], [1900, 1830], [1630, 1830]];
  }
  if (missionId === 3 && stage === 0) {
    return [[3000, 1450], [1900, 1420], [1900, 2670], [2380, 2670], [2380, 2560]];
  }
  if (missionId === 3 && stage === 1) {
    return [[2770, 2670], [2770, 2310], [2130, 2310], [1900, 2310], [1900, 1830], [1630, 1830]];
  }
  if (missionId === 5) {
    return [[1900, 1830], [1900, 1035], [250, 1035], [250, 1300], [460, 1300]];
  }
  return [];
}

/** An autopilot that drives a car (or walks) along a waypoint queue. */
export function createAutopilot() {
  let waypoints = [];
  let stuckTimer = 0;
  let reverseTimer = 0;
  let reverseSteer = 0;
  let checkTimer = 0;
  let lastX = 0;
  let lastY = 0;

  function setRoute(points) {
    waypoints = points.map((p) => ({ x: p[0], y: p[1] }));
    stuckTimer = 0;
    reverseTimer = 0;
    checkTimer = 0;
    lastX = 0;
    lastY = 0;
  }

  function setTarget(x, y) {
    setRoute([[x, y]]);
  }

  function clear() {
    waypoints = [];
    stuckTimer = 0;
    reverseTimer = 0;
    checkTimer = 0;
  }

  /** Drive input for one step: {throttle, steer, brake, move, run, enter}. */
  function drive(game, dt) {
    const player = game.state.player;
    const out = { throttle: 0, steer: 0, brake: false, move: { x: 0, y: 0 }, run: false, enter: false };
    if (waypoints.length === 0) return out;
    const target = waypoints[0];
    const px = player.onFoot ? player.x : player.car.x;
    const py = player.onFoot ? player.y : player.car.y;
    const d = dist(px, py, target.x, target.y);
    if (d < 40) {
      waypoints.shift();
      return out;
    }
    const wantAngle = Math.atan2(target.y - py, target.x - px);
    const diff = player.onFoot ? 0 : angleDelta(player.car.angle, wantAngle);
    if (player.onFoot) {
      out.move = { x: Math.cos(wantAngle), y: Math.sin(wantAngle) };
      out.run = true;
      // If a car is right here and the target is far, take it.
      const car = game.nearestCarToPlayer();
      if (car && d > 300) out.enter = true;
      return out;
    }
    const car = player.car;
    const speed = Math.abs(car.speed);
    // Pinned against a wall: the speedometer stays high while displacement is
    // zero, so judge stuck by actual movement, not by speed.
    checkTimer += dt;
    if (checkTimer >= 1.5) {
      const moved = dist(px, py, lastX, lastY);
      if (moved < 10 && d > 70 && reverseTimer <= 0) {
        reverseTimer = 0.9;
        reverseSteer = diff > 0 ? -1 : 1;
      }
      lastX = px;
      lastY = py;
      checkTimer = 0;
    }
    if (reverseTimer > 0) {
      reverseTimer -= dt;
      out.throttle = -1;
      out.steer = reverseSteer;
      return out;
    }
    if (speed < 25 && car.speed >= 0) {
      stuckTimer += dt;
      if (stuckTimer > 1.2) {
        stuckTimer = 0;
        reverseTimer = 0.9;
        reverseSteer = diff > 0 ? -1 : 1;
        out.throttle = -1;
        out.steer = reverseSteer;
        return out;
      }
    } else {
      stuckTimer = 0;
    }
    // U-turn: the target is behind us. Brake to a crawl and turn in place
    // instead of swinging wide at speed into whatever is beside us.
    if (Math.abs(diff) > 2.2) {
      out.steer = clamp(diff * 2.5, -1, 1);
      if (speed > 80) {
        out.throttle = 0;
        out.brake = true;
      } else {
        out.throttle = 0.3;
        out.brake = false;
      }
      return out;
    }
    out.steer = clamp(diff * 2.5, -1, 1);
    // Slow for the turn: cap speed by distance to the waypoint so 90-degree
    // corners are not taken at full speed and overshot.
    const targetSpeed = d > 500 ? 590 : d > 250 ? 320 : 150;
    if (speed > targetSpeed) {
      out.throttle = 0;
      out.brake = true;
    } else {
      out.throttle = Math.abs(diff) > 1.3 ? 0.35 : 1;
      out.brake = false;
    }
    return out;
  }

  return {
    setRoute, setTarget, clear, drive,
    get active() { return waypoints.length > 0; },
    get remaining() { return waypoints.length; },
  };
}

/**
 * Set `game` to the named scene and return the screen to draw over it.
 * `game` is the object main.js builds (state, reset, step, giveCar, ...).
 */
export function stageShot(name, game) {
  game.reset();
  const state = game.state;
  if (name === 'mission') {
    game.giveCar('duster', 1900, 1560, -Math.PI / 2);
    game.startMissionByIndex(0);
    game.autopilot.setRoute(routeFor(1, 0));
    for (let i = 0; i < 20 / STEP; i += 1) {
      game.step(STEP, game.autopilot.drive(game, STEP));
      if (state.missions.stage === 1) break;
    }
    game.autopilot.setRoute(routeFor(1, 1));
    for (let i = 0; i < 6 / STEP; i += 1) game.step(STEP, game.autopilot.drive(game, STEP));
    return { screen: 'play' };
  }
  if (name === 'chase') {
    game.giveCar('duster', 900, 1420, 0);
    game.setWanted(3);
    game.autopilot.setRoute([[3500, 1420]]);
    for (let i = 0; i < 8 / STEP; i += 1) game.step(STEP, game.autopilot.drive(game, STEP));
    return { screen: 'play' };
  }
  if (name === 'night') {
    game.setNight(true);
    game.setStorm(true);
    game.giveCar('longhorn', 2380, 2560, 0);
    game.startMissionByIndex(2);
    // Jump the mission to stage 1 (crate collected) for the shot.
    state.missions.stage = 1;
    state.missions.carrying = true;
    game.autopilot.setRoute(routeFor(3, 1));
    for (let i = 0; i < 7 / STEP; i += 1) game.step(STEP, game.autopilot.drive(game, STEP));
    return { screen: 'play' };
  }
  // Cover: the title screen over the town at golden hour.
  game.giveCar('duster', 1900, 1560, -Math.PI / 2);
  for (let i = 0; i < 5 / STEP; i += 1) game.step(STEP, { throttle: 0, steer: 0, brake: false, move: { x: 0, y: 0 }, run: false, enter: false });
  return { screen: 'title' };
}
