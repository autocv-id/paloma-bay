// Combat: hitscan shooting on foot, melee, explosions, burning wrecks.

import * as THREE from 'three';
import { G } from './state.js';
import { currentWeapon, spendAmmo } from './weapons.js';

export class Combat {
  constructor(scene, world, effects, events) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.events = events; // { onShot(), onExplosion(x,z), onPedHit() }
    this.raycaster = new THREE.Raycaster();
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
    this.tracers = [];
  }

  // Shoot from the camera through the crosshair. targets: vehicles + peds.
  shoot(camera, targets, peds) {
    const w = currentWeapon();
    const now = G.time;
    if (now - G.lastShotAt < 1 / w.rate) return false;
    if (w.id !== 'fists' && !spendAmmo(G.weaponIndex, 1)) return false;
    G.lastShotAt = now;
    if (w.id === 'fists') {
      // melee: short range, knocks peds down
      const p = peds.nearest(G.playerX, G.playerZ, 3.2);
      if (p) {
        p.mesh.position.y = 0.4;
        if (this.events.onPedHit) this.events.onPedHit(p);
      }
      if (this.events.onShot) this.events.onShot('melee');
      return true;
    }
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = [];
    for (const v of targets) meshes.push(v.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    const from = camera.position.clone();
    let end;
    if (hits.length > 0 && hits[0].distance < 120) {
      end = hits[0].point;
      const root = this.findVehicleRoot(hits[0].object, targets);
      if (root) this.hitVehicle(root, w);
    } else {
      end = from.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(90));
    }
    this.spawnTracer(from, end);
    this.effects.muzzle(from.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(2)));
    if (this.events.onShot) this.events.onShot(w.id);
    // RPG: explosion at the impact point
    if (w.id === 'harpoon') this.explode(end.x, end.z, 14, 220, targets);
    return true;
  }

  findVehicleRoot(obj, targets) {
    let o = obj;
    while (o) {
      for (const v of targets) if (v.mesh === o) return v;
      o = o.parent;
    }
    return null;
  }

  hitVehicle(v, w) {
    // damage applied by caller-provided hook to avoid a circular import
    if (this.onDamageVehicle) this.onDamageVehicle(v, w.damage);
    this.effects.sparks(v.x, 1, v.z);
  }

  spawnTracer(from, to) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const geo = new THREE.BoxGeometry(0.06, 0.06, len);
    const m = new THREE.Mesh(geo, this.tracerMat);
    m.position.copy(from).add(dir.clone().multiplyScalar(0.5));
    m.lookAt(to);
    this.scene.add(m);
    this.tracers.push({ mesh: m, until: G.time + 0.07 });
  }

  // Explosion: particles + fire + area damage to nearby vehicles.
  explode(x, z, radius, damage, targets) {
    this.effects.explosion(x, z);
    for (const v of targets || []) {
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < radius && this.onDamageVehicle) {
        this.onDamageVehicle(v, damage * (1 - d / radius));
      }
    }
    if (this.events.onExplosion) this.events.onExplosion(x, z);
  }

  // Cars at 0 condition burn, then explode into wrecks.
  updateBurning(dt, vehicles) {
    for (const v of vehicles) {
      if (!v.burning || v.burnt) continue;
      this.effects.smoke(v.x, v.z, dt);
      this.effects.fire(v.x, v.z, dt);
      // a flame mesh on the roof: particles alone drown against a sunset
      // sky at 30 m — a solid bright flame is what reads as "on fire" at
      // a glance. Unlit, so it stays full-bright against any background.
      if (!v.flame) {
        v.flame = new THREE.Group();
        const outer = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.5, 6),
          new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
        outer.position.y = 3.0;
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.2, 6),
          new THREE.MeshBasicMaterial({ color: 0xffd24d }));
        inner.position.y = 2.6;
        v.flame.add(outer, inner);
        v.mesh.add(v.flame);
      }
      const s = 1 + Math.sin(G.time * 11 + v.x) * 0.1;
      v.flame.scale.set(s, 1 + Math.sin(G.time * 13 + v.z) * 0.12, s);
      v.burnTimer = (v.burnTimer || 0) + dt;
      if (v.condition <= 0 && v.burnTimer > 2.5) {
        v.burnt = true;
        v.burning = false;
        if (v.flame) { v.mesh.remove(v.flame); v.flame = null; }
        this.explode(v.x, v.z, 10, 120, vehicles);
        // charred wreck look
        v.mesh.traverse((o) => {
          if (o.isMesh && o.material && o.material.color) o.material = new THREE.MeshLambertMaterial({ color: 0x1c1c20 });
        });
      }
    }
    // fade tracers
    for (const t of [...this.tracers]) {
      if (G.time > t.until) {
        this.scene.remove(t.mesh);
        this.tracers = this.tracers.filter((x) => x !== t);
      }
    }
  }
}
