// Shared game state: one object every system reads and writes. The state is
// plain data so save/load can snapshot it, and the screenshot scenarios can
// set it up deterministically.

import { TUNE, WEAPONS } from './config.js';

export function freshState() {
  return {
    seed: 7,
    time: 0, // seconds since boot
    day: 1,
    clock: TUNE.startHour, // hours, 0..24
    mode: 'title', // title | playing | paused | garage | busted | wasted
    paused: false,

    // progression
    money: TUNE.startMoney,
    rp: TUNE.startRp,
    missionsDone: [], // mission ids completed
    mission: null, // active mission runtime (see missions.js)
    missionIndex: 0, // next story mission to offer

    // player
    health: 100,
    armor: 0,
    onFoot: true,
    car: null, // vehicle object when driving
    playerX: 190, playerZ: 40, heading: Math.PI, // on the boulevard
    playerSpeed: 0,
    moving: false,

    // wanted / police
    wanted: 0,
    evadeTimer: 0,
    unseenTimer: 0,
    bustTimer: 0,
    eyesOutUntil: 0,

    // weapons
    weapons: WEAPONS.map((w) => ({ id: w.id, ammo: w.mag === Infinity ? Infinity : w.mag })),
    weaponIndex: 1, // P9 by default
    lastShotAt: 0,

    // crew ability cooldowns (seconds remaining)
    crewCd: { swap: 0, fix: 0, eyes: 0 },

    // garage / economy
    ownedCars: ['sloop-sedan'],
    garageCar: 'sloop-sedan',
    upgrades: {}, // carId -> { engine: n, armor: n }

    // radio
    radioStation: 0,
    radioMuted: false,

    // ui
    dialogue: null, // { npc, text, queue }
    banner: null, // { text, sub, until }
    location: null, // current district (for the banner)
    locationUntil: 0,
    notice: null, // small toast { text, until }

    // debug / screenshots
    shot: null, // ?shot= scenario name
    selftest: false,
    errors: [], // console errors captured during selftest
  };
}

export const G = freshState();

export function resetState(seed = 7) {
  const fresh = freshState();
  fresh.seed = seed;
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, fresh);
}

// ---- small helpers shared by systems ----
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function formatMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
export function formatClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
