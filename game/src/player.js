// The player: on-foot movement with a visible low-poly character, entering
// and exiting cars, and carjacking.

import * as THREE from 'three';
import { TUNE, carById } from './config.js';
import { G, clamp } from './state.js';
import { makeVehicle, driveVehicle, vehicleSpeedKmh } from './vehicles.js';

// A limb hanging from a pivot at the joint: rotating the group swings it.
export function limbPivot(g, w, h, d, mat, x, y) {
  const p = new THREE.Group();
  p.position.set(x, y, 0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = -h / 2;
  p.add(m);
  g.add(p);
  return p;
}

function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a9e8a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89868 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x243040 });
  const shoe = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.38), jacket);
  body.position.y = 1.18;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.8;
  head.castShadow = true;
  // Kade's yellow cap: crown + a forward brim, his signature at any range.
  const capMat = new THREE.MeshLambertMaterial({ color: 0xf0c040 });
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), capMat);
  crown.position.y = 2.02;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.24), capMat);
  brim.position.set(0, 1.96, 0.3);
  const legL = limbPivot(g, 0.24, 0.75, 0.28, pants, -0.17, 0.78);
  const legR = limbPivot(g, 0.24, 0.75, 0.28, pants, 0.17, 0.78);
  const armL = limbPivot(g, 0.2, 0.68, 0.24, jacket, -0.42, 1.55);
  const armR = limbPivot(g, 0.2, 0.68, 0.24, jacket, 0.42, 1.55);
  // Shoes: dark toe boxes at the end of each leg, so the stride reads.
  for (const leg of [legL, legR]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.42), shoe);
    s.position.set(0, -0.72, 0.06);
    leg.add(s);
  }
  g.add(body, head, crown, brim);
  g.userData.legs = [legL, legR];
  g.userData.arms = [armL, armR];
  return g;
}

export class Player {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mesh = buildPlayerMesh();
    this.mesh.position.set(G.playerX, 0, G.playerZ);
    this.scene.add(this.mesh);
    this.walkPhase = 0;
    this.aimPoint = new THREE.Vector3();
  }

  get x() { return G.onFoot ? G.playerX : G.car.x; }
  get z() { return G.onFoot ? G.playerZ : G.car.z; }
  get heading() { return G.onFoot ? G.heading : G.car.heading; }
  get speedKmh() { return G.onFoot ? G.playerSpeed * 3.6 : vehicleSpeedKmh(G.car); }

  // On-foot step: move input is a {x, z} wish direction in world space.
  updateOnFoot(dt, moveX, moveZ, running) {
    const speed = running ? TUNE.runSpeed : TUNE.walkSpeed;
    const len = Math.hypot(moveX, moveZ);
    G.moving = len > 0.1;
    if (G.moving) {
      const nx = moveX / len, nz = moveZ / len;
      const want = Math.atan2(nx, nz);
      let diff = want - G.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      G.heading += clamp(diff, -6 * dt, 6 * dt);
      const px = G.playerX + nx * speed * dt;
      const pz = G.playerZ + nz * speed * dt;
      const hit = this.world.collide(px, pz, 0.7);
      G.playerX = hit.x; G.playerZ = hit.z;
      G.playerSpeed = speed;
      this.walkPhase += dt * speed * 1.6;
    } else {
      G.playerSpeed = 0;
    }
    this.mesh.visible = true;
    this.mesh.position.set(G.playerX, 0, G.playerZ);
    this.mesh.rotation.y = G.heading;
    const swing = G.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.7;
    this.mesh.userData.arms[1].rotation.x = swing * 0.7;
  }

  // Drive step: throttle -1..1, steer -1..1.
  updateDriving(dt, throttle, steer) {
    if (!G.car) return;
    this.mesh.visible = false;
    driveVehicle(G.car, throttle, steer, dt, (x, z, r) => this.world.collide(x, z, r));
  }

  enterCar(v) {
    G.car = v;
    G.car.isPlayer = true;
    G.car.npc = false;
    G.onFoot = false;
    this.mesh.visible = false;
  }

  exitCar() {
    if (!G.car) return;
    const v = G.car;
    G.playerX = v.x + Math.sin(v.heading + Math.PI / 2) * 3;
    G.playerZ = v.z + Math.cos(v.heading + Math.PI / 2) * 3;
    const hit = this.world.collide(G.playerX, G.playerZ, 0.7);
    G.playerX = hit.x; G.playerZ = hit.z;
    G.heading = v.heading;
    G.car = null;
    G.onFoot = true;
    this.mesh.visible = true;
  }

  // Spawn the player's owned car beside them (garage delivery).
  spawnOwnedCar(carId) {
    const def = carById(carId);
    const v = makeVehicle(def, G.playerX + 4, G.playerZ + 2, G.heading, { isPlayer: false });
    v.upgrades = G.upgrades[carId] || { engine: 0, armor: 0 };
    this.scene.add(v.mesh);
    return v;
  }

  reset(x, z, heading) {
    G.playerX = x; G.playerZ = z; G.heading = heading;
    G.onFoot = true;
    if (G.car) { G.car.isPlayer = false; G.car = null; }
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
  }
}
