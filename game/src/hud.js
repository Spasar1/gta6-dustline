// The DOM HUD: cash, wanted stars, mission line, speed, fuel, storm warning,
// banners, toasts and the big overlays (title, pause, busted, wasted, mission
// briefings). The canvas draws the world; this module talks to the player.
import { MISSIONS } from './config.js';

export function createHud() {
  const cashEl = document.getElementById('cash');
  const wantedEl = document.getElementById('wanted');
  const missionEl = document.getElementById('mission-line');
  const speedEl = document.getElementById('speed');
  const fuelFill = document.getElementById('fuel-fill');
  const fuelLabel = document.getElementById('fuel-label');
  const stormEl = document.getElementById('storm');
  const bannerEl = document.getElementById('banner');
  const toastEl = document.getElementById('toast');
  const overlayEl = document.getElementById('overlay');
  const titleEl = document.getElementById('overlay-title');
  const subEl = document.getElementById('overlay-sub');
  const bodyEl = document.getElementById('overlay-body');
  const hintEl = document.getElementById('overlay-hint');
  const buttonEl = document.getElementById('overlay-button');
  const statusEl = document.getElementById('status');

  let bannerTimer = null;
  let toastTimer = null;
  let lastCash = '';
  let lastWanted = -1;
  let lastMission = '';
  let lastSpeed = '';
  let lastFuel = -1;

  function announce(message) {
    statusEl.textContent = message;
  }

  function update(state) {
    const cash = `$${Math.floor(state.player.cash)}`;
    if (cash !== lastCash) {
      cashEl.textContent = cash;
      lastCash = cash;
    }
    if (state.police.wanted !== lastWanted) {
      let stars = '';
      for (let i = 0; i < 5; i += 1) {
        stars += i < state.police.wanted ? '★' : '<span class="dim">★</span>';
      }
      wantedEl.innerHTML = stars;
      lastWanted = state.police.wanted;
    }
    const missionText = state.missionText || '';
    if (missionText !== lastMission) {
      missionEl.textContent = missionText;
      lastMission = missionText;
    }
    const speed = state.player.onFoot
      ? (state.player.speed > 10 ? 'ON FOOT' : 'ON FOOT')
      : `${Math.round(Math.abs(state.player.car.speed) * 0.32)} mph`;
    if (speed !== lastSpeed) {
      speedEl.textContent = speed;
      lastSpeed = speed;
    }
    const fuel = state.player.onFoot ? 100 : Math.round(state.player.car.fuel);
    if (fuel !== lastFuel) {
      fuelFill.style.width = `${fuel}%`;
      fuelLabel.textContent = state.player.onFoot ? 'ON FOOT' : (fuel <= 0 ? 'EMPTY' : `FUEL ${fuel}%`);
      lastFuel = fuel;
    }
    stormEl.classList.toggle('hidden', !state.stormOn);
  }

  function banner(text, sub, seconds) {
    bannerEl.innerHTML = sub ? `${text}<small>${sub}</small>` : text;
    bannerEl.classList.remove('hidden');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => bannerEl.classList.add('hidden'), (seconds || 3) * 1000);
  }

  function toast(text, seconds) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), (seconds || 3) * 1000);
  }

  function showOverlay(title, sub, bodyHtml, hint, buttonText, onButton) {
    titleEl.textContent = title;
    subEl.textContent = sub;
    bodyEl.innerHTML = bodyHtml;
    hintEl.textContent = hint;
    buttonEl.textContent = buttonText;
    overlayEl.classList.remove('hidden');
    buttonEl.onclick = onButton;
  }

  function hideOverlay() {
    overlayEl.classList.add('hidden');
  }

  function showTitle(save, onStart) {
    const next = save.missionIndex < MISSIONS.length ? MISSIONS[save.missionIndex] : null;
    const body = next
      ? `<b>Jesse "Dusty" Kane</b> owes Rosa Delgado at the Dustline Motel, and Sheriff Boone wants his plate.`
        + `<br><br>Next job: <b>Mission ${next.id} — ${next.title}</b> ($${next.reward}). Talk to Rosa at the motel to start it.`
        + `<br><br>Cash: <b>$${Math.floor(save.cash)}</b> &nbsp;•&nbsp; Desert caches found: <b>${save.cachesTaken}/${12}</b>`
      : `<b>Jesse "Dusty" Kane</b> finished all five jobs. Dustline is his town now — free roam, caches, and the highway time trial are still out there.`
        + `<br><br>Cash: <b>$${Math.floor(save.cash)}</b> &nbsp;•&nbsp; Desert caches found: <b>${save.cachesTaken}/${12}</b>`;
    showOverlay(
      'DUSTLINE',
      'A desert highway town. One driver. Five jobs. No way back.',
      body,
      'WASD / arrows drive & walk • E enter or leave a car • F refuel / interact • Space handbrake • Shift run • P pause • M mute',
      'START ENGINE',
      () => { hideOverlay(); if (onStart) onStart(); },
    );
  }

  function showPause(onResume) {
    showOverlay(
      'PAUSED',
      'The dust waits for no one. Except now.',
      'Your progress is saved. The highway, the checkpoint and Sheriff Boone will all still be there.',
      'Press P or click Resume to keep driving.',
      'RESUME',
      () => { hideOverlay(); if (onResume) onResume(); },
    );
  }

  function showBusted(onRespawn) {
    showOverlay(
      'BUSTED',
      'Sheriff Boone has you. The county takes its cut.',
      'You lost <b>$50</b> in fines and the job you were on. Rosa is not pleased.',
      'Click to walk out of the sheriff\u2019s office and get back to work.',
      'WALK OUT',
      () => { hideOverlay(); if (onRespawn) onRespawn(); },
    );
  }

  function showWasted(onRespawn) {
    showOverlay(
      'WASTED',
      'The desert is not kind to drivers who push too hard.',
      'Your car is a wreck. The clinic patched you up — the bill was <b>$50</b>.',
      'Click to get back on your feet.',
      'GET UP',
      () => { hideOverlay(); if (onRespawn) onRespawn(); },
    );
  }

  function showBriefing(mission, onStart) {
    showOverlay(
      `MISSION ${mission.id} — ${mission.title}`,
      `${mission.giver} • Reward $${mission.reward} • ${mission.timeLimit}s`,
      mission.brief,
      'Drive to the gold marker. The arrow and the minimap point the way.',
      'TAKE THE JOB',
      () => { hideOverlay(); if (onStart) onStart(); },
    );
  }

  function showStoryDone(onContinue) {
    showOverlay(
      'THE BIG RUN — DONE',
      'All five jobs complete. Dustline is yours.',
      'Rosa is paid. Boone is still looking, but the desert is wide and your tank is full. Free roam: caches, the highway time trial, and whatever trouble you find.',
      '',
      'KEEP DRIVING',
      () => { hideOverlay(); if (onContinue) onContinue(); },
    );
  }

  return {
    update, banner, toast, announce,
    showTitle, showPause, showBusted, showWasted, showBriefing, showStoryDone,
    hideOverlay,
  };
}
