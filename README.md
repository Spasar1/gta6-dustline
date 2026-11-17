# Dustline — Open World Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Spasar1/gta6-dustline/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Spasar1/gta6-dustline/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), built by an AI agent.

## The game

**Dustline** is a sun-baked desert highway town on a border route: an interstate, a motel strip, a truck stop, a dry lakebed, a quarry and a border checkpoint with a barrier across Main Street. You are **Jesse "Dusty" Kane**, a long-haul driver turned smuggler, working off a debt to **Rosa Delgado** at the Dustline Motel while **Sheriff Boone** hunts your plate.

- **Five story missions**: First Haul, Dust Runner, Checkpoint Dodge, Hot Pursuit, The Big Run — $150 to $1,000 a job.
- **Desert systems**: rolling dust storms that cut visibility (and police sight), fuel management with gas stations, border-checkpoint evasion via the dry wash bypass, highway high-speed chases.
- **Open world**: drive or walk, steal cars, traffic and pedestrians, a wanted level with pursuing sheriff cruisers, busted/wasted recovery, 12 desert caches, a highway time trial, a HUD with a minimap, and a localStorage save.
- **Sound**: fully synthesized WebAudio — engine hum, sirens, wind, pickups. No audio files.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit http://localhost:8080). No network requests, no build step.

- **WASD / arrows** — drive & walk · **E** — enter / leave a car · **F** — refuel at a gas station / talk to Rosa · **Space** — handbrake (punch on foot) · **Shift** — run · **P** — pause · **M** — mute

## Layout

- `game/index.html` + `game/css/style.css` — page and HUD
- `game/src/config.js` — tuning, car models, mission definitions
- `game/src/world.js` — the town: roads, buildings, props, zones
- `game/src/cars.js` — car physics · `game/src/player.js` — Dusty on foot and in a car
- `game/src/traffic.js` — traffic and pedestrians · `game/src/police.js` — wanted level and cruisers
- `game/src/missions.js` — story missions, caches, time trial
- `game/src/render.js` — camera, world, minimap, storm and night
- `game/src/hud.js` — DOM HUD and overlays · `game/src/audio.js` — synthesized sound
- `game/src/save.js` — localStorage save · `game/src/shots.js` — screenshot scenes
- `game/src/main.js` — boot and the fixed-step loop
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)

## License

MIT — see `LICENSE`.
