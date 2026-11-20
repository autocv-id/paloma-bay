// Screenshot scenarios and the self-test harness. Scenarios set up REAL game
// states through the real systems (missions, wanted, police, dialogue) —
// nothing is staged with fake DOM. The starter kit's own shots.json used the
// same ?shot= query convention. The self-test drives the game programmatically
// and reports pass/fail into the DOM for headless verification.

import { G } from './state.js';
import { carById, TUNE } from './config.js';
import { MISSIONS } from './story.js';
import { makeVehicle } from './vehicles.js';
import { say, banner } from './notify.js';

export function applyShot(name, ctx) {
  const { player, police, missions, traffic, cameraRig, ui } = ctx;
  G.shot = name;
  if (name === 'chase') {
    // COVER: golden-hour chase, JOB 10 stage 3/4, 5 stars, helicopter, full HUD.
    G.clock = 17.4; G.day = 9;
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
    // police pack AHEAD of the player (the camera looks forward down the
    // boulevard, so units behind the player would never be in the frame),
    // spread so the chase still reads as a formation, not a pile-up
    const formation = [
      [186, 55], [206, 60], [192, 35], [200, 20], [196, -5],
    ];
    for (let i = 0; i < 5; i++) {
      const u = police.spawnUnit(196, 80 + 30 + i * 14);
      u.x = formation[i][0];
      u.z = formation[i][1];
      u.heading = Math.PI;
      u.speed = 26;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = Math.PI;
    }
    say('iris', ["Five stars, Kade. The whole city is watching — do not get caught."]);
    cameraRig.snapTo(196, 80, Math.PI);
  } else if (name === 'foot') {
    // On foot downtown, morning, job 1 offered, pedestrians + traffic around.
    G.clock = 10.2; G.day = 3;
    G.money = 6420; G.rp = 1400; G.health = 100; G.armor = 0;
    missions.startMission(MISSIONS[0]);
    player.reset(8, 64, Math.PI * 0.75);
    say('iris', ['New in town, Kade? Everyone starts the same way here: on foot.']);
    cameraRig.snapTo(8, 64, Math.PI * 0.75);
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
    // Night shootout in the Foundry: 5 stars, helicopter, burning car, SMG.
    // Staged on the x=-168 street looking north to the z=168 intersection,
    // so the wreck and the rival cars sit in the open road, not behind a wall.
    G.clock = 21.6; G.day = 5;
    G.money = 12400; G.rp = 2600; G.health = 84; G.armor = 40;
    G.weaponIndex = 2;
    missions.startMission(MISSIONS[7]);
    G.mission.stage = 1;
    missions.startStage(); // destroy 2 rival cars (spawn near -160, 160)
    player.reset(-168, 190, Math.PI);
    police.setWanted(5, 'shootout');
    // a burning wreck just ahead-right of the player for light and drama
    const wreck = makeVehicle(carById('harbor-cruiser'), -163, 176, 0.6, { colorIndex: 0 });
    wreck.condition = 0;
    wreck.burning = true;
    wreck.burnTimer = -30; // keep it burning (with smoke) through the screenshot
    ctx.scene.add(wreck.mesh);
    ctx.extraVehicles.push(wreck);
    say('nadia', ['Two cars down and counting — keep moving, the heli has the light!']);
    cameraRig.snapTo(-168, 190, Math.PI);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
      await waitFrames(5);
      ctx.tryEnterCar();
      await waitFrames(5);
      check(!G.onFoot && G.car === near, 'enter car: F steals the nearest car');
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
