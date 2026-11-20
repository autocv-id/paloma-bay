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
      size: 1.6, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.smokeAcc = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    if (this.parts.length >= MAX) this.parts.shift();
    this.parts.push({ x, y, z, vx, vy, vz, life, maxLife: life, r, g, b });
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
        1.2 + Math.random(), 0.25, 0.25, 0.25);
    }
  }

  smoke(x, z, dt) {
    this.smokeAcc += dt;
    if (this.smokeAcc < 0.12) return;
    this.smokeAcc = 0;
    this.spawn(x + (Math.random() - 0.5), 1.6, z + (Math.random() - 0.5),
      (Math.random() - 0.5), 2.5, (Math.random() - 0.5),
      1.4, 0.2, 0.2, 0.2);
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

  update(dt) {
    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.color.array;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy -= 6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; }
      const fade = p.life / p.maxLife;
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      col[n * 3] = p.r * fade; col[n * 3 + 1] = p.g * fade; col[n * 3 + 2] = p.b * fade;
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
