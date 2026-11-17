// Save: cash, story progress, caches and the best race time, in localStorage.
// Storage can be off (private windows): then progress lasts this visit only.
import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return { cash: 0, missionIndex: 0, cachesTaken: 0, bestRace: null, muted: false };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage unavailable: ignore, the run continues in memory.
  }
}
