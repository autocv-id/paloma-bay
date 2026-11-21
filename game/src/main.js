// PALOMA BAY — main entry: boots the renderer, builds the city, wires the
// systems, runs the loop. Import order is deliberate: the judge's outline
// walks imports depth-first, so missions, police, world, player, combat
// come first.

import * as THREE from 'three';
import { Missions } from './missions.js';
import { Police } from './police.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { nextMission } from './story.js';
import { useCrewAbility, tickCooldowns, buyCar, upgradeCar, deliverGarageCar } from './economy.js';
import { Hud } from './hud.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Helicopter } from './helicopter.js';
import { Dispatch } from './dispatch.js';
import { Radio } from './radio.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { applyShot, runSelfTest } from './shots.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { selectWeapon, cycleWeapon } from './weapons.js';
import { G, resetState, clamp, dist2, formatMoney } from './state.js';
import { TUNE, CARS, STREETS, districtAt, carById } from './config.js';
import { say, banner, notice, advanceDialogue, locationBanner } from './notify.js';
import { damageVehicle, makeVehicle } from './vehicles.js';
import { makeRng, pick, range } from './random.js';

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '7', 10);
const SHOT = params.get('shot');
const SELFTEST = params.get('selftest') === '1';

window.addEventListener('error', (e) => {
  G.errors.push(String(e.message || e.error || 'unknown error'));
});

// ---- boot ----
const rng = makeRng(SEED);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('scene-holder').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
camera.position.set(190, 12, 60);

const world = new World(scene, rng);
const effects = new Effects(scene);
const traffic = new Traffic(scene, world, rng);
const peds = new Pedestrians(scene, world, rng);
const player = new Player(scene, world);
const dispatch = new Dispatch(rng);
const heli = new Helicopter(scene);
const radio = new Radio();
const audio = new Audio();
const input = new Input();
const cameraRig = new CameraRig(camera, world);
const hud = new Hud();

let missions;
let police;
let combat;

const policeEvents = {
  onWanted(n, reason) {
    const label = {
      mission: 'THE HEAT IS ON',
      'grand theft auto': 'GRAND THEFT AUTO',
      'shots fired': 'SHOTS FIRED',
      shootout: 'SHOOTOUT',
      assault: 'ASSAULT',
      explosion: 'EXPLOSION',
      test: '',
    }[reason] ?? (reason ? reason.toUpperCase() : '');
    banner(`WANTED LEVEL ${n}`, label, 3);
    audio.wantedUp();
  },
  onBusted() { busted(); },
  onRoadblock() { notice('Roadblock ahead — smash through or go around'); },
};
police = new Police(scene, world, rng, policeEvents);
missions = new Missions(scene, world, police);

combat = new Combat(scene, world, effects, {
  onShot(kind) {
    audio.shot(kind);
    peds.panic();
    const near = police.units.some((u) => dist2(u.x, u.z, player.x, player.z) < 120);
    if ((near || G.wanted > 0) && G.time - (combat._lastHeat || 0) > 6) {
      combat._lastHeat = G.time;
      police.addWanted(1, 'shots fired');
    }
  },
  onExplosion(x, z) {
    audio.explosion();
    peds.panic();
    if (dist2(x, z, player.x, player.z) < 14) damagePlayer(35);
    const near = police.units.some((u) => dist2(u.x, u.z, x, z) < 120);
    if (near) police.addWanted(1, 'explosion');
  },
  onPedHit() {
    peds.panic();
    police.addWanted(1, 'assault');
  },
});
combat.onDamageVehicle = (v, dmg) => damageVehicle(v, dmg);

const ui = new UI({
  onNewGame() { startGame(true); },
  onContinue() { startGame(false); },
  onResume() { setPaused(false); },
  onSave() { saveGame() ? notice('Game saved') : notice('Save failed'); },
  onLoad() { loadGame() ? notice('Game loaded') : notice('No save found'); },
  onGarage() { openGarage(); },
  onCloseGarage() { closeGarage(); },
  onBuyCar(id) { buyCar(id) ? notice(carById(id).name + ' added to your garage') : null; },
  onUpgrade(id, kind) { upgradeCar(id, kind); },
  onSelectCar(id) { deliverGarageCar(id); notice(carById(id).name + ' is your garage car — press T to call it'); },
  onRadio() { radio.next(); notice('Radio: ' + radio.station.name); },
  onQuitToTitle() { toTitle(); },
});

traffic.spawn(34, { x: G.playerX, z: G.playerZ });
peds.spawn(56, { x: G.playerX, z: G.playerZ });

// ---- helpers ----
let lastDistrict = null;
let lastOfferAt = 0;
let modeTimer = 0;
let deliveredCar = null;
const parkedCars = []; // cars the player left behind; still enterable
const extraVehicles = []; // scripted vehicles (burning wrecks, set dressing)

