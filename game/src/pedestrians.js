// Pedestrians: low-poly walkers on the sidewalks who stroll, chat in place,
// and flee when shots are fired or a car bears down on them.

import * as THREE from 'three';
import { STREETS } from './config.js';
import { pick, range } from './random.js';
import { limbPivot } from './player.js';

const SHIRT_COLORS = [0xe05a5a, 0x5a8ae0, 0x5ad08a, 0xe0c85a, 0xa05ad0, 0x5ad0d0, 0xe08a5a, 0x90a0b0];
const SKIN_COLORS = [0xf0c8a0, 0xc89868, 0x8a5a38, 0xe8b888];
const PANTS_COLORS = [0x2a3240, 0x3a2a20, 0x20302a, 0x40303a];
const HAIR_COLORS = [0x1a1a1a, 0x4a2a10, 0x8a6a3a, 0xd0d0d0];

function buildPedMesh(rng, beach) {
  const g = new THREE.Group();
  // Beach variant: half shirtless (skin torso + arms), the rest in bright
  // swim tops; shorts in bright colours instead of dark trousers.
  const shirt = new THREE.MeshLambertMaterial({ color: beach && rng() < 0.5 ? pick(rng, SKIN_COLORS) : pick(rng, SHIRT_COLORS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKIN_COLORS) });
  const pants = new THREE.MeshLambertMaterial({ color: beach ? pick(rng, SHIRT_COLORS) : pick(rng, PANTS_COLORS) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.82, 0.36), shirt);
  body.position.y = 1.14;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  // Hair or a cap: one in three wears a cap in a shirt colour.
  const topper = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.15, 0.44),
    new THREE.MeshLambertMaterial({ color: rng() < 0.33 ? pick(rng, SHIRT_COLORS) : pick(rng, HAIR_COLORS) }));
  topper.position.y = 1.98;
  const legL = limbPivot(g, 0.22, 0.72, 0.26, pants, -0.16, 0.74);
  const legR = limbPivot(g, 0.22, 0.72, 0.26, pants, 0.16, 0.74);
  const armL = limbPivot(g, 0.18, 0.64, 0.22, shirt, -0.4, 1.5);
  const armR = limbPivot(g, 0.18, 0.64, 0.22, shirt, 0.4, 1.5);
  g.add(body, head, topper);
  g.userData.legs = [legL, legR];
  g.userData.arms = [armL, armR];
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

  // Place one pedestrian at an exact spot (screenshot staging; beach =
  // shirtless/swimsuit variant for the beach shot).
  spawnAt(x, z, heading, target, beach) {
    const mesh = buildPedMesh(this.rng, beach);
    mesh.position.set(x, 0, z);
    const p = {
      mesh, x, z,
      heading: heading ?? 0,
      speed: range(this.rng, 1.2, 2.2),
      target: target || { x, z },
      phase: range(this.rng, 0, 6),
      fleeing: false,
    };
    this.peds.push(p);
    this.scene.add(mesh);
    return p;
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
      p.mesh.userData.arms[0].rotation.x = -swing * 0.7;
      p.mesh.userData.arms[1].rotation.x = swing * 0.7;
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
