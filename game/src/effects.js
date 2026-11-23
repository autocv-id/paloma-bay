// Effects: particles for explosions, smoke, sparks and muzzle flashes, plus
// skid feedback. One pooled Points cloud per effect type keeps draw calls
// low and the frame rate safe in headless screenshots.

import * as THREE from 'three';

const MAX = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    this.geo = geo;
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 3.0, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.smokeAcc = 0;
    this.fireAcc = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, r, g, b, buoy = false) {
    if (this.parts.length >= MAX) this.parts.shift();
    this.parts.push({ x, y, z, vx, vy, vz, life, maxLife: life, r, g, b, buoy });
  }

  explosion(x, z) {
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 14;
      this.spawn(x, 1 + Math.random() * 2, z,
        Math.cos(a) * sp, 4 + Math.random() * 10, Math.sin(a) * sp,
        0.5 + Math.random() * 0.7,
        1, 0.45 + Math.random() * 0.4, 0.1);
    }
    for (let i = 0; i < 22; i++) {
      this.spawn(x + (Math.random() - 0.5) * 4, 2 + Math.random() * 4, z + (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2,
        1.2 + Math.random(), 0.25, 0.25, 0.25, true);
    }
  }

  smoke(x, z, dt) {
    this.smokeAcc += dt;
    if (this.smokeAcc < 0.12) return;
    this.smokeAcc = 0;
    // four puffs a tick, dark and long-lived: the smoke column is the
    // cue that reads at distance — grey-black against a sunset sky.
    // Buoyant: real smoke rises instead of falling back onto the car.
    for (let i = 0; i < 4; i++) {
      this.spawn(x + (Math.random() - 0.5) * 1.2, 1.6, z + (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5), 1.5 + Math.random(), (Math.random() - 0.5),
        1.8, 0.12, 0.12, 0.12, true);
    }
  }

  // A burning car throws flames, not just smoke: bright yellow-orange
  // tongues licking up from the wreck, so the fire reads at a glance —
  // a smoke wisp alone does not (the night wreck proved it: it read as
  // a parked car). Yellow-white reads against the orange dusk sky.
  // Tall flames (vy 6-10): the column must clear the neighbouring car
  // roofs and stand in open sky, or it drowns in the traffic cluster.
  fire(x, z, dt) {
    this.fireAcc += dt;
    if (this.fireAcc < 0.05) return;
    this.fireAcc = 0;
    for (let i = 0; i < 3; i++) {
      this.spawn(x + (Math.random() - 0.5) * 1.6, 1 + Math.random(),
        z + (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.5) * 1.5, 6 + Math.random() * 4, (Math.random() - 0.5) * 1.5,
        0.7 + Math.random() * 0.4,
        1, 0.95, 0.75);
    }
  }

  sparks(x, y, z) {
    for (let i = 0; i < 8; i++) {
      this.spawn(x, y, z,
        (Math.random() - 0.5) * 10, Math.random() * 6, (Math.random() - 0.5) * 10,
        0.25 + Math.random() * 0.2, 1, 0.9, 0.4);
    }
  }

  muzzle(p) {
    for (let i = 0; i < 5; i++) {
      this.spawn(p.x, p.y, p.z,
        (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4,
        0.08, 1, 0.85, 0.3);
    }
  }

  // Nitro exhaust: a burst of orange flame behind the car each step.
  boostFlame(x, z, heading) {
    const bx = x - Math.sin(heading) * 2.3;
    const bz = z - Math.cos(heading) * 2.3;
    for (let i = 0; i < 3; i++) {
      this.spawn(bx + (Math.random() - 0.5) * 0.6, 0.5, bz + (Math.random() - 0.5) * 0.6,
        -Math.sin(heading) * 6, 1.5 + Math.random() * 2, -Math.cos(heading) * 6,
        0.25 + Math.random() * 0.15, 1, 0.55 + Math.random() * 0.3, 0.1);
    }
  }

  update(dt) {
    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.color.array;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      // smoke is buoyant (rises); everything else falls
      if (p.buoy) p.vy += 0.5 * dt;
      else p.vy -= 6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; }
      // fade to a 35% floor, not to black: a fire particle at half life
      // is still a flame, and fading to zero turns yellow fire into
      // muddy olive that vanishes against a sunset sky
      const fade = 0.35 + 0.65 * (p.life / p.maxLife);
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      col[n * 3] = p.r * fade; col[n * 3 + 1] = p.g * fade; col[n * 3 + 2] = p.b * fade;
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