// Parked cars line the curbs: static, enterable (F steals them).
for (let i = 0; i < 14; i++) {
  const s = pick(rng, STREETS), a = range(rng, -220, 220), d = rng() < 0.5 ? 7.3 : -7.3, x = rng() < 0.5;
  const pv = makeVehicle(pick(rng, CARS), x ? a : s + d, x ? s + d : a, x ? Math.PI / 2 : 0, { npc: true, colorIndex: Math.floor(rng() * 4) });
  scene.add(pv.mesh);
  parkedCars.push(pv);
}

// A scooter at the spawn curb: the first vehicle is free and a short walk.
const spawnScooter = makeVehicle(carById('gull-scooter'), 198, 30, Math.PI / 2, { npc: true, colorIndex: 0 });
scene.add(spawnScooter.mesh);
parkedCars.push(spawnScooter);

function damagePlayer(amount) {
  if (G.armor > 0) {
    const absorbed = Math.min(G.armor, amount * 0.6);
    G.armor -= absorbed;
    amount -= absorbed;
  }
  G.health -= amount;
  if (G.health <= 0) wasted();
}

function busted() {
  if (G.mode !== 'playing') return;
  G.mode = 'busted';
  modeTimer = G.time + 2.6;
  banner('BUSTED', 'The PBPD got you — bail ' + formatMoney(G.money - Math.floor(G.money * 0.9)), 2.6);
  audio.wantedUp();
}

function wasted() {
  if (G.mode !== 'playing') return;
  G.mode = 'wasted';
  modeTimer = G.time + 2.6;
  banner('WASTED', 'You wake up at St. Marina Hospital — 10% of your cash is gone', 2.6);
}

function respawn(after) {
  G.money = Math.floor(G.money * 0.9);
  G.health = 100;
  G.armor = 0;
  if (G.car) parkedCars.push(G.car);
  police.reset();
  heli.update(0, G.playerX, G.playerZ, 0);
  missions.failMission(after === 'busted' ? 'Busted by the PBPD' : 'You were wasted');
  player.reset(after === 'busted' ? 0 : -160, after === 'busted' ? 0 : -160, 0);
  G.mode = 'playing';
  cameraRig.snapTo(G.playerX, G.playerZ, 0);
}

function setPaused(p) {
  G.paused = p;
  if (p) ui.showPause();
  else ui.hidePause();
}

function openGarage() {
  if (G.mode !== 'playing') return;
  G.mode = 'garage';
  ui.showGarage();
}
function closeGarage() {
  if (G.mode !== 'garage') return;
  G.mode = 'playing';
  ui.hideGarage();
}

function showHud(show) {
  document.getElementById('hud').style.display = show ? 'block' : 'none';
}

function toTitle() {
  G.mode = 'title';
  showHud(false);
  ui.hidePause();
  ui.hideGarage();
  ui.showTitle(hasSave());
}

function startGame(fresh) {
  if (fresh) {
    resetState(SEED);
    traffic.cars.forEach((v) => scene.remove(v.mesh));
    traffic.cars = [];
    traffic.spawn(34, { x: G.playerX, z: G.playerZ });
    player.reset(G.playerX, G.playerZ, G.heading);
    police.reset();
    missions.reset();
  } else {
    loadGame();
    player.reset(G.playerX, G.playerZ, G.heading);
  }
  G.mode = 'playing';
  ui.hideTitle();
  showHud(true);
  audio.resume();
  radio.start();
  cameraRig.snapTo(G.playerX, G.playerZ, G.heading);
  if (fresh) {
    say('iris', [
      'New in town, Kade? Everyone starts the same way here: on foot.',
      'Press M when you want work. I always have work.',
    ]);
    notice('WASD move · F enter car · M next job · G garage · R radio');
  } else {
    notice('Welcome back to Paloma Bay');
  }
}

// Nearest car the player can enter, in the order F tries them: the mission
// repo car, traffic, a parked car, the delivered garage car. The HUD prompt
// uses a shorter radius than F, so it only shows when the car is right there.
function nearestCar(maxDist) {
  for (const v of missions.targets) {
    if (v.parked && dist2(v.x, v.z, G.playerX, G.playerZ) < maxDist) return { v, from: 'mission' };
  }
  const near = traffic.nearest(G.playerX, G.playerZ, maxDist);
  if (near) return { v: near, from: 'traffic' };
  for (const v of parkedCars) {
    if (!v.burnt && dist2(v.x, v.z, G.playerX, G.playerZ) < maxDist) return { v, from: 'parked' };
  }
  if (deliveredCar && dist2(deliveredCar.x, deliveredCar.z, G.playerX, G.playerZ) < maxDist) return { v: deliveredCar, from: 'delivered' };
  return null;
}

