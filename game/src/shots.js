// Screenshot scenarios and the self-test harness. Scenarios set up REAL game
// states through the real systems (missions, wanted, police, dialogue) —
// nothing is staged with fake DOM.

import * as THREE from 'three';
import { G } from './state.js';
import { carById, CARS } from './config.js';
import { MISSIONS } from './story.js';
import { makeVehicle } from './vehicles.js';
import { say } from './notify.js';

export function applyShot(name, ctx) {
  const { player, police, missions, traffic, cameraRig, ui } = ctx;
  G.shot = name;
  if (name === 'chase') {
    // COVER: FRONT three-quarter view — camera ahead of the hero car,
    // police pursuit visible BEHIND it.
    G.clock = 12.5; G.day = 9;
    G.money = 18450; G.rp = 3900; G.health = 72; G.armor = 55;
    G.missionsDone = MISSIONS.slice(0, 9).map((m) => m.id);
    const def = MISSIONS[9];
    missions.startMission(def);
    G.mission.stage = 2;
    missions.startStage(); // loseCops at 5 stars
    // player car: gold Marlin SS on the boulevard, already moving fast
    const car = makeVehicle(carById('marlin-ss'), 196, 80, Math.PI, { colorIndex: 2 });
    car.speed = 30;
    car.condition = 62;
    ctx.scene.add(car.mesh);
    player.enterCar(car);
    // Six police BEHIND the player (south): the pursuit closing in.
    // The nearest (12 m) earns RAM or PIT; the rest keep staged tactics.
    police.spawnTimer = 999; // the six staged units are the whole pursuit
    const formation = [
      [192, 91], [206, 98], [192, 112], [200, 128], [196, 148], [190, 168],
    ];
    const tactics = [null, 'FLANK', 'PURSUE', 'INTERCEPT', 'FLANK', 'PURSUE'];
    for (let i = 0; i < 6; i++) {
      const u = police.spawnUnit(196, 80 + 30 + i * 14);
      u.x = formation[i][0];
      u.z = formation[i][1];
      u.heading = Math.PI;
      u.speed = 26;
      if (tactics[i]) u.tactic = tactics[i];
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = Math.PI;
    }
    say('iris', ["Five stars, Kade. The whole city is watching — do not get caught."]);
    // Civilian traffic on the road behind the player (in frame, south).
    for (const [cx, cz, ci] of [[192, 110, 0], [201, 130, 1], [193, 150, 2], [200, 170, 3], [194, 190, 4], [203, 210, 5]]) {
      const cv = makeVehicle(CARS[ci % CARS.length], cx, cz, Math.PI, { npc: true, colorIndex: ci % 4 });
      cv.target = { x: cx, z: -224 }; // north, toward and past the camera
      cv.speed = 5;
      ctx.scene.add(cv.mesh);
      traffic.cars.push(cv);
    }
    // Walkers on the beach-side sidewalk, in frame (south of the car).
    ctx.peds.spawnAt(207, 100, Math.PI, { x: 207, z: -40 });
    ctx.peds.spawnAt(207, 130, Math.PI, { x: 207, z: -70 });
    // A parked scooter on the sidewalk: the second vehicle type.
    const scooter = makeVehicle(carById('gull-scooter'), 208, 95, Math.PI / 2, { npc: true, colorIndex: 0 });
    ctx.scene.add(scooter.mesh);
    ctx.extraVehicles.push(scooter);
    // Heli BEHIND the player (negative lead): body + cone in the upper frame.
    ctx.heli.orbitRadius = 6;
    ctx.heli.orbitLead = -22;
    cameraRig.yawOffset = Math.PI + 0.6;
    cameraRig.snapTo(196, 80, Math.PI);
  } else if (name === 'foot') {
    // CROWDED BEACH: Kade on the sand facing NORTH — 51 walkers +
    // umbrellas + towels show a living beach, not an empty postcard.
    G.clock = 12.0; G.day = 3;
    G.money = 6420; G.rp = 1400; G.health = 100; G.armor = 0;
    missions.startMission(MISSIONS[0]);
    player.reset(285, 0, Math.PI);
    // A parked scooter beside Kade: the enter prompt reads in the frame.
    const beachScooter = makeVehicle(carById('gull-scooter'), 287, -2, Math.PI / 2, { npc: true, colorIndex: 1 });
    ctx.scene.add(beachScooter.mesh);
    ctx.parkedCars.push(beachScooter);
    // 51 walkers in clusters of 2-3 around the camera axis — near rows
    // narrow (the frame is only ~19 m wide 10 m out), far rows wider.
    // A third 1 = strolls SOUTH toward the camera. 0.4 m/s holds the
    // formation through the 75 s shutter (never 150 s: staged peds vanish).
    const crowd = [[277,-4],[280,-4],[290,-4],[293,-4],[274,-9],[277,-9],[286,-9],[289,-9],[296,-9],[268,-15],[271,-15],[280,-15,1],[283,-15],[292,-15,1],[295,-15],[300,-15],[264,-22],[267,-22],[277,-22,1],[280,-22],[289,-22],[292,-22,1],[301,-22],[304,-22],[260,-30],[263,-30],[273,-30],[276,-30,1],[286,-30],[289,-30,1],[299,-30],[302,-30],[310,-30],[258,-40],[261,-40],[272,-40],[275,-40],[286,-40],[289,-40],[300,-40],[303,-40],[313,-40],[260,-52],[274,-52],[288,-52],[302,-52],[314,-52],[264,-66],[282,-66],[300,-66],[316,-66]];
    for (const [px, pz, sb] of crowd) {
      const p = ctx.peds.spawnAt(px, pz, sb ? 0 : Math.PI, { x: px, z: pz + (sb ? 130 : -130) }, true);
      p.speed = 0.4;
    }
    // Umbrella cluster + towels, staged dense in the near/mid-ground.
    const cols = [0xff6a6a, 0x4dc8ff, 0xffd24d, 0x7ae08a, 0xff8ad8];
    const poleG = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 5);
    const canG = new THREE.ConeGeometry(2.4, 1.1, 8);
    const poleM = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const [ux, uz, ci] of [[270,-10,0],[296,-10,1],[262,-20,2],[288,-20,3],[312,-20,4],[266,-34,0],[294,-34,1],[318,-34,2],[258,-52,3],[282,-52,4],[306,-52,0],[272,-72,1],[274,-8,2],[294,-8,0],[266,-16,4],[304,-16,1],[260,-28,3],[310,-28,2],[276,-44,0],[300,-44,3]]) {
      const pole = new THREE.Mesh(poleG, poleM);
      pole.position.set(ux, 1.3, uz);
      const can = new THREE.Mesh(canG, new THREE.MeshLambertMaterial({ color: cols[ci] }));
      can.position.set(ux, 2.9, uz);
      can.castShadow = true;
      ctx.scene.add(pole, can);
    }
    const towelG = new THREE.BoxGeometry(2.0, 0.06, 1.0);
    for (const [tx, tz, ci] of [[266,-12,1],[304,-10,2],[280,-22,0],[312,-22,3],[272,-48,4],[296,-48,1],[264,-66,2],[288,-66,0],[280,-6,2],[292,-6,0],[274,-18,3],[298,-18,1],[284,-32,4],[306,-32,2]]) {
      const tw = new THREE.Mesh(towelG, new THREE.MeshLambertMaterial({ color: cols[ci] }));
      tw.position.set(tx, 0.08, tz);
      tw.rotation.y = ci * 0.5;
      ctx.scene.add(tw);
    }
    // Patrol heli (staged, not wanted-driven): orbits 80 m ahead.
    ctx.heli.staged = true;
    ctx.heli.orbitRadius = 25;
    ctx.heli.orbitLead = 80;
    say('iris', ['New in town, Kade? Everyone starts the same way here: on foot.']);
    cameraRig.snapTo(285, 0, Math.PI);
  } else if (name === 'garage') {
    // Garage screen open: money, rank, owned cars and upgrades visible.
    G.clock = 17.4; G.day = 12;
    G.money = 25430; G.rp = 4200;
    G.missionsDone = MISSIONS.slice(0, 4).map((m) => m.id);
    G.ownedCars = ['sloop-sedan', 'tern-coupe', 'paloma-gt', 'marlin-ss'];
    G.upgrades = {
      'paloma-gt': { engine: 2, armor: 1 },
      'marlin-ss': { engine: 1, armor: 0 },
      'tern-coupe': { engine: 0, armor: 2 },
    };
    G.garageCar = 'paloma-gt';
    player.reset(140, -120, Math.PI / 2);
    ui.showGarage();
    G.mode = 'garage';
    cameraRig.snapTo(140, -120, Math.PI / 2);
  } else if (name === 'night') {
    // Night shootout on the BOULEVARD, facing north: CORAL CLUB + PIER 9
    // neon right, 5 stars, helicopter, burning car, SMG.
    G.clock = 21.6; G.day = 5;
    G.money = 12400; G.rp = 2600; G.health = 84; G.armor = 40;
    G.weaponIndex = 2;
    missions.startMission(MISSIONS[7]);
    G.mission.stage = 1;
    missions.startStage(); // destroy 2 rival cars
    // 20 m south of the CORAL CLUB billboard (209, -20): it fills the
    // right of the frame instead of a faint glow in the distance.
    player.reset(198, 0, Math.PI);
    police.setWanted(5, 'shootout');
    // Hold the auto-spawner for the shot: at 5 stars it would add a far
    // unit the panel would count but the frame would not show.
    police.spawnTimer = 999;
    // Three pursuit units staged ahead, facing the player (south) — all
    // within ~70 m, all visible up the boulevard. The nearest closes to
    // ~10 m and earns RAM or PIT; the other two keep FLANK / INTERCEPT.
    for (const [ux, uz, tac] of [[190, -30, null], [202, -50, 'FLANK'], [196, -70, 'INTERCEPT']]) {
      const u = police.spawnUnit(198, 0);
      u.x = ux; u.z = uz;
      u.heading = 0; // south, toward the player
      u.speed = 20;
      if (tac) u.tactic = tac;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = 0;
    }
    // Drop the 4+ star on-foot camera lift: it pushed the player down
    // behind the dialogue box.
    cameraRig.lookYLift = 0;
    // Heli on the WEST side of the boulevard (negative orbit radius):
    // the palm row at x=206 hides any heli east of it, and the white
    // body reads in clear sky, left of centre, below the WANTED banner.
    // SHUTTER: 15 s — the heli needs ~0.6 game-seconds to cross.
    ctx.heli.orbitRadius = -8;
    ctx.heli.orbitLead = 65;
    // a burning wreck ahead-LEFT (kept clear of the billboard sightline)
    const wreck = makeVehicle(carById('harbor-cruiser'), 191, -15, 0.6, { colorIndex: 0 });
    wreck.condition = 0;
    wreck.burning = true;
    wreck.burnTimer = -30; // keep it burning (with smoke) through the screenshot
    ctx.scene.add(wreck.mesh);
    ctx.extraVehicles.push(wreck);
    // Civilian cars on the boulevard ahead, headlights toward camera.
    for (const [cx, cz, ci] of [[192, -25, 0], [200, -45, 1], [193, -65, 2]]) {
      const cv = makeVehicle(CARS[ci % CARS.length], cx, cz, 0, { npc: true, colorIndex: ci % 4 });
      cv.target = { x: cx, z: 224 }; // south, toward the player
      cv.speed = 5;
      ctx.scene.add(cv.mesh);
      traffic.cars.push(cv);
    }
    // Two pedestrians fleeing south past the camera.
    ctx.peds.spawnAt(204, -20, 0, { x: 204, z: 100 });
    ctx.peds.spawnAt(188, -30, 0, { x: 188, z: 90 });
    say('nadia', ['Two cars down and counting — keep moving, the heli has the light!']);
    cameraRig.snapTo(198, 0, Math.PI);
  }
}

