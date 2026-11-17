// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens: title, play, paused, busted, wasted.
//
// ?seed=N is accepted and ignored — the town is built from a fixed seed, so every
// run is the same town. ?shot=cover|mission|chase|night (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, STORM, MISSIONS, FUEL } from './config.js';
import { createWorld } from './world.js';
import { ACTION_ENTER, ACTION_INTERACT, ACTION_PAUSE, ACTION_MUTE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { createPlayer, stepOnFoot, nearestCar, enterCar, exitCar } from './player.js';
import { createCar, stepCar } from './cars.js';
import { createTraffic, stepTraffic, knockPed } from './traffic.js';
import { createPolice, addWanted, setWanted, stepPolice, clearPolice } from './police.js';
import { createMissions, startMission, updateMissions, currentTarget } from './missions.js';
import { stageShot, createAutopilot } from './shots.js';
import { dist } from './random.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const minimapCanvas = document.getElementById('minimap');
const hud = createHud();
const audio = createAudio();
const renderer = createRenderer(canvas, minimapCanvas);
const autopilot = createAutopilot();

function createGame() {
  const world = createWorld();
  const save = loadSave();
  const state = {
    world,
    player: createPlayer(1850, 1860),
    traffic: createTraffic(world),
    police: createPolice(),
    missions: createMissions(),
    parked: [],
    loose: [],
    time: 0,
    screen: 'title',
    stormOn: false,
    stormTimer: STORM.firstAt,
    stormLeft: 0,
    stormOverride: null,
    night: false,
    target: null,
    missionText: '',
    save,
    crashCooldown: 0,
  };
  state.missions.index = save.missionIndex;
  state.missions.caches.forEach((c, i) => { c.taken = i < save.cachesTaken; });
  state.player.cash = save.cash;

  function placeParked() {
    state.parked = [];
    const loaner = createCar('coyote', 1750, 1860, Math.PI / 2);
    state.parked.push({ car: loaner, owned: true });
    const sedan = createCar('sidewinder', 2100, 1860, Math.PI / 2);
    state.parked.push({ car: sedan, owned: false });
    const van = createCar('burro', 700, 1300, 0);
    state.parked.push({ car: van, owned: false });
    const muscle = createCar('duster', 3150, 1500, Math.PI);
    state.parked.push({ car: muscle, owned: false });
  }

  function reset() {
    state.player = createPlayer(1850, 1860);
    state.player.cash = state.save.cash;
    state.traffic = createTraffic(world);
    state.police = createPolice();
    state.missions = createMissions();
    state.missions.index = state.save.missionIndex;
    state.missions.caches.forEach((c, i) => { c.taken = i < state.save.cachesTaken; });
    state.loose = [];
    placeParked();
    state.time = 0;
    state.stormOn = false;
    state.stormTimer = STORM.firstAt;
    state.stormLeft = 0;
    state.stormOverride = null;
    state.night = false;
    state.screen = 'play';
    autopilot.clear();
  }

  placeParked();

  function allCars() {
    const list = [];
    for (const p of state.parked) list.push(p.car);
    for (const c of state.loose) list.push(c);
    for (const c of state.traffic.cars) if (!c.stolen) list.push(c);
    return list;
  }

  function nearestCarToPlayer() {
    return nearestCar(state.player, allCars());
  }

  function doEnterCar() {
    const player = state.player;
    if (!player.onFoot) {
      doExitCar();
      return;
    }
    const car = nearestCarToPlayer();
    if (!car) return;
    // Stealing: any car that is not Rosa's loaner draws the law.
    const parked = state.parked.find((p) => p.car === car);
    if (parked) {
      state.parked = state.parked.filter((p) => p.car !== car);
      if (!parked.owned) addWanted(state.police, 1, state.time);
    } else if (state.traffic.cars.includes(car)) {
      car.stolen = true;
      addWanted(state.police, 1, state.time);
    } else {
      state.loose = state.loose.filter((c) => c !== car);
    }
    enterCar(player, car);
    audio.unlock();
  }

  function doExitCar() {
    const player = state.player;
    if (player.onFoot || !player.car) return;
    const car = player.car;
    exitCar(player);
    state.loose.push(car);
  }

  function doInteract() {
    const player = state.player;
    const px = player.onFoot ? player.x : player.car.x;
    const py = player.onFoot ? player.y : player.car.y;
    // Refuel: in a car, at a gas station.
    if (!player.onFoot) {
      for (const g of world.gasStations) {
        if (px >= g.x - 10 && px < g.x + g.w + 10 && py >= g.y - 10 && py < g.y + g.h + 10) {
          player.car.fuel = FUEL.max;
          player.car.stalled = false;
          hud.toast('Tank full — $0. Rosa covers the tab.');
          audio.fuel();
          return;
        }
      }
    }
    // Mission briefing: at the motel, no mission running.
    const motel = world.places.motel;
    if (!state.missions.active && state.missions.index < MISSIONS.length && dist(px, py, motel.x, motel.y) < 120) {
      const def = MISSIONS[state.missions.index];
      state.screen = 'paused';
      hud.showBriefing(def, () => {
        state.screen = 'play';
        startMission(state.missions, state.missions.index, missionCtx());
        hud.banner(`MISSION ${def.id} — ${def.title}`, def.brief, 4);
        audio.mission();
      });
    }
  }

  function doPunch() {
    const player = state.player;
    if (!player.onFoot || player.punchTimer > 0) return;
    player.punchTimer = 0.45;
    player.punchAnim = 0.2;
    audio.punch();
    for (const ped of state.traffic.peds) {
      if (!ped.down && dist(player.x, player.y, ped.x, ped.y) < 44) {
        knockPed(ped);
        addWanted(state.police, 1, state.time);
        hud.toast('You knocked a pedestrian down. The law noticed.');
        return;
      }
    }
  }

  function missionCtx() {
    return {
      player: state.player,
      places: world.places,
      checkpoint: world.checkpoint,
      setWanted: (n) => setWanted(state.police, n, state.time),
      addWanted: (n) => addWanted(state.police, n, state.time),
      wanted: () => state.police.wanted,
      setStorm: (on) => { state.stormOverride = on ? true : null; state.stormOn = on; },
      clearWanted: () => clearPolice(state.police),
    };
  }

  function handleMissionEvents(events) {
    for (let i = 0; i < events.length; i += 1) {
      const e = events[i];
      const extra = events[i + 1] && events[i + 1].startsWith('+') ? events[i + 1] : null;
      if (e === 'pickup') { hud.toast('Package picked up.'); audio.pickup(); }
      else if (e === 'crate') { hud.toast('Stash crate secured.'); audio.coin(); }
      else if (e === 'cache') { hud.toast(extra || 'Desert cache found.'); audio.coin(); persistSave(); }
      else if (e === 'drop') { hud.toast('Drop made.'); audio.pickup(); }
      else if (e === 'evaded') { hud.banner('YOU LOST THEM', 'Now slip into the motel safehouse.'); audio.mission(); }
      else if (e === 'checkpoint-cross') { hud.banner('CHECKPOINT!', 'The law saw you cross with the crate.'); audio.siren(); }
      else if (e === 'mission-complete') {
        const reward = extra || '';
        hud.banner('MISSION COMPLETE', reward ? `${reward} — Rosa is pleased.` : 'Rosa is pleased.', 4);
        audio.mission();
        if (state.missions.index >= MISSIONS.length) hud.showStoryDone(() => { state.screen = 'play'; });
        persistSave();
      } else if (e === 'mission-failed') {
        hud.banner('MISSION FAILED', events[i + 1] || '', 4);
        audio.fail();
      } else if (e === 'race-start') { hud.toast('Time trial! Hit all 6 gates on the interstate.'); audio.mission(); }
      else if (e === 'race-gate') { audio.coin(); }
      else if (e === 'race-complete') { hud.banner('TIME TRIAL DONE', extra || '', 4); audio.mission(); persistSave(); }
      else if (e === 'race-failed') { hud.toast('Time trial over — too slow.'); audio.fail(); }
    }
  }

  function persistSave() {
    state.save.cash = Math.floor(state.player.cash);
    state.save.missionIndex = state.missions.index;
    state.save.cachesTaken = state.missions.caches.filter((c) => c.taken).length;
    writeSave(state.save);
  }

  function bustPlayer() {
    const player = state.player;
    player.cash = Math.max(0, player.cash - 50);
    if (!player.onFoot) {
      const car = player.car;
      exitCar(player);
      state.loose.push(car);
    }
    state.missions.active = false;
    state.missions.mission = null;
    clearPolice(state.police);
    player.x = 1500;
    player.y = 1060;
    player.safeX = 1500;
    player.safeY = 1060;
    state.screen = 'busted';
    audio.fail();
    persistSave();
    hud.showBusted(() => { state.screen = 'play'; });
  }

  function wastePlayer() {
    const player = state.player;
    player.cash = Math.max(0, player.cash - 50);
    if (!player.onFoot && player.car) {
      state.loose = state.loose.filter((c) => c !== player.car);
      player.car = null;
      player.onFoot = true;
    }
    player.x = player.safeX;
    player.y = player.safeY;
    state.missions.active = false;
    state.missions.mission = null;
    clearPolice(state.police);
    state.screen = 'wasted';
    audio.fail();
    persistSave();
    hud.showWasted(() => { state.screen = 'play'; });
  }

  /** One fixed step. `input` is {throttle, steer, brake, move, run, enter, interact, punch}. */
  function step(dt, input) {
    state.time += dt;
    if (state.crashCooldown > 0) state.crashCooldown -= dt;

    // Dust storms: on a timer, or forced by a mission.
    if (state.missions.stormForced) {
      state.stormOn = true;
    } else if (state.stormOverride !== null) {
      state.stormOn = state.stormOverride;
    } else if (state.stormOn) {
      state.stormLeft -= dt;
      if (state.stormLeft <= 0) {
        state.stormOn = false;
        state.stormTimer = 80 + Math.random() * 70;
      }
    } else {
      state.stormTimer -= dt;
      if (state.stormTimer <= 0) {
        state.stormOn = true;
        state.stormLeft = 26;
      }
    }
    audio.wind(state.stormOn);

    if (state.screen !== 'play') {
      // Title backdrop: traffic keeps moving, nothing else.
      if (state.screen === 'title') stepTraffic(state.traffic, dt, world, null);
      return;
    }

    const player = state.player;

    if (input.enter) doEnterCar();
    if (input.interact) doInteract();
    if (input.punch) doPunch();

    if (player.onFoot) {
      stepOnFoot(player, input.move, input.run, dt, world);
      audio.engine(0, false);
    } else {
      const car = player.car;
      const result = stepCar(car, { throttle: input.throttle, steer: input.steer, brake: input.brake }, dt, world);
      if (result.crashed && state.crashCooldown <= 0) {
        audio.crash();
        state.crashCooldown = 0.4;
        renderer.spawnDust(car.x, car.y, 6);
      }
      audio.engine(Math.abs(car.speed) / car.def.top, true);
      // Dust kicked up off-road or at speed.
      if ((!world.isOnRoad(car.x, car.y, 4) && Math.abs(car.speed) > 150) || Math.abs(car.speed) > 480) {
        if (Math.random() < 0.35) renderer.spawnDust(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 1);
      }
      if (car.damage > 60) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          renderer.spawnSmoke(car.x, car.y - 10);
          car.smokeTimer = 0.4;
        }
      }
      if (car.damage >= 100) {
        wastePlayer();
        return;
      }
      // Running over pedestrians is a crime.
      for (const ped of state.traffic.peds) {
        if (!ped.down && dist(car.x, car.y, ped.x, ped.y) < 30) {
          knockPed(ped);
          addWanted(state.police, 1, state.time);
          audio.crash();
          hud.toast('You hit a pedestrian. The law noticed.');
        }
      }
      // Safe spot: the motel, while not wanted.
      if (state.police.wanted === 0 && dist(car.x, car.y, world.places.motel.x, world.places.motel.y) < 160) {
        player.safeX = car.x;
        player.safeY = car.y;
      }
    }

    stepTraffic(state.traffic, dt, world, player.onFoot ? null : player.car);

    const policeResult = stepPolice(state.police, player, dt, world, state.time, state.stormOn, (kind) => {
      if (kind === 'siren') audio.siren();
    });
    if (policeResult.busted) {
      bustPlayer();
      return;
    }

    const events = updateMissions(state.missions, dt, missionCtx());
    handleMissionEvents(events);

    state.target = currentTarget(state.missions, world.places);
    state.missionText = state.target ? state.target.label : '';
    if (state.missions.active && state.missions.mission) {
      state.missionText += `  •  ${Math.ceil(state.missions.timer)}s`;
    }
    if (state.missions.race.active) {
      state.missionText = `Race gate ${state.missions.race.gate + 1}/6 — ${Math.ceil(state.missions.race.timer)}s`;
    }
    renderer.drawMinimap(state);
  }

  return {
    state,
    reset,
    step,
    autopilot,
    nearestCarToPlayer,
    giveCar: (model, x, y, angle) => {
      const old = state.player.onFoot ? null : state.player.car;
      if (old) state.loose.push(old);
      const car = createCar(model, x, y, angle);
      state.loose.push(car);
      enterCar(state.player, car);
      return car;
    },
    startMissionByIndex: (i) => startMission(state.missions, i, missionCtx()),
    setWanted: (n) => setWanted(state.police, n, state.time),
    setNight: (on) => { state.night = on; },
    setStorm: (on) => { state.stormOverride = on; state.stormOn = on; },
    persistSave,
  };
}

