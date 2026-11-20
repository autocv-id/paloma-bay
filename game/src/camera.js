// Camera: a smoothed third-person chase camera. Behind the car when driving
// (with speed-based pullback), behind the player on foot, mouse-drag orbits
// the view. It never clips through buildings: the boom shortens on contact.

import * as THREE from 'three';
import { TUNE } from './config.js';
import { G, angleLerp } from './state.js';

export class CameraRig {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.distance = TUNE.cameraDistance;
    this.current = new THREE.Vector3(190, 12, 60);
    this.lookAt = new THREE.Vector3(190, 2, 40);
  }

  update(dt, targetX, targetZ, targetHeading, speedNorm, orbitDX) {
    // orbit with mouse, otherwise ease behind the heading
    if (Math.abs(orbitDX) > 0.5) {
      this.yaw -= orbitDX * 0.0032;
    } else {
      this.yaw = angleLerp(this.yaw, targetHeading + Math.PI, Math.min(1, dt * 1.6));
    }
    const wantDist = TUNE.cameraDistance + speedNorm * 3;
    this.distance += (wantDist - this.distance) * Math.min(1, dt * 2);
    const tx = targetX;
    const tz = targetZ;
    // at 4+ stars the camera tilts up so the police helicopter stays in
    // frame — the air pursuit is half the spectacle, it must be visible
    const ty = (G.onFoot ? 2.2 : 2.6) + (G.wanted >= 4 ? 3.2 : 0);
    const camX = tx + Math.sin(this.yaw) * this.distance;
    const camZ = tz + Math.cos(this.yaw) * this.distance;
    const camY = ty + TUNE.cameraHeight * (0.7 + this.pitch);
    // keep the camera out of buildings: shorten the boom on contact
    let dist = this.distance;
    const hit = this.world.collide(camX, camZ, 1.2);
    if (hit.x !== camX || hit.z !== camZ) dist = Math.max(5, this.distance * 0.45);
    const fx = tx + Math.sin(this.yaw) * dist;
    const fz = tz + Math.cos(this.yaw) * dist;
    const k = Math.min(1, dt * 7);
    this.current.x += (fx - this.current.x) * k;
    this.current.y += (camY - this.current.y) * k;
    this.current.z += (fz - this.current.z) * k;
    this.lookAt.x += (tx - this.lookAt.x) * k;
    this.lookAt.y += (ty - this.lookAt.y) * k;
    this.lookAt.z += (tz - this.lookAt.z) * k;
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.lookAt);
  }

  snapTo(x, z, heading) {
    this.yaw = heading + Math.PI;
    this.current.set(x + Math.sin(this.yaw) * this.distance, 8, z + Math.cos(this.yaw) * this.distance);
    this.lookAt.set(x, 2, z);
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.lookAt);
  }
}
