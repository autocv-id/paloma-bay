// Police: the wanted system and the PBPD pursuit. Wanted stars rise when the
// player commits crimes in sight of the law; police cars spawn, chase, ram
// and PIT; roadblocks appear at 3 stars; the helicopter arrives at 4. Lose
// the cops by breaking line of sight until the heat dies down.

import * as THREE from 'three';
import { WANTED, POLICE_UNITS, TUNE } from './config.js';
import { G, clamp, dist2 } from './state.js';
import { makeVehicle, driveVehicle, damageVehicle } from './vehicles.js';
import { pick } from './random.js';

const COP_CAR = { id: 'pbpd', name: 'PBPD Interceptor', kind: 'POLICE', top: 56, accel: 27, grip: 1.0, colors: [0xf0f0f0] };

export class Police {
  constructor(scene, world, rng, events) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.events = events; // { onWanted(n), onBusted(), onRoadblock() }
    this.units = []; // police vehicles with unit names + tactics
    this.roadblocks = []; // { x, z, heading, meshes }
    this.usedNames = new Set();
    this.spawnTimer = 0;
    this.lastWanted = 0;
  }

  setWanted(n, reason) {
    const next = clamp(Math.round(n), 0, 5);
    if (next !== G.wanted) {
      G.wanted = next;
      G.evadeTimer = 0;
      G.unseenTimer = 0;
      if (next > this.lastWanted && this.events.onWanted) this.events.onWanted(next, reason);
      this.lastWanted = next;
    }
  }

  addWanted(n, reason) { this.setWanted(G.wanted + n, reason); }

  nextUnitName() {
    const free = POLICE_UNITS.filter((u) => !this.usedNames.has(u));
    const name = free.length ? pick(this.rng, free) : 'PBPD-' + Math.floor(this.rng() * 90 + 10);
    this.usedNames.add(name);
    return name;
  }

  spawnUnit(px, pz) {
    const name = this.nextUnitName();
    // spawn on a road 60-120m away, off-screen-ish
    let x = px, z = pz, tries = 0;
    while (tries++ < 12) {
      const p = this.world.randomRoadPoint(this.rng);
      if (dist2(p.x, p.z, px, pz) > 55) { x = p.x; z = p.z; break; }
    }
    const v = makeVehicle(COP_CAR, x, z, Math.atan2(px - x, pz - z),
      { police: true, unitName: name, tactic: 'PURSUE' });
    v.target = { x: px, z: pz };
    this.units.push(v);
    this.scene.add(v.mesh);
    return v;
  }

  spawnRoadblock(px, pz, heading) {
    const fx = px + Math.sin(heading) * 70;
    const fz = pz + Math.cos(heading) * 70;
    const group = new THREE.Group();
    const meshes = [];
    for (const off of [-4, 0, 4]) {
      const v = makeVehicle(COP_CAR, fx + Math.cos(heading) * off, fz - Math.sin(heading) * off,
        heading + Math.PI / 2, { police: true, unitName: this.nextUnitName(), tactic: 'ROADBLOCK' });
      v.speed = 0;
      this.units.push(v);
      this.scene.add(v.mesh);
      meshes.push(v);
    }
    this.roadblocks.push({ x: fx, z: fz, heading, meshes, group });
    if (this.events.onRoadblock) this.events.onRoadblock();
  }

  clearRoadblocks() {
    for (const rb of this.roadblocks) {
      for (const v of rb.meshes) this.removeUnit(v);
    }
    this.roadblocks = [];
  }

  removeUnit(v) {
    this.units = this.units.filter((u) => u !== v);
    this.usedNames.delete(v.unitName);
    this.scene.remove(v.mesh);
  }

  // Line of sight: any unit within 90m and roughly facing the player counts.
  playerSeen(px, pz) {
    for (const u of this.units) {
      if (u.burnt) continue;
      if (dist2(u.x, u.z, px, pz) < 95) return true;
    }
    return false;
  }

  update(dt, px, pz, playerSpeed, onFoot) {
    const want = G.wanted;
    // maintain the right number of units
    const target = WANTED.maxUnits[want] || 0;
    this.spawnTimer -= dt;
    if (this.units.filter((u) => !u.burnt).length < target && this.spawnTimer <= 0) {
      this.spawnUnit(px, pz);
      this.spawnTimer = 1.2;
    }
    if (want === 0) {
      // stand down: units drive off and despawn
      for (const u of [...this.units]) {
        const d = dist2(u.x, u.z, px, pz);
        if (d > 130) this.removeUnit(u);
        else driveVehicle(u, 0.5, 0, dt, (x, z, r) => this.world.collide(x, z, r));
      }
      this.clearRoadblocks();
      return;
    }
    // roadblocks at 3+ stars, at most one active
    if (want >= WANTED.roadblockAt && this.roadblocks.length === 0 && this.rng() < dt * 0.12) {
      this.spawnRoadblock(px, pz, Math.atan2(px - (this.units[0]?.x ?? px), pz - (this.units[0]?.z ?? pz)));
    }
    // chase AI per unit
    for (const u of [...this.units]) {
      if (u.burnt) continue;
      const d = dist2(u.x, u.z, px, pz);
      if (d > 260) { // lost too far: recycle near the player
        const p = this.world.randomRoadPoint(this.rng);
        u.x = p.x; u.z = p.z;
      }
      if (u.tactic === 'ROADBLOCK') continue; // parked across the road
      // pick a tactic by distance and wanted level
      if (d < 14 && want >= 2) u.tactic = this.rng() < 0.5 ? 'RAM' : 'PIT';
      else if (d < 45) u.tactic = 'PURSUE';
      else u.tactic = 'PURSUE';
      const aimX = u.tactic === 'PIT' ? px + Math.sin(G.heading || 0) * 4 : px;
      const aimZ = u.tactic === 'PIT' ? pz + Math.cos(G.heading || 0) * 4 : pz;
      const wantAngle = Math.atan2(aimX - u.x, aimZ - u.z);
      let diff = wantAngle - u.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = clamp(diff * 2.4, -1, 1);
      const throttle = d > 10 ? 1 : 0.7;
      driveVehicle(u, throttle, steer, dt, (x, z, r) => this.world.collide(x, z, r));
      // ramming the player's car damages it
      if (G.car && dist2(u.x, u.z, G.car.x, G.car.z) < 3.4) {
        damageVehicle(G.car, dt * 6);
      }
    }
    // evade / heat decay
    const seen = this.playerSeen(px, pz);
    if (!seen) {
      G.unseenTimer += dt;
      if (G.unseenTimer > WANTED.evadeSeconds) {
        this.setWanted(want - 1, 'heat cooled');
        G.unseenTimer = 0;
      }
    } else {
      G.unseenTimer = 0;
    }
    // busted: on foot, slow, police close
    if (onFoot && want > 0 && playerSpeed < 1) {
      const near = this.units.some((u) => !u.burnt && dist2(u.x, u.z, px, pz) < 8);
      if (near) {
        G.bustTimer += dt;
        if (G.bustTimer > WANTED.bustSeconds && this.events.onBusted) this.events.onBusted();
      } else G.bustTimer = 0;
    } else G.bustTimer = 0;
  }

  // Dispatch data for the HUD: nearest units with tactic + live distance.
  dispatchRows(px, pz) {
    return this.units
      .filter((u) => !u.burnt)
      .map((u) => ({ name: u.unitName, tactic: u.tactic, dist: Math.round(dist2(u.x, u.z, px, pz)) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6);
  }

  reset() {
    for (const u of [...this.units]) this.removeUnit(u);
    this.roadblocks = [];
    this.usedNames.clear();
    G.wanted = 0;
    this.lastWanted = 0;
  }
}