const game = createGame();
const state = game.state;

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
resize();
window.addEventListener('resize', resize);

function keyboardInput() {
  const input = window.__input;
  const steer = input.steer();
  return {
    throttle: -input.throttle(),
    steer,
    brake: input.brake(),
    move: { x: steer, y: input.throttle() },
    run: input.run(),
    enter: false,
    interact: false,
    punch: input.brake() && state.player.onFoot,
  };
}

function runShot(name) {
  const scene = stageShot(name, game);
  state.screen = scene.screen === 'title' ? 'title' : 'play';
  if (scene.screen === 'title') {
    hud.showTitle(state.save, () => { state.screen = 'play'; });
  } else {
    hud.hideOverlay();
  }
  hud.update(state);
  let painted = 0;
  function paint() {
    renderer.draw(state, { storm: state.stormOn, night: state.night });
    renderer.drawMinimap(state);
    painted += 1;
    // The camera lerps 12% toward the player per draw, so paint ~50 frames
    // until it has settled on the player — otherwise the action shots show
    // empty desert with the player's car off-screen.
    if (painted < 50) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  window.__input = createInput();
  let accumulator = 0;
  let last = performance.now();
  let pendingEnter = false;
  let pendingInteract = false;

  function startPlay() {
    state.screen = 'play';
    hud.hideOverlay();
    hud.announce('Playing. Drive to the gold marker.');
  }

  hud.showTitle(state.save, startPlay);
  hud.announce('Dustline. Press Start Engine to play.');

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = window.__input.takeActions();
    if (actions & ACTION_PAUSE) {
      if (state.screen === 'play') {
        state.screen = 'paused';
        audio.engine(0, false);
        hud.showPause(() => { state.screen = 'play'; });
        hud.announce('Paused.');
      } else if (state.screen === 'paused') {
        state.screen = 'play';
        hud.hideOverlay();
        hud.announce('Playing.');
      }
    }
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      hud.toast(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_ENTER && state.screen === 'title') startPlay();
    if (actions & ACTION_INTERACT && state.screen === 'title') startPlay();
    pendingEnter = pendingEnter || Boolean(actions & ACTION_ENTER);
    pendingInteract = pendingInteract || Boolean(actions & ACTION_INTERACT);

    if (state.screen === 'play' || state.screen === 'title') {
      while (accumulator >= STEP && (state.screen === 'play' || state.screen === 'title')) {
        const input = autopilot.active
          ? autopilot.drive(game, STEP)
          : keyboardInput();
        // Keyboard one-shots still apply while the autopilot drives.
        if (autopilot.active) {
          const kb = keyboardInput();
          input.enter = input.enter || kb.enter;
          input.interact = input.interact || kb.interact;
        }
        input.enter = input.enter || pendingEnter;
        input.interact = input.interact || pendingInteract;
        pendingEnter = false;
        pendingInteract = false;
        stepGameInput(input);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    hud.update(state);
    renderer.draw(state, { storm: state.stormOn, night: state.night });
  }

  function stepGameInput(input) {
    // Translate the unified input into the step() call, handling one-shots.
    const mapped = {
      throttle: input.throttle || 0,
      steer: input.steer || 0,
      brake: Boolean(input.brake),
      move: input.move || { x: 0, y: 0 },
      run: Boolean(input.run),
      enter: Boolean(input.enter),
      interact: Boolean(input.interact),
      punch: Boolean(input.punch),
    };
    game.step(STEP, mapped);
  }

  // Leaving the tab pauses a running game rather than letting the law close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.screen = 'paused';
      audio.engine(0, false);
      hud.showPause(() => { state.screen = 'play'; });
      hud.announce('Paused.');
    }
  });

  requestAnimationFrame(frame);
}