// ---- self-test ----
function waitFrames(n) {
  return new Promise((resolve) => {
    let i = 0;
    const step = () => { if (++i >= n) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
export async function runSelfTest(ctx) {
  const el = document.getElementById('selftest-results');
  const lines = [];
  const log = (ok, name, detail) => {
    lines.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    el.textContent = lines.join('\n');
  };
  const { player, police, missions, traffic, combat, radio, input, camera } = ctx;
  let passed = 0, total = 0;
  const check = (ok, name, detail) => { total++; if (ok) passed++; log(ok, name, detail); };

  try {
    await waitFrames(10);
    check(ctx.scene.children.length > 50, 'boot: scene built', `${ctx.scene.children.length} objects`);
    check(G.errors.length === 0, 'boot: no console errors', G.errors.slice(0, 2).join(' | '));

    // 1. walk
    const x0 = G.playerX, z0 = G.playerZ;
    input.fakePress('KeyW');
    await waitFrames(45);
    input.fakeRelease('KeyW');
    await waitFrames(5);
    check(Math.hypot(G.playerX - x0, G.playerZ - z0) > 2, 'walk: player moves with W',
      `${Math.hypot(G.playerX - x0, G.playerZ - z0).toFixed(1)}m`);

    // 2. enter a car
    const near = traffic.nearest(G.playerX, G.playerZ, 400);
    check(!!near, 'setup: traffic car exists');
    if (near) {
      player.reset(near.x + 3, near.z, 0);
      // Enter immediately: the reset puts the player 3 m away, but a traffic
      // car at cruise speed leaves the 6 m radius in 5 frames at headless fps.
      ctx.tryEnterCar();
      await waitFrames(5);
      check(!G.onFoot && G.car === near, 'enter car: F steals the nearest car');
      // Guard the driving checks on actually being in the car, so a failed
      // enter fails as lines instead of throwing and aborting the suite.
      if (!G.onFoot && G.car) {
      // 3. drive
      const s0 = G.car.speed;
      input.fakePress('KeyW');
      await waitFrames(40);
      input.fakeRelease('KeyW');
      check(G.car.speed > 5, 'drive: car accelerates', `${(G.car.speed * 3.6).toFixed(0)} km/h`);
      // 4. carjack wanted
      check(G.wanted >= 1, 'carjack: wanted rises', `${G.wanted} stars`);
      // 5. police spawn
      await waitFrames(120);
      check(police.units.length > 0, 'police: units spawn on wanted', `${police.units.length} units`);
      // 6. exit car
      player.exitCar();
      await waitFrames(5);
      check(G.onFoot && !G.car, 'exit car: F leaves the car');
      }
    }

    // 7. helicopter at 4 stars — teleport far from the existing police pack
    // first, or the player gets busted on foot before the heli check runs
    player.reset(-200, -200, 0);
    await waitFrames(5);
    police.setWanted(4, 'test');
    await waitFrames(15); // the heli activates on the first frame at 4 stars
    check(ctx.heli.active, 'heli: arrives at 4 stars');

    // 8. mission start + stage advance
    police.setWanted(0, 'test reset');
    police.reset();
    const started = missions.startMission(MISSIONS[0]);
    check(started && G.mission, 'mission: job 1 starts');
    if (G.mission) {
      player.reset(140, -140, 0);
      await waitFrames(30);
      check(G.mission && G.mission.stage === 1, 'mission: stage advances on reaching the marker',
        `stage ${G.mission ? G.mission.stage + 1 : '-'}`);
      missions.failMission('test cleanup');
    }

    // 9. shooting damages a car
    const target = traffic.nearest(G.playerX, G.playerZ, 400);
    if (target) {
      const c0 = target.condition;
      player.reset(target.x + 6, target.z + 6, Math.atan2(target.x - (target.x + 6), target.z - (target.z + 6)));
      G.weaponIndex = 1;
      await waitFrames(10);
      // aim the camera at the target and refresh its matrices: the raycast
      // reads matrixWorld, which the render loop would only update next frame
      camera.lookAt(target.x, 1, target.z);
      camera.updateMatrixWorld(true);
      combat.shoot(camera, [target], ctx.peds);
      await waitFrames(10);
      check(target.condition < c0, 'shoot: P9 damages a car', `${c0.toFixed(0)} -> ${target.condition.toFixed(0)}`);
    }

    // 10. save / load round-trip
    G.money = 4242;
    const saved = ctx.saveGame();
    G.money = 1;
    ctx.loadGame();
    check(saved && G.money === 4242, 'save/load: money round-trips');

    // 11. radio
    const st0 = G.radioStation;
    radio.next();
    check(G.radioStation !== st0, 'radio: station switches', RADIO_NAME());
    function RADIO_NAME() { return radio.station.name; }

    // 12. crew ability
    police.setWanted(3, 'test');
    await waitFrames(10);
    const w0 = G.wanted;
    ctx.useCrewAbility('swap', police);
    check(G.wanted === Math.max(0, w0 - 2), 'crew: Swap Plates drops 2 stars', `${w0} -> ${G.wanted}`);

    // 13. pause
    ctx.setPaused(true);
    await waitFrames(5);
    const pausedOk = G.paused === true;
    ctx.setPaused(false);
    check(pausedOk, 'pause: toggles');

    check(G.errors.length === 0, 'final: no console errors', G.errors.slice(0, 2).join(' | '));
  } catch (e) {
    total++;
    log(false, 'exception', String(e && e.message || e));
  }
  const summary = `SELFTEST: ${passed}/${total} PASS`;
  lines.push(summary);
  el.textContent = lines.join('\n');
  document.title = summary;
  return { passed, total };
}
