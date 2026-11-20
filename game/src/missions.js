// The mission engine: runs the story jobs from story.js as a stage machine.
// Stages are goto / enterCar / deliver / loseCops / ram / destroy / survive.

import * as THREE from 'three';
import { G, dist2 } from './state.js';
import { carById, NPCS } from './config.js';
import { makeVehicle, driveVehicle } from './vehicles.js';
import { say, banner, notice } from './notify.js';

function buildBeacon() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd24d }),
  );
  diamond.position.y = 7;
  g.add(beam, ring, diamond);
  g.userData = { beam, ring, diamond };
  g.visible = false;
  return g;
}

export class Missions {
  constructor(scene, world, police) {
    this.scene = scene;
    this.world = world;
    this.police = police;
    this.beacon = buildBeacon();
    this.scene.add(this.beacon);
    this.targets = []; // target vehicles for ram/destroy stages
    this.offered = false;
  }

  get active() { return !!G.mission; }
  get stage() {
    if (!G.mission) return null;
    return G.mission.def.stages[G.mission.stage];
  }

  startMission(def) {
    if (G.mission) return false;
    G.mission = { def, stage: 0, timer: 0, destroyed: 0, failed: false };
    say(def.giver, def.intro);
    banner(`JOB ${def.num}/10 · ${def.title}`, 'New job from ' + NPCS[def.giver].name, 4);
    this.startStage();
    return true;
  }

  startStage() {
    const st = this.stage;
    if (!st) return;
    const m = G.mission;
    m.timer = st.timer || 0;
    if (st.wanted) this.police.setWanted(st.wanted, 'mission');
    if (st.night) G.clock = 21.5;
    // spawn stage vehicles
    if ((st.type === 'ram' || st.type === 'destroy') && st.carId) {
      const count = st.type === 'destroy' ? (st.count || 1) : 1;
      for (let i = 0; i < count; i++) {
        const def = carById(st.carId);
        const v = makeVehicle(def,
          (st.x || 0) + (i - count / 2) * 12 + 8,
          (st.z || 0) + (i % 2 ? 10 : -10),
          Math.random() * Math.PI * 2,
          { colorIndex: st.type === 'ram' ? 2 : 1 });
        v.missionTarget = true;
        v.aggressive = st.type === 'destroy';
        this.targets.push(v);
        this.scene.add(v.mesh);
      }
    }
    if (st.type === 'enterCar' && st.carId && st.x !== undefined) {
      const def = carById(st.carId);
      const v = makeVehicle(def, st.x + 6, st.z + 4, 0, { npc: true, colorIndex: 0 });
      v.missionTarget = true;
      v.parked = true;
      this.targets.push(v);
      this.scene.add(v.mesh);
    }
    // beacon
    if (st.x !== undefined) {
      this.beacon.position.set(st.x, 0, st.z);
      this.beacon.visible = true;
    } else {
      this.beacon.visible = false;
    }
  }

  clearTargets() {
    for (const v of this.targets) this.scene.remove(v.mesh);
    this.targets = [];
  }

  failMission(reason) {
    if (!G.mission) return;
    banner('JOB FAILED', reason || 'Try again — press M', 4);
    this.clearTargets();
    this.beacon.visible = false;
    G.mission = null;
  }

  completeMission() {
    const def = G.mission.def;
    G.money += def.reward.money;
    G.rp += def.reward.rp;
    G.missionsDone.push(def.id);
    banner('JOB PASSED', `+$${def.reward.money.toLocaleString('en-US')} · +${def.reward.rp} RP`, 5);
    say(def.giver, [def.outro]);
    this.clearTargets();
    this.beacon.visible = false;
    G.mission = null;
    this.offered = false;
  }

  advanceStage() {
    const m = G.mission;
    m.stage++;
    if (m.stage >= m.def.stages.length) {
      this.completeMission();
      return;
    }
    const st = this.stage;
    notice(st.text);
    this.startStage();
  }

  update(dt, ctx) {
    const { px, pz, onFoot, playerCar } = ctx;
    // beacon pulse
    if (this.beacon.visible) {
      const t = performance.now() / 400;
      this.beacon.userData.diamond.position.y = 7 + Math.sin(t) * 1.2;
      this.beacon.userData.diamond.rotation.y += dt * 2;
      this.beacon.userData.ring.scale.setScalar(1 + Math.sin(t * 0.7) * 0.08);
    }
    // target vehicle AI
    for (const v of this.targets) {
      if (v.burnt || v.parked) continue;
      const dx = px - v.x, dz = pz - v.z;
      const d = Math.hypot(dx, dz) || 1;
      let tx, tz;
      if (v.aggressive) { tx = px; tz = pz; } // chase the player
      else { tx = v.x - (dx / d) * 60; tz = v.z - (dz / d) * 60; } // flee
      const want = Math.atan2(tx - v.x, tz - v.z);
      let diff = want - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      driveVehicle(v, 0.85, Math.max(-1, Math.min(1, diff * 2)), dt,
        (x, z, r) => this.world.collide(x, z, r));
      if (v.condition <= 0 && !v.counted) {
        v.counted = true;
        if (G.mission) G.mission.destroyed++;
      }
    }
    if (!G.mission) return;
    const st = this.stage;
    const m = G.mission;
    // timed stages
    if (st.timer) {
      m.timer -= dt;
      if (m.timer <= 0) { this.failMission('Out of time'); return; }
    }
    const d = st.x !== undefined ? dist2(px, pz, st.x, st.z) : Infinity;
    switch (st.type) {
      case 'goto':
        if (d < (st.r || 14)) this.advanceStage();
        break;
      case 'enterCar':
        if (!onFoot) {
          if (!st.carId || (playerCar && playerCar.def.id === st.carId)) this.advanceStage();
          else notice('Wrong car — steal the ' + carById(st.carId).name);
        }
        break;
      case 'deliver':
        if (!onFoot && d < (st.r || 14)) this.advanceStage();
        else if (!onFoot && playerCar && playerCar.condition <= 0) this.failMission('The car was destroyed');
        break;
      case 'loseCops':
        if (G.wanted === 0) this.advanceStage();
        break;
      case 'ram': {
        const t = this.targets[0];
        if (t && t.condition <= (st.damageTo ?? 0)) this.advanceStage();
        break;
      }
      case 'destroy':
        if (m.destroyed >= (st.count || 1)) this.advanceStage();
        break;
      case 'survive':
        if (m.timer <= 0) this.advanceStage();
        break;
      default:
        break;
    }
  }

  marker() {
    const st = this.stage;
    if (!st || st.x === undefined) return null;
    return { x: st.x, z: st.z };
  }

  reset() {
    this.clearTargets();
    this.beacon.visible = false;
    G.mission = null;
  }
}