// Debug + test API: the parent's Playwright tests drive the game through this.
// Nothing in play depends on it.
window.__dustline = {
  state: () => ({
    screen: state.screen,
    cash: Math.floor(state.player.cash),
    wanted: state.police.wanted,
    missionIndex: state.missions.index,
    missionActive: state.missions.active,
    missionStage: state.missions.stage,
    missionTimer: state.missions.timer,
    missionTitle: state.missions.mission ? state.missions.mission.title : null,
    player: {
      x: state.player.onFoot ? state.player.x : state.player.car.x,
      y: state.player.onFoot ? state.player.y : state.player.car.y,
      onFoot: state.player.onFoot,
      car: state.player.onFoot ? null : state.player.car.model,
      fuel: state.player.onFoot ? 100 : Math.round(state.player.car.fuel),
      damage: state.player.onFoot ? 0 : Math.round(state.player.car.damage),
      speed: state.player.onFoot ? state.player.speed : Math.round(state.player.car.speed),
    },
    target: state.target,
    cachesTaken: state.missions.caches.filter((c) => c.taken).length,
    cratesTaken: state.missions.crates.filter((c) => c.taken).length,
    race: { active: state.missions.race.active, gate: state.missions.race.gate, timer: state.missions.race.timer },
    storm: state.stormOn,
  }),
  startMission: (i) => game.startMissionByIndex(i),
  teleport: (x, y) => {
    if (!state.player.onFoot && state.player.car) {
      state.player.car.x = x;
      state.player.car.y = y;
      state.player.car.speed = 0;
    }
    state.player.x = x;
    state.player.y = y;
  },
  giveCar: (model) => {
    const px = state.player.onFoot ? state.player.x : state.player.car.x;
    const py = state.player.onFoot ? state.player.y : state.player.car.y;
    game.giveCar(model, px, py, 0);
  },
  setWanted: (n) => game.setWanted(n),
  setStorm: (on) => game.setStorm(on),
  setNight: (on) => game.setNight(on),
  damageCar: (n) => {
    if (!state.player.onFoot && state.player.car) {
      state.player.car.damage = Math.min(100, state.player.car.damage + n);
    }
  },
  autopilotRoute: (points) => autopilot.setRoute(points),
  autopilotTo: (x, y) => autopilot.setTarget(x, y),
  autopilotClear: () => autopilot.clear(),
  autopilotActive: () => autopilot.active,
  saveNow: () => game.persistSave(),
};

if (shot) runShot(shot);
else runGame();
