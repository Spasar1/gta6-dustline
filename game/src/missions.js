// Missions, desert caches and the highway time trial. Each mission is a small
// state machine: a stage, a target point, a timer. update() returns event names
// the loop turns into banners, sounds and cash; nothing here touches the DOM.
import { MISSIONS, CACHES, CACHE_REWARD, RACE_REWARD, RACE_TIME } from './config.js';
import { dist } from './random.js';

const ARRIVE = 62;

const CRATE_SPOTS = [
  { x: 1400, y: 300 }, { x: 1800, y: 500 }, { x: 2200, y: 350 },
  { x: 2500, y: 600 }, { x: 1650, y: 650 },
];

const CACHE_SPOTS = [
  { x: 1300, y: 300 }, { x: 1600, y: 250 }, { x: 1900, y: 600 }, { x: 2200, y: 300 },
  { x: 2500, y: 550 }, { x: 2700, y: 300 }, { x: 1450, y: 650 }, { x: 1750, y: 400 },
  { x: 2050, y: 700 }, { x: 2350, y: 250 }, { x: 2600, y: 650 }, { x: 1500, y: 450 },
];

const RACE_GATES = [
  { x: 600, y: 1420 }, { x: 1200, y: 1420 }, { x: 1800, y: 1420 },
  { x: 2400, y: 1420 }, { x: 3000, y: 1420 }, { x: 3500, y: 1420 },
];

export function createMissions() {
  return {
    index: 0, // next mission to start; 5 when the story is done
    active: false,
    mission: null,
    stage: 0,
    timer: 0,
    crates: [],
    drops: [],
    carrying: false,
    race: { active: false, gate: 0, timer: 0 },
    raceGates: RACE_GATES.map((g) => ({ ...g })),
    caches: CACHE_SPOTS.map((s) => ({ ...s, taken: false })),
    stormForced: false,
  };
}

function targetOf(m, places) {
  if (!m.active || !m.mission) return null;
  const id = m.mission.id;
  if (id === 1) return m.stage === 0
    ? { x: places.truckStop.x, y: places.truckStop.y, label: 'Pick up the package — Red Rock Truck Stop' }
    : { x: places.motel.x, y: places.motel.y, label: 'Deliver to the Dustline Motel' };
  if (id === 2) {
    const next = m.crates.find((c) => !c.taken);
    return next ? { x: next.x, y: next.y, label: `Stash crates: ${m.crates.filter((c) => c.taken).length}/5` } : null;
  }
  if (id === 3) return m.stage === 0
    ? { x: places.borderWarehouse.x, y: places.borderWarehouse.y, label: 'Pick up the hot crate — Border Warehouse' }
    : { x: places.motel.x, y: places.motel.y, label: 'Deliver to the motel — AVOID the checkpoint' };
  if (id === 4) return m.stage === 0
    ? { x: places.lakebedCenter.x, y: places.lakebedCenter.y, label: 'Lose the cruisers — wanted to zero' }
    : { x: places.motel.x, y: places.motel.y, label: 'Slip into the motel safehouse' };
  if (id === 5) {
    const drop = m.drops[m.stage];
    if (!drop) return { x: places.motel.x, y: places.motel.y, label: 'The Big Run — return home' };
    return { x: drop.x, y: drop.y, label: `Drop ${m.stage + 1}/3 — ${drop.label}` };
  }
  return null;
}

export function startMission(m, index, ctx) {
  const def = MISSIONS[index];
  if (!def) return false;
  m.index = index;
  m.mission = def;
  m.active = true;
  m.stage = 0;
  m.timer = def.timeLimit;
  m.carrying = false;
  m.flagged = false;
  m.crates = CRATE_SPOTS.map((s) => ({ ...s, taken: false }));
  m.stormForced = def.id === 2;
  if (def.id === 4) {
    ctx.setWanted(3);
  }
  if (def.id === 5) {
    m.drops = [
      { x: ctx.places.truckStop.x, y: ctx.places.truckStop.y, label: 'Red Rock Truck Stop' },
      { x: ctx.places.borderWarehouse.x, y: ctx.places.borderWarehouse.y, label: 'Border Warehouse' },
      { x: ctx.places.motel.x, y: ctx.places.motel.y, label: 'Dustline Motel' },
    ];
    ctx.setWanted(2);
  }
  if (m.stormForced) ctx.setStorm(true);
  return true;
}

function completeMission(m, ctx) {
  const reward = m.mission.reward;
  ctx.player.cash += reward;
  m.active = false;
  m.mission = null;
  m.index += 1;
  m.stormForced = false;
  ctx.setStorm(false);
  ctx.clearWanted();
  return ['mission-complete', `+$${reward}`];
}

