// The town of Dustline: roads, buildings, props and zones, built once from a fixed
// seed so the map is identical every run. Nothing here draws or knows the screen;
// render.js draws what this returns, and cars.js asks it about collisions.
import { mulberry32, range, pick } from './random.js';
import { WORLD } from './config.js';

/** Point-in-AABB test. */
export function inRect(x, y, r) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Circle-vs-AABB test, for the player on foot and car corners. */
export function circleHitsRect(x, y, radius, r) {
  const cx = Math.max(r.x, Math.min(x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(y, r.y + r.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

export function createWorld() {
  const rng = mulberry32(1337);

  // Roads: {x, y, w, h, highway}. The interstate runs east-west; Main Street runs
  // north-south through town; the grid and the dirt tracks fill the rest.
  const roads = [
    { x: 0, y: 1360, w: WORLD.width, h: 120, highway: true, name: 'Interstate 10' },
    { x: 1840, y: 180, w: 120, h: 2520, highway: false, name: 'Main Street' },
    { x: 300, y: 1000, w: 2600, h: 70, highway: false, name: 'Frontage Road' },
    { x: 300, y: 1900, w: 2600, h: 70, highway: false, name: 'Cactus Road' },
    { x: 1400, y: 1000, w: 70, h: 970, highway: false, name: 'Depot Street' },
    { x: 2400, y: 1000, w: 70, h: 970, highway: false, name: 'Juniper Street' },
    { x: 1900, y: 180, w: 60, h: 1180, highway: false, name: 'Lake Road', dirt: true },
    { x: 2100, y: 2280, w: 700, h: 60, highway: false, name: 'Dry Wash', dirt: true },
    { x: 2740, y: 2280, w: 60, h: 420, highway: false, name: 'Wash Cut', dirt: true },
    { x: 1960, y: 2640, w: 840, h: 60, highway: false, name: 'Border Road', dirt: true },
    { x: 2900, y: 1420, w: 500, h: 60, highway: false, name: 'Quarry Road', dirt: true },
  ];

  // Buildings: {x, y, w, h, color, roof, label}. All block movement.
  const buildings = [
    { x: 300, y: 1120, w: 320, h: 130, color: '#7a4a2e', roof: '#5d3620', label: 'RED ROCK TRUCK STOP' },
    { x: 660, y: 1120, w: 130, h: 90, color: '#9c6b3f', roof: '#7a4a2e', label: 'DINER' },
    { x: 1500, y: 1640, w: 260, h: 150, color: '#c96f3f', roof: '#8a4a26', label: 'DUSTLINE MOTEL' },
    { x: 2040, y: 1640, w: 150, h: 110, color: '#d9b23c', roof: '#a8871f', label: 'ROSA\u2019S DINER' },
    { x: 1480, y: 900, w: 180, h: 90, color: '#6b7a8c', roof: '#4a5566', label: 'SHERIFF' },
    { x: 2480, y: 900, w: 200, h: 100, color: '#8a5a3b', roof: '#6e452c', label: 'GAS & GO' },
    { x: 2500, y: 1980, w: 220, h: 120, color: '#7a6a55', roof: '#5d4f40', label: 'WAREHOUSE' },
    { x: 3300, y: 1200, w: 260, h: 140, color: '#6e5a44', roof: '#54432f', label: 'QUARRY OFFICE' },
    { x: 3480, y: 1620, w: 180, h: 120, color: '#5d4a38', roof: '#463729', label: 'QUARRY SHED' },
    { x: 2280, y: 2720, w: 200, h: 110, color: '#7a5a3a', roof: '#5d452c', label: 'BORDER WAREHOUSE' },
    { x: 1760, y: 2440, w: 90, h: 70, color: '#8c8c8c', roof: '#6a6a6a', label: 'BOOTH' },
    { x: 1990, y: 2440, w: 90, h: 70, color: '#8c8c8c', roof: '#6a6a6a', label: 'BOOTH' },
    // Town houses.
    { x: 1520, y: 1080, w: 110, h: 90, color: '#a8764e', roof: '#7a5636', label: '' },
    { x: 1700, y: 1080, w: 110, h: 90, color: '#b98a5a', roof: '#8a6540', label: '' },
    { x: 2120, y: 1080, w: 110, h: 90, color: '#9c6b3f', roof: '#75502e', label: '' },
    { x: 1520, y: 1980, w: 110, h: 90, color: '#a8764e', roof: '#7a5636', label: '' },
    { x: 1700, y: 1980, w: 110, h: 90, color: '#b98a5a', roof: '#8a6540', label: '' },
    { x: 2120, y: 1980, w: 110, h: 90, color: '#9c6b3f', roof: '#75502e', label: '' },
    { x: 2500, y: 1080, w: 110, h: 90, color: '#a8764e', roof: '#7a5636', label: '' },
  ];

  // Gas stations: refuel zones (drive in, hold F).
  const gasStations = [
    { x: 420, y: 1260, w: 220, h: 90, name: 'Truck Stop Fuel' },
    { x: 2500, y: 1030, w: 160, h: 80, name: 'Gas & Go' },
  ];

  // The border checkpoint: a barrier across Main Street at y 2520. Crossing the
  // line on the road while carrying contraband is what the law notices.
  const checkpoint = { x: 1840, y: 2510, w: 120, h: 26, lineY: 2523 };

  // The dry lakebed: open flat ground north, where the caches hide.
  const lakebed = { x: 1150, y: 150, w: 1700, h: 620 };

  // Props: cacti, rocks, signs and billboards, seeded, kept off roads/buildings.
  const props = [];
  const propKinds = ['cactus', 'cactus', 'rock', 'rock', 'sign', 'tumbleweed'];
  for (let i = 0; i < 260; i += 1) {
    const x = range(rng, 60, WORLD.width - 60);
    const y = range(rng, 60, WORLD.height - 60);
    if (roads.some((r) => inRect(x, y, { x: r.x - 30, y: r.y - 30, w: r.w + 60, h: r.h + 60 }))) continue;
    if (buildings.some((b) => inRect(x, y, { x: b.x - 24, y: b.y - 24, w: b.w + 48, h: b.h + 48 }))) continue;
    if (gasStations.some((g) => inRect(x, y, g))) continue;
    props.push({ x, y, kind: pick(rng, propKinds), size: range(rng, 10, 26), seed: rng() });
  }
  // Billboards along the interstate.
  props.push({ x: 700, y: 1300, kind: 'billboard', size: 60, seed: 0.2, text: 'DUSTLINE  12 MI' });
  props.push({ x: 3100, y: 1300, kind: 'billboard', size: 60, seed: 0.7, text: 'GAS  •  FOOD  •  MOTEL' });
  props.push({ x: 2000, y: 2400, kind: 'billboard', size: 60, seed: 0.4, text: 'BORDER CHECKPOINT AHEAD' });

  // Named places the game logic and the minimap use. Each point sits on open
  // ground in front of its building — never inside one, so cars can reach it.
  const places = {
    motel: { x: 1630, y: 1830, label: 'Dustline Motel' },
    truckStop: { x: 460, y: 1300, label: 'Red Rock Truck Stop' },
    quarry: { x: 3430, y: 1450, label: 'Quarry' },
    borderWarehouse: { x: 2380, y: 2560, label: 'Border Warehouse' },
    lakebedCenter: { x: 2000, y: 460, label: 'Dry Lakebed' },
    checkpoint: { x: 1900, y: 2523, label: 'Border Checkpoint' },
  };

  function isOnRoad(x, y, margin) {
    const m = margin || 0;
    return roads.some((r) => x >= r.x - m && x < r.x + r.w + m && y >= r.y - m && y < r.y + r.h + m);
  }

  function onHighway(x, y) {
    return roads.some((r) => r.highway && inRect(x, y, r));
  }

  function hitsBuilding(x, y, radius) {
    for (const b of buildings) if (circleHitsRect(x, y, radius, b)) return b;
    return null;
  }

  function insideWorld(x, y) {
    return x >= 30 && x < WORLD.width - 30 && y >= 30 && y < WORLD.height - 30;
  }

  return { roads, buildings, props, gasStations, checkpoint, lakebed, places, isOnRoad, onHighway, hitsBuilding, insideWorld };
}
