// Save / load: the whole campaign in one localStorage key — money, respect,
// missions done, garage, weapons, radio and the player's position. Saving
// happens on mission pass and from the pause menu; loading restores it all.

import { G } from './state.js';

const KEY = 'paloma-bay-save-v1';

export function saveGame() {
  try {
    const data = {
      money: G.money,
      rp: G.rp,
      missionsDone: G.missionsDone,
      missionIndex: G.missionIndex,
      health: G.health,
      armor: G.armor,
      weapons: G.weapons,
      ownedCars: G.ownedCars,
      garageCar: G.garageCar,
      upgrades: G.upgrades,
      radioStation: G.radioStation,
      day: G.day,
      clock: G.clock,
      playerX: G.playerX,
      playerZ: G.playerZ,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    G.money = data.money ?? G.money;
    G.rp = data.rp ?? G.rp;
    G.missionsDone = data.missionsDone || [];
    G.missionIndex = data.missionIndex || 0;
    G.health = data.health ?? 100;
    G.armor = data.armor ?? 0;
    if (data.weapons) G.weapons = data.weapons;
    G.ownedCars = data.ownedCars || G.ownedCars;
    G.garageCar = data.garageCar || G.garageCar;
    G.upgrades = data.upgrades || {};
    G.radioStation = data.radioStation || 0;
    G.day = data.day || 1;
    G.clock = data.clock ?? G.clock;
    G.playerX = data.playerX ?? G.playerX;
    G.playerZ = data.playerZ ?? G.playerZ;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
