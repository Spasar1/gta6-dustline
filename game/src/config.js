// Every tuning number, name and colour for Dustline in one place. The world is a
// fixed 3840x2880 desert town; the camera follows the player, so no rule depends
// on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** World bounds, in world pixels. */
export const WORLD = { width: 3840, height: 2880 };

/** Where the best run is kept between visits (this browser only). */
export const SAVE_KEY = 'dustline.save.v1';

/** The player on foot. */
export const WALK = {
  walkSpeed: 170,
  runSpeed: 300,
  radius: 13,
  punchRange: 34,
  punchCooldown: 0.45,
};

/** Cars: name, top speed (px/s), acceleration, turn rate, colour, length/width. */
export const CARS = {
  coyote: { name: 'Coyote Pickup', top: 470, accel: 300, turn: 2.6, color: '#b8452a', length: 52, width: 26 },
  sidewinder: { name: 'Sidewinder Sedan', top: 520, accel: 340, turn: 3.0, color: '#3a6ea5', length: 50, width: 25 },
  duster: { name: 'Duster Muscle', top: 590, accel: 400, turn: 2.7, color: '#e0a32e', length: 52, width: 26 },
  burro: { name: 'Burro Van', top: 400, accel: 250, turn: 2.4, color: '#7a7d84', length: 56, width: 28 },
  longhorn: { name: 'Longhorn Semi', top: 440, accel: 220, turn: 2.0, color: '#4a6b4f', length: 78, width: 30 },
  cruiser: { name: 'Sheriff Cruiser', top: 560, accel: 420, turn: 3.2, color: '#e8e8e8', length: 52, width: 26 },
};

export const FUEL = {
  max: 100,
  drainPerSecond: 0.25,
  drainPerSpeed: 0.001,
  lowAt: 25,
};

/** Wanted level: how many cruisers hunt, how fast they are, how long a bust takes. */
export const WANTED = [
  { cruisers: 0, speedMul: 1.0 },
  { cruisers: 1, speedMul: 0.92 },
  { cruisers: 2, speedMul: 0.98 },
  { cruisers: 3, speedMul: 1.05 },
  { cruisers: 4, speedMul: 1.12 },
  { cruisers: 5, speedMul: 1.2 },
];

export const POLICE = {
  sightRange: 620,
  bustRange: 46,
  bustTime: 2.0,
  ramDamage: 8,
  decaySeconds: 14,
};

/** Dust storms: how often one rolls in, how long it lasts, how far you can see in it. */
export const STORM = {
  firstAt: 75,
  gapMin: 80,
  gapMax: 150,
  duration: 26,
  viewRadius: 300,
  clearViewRadius: 900,
};

export const MISSIONS = [
  {
    id: 1, title: 'First Haul', reward: 150, timeLimit: 180,
    brief: 'Rosa needs a package from the Red Rock Truck Stop. Pick it up, bring it to the Dustline Motel. Do not dawdle.',
    giver: 'Rosa Delgado',
  },
  {
    id: 2, title: 'Dust Runner', reward: 300, timeLimit: 240,
    brief: 'Five stash crates are buried out on the dry lakebed, and a dust storm is rolling in. Grab all five before the storm clears.',
    giver: 'Rosa Delgado',
  },
  {
    id: 3, title: 'Checkpoint Dodge', reward: 400, timeLimit: 300,
    brief: 'A hot crate sits at the quarry. The border checkpoint is watching the highway — take the dry wash around it and bring the crate to the motel.',
    giver: 'Sal Vega',
  },
  {
    id: 4, title: 'Hot Pursuit', reward: 600, timeLimit: 300,
    brief: 'Sheriff Boone has your plate. Lose the cruisers — get your wanted level to zero — then slip into the motel safehouse.',
    giver: 'Rosa Delgado',
  },
  {
    id: 5, title: 'The Big Run', reward: 1000, timeLimit: 360,
    brief: 'Three drops, one night: motel, truck stop, border warehouse, then home. Boone will have every cruiser on the road. Make it pay.',
    giver: 'Sal Vega',
  },
];

export const CACHES = 12;
export const CACHE_REWARD = 25;
export const RACE_REWARD = 150;
export const RACE_TIME = 95;

export const PALETTE = {
  sand: '#d9a860',
  sandDark: '#c08d46',
  sandLight: '#e8c88a',
  road: '#4a4440',
  roadLine: '#e8d27a',
  interstate: '#3d3a38',
  sidewalk: '#b99a6b',
  building: '#8a5a3b',
  buildingRoof: '#6e452c',
  motel: '#c96f3f',
  diner: '#d9b23c',
  water: '#3f6d8e',
  cactus: '#4a7d3a',
  rock: '#8d7a63',
  night: '#1a2233',
  player: '#ffcf3f',
  police: '#e8e8e8',
  hud: '#ffe9b0',
};

export const FONT = "'Trebuchet MS', Verdana, sans-serif";