function failMission(m, ctx, reason) {
  m.active = false;
  m.mission = null;
  m.stormForced = false;
  ctx.setStorm(false);
  return ['mission-failed', reason];
}

/**
 * One step of the mission system. `ctx` carries the player, places, police and
 * storm controls. Returns an array of event names for the loop to act on.
 */
export function updateMissions(m, dt, ctx) {
  const events = [];
  const player = ctx.player;
  const px = player.onFoot ? player.x : player.car.x;
  const py = player.onFoot ? player.y : player.car.y;

  // Desert caches: always collectible, mission or not.
  for (const cache of m.caches) {
    if (!cache.taken && dist(px, py, cache.x, cache.y) < 48) {
      cache.taken = true;
      player.cash += CACHE_REWARD;
      events.push('cache', `+$${CACHE_REWARD} desert cache`);
    }
  }

  // Highway time trial: drive through gate 1 on the interstate to start.
  const race = m.race;
  if (!m.active && !race.active) {
    if (dist(px, py, RACE_GATES[0].x, RACE_GATES[0].y) < 55 && !player.onFoot) {
      race.active = true;
      race.gate = 1;
      race.timer = RACE_TIME;
      events.push('race-start');
    }
  } else if (race.active) {
    race.timer -= dt;
    const gate = RACE_GATES[race.gate];
    if (gate && dist(px, py, gate.x, gate.y) < 60) {
      race.gate += 1;
      events.push('race-gate');
      if (race.gate >= RACE_GATES.length) {
        race.active = false;
        player.cash += RACE_REWARD;
        events.push('race-complete', `+$${RACE_REWARD} time trial`);
      }
    }
    if (race.timer <= 0 && race.active) {
      race.active = false;
      events.push('race-failed');
    }
  }

  if (!m.active || !m.mission) return events;
  m.timer -= dt;
  if (m.timer <= 0) {
    events.push(...failMission(m, ctx, 'Out of time'));
    return events;
  }

  const id = m.mission.id;
  const target = targetOf(m, ctx.places);

  if (id === 1 || id === 3) {
    if (target && dist(px, py, target.x, target.y) < ARRIVE) {
      if (m.stage === 0) {
        m.stage = 1;
        m.carrying = true;
        events.push('pickup');
      } else {
        events.push(...completeMission(m, ctx));
      }
    }
    // Mission 3: crossing the checkpoint line with the crate draws the law.
    if (id === 3 && m.carrying) {
      const cp = ctx.checkpoint;
      if (px > cp.x && px < cp.x + cp.w && Math.abs(py - cp.lineY) < 14) {
        if (!m.flagged) {
          m.flagged = true;
          ctx.addWanted(2);
          events.push('checkpoint-cross');
        }
      }
    }
  } else if (id === 2) {
    for (const crate of m.crates) {
      if (!crate.taken && dist(px, py, crate.x, crate.y) < 52) {
        crate.taken = true;
        events.push('crate');
      }
    }
    if (m.crates.every((c) => c.taken)) events.push(...completeMission(m, ctx));
  } else if (id === 4) {
    if (m.stage === 0 && ctx.wanted() === 0) {
      m.stage = 1;
      events.push('evaded');
    } else if (m.stage === 1 && target && dist(px, py, target.x, target.y) < ARRIVE) {
      events.push(...completeMission(m, ctx));
    }
  } else if (id === 5) {
    if (target && dist(px, py, target.x, target.y) < ARRIVE) {
      if (m.stage < m.drops.length) {
        m.stage += 1;
        events.push('drop');
        if (m.stage >= m.drops.length) events.push(...completeMission(m, ctx));
      }
    }
  }
  return events;
}

/** The current objective for the HUD and the minimap arrow. */
export function currentTarget(m, places) {
  if (m.race.active && m.race.gate < RACE_GATES.length) {
    const g = RACE_GATES[m.race.gate];
    return { x: g.x, y: g.y, label: `Race gate ${m.race.gate + 1}/6 — ${Math.ceil(m.race.timer)}s` };
  }
  const t = targetOf(m, places);
  if (t) return t;
  if (!m.active && m.index < MISSIONS.length) {
    return { x: places.motel.x, y: places.motel.y, label: `See Rosa at the motel — Mission ${m.index + 1}: ${MISSIONS[m.index].title}` };
  }
  return { x: places.motel.x, y: places.motel.y, label: 'Dustline is yours. Free roam.' };
}

export function raceGates() {
  return RACE_GATES;
}

export { CACHES };