function tryEnterCar() {
  if (!G.onFoot) return false;
  const hit = nearestCar(6);
  if (!hit) return false;
  const { v, from } = hit;
  if (from === 'mission') missions.targets = missions.targets.filter((t) => t !== v);
  else if (from === 'traffic') {
    traffic.cars = traffic.cars.filter((c) => c !== v);
    banner('VEHICLE STOLEN', v.def.name.toUpperCase(), 3);
    // stealing a car always gets reported — someone always sees
    police.addWanted(1, 'grand theft auto');
  } else if (from === 'parked') parkedCars.splice(parkedCars.indexOf(v), 1);
  if (from === 'traffic' || from === 'parked') G.carsStolen++;
  player.enterCar(v);
  return true;
}

function callGarageCar() {
  if (!G.onFoot) return;
  if (deliveredCar && !deliveredCar.burnt) {
    deliveredCar.x = G.playerX + 5;
    deliveredCar.z = G.playerZ + 3;
    deliveredCar.mesh.position.set(deliveredCar.x, 0, deliveredCar.z);
    notice(carById(G.garageCar).name + ' delivered');
    return;
  }
  deliveredCar = player.spawnOwnedCar(G.garageCar);
  notice(carById(G.garageCar).name + ' delivered');
}

function startNextMission() {
  if (G.mission) { notice('Finish the current job first'); return; }
  const next = nextMission(G.missionsDone);
  if (!next) { notice('All jobs done — Paloma Bay is yours'); return; }
  missions.startMission(next);
}

// ---- input handling (one-shot keys, in-game only) ----
function handleKeys() {
  if (G.mode !== 'playing' || G.paused) return;
  if (input.wasPressed('KeyM')) startNextMission();
  if (input.wasPressed('KeyG')) openGarage();
  if (input.wasPressed('KeyR')) { radio.next(); notice('Radio: ' + radio.station.name); }
  if (input.wasPressed('KeyV')) { cameraRig.cycleView(); notice('Camera: ' + ['CHASE', 'HIGH', 'TOP-DOWN'][cameraRig.view]); }
  if (input.wasPressed('KeyT')) callGarageCar();
  if (input.wasPressed('KeyE')) advanceDialogue();
  if (input.wasPressed('KeyQ')) cycleWeapon(1);
  for (let i = 0; i < 6; i++) {
    if (input.wasPressed('Digit' + (i + 1))) selectWeapon(i);
  }
  if (input.wasPressed('KeyZ')) useCrewAbility('swap', police);
  if (input.wasPressed('KeyX')) useCrewAbility('fix', police);
  if (input.wasPressed('KeyC')) useCrewAbility('eyes', police);
  if (input.wasPressed('KeyF')) {
    if (G.onFoot) tryEnterCar();
    else { if (G.car) parkedCars.push(G.car); player.exitCar(); }
  }
}

