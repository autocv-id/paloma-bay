// Pedestrians: low-poly walkers on the sidewalks who stroll, chat in place,
// and flee when shots are fired or a car bears down on them. They make the
// city feel alive in the on-foot screenshots.

import * as THREE from 'three';
import { STREETS } from './config.js';
import { pick, range } from './random.js';

const SHIRT_COLORS = [0xe05a5a, 0x5a8ae0, 0x5ad08a, 0xe0c85a, 0xa05ad0, 0x5ad0d0, 0xe08a5a, 0x90a0b0];
const SKIN_COLORS = [0xf0c8a0, 0xc89868, 0x8a5a38, 0xe8b888];

function buildPedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRT_COLORS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKIN_COLORS) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3240 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.28), pants);
  legL.position.set(-0.17, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(body, head, legL, legR);
  g.userData.legs = [legL, legR];
  return g;
}

export class Pedestrians {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.peds = [];
    this.panicUntil = 0;
  }

  spawn(n, near) {
    for (let i = 0; i < n; i++) {
      const s = pick(this.rng, STREETS);
      const along = range(this.rng, -220, 220);
      const onX = this.rng() < 0.5;
      const x = onX ? along : s + (this.rng() < 0.5 ? 8.5 : -8.5);
      const z = onX ? s + (this.rng() < 0.5 ? 8.5 : -8.5) : along;
      if (near && Math.hypot(x - near.x, z - near.z) < 12) continue;
      const mesh = buildPedMesh(this.rng);
      mesh.position.set(x, 0, z);
      const p = {
        mesh, x, z,
        heading: range(this.rng, 0, Math.PI * 2),
        speed: range(this.rng, 1.2, 2.2),
        target: null,
        phase: range(this.rng, 0, 6),
        fleeing: false,
      };
      p.target = this.nextTarget(p);
      this.peds.push(p);
      this.scene.add(mesh);
    }
  }

  nextTarget(p) {
    const s = this.world.nearestStreetCoord(p.x);
    const s2 = this.world.nearestStreetCoord(p.z);
    if (this.rng() < 0.5) return { x: s + (this.rng() < 0.5 ? 8.5 : -8.5), z: range(this.rng, -220, 220) };
    return { x: range(this.rng, -220, 220), z: s2 + (this.rng() < 0.5 ? 8.5 : -8.5) };
  }

  panic() { this.panicUntil = performance.now() / 1000 + 8; }

  update(dt, time, playerX, playerZ, threatX, threatZ) {
    const panicking = time < this.panicUntil;
    for (const p of this.peds) {
      const t = p.target;
      let tx = t.x, tz = t.z;
      let speed = p.speed;
      if (panicking) {
        // run away from the threat
        const dx = p.x - threatX, dz = p.z - threatZ;
        const d = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / d) * 40;
        tz = p.z + (dz / d) * 40;
        speed = 6.5;
        p.fleeing = true;
      } else if (p.fleeing) {
        p.fleeing = false;
        p.target = this.nextTarget(p);
      }
      const dx = tx - p.x, dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) { p.target = this.nextTarget(p); continue; }
      const want = Math.atan2(dx, dz);
      let diff = want - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const nx = p.x + Math.sin(p.heading) * speed * dt;
      const nz = p.z + Math.cos(p.heading) * speed * dt;
      const hit = this.world.collide(nx, nz, 0.6);
      p.x = hit.x; p.z = hit.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // walk cycle
      p.phase += dt * speed * 2.4;
      const swing = Math.sin(p.phase) * 0.5;
      p.mesh.userData.legs[0].rotation.x = swing;
      p.mesh.userData.legs[1].rotation.x = -swing;
      // recycle far peds near the player
      if (Math.hypot(p.x - playerX, p.z - playerZ) > 300) {
        const s = pick(this.rng, STREETS);
        p.x = playerX + range(this.rng, -120, 120);
        p.z = s + 8.5;
        p.target = this.nextTarget(p);
      }
    }
  }

  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
