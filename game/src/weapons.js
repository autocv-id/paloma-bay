// Weapons: the six slots on the HUD, ammo, rank locks and the numbers the
// combat system uses. Locked weapons show their required rank.

import { WEAPONS, rankFor } from './config.js';
import { G } from './state.js';

function weaponUnlocked(index) {
  const w = WEAPONS[index];
  return rankFor(G.rp) >= w.minRank;
}

export function currentWeapon() {
  return WEAPONS[G.weaponIndex];
}

export function selectWeapon(index) {
  if (index < 0 || index >= WEAPONS.length) return false;
  if (!weaponUnlocked(index)) return false;
  G.weaponIndex = index;
  return true;
}

export function cycleWeapon(dir) {
  for (let i = 0; i < WEAPONS.length; i++) {
    const next = (G.weaponIndex + dir + WEAPONS.length) % WEAPONS.length;
    if (selectWeapon(next)) return true;
    G.weaponIndex = next;
  }
  return false;
}

export function spendAmmo(index, n = 1) {
  const w = G.weapons[index];
  if (!w || w.ammo === Infinity) return true;
  if (w.ammo <= 0) return false;
  w.ammo = Math.max(0, w.ammo - n);
  return true;
}
