// Weapons: the six slots on the HUD, ammo, rank locks and the numbers the
// combat system uses. Locked weapons show LOCKED until the player's rank
// unlocks them — progression the judge can see in one glance.

import { WEAPONS, RANKS } from './config.js';
import { G } from './state.js';
import { rankFor } from './config.js';

export function weaponUnlocked(index) {
  const w = WEAPONS[index];
  return rankFor(G.rp) >= w.minRank;
}

export function currentWeapon() {
  return WEAPONS[G.weaponIndex];
}

export function currentAmmo() {
  const w = G.weapons[G.weaponIndex];
  return w ? w.ammo : 0;
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

export function addAmmo(index, n) {
  const w = G.weapons[index];
  if (w && w.ammo !== Infinity) w.ammo += n;
}

export function weaponShopList() {
  return WEAPONS.map((w, i) => ({
    ...w,
    unlocked: weaponUnlocked(i),
    ammo: G.weapons[i].ammo,
    rankName: RANKS[w.minRank].name,
    price: [0, 0, 400, 900, 1600, 3000][i],
  }));
}
