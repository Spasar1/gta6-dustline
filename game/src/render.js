// Drawing: the camera, the desert, the town, every entity, the minimap, the dust
// storm and the night. Pure drawing — it reads state and writes pixels only.
import { WORLD, PALETTE } from './config.js';
import { clamp, lerp } from './random.js';

export function createRenderer(canvas, minimapCanvas) {
  const ctx = canvas.getContext('2d');
  const mctx = minimapCanvas.getContext('2d');
  const particles = [];
  let camera = { x: 0, y: 0 };
  let viewW = 1280;
  let viewH = 720;

  function resize(w, h) {
    viewW = w;
    viewH = h;
    canvas.width = w;
    canvas.height = h;
  }

  function spawnDust(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40 - 12,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        size: 4 + Math.random() * 8,
        color: '210,180,130',
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  function spawnSmoke(x, y) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 20,
      vy: -30 - Math.random() * 20,
      life: 0.8,
      max: 0.8,
      size: 7 + Math.random() * 6,
      color: '60,60,60',
    });
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawCar(c, x, y, angle, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-c.length / 2 + 3, -c.width / 2 + 3, c.length, c.width);
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.roundRect(-c.length / 2, -c.width / 2, c.length, c.width, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.beginPath();
    ctx.roundRect(-c.length / 2 + 10, -c.width / 2 + 4, c.length / 2 - 6, c.width - 8, 4);
    ctx.fill();
    ctx.fillStyle = isPlayer ? '#ffcf3f' : 'rgba(255,255,255,0.75)';
    ctx.fillRect(c.length / 2 - 6, -c.width / 2 + 3, 4, 5);
    ctx.fillRect(c.length / 2 - 6, c.width / 2 - 8, 4, 5);
    if (c.model === 'cruiser' || c.isPolice) {
      ctx.fillStyle = '#222';
      ctx.fillRect(-4, -c.width / 2, 8, c.width);
      ctx.fillStyle = '#c33';
      ctx.fillRect(-c.length / 2 + 2, -c.width / 2 + 2, 8, 5);
      ctx.fillStyle = '#36c';
      ctx.fillRect(-c.length / 2 + 2, c.width / 2 - 7, 8, 5);
    }
    ctx.restore();
  }

  function drawRoad(r) {
    ctx.fillStyle = r.dirt ? '#a8875e' : r.highway ? PALETTE.interstate : PALETTE.road;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (!r.dirt) {
      ctx.strokeStyle = PALETTE.roadLine;
      ctx.lineWidth = 3;
      ctx.setLineDash([26, 22]);
      ctx.beginPath();
      if (r.w > r.h) {
        ctx.moveTo(r.x, r.y + r.h / 2);
        ctx.lineTo(r.x + r.w, r.y + r.h / 2);
      } else {
        ctx.moveTo(r.x + r.w / 2, r.y);
        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawProp(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === 'cactus') {
      ctx.fillStyle = PALETTE.cactus;
      ctx.fillRect(-3, -p.size, 6, p.size);
      ctx.fillRect(-p.size / 2, -p.size * 0.6, 5, 12);
      ctx.fillRect(p.size / 2 - 5, -p.size * 0.75, 5, 14);
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath();
      ctx.arc(0, -p.size - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'rock') {
      ctx.fillStyle = PALETTE.rock;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.6, p.seed * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'tumbleweed') {
      ctx.strokeStyle = '#b98d4f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-p.size / 2, 0);
      ctx.lineTo(p.size / 2, 0);
      ctx.moveTo(0, -p.size / 2);
      ctx.lineTo(0, p.size / 2);
      ctx.stroke();
    } else if (p.kind === 'sign') {
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-2, -14, 4, 14);
      ctx.fillStyle = '#e8d27a';
      ctx.fillRect(-12, -26, 24, 13);
    } else if (p.kind === 'billboard') {
      ctx.fillStyle = '#4a3421';
      ctx.fillRect(-4, -46, 8, 46);
      ctx.fillRect(4, -46, 8, 46);
      ctx.fillStyle = '#f4e3b0';
      ctx.fillRect(-p.size, -86, p.size * 2, 42);
      ctx.fillStyle = '#7a3a1a';
      ctx.font = 'bold 13px Trebuchet MS, Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text || '', 0, -62);
    }
    ctx.restore();
  }

  /** Draw the whole world from `state`. `opts` carries night/storm flags. */
  function draw(state, opts) {
    const player = state.player;
    const px = player.onFoot ? player.x : player.car.x;
    const py = player.onFoot ? player.y : player.car.y;
    const tx = clamp(px - viewW / 2, 0, Math.max(0, WORLD.width - viewW));
    const ty = clamp(py - viewH / 2, 0, Math.max(0, WORLD.height - viewH));
    camera.x = lerp(camera.x, tx, 0.12);
    camera.y = lerp(camera.y, ty, 0.12);
    const ox = -camera.x;
    const oy = -camera.y;

    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = opts.night ? '#20283a' : PALETTE.sand;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(ox, oy);

    // Sand shading + the dry lakebed.
    ctx.fillStyle = opts.night ? '#252e42' : PALETTE.sandLight;
    ctx.fillRect(state.world.lakebed.x, state.world.lakebed.y, state.world.lakebed.w, state.world.lakebed.h);
    ctx.strokeStyle = 'rgba(120,90,50,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(state.world.lakebed.x, state.world.lakebed.y, state.world.lakebed.w, state.world.lakebed.h);
    ctx.fillStyle = opts.night ? '#2c3550' : PALETTE.sandDark;
    for (let i = 0; i < 40; i += 1) {
      const x = ((i * 977) % WORLD.width) + 40;
      const y = ((i * 571) % WORLD.height) + 40;
      ctx.beginPath();
      ctx.ellipse(x, y, 60, 18, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const r of state.world.roads) drawRoad(r);

    // Gas stations.
    for (const g of state.world.gasStations) {
      ctx.fillStyle = '#8a2f2f';
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Trebuchet MS, Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FUEL — HOLD F', g.x + g.w / 2, g.y + g.h / 2 + 5);
    }

    // Checkpoint barrier across Main Street.
    const cp = state.world.checkpoint;
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(cp.x, cp.y, cp.w, cp.h);
    ctx.fillStyle = '#c33';
    for (let x = cp.x; x < cp.x + cp.w; x += 20) ctx.fillRect(x, cp.y, 10, cp.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Trebuchet MS, Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHECKPOINT', cp.x + cp.w / 2, cp.y - 8);

    // Buildings.
    for (const b of state.world.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 4, b.y + 4, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 14);
      if (b.label) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Trebuchet MS, Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 12);
      }
    }

    for (const p of state.world.props) {
      if (p.x < camera.x - 120 || p.x > camera.x + viewW + 120 || p.y < camera.y - 120 || p.y > camera.y + viewH + 120) continue;
      drawProp(p);
    }

    // Caches and crates.
    for (const cache of state.missions.caches) {
      if (cache.taken) continue;
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath();
      ctx.arc(cache.x, cache.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5a10';
      ctx.font = 'bold 13px Trebuchet MS, Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', cache.x, cache.y + 5);
    }
    if (state.missions.active && state.missions.mission && state.missions.mission.id === 2) {
      for (const crate of state.missions.crates) {
        if (crate.taken) continue;
        ctx.fillStyle = '#8a5a2a';
        ctx.fillRect(crate.x - 12, crate.y - 9, 24, 18);
        ctx.strokeStyle = '#ffd75e';
        ctx.lineWidth = 2;
        ctx.strokeRect(crate.x - 12, crate.y - 9, 24, 18);
      }
    }

    // Race gates.
    if (state.missions.race.active) {
      const gates = state.missions.raceGates;
      gates.forEach((g, i) => {
        const done = i < state.missions.race.gate;
        ctx.strokeStyle = done ? '#7ddc7d' : '#ffd75e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = done ? '#7ddc7d' : '#ffd75e';
        ctx.font = 'bold 16px Trebuchet MS, Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), g.x, g.y + 6);
      });
    }

    // Traffic, police, pedestrians.
    for (const car of state.traffic.cars) {
      if (car.stolen) continue;
      drawCar(car, car.x, car.y, car.angle, false);
    }
    for (const p of state.parked) drawCar(p.car, p.car.x, p.car.y, p.car.angle, false);
    for (const car of state.loose) drawCar(car, car.x, car.y, car.angle, false);
    for (const cruiser of state.police.cruisers) drawCar(cruiser, cruiser.x, cruiser.y, cruiser.angle, false);
    for (const ped of state.traffic.peds) {
      if (ped.down) {
        ctx.fillStyle = ped.color;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 7, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c88a';
      ctx.beginPath();
      ctx.arc(ped.x, ped.y - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player.
    if (player.onFoot) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(player.x + 2, player.y + 3, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a6db0';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(player.x, player.y - 15, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a6db0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
      ctx.stroke();
      if (player.punchAnim > 0) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(player.x + Math.cos(player.angle) * 28, player.y + Math.sin(player.angle) * 28, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      drawCar(player.car, player.car.x, player.car.y, player.car.angle, true);
    }

    // Objective marker: pulsing ring on the target, or an edge arrow when off-screen.
    const target = state.target;
    if (target) {
      const sx = target.x + ox;
      const sy = target.y + oy;
      const onScreen = sx > 60 && sx < viewW - 60 && sy > 60 && sy < viewH - 60;
      if (onScreen) {
        ctx.fillStyle = '#ffd75e';
        ctx.beginPath();
        ctx.arc(target.x, target.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5a10';
        ctx.beginPath();
        ctx.arc(target.x, target.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,215,94,${0.5 + 0.4 * Math.sin(state.time * 4)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(target.x, target.y, 20 + 4 * Math.sin(state.time * 4), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const cxp = clamp(sx, 70, viewW - 70);
        const cyp = clamp(sy, 70, viewH - 70);
        const ang = Math.atan2(sy - viewH / 2, sx - viewW / 2);
        ctx.save();
        ctx.translate(cxp, cyp);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffd75e';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    stepParticles(1 / 60);
    for (const p of particles) {
      ctx.fillStyle = `rgba(${p.color},${Math.max(0, p.life / p.max) * 0.55})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Dust storm: sand-coloured fog closing in around the player.
    if (opts.storm) {
      const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, 90, viewW / 2, viewH / 2, 520);
      grad.addColorStop(0, 'rgba(214,178,120,0.08)');
      grad.addColorStop(0.55, 'rgba(214,178,120,0.5)');
      grad.addColorStop(1, 'rgba(190,150,90,0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.strokeStyle = 'rgba(240,210,150,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i += 1) {
        const y = ((i * 97 + state.time * 260) % (viewH + 40)) - 20;
        const x = ((i * 211 + state.time * 420) % (viewW + 120)) - 60;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 46, y + 6);
        ctx.stroke();
      }
    }

    // Night: darkness with a lit circle around the player.
    if (opts.night) {
      ctx.fillStyle = 'rgba(10,16,34,0.55)';
      ctx.fillRect(0, 0, viewW, viewH);
      const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, 60, viewW / 2, viewH / 2, 420);
      grad.addColorStop(0, 'rgba(255,220,140,0.10)');
      grad.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  /** The minimap: the whole town shrunk, with player, target and cruisers. */
  function drawMinimap(state) {
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = '#c8a06a';
    mctx.fillRect(0, 0, w, h);
    mctx.fillStyle = '#e8d9a8';
    mctx.fillRect(state.world.lakebed.x * sx, state.world.lakebed.y * sy, state.world.lakebed.w * sx, state.world.lakebed.h * sy);
    mctx.fillStyle = '#4a4440';
    for (const r of state.world.roads) mctx.fillRect(r.x * sx, r.y * sy, Math.max(2, r.w * sx), Math.max(2, r.h * sy));
    mctx.fillStyle = '#6e452c';
    for (const b of state.world.buildings) mctx.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    const player = state.player;
    const px = (player.onFoot ? player.x : player.car.x) * sx;
    const py = (player.onFoot ? player.y : player.car.y) * sy;
    if (state.target) {
      mctx.fillStyle = '#ffd75e';
      mctx.beginPath();
      mctx.arc(state.target.x * sx, state.target.y * sy, 5, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.fillStyle = '#ff5a4e';
    for (const c of state.police.cruisers) {
      mctx.beginPath();
      mctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(player.onFoot ? player.angle : player.car.angle);
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    mctx.moveTo(7, 0);
    mctx.lineTo(-5, -5);
    mctx.lineTo(-5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  return { resize, draw, drawMinimap, spawnDust, spawnSmoke };
}
