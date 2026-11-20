// Economy: money, respect, ranks, crew abilities and the garage.

import { RANKS, CREW, CARS, carById, rankFor } from './config.js';
import { G } from './state.js';
import { repairVehicle } from './vehicles.js';
import { notice, banner } from './notify.js';

export function rankProgress() {
  const r = rankFor(G.rp);
  const cur = RANKS[r].rp;
  const next = RANKS[r + 1] ? RANKS[r + 1].rp : cur + 1;
  return { rank: r, name: RANKS[r].name, into: G.rp - cur, need: next - cur };
}

export function useCrewAbility(id, police) {
  const ability = CREW.find((c) => c.id === id);
  if (!ability) return false;
  if ((G.crewCd[id] || 0) > 0) {
    notice(`${ability.name} recharging — ${Math.ceil(G.crewCd[id])}s`);
    return false;
  }
  G.crewCd[id] = ability.cd;
  if (id === 'swap') {
    police.setWanted(Math.max(0, G.wanted - 2), 'plates swapped');
    banner('PLATES SWAPPED', 'Wanted level down 2 stars', 3);
  } else if (id === 'fix') {
    if (G.car) {
      repairVehicle(G.car);
      banner('QUICK FIX', 'Car repaired to 100%', 3);
    } else {
      notice('Quick Fix needs a car');
      G.crewCd[id] = 5;
      return false;
    }
  } else if (id === 'eyes') {
    G.eyesOutUntil = G.time + 25;
    banner('EYES OUT', 'Police positions revealed for 25s', 3);
  }
  return true;
}

export function tickCooldowns(dt) {
  for (const k of Object.keys(G.crewCd)) {
    G.crewCd[k] = Math.max(0, G.crewCd[k] - dt);
  }
}

// ---- garage ----
export function garageCars() {
  return CARS.map((c) => ({
    ...c,
    owned: G.ownedCars.includes(c.id),
    upgrades: G.upgrades[c.id] || { engine: 0, armor: 0 },
  }));
}

export function buyCar(carId) {
  const def = carById(carId);
  if (G.ownedCars.includes(carId)) return false;
  if (G.money < def.price) { notice('Not enough cash'); return false; }
  G.money -= def.price;
  G.ownedCars.push(carId);
  G.upgrades[carId] = { engine: 0, armor: 0 };
  return true;
}

export function upgradeCar(carId, kind) {
  const up = G.upgrades[carId] || { engine: 0, armor: 0 };
  const level = up[kind] || 0;
  if (level >= 3) { notice('Already maxed'); return false; }
  const price = 1500 * (level + 1);
  if (G.money < price) { notice('Not enough cash'); return false; }
  G.money -= price;
  up[kind] = level + 1;
  G.upgrades[carId] = up;
  return true;
}

export function deliverGarageCar(carId) {
  G.garageCar = carId;
  return true;
}
