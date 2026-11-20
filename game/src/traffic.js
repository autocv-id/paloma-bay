// Traffic: civilian cars that cruise the street grid on fixed lanes, plus
// simple avoidance so they do not pile into the player. Traffic cars are
// carjackable — stealing one is how the player gets wheels.

import { CARS, STREETS } from './config.js';
import { makeVehicle, driveVehicle } from './vehicles.js';
import { pick, range } from './random.js';

export class Traffic {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.cars = [];
  }

  spawn(n, near) {
    for (let i = 0; i < n; i++) {
      const p = this.world.randomRoadPoint(this.rng);
      if (near && Math.hypot(p.x - near.x, p.z - near.z) < 25) continue;
      const def = pick(this.rng, CARS);
      const v = makeVehicle(def, p.x, p.z, p.heading, { npc: true, colorIndex: Math.floor(this.rng() * 3) });
      v.target = this.nextTarget(p.x, p.z, p.heading);
      this.cars.push(v);
      this.scene.add(v.mesh);
    }
  }

  nextTarget(x, z, heading) {
    // Pick the next intersection along the current heading, then a new turn.
    const alongX = Math.abs(Math.sin(heading)) > 0.7;
    const street = this.world.nearestStreetCoord(alongX ? z : x);
    const dir = alongX ? Math.sign(Math.sin(heading)) : Math.sign(Math.cos(heading));
    let next = alongX ? x + dir * 56 : z + dir * 56;
    next = Math.max(-224, Math.min(224, next));
    const turn = pick(this.rng, [-1, 0, 1]);
    if (alongX) {
      const nz = street + turn * 56;
      return { x: next, z: Math.max(-224, Math.min(224, nz)) };
    }
    const nx = street + turn * 56;
    return { x: Math.max(-224, Math.min(224, nx)), z: next };
  }

  update(dt, playerX, playerZ) {
    for (const v of this.cars) {
      if (v.burnt) continue;
      const t = v.target;
      if (!t) { v.target = this.nextTarget(v.x, v.z, v.heading); continue; }
      const dx = t.x - v.x, dz = t.z - v.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6) { v.target = this.nextTarget(v.x, v.z, v.heading); continue; }
      const want = Math.atan2(dx, dz);
      let diff = want - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      // slow near the player so traffic feels alive, not suicidal
      const pd = Math.hypot(playerX - v.x, playerZ - v.z);
      const throttle = pd < 9 ? 0.15 : 0.55;
      driveVehicle(v, throttle, steer, dt, (x, z, r) => this.world.collide(x, z, r));
      // recycle far-away cars near the player to keep the streets busy
      if (Math.hypot(v.x - playerX, v.z - playerZ) > 320) {
        const p = this.world.randomRoadPoint(this.rng);
        v.x = p.x; v.z = p.z; v.heading = p.heading;
        v.target = this.nextTarget(p.x, p.z, p.heading);
        v.mesh.position.set(v.x, 0, v.z);
      }
    }
  }

  // Nearest drivable traffic car to a point (for carjacking).
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const v of this.cars) {
      if (v.burnt) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  remove(v) {
    this.cars = this.cars.filter((c) => c !== v);
    this.scene.remove(v.mesh);
  }
}