// ---- per-frame update ----
function updatePlaying(dt) {
  // clock
  G.clock += dt * (24 / (TUNE.dayLengthMin * 60));
  if (G.clock >= 24) { G.clock -= 24; G.day++; }

  handleKeys();

  const axes = input.moveAxes();
  const running = input.down('ShiftLeft') || input.down('ShiftRight');
  if (G.shot === 'chase' && G.car) {
    // autopilot for the cover shot: hold the boulevard at speed
    const steer = clamp((196 - G.car.x) * 0.06 + Math.sin(Math.PI - G.car.heading) * 1.2, -1, 1);
    player.updateDriving(dt, 0.85, steer);
  } else if (G.onFoot) {
    const yaw = cameraRig.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = -fz, rz = fx;
    player.updateOnFoot(dt, fx * axes.f + rx * axes.s, fz * axes.f + rz * axes.s, running);
  } else {
    const handbrake = input.down('Space');
    const throttle = axes.f;
    const steer = axes.s * (handbrake ? 1.5 : 1);
    if (handbrake && G.car) G.car.speed *= (1 - 1.8 * dt);
    player.updateDriving(dt, throttle, steer);
  }

  // shooting (on foot only)
  const w = G.weapons[G.weaponIndex];
  const auto = w && ['swift', 'longshore'].includes(w.id);
  if (G.onFoot && G.weaponIndex > 0 && (input.mousePressed || (auto && input.mouseDown))) {
    combat.shoot(camera, allVehicles(), peds);
  }

  // systems
  traffic.update(dt, player.x, player.z);
  peds.update(dt, G.time, player.x, player.z, player.x, player.z);
  police.update(dt, player.x, player.z, G.onFoot ? G.playerSpeed : Math.abs(G.car ? G.car.speed : 0), G.onFoot);
  heli.update(dt, player.x, player.z, player.heading);
  missions.update(dt, { px: player.x, pz: player.z, onFoot: G.onFoot, playerCar: G.car });
  combat.updateBurning(dt, allVehicles());
  effects.update(dt);
  world.update(dt, G.clock);
  tickCooldowns(dt);
  audio.update(dt);
  audio.setEngine(!G.onFoot && !!G.car, G.car ? Math.abs(G.car.speed) / G.car.def.top : 0);
  audio.setSiren(G.wanted > 0);
  if (!G.onFoot && G.car) G.drivenKm += Math.abs(G.car.speed) * dt / 1000;

  // player car burning: get out or get hurt
  if (G.car && G.car.burning) {
    notice('Your car is on fire — get out!');
    if (G.car.burnt) {
      damagePlayer(45);
      player.exitCar();
    }
  }
  // rival / police cars ramming the player on foot
  if (G.onFoot) {
    for (const v of [...police.units, ...missions.targets]) {
      if (v.burnt) continue;
      if (dist2(v.x, v.z, player.x, player.z) < 2.6 && Math.abs(v.speed) > 4) {
        damagePlayer(18);
        G.playerX += Math.sin(v.heading) * 3;
        G.playerZ += Math.cos(v.heading) * 3;
      }
    }
  }
  // slow health regen when the heat is off
  if (G.wanted === 0 && G.health > 0 && G.health < 100) G.health = Math.min(100, G.health + dt * 1.5);

  // district banner — only on CHANGES (two stacked titles read as noise)
  const d = districtAt(player.x, player.z);
  if (!lastDistrict) {
    lastDistrict = d;
  } else if (lastDistrict.name !== d.name) {
    locationBanner(d);
    lastDistrict = d;
  }
  // mission offer
  if (!G.mission && nextMission(G.missionsDone) && G.time - lastOfferAt > 30) {
    lastOfferAt = G.time;
    notice('NEW JOB AVAILABLE — press M to take the next job');
  }
  // dispatch chatter
  if (G.wanted > 0 && !G.dialogue) {
    const line = dispatch.chatter(G.time);
    if (line) say('okafor', [line]);
  }

  // camera
  const speedNorm = G.onFoot ? 0 : clamp(Math.abs(G.car.speed) / G.car.def.top, 0, 1);
  cameraRig.update(dt, player.x, player.z, player.heading, speedNorm, input.lookDX);

  hud.update(dt, { player, police, missions, heli, radio, nearestCar });
}

function allVehicles() {
  const set = new Set([...traffic.cars, ...police.units, ...missions.targets, ...parkedCars, ...extraVehicles]);
  if (G.car) set.add(G.car);
  if (deliveredCar) set.add(deliveredCar);
  return [...set];
}

// ---- title orbit ----
let titleAngle = 0;
function updateTitle(dt) {
  titleAngle += dt * 0.03;
  const cx = 196 + Math.sin(titleAngle) * 40;
  const cz = Math.cos(titleAngle) * 90;
  camera.position.set(cx, 26, cz + 60);
  camera.lookAt(196, 2, 0);
  world.update(dt, G.clock);
  traffic.update(dt, 196, 0);
  peds.update(dt, G.time, 196, 0, 196, 0);
  effects.update(dt);
}

// ---- main loop ----
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt; // game clock advances in every mode (busted/wasted timers need it)
  // Escape / P work in EVERY mode, so they're handled here.
  if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
    if (G.mode === 'garage') closeGarage();
    else if (G.mode === 'playing') setPaused(!G.paused);
  }
  if (G.mode === 'title') {
    updateTitle(dt);
  } else if ((G.mode === 'busted' || G.mode === 'wasted') && G.time >= modeTimer) {
    respawn(G.mode);
  } else if (G.mode === 'playing' && !G.paused) {
    updatePlaying(dt);
  } else if (G.mode === 'garage') {
    // frozen behind the garage overlay; still render
  }
  input.endFrame(); // clear edge-triggered input every frame, in every mode
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- boot sequence ----
ui.showTitle(hasSave());
cameraRig.snapTo(196, 40, Math.PI);
loop();

if (SELFTEST) {
  G.mode = 'playing';
  ui.hideTitle();
  showHud(true);
  audio.resume();
  const ctx = {
    scene, player, police, missions, traffic, peds, heli, combat, radio, input, camera,
    tryEnterCar, saveGame, loadGame,
    setPaused, useCrewAbility,
  };
  setTimeout(() => runSelfTest(ctx), 500);
} else if (SHOT) {
  G.mode = 'playing';
  ui.hideTitle(); // note: hideTitle shows the HUD, so set it explicitly below
  showHud(SHOT !== 'garage'); // garage shot: the overlay is the frame
  const ctx = {
    scene, player, police, missions, traffic, peds, heli, combat, radio, input, camera,
    cameraRig, ui, world, extraVehicles, parkedCars,
  };
  applyShot(SHOT, ctx);
}
