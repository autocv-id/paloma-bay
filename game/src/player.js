// The player: on-foot movement with a visible low-poly character, entering
// and exiting cars, and carjacking — stealing a traffic car in sight of the
// police raises the wanted level, exactly as the mission text promises.

import * as THREE from 'three';
import { TUNE, carById } from './config.js';
import { G, clamp, dist2 } from './state.js';
import { makeVehicle, driveVehicle, vehicleSpeedKmh } from './vehicles.js';

function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a9e8a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89868 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x243040 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.4), jacket);
  body.position.y = 1.1;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
  head.position.y = 1.8;
  head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xf0c040 }));
  cap.position.y = 2.02;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.66, 0.3), pants);
  legL.position.set(-0.18, 0.33, 0);
  const legR = legL.clone();
  legR.position.x = 0.18;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.26), jacket);
  armL.position.set(-0.46, 1.1, 0);
  const armR = armL.clone();
  armR.position.x = 0.46;
  g.add(body, head, cap, legL, legR, armL, armR);
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
