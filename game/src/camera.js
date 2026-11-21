// Camera: a smoothed third-person chase camera. The boom shortens on contact.

import * as THREE from 'three';
import { TUNE } from './config.js';
import { G, angleLerp } from './state.js';

// Chase-camera views (driving only): [extra distance, extra height] over
// the current close chase-cam — 0 current, 1 high-far, 2 near-top-down.
const VIEWS = [[0, 0], [6, 5.8], [-3, 8.8]];

export class CameraRig {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.distance = TUNE.cameraDistance;
    this.view = 0; // V cycles the chase cameras
    this.yawOffset = 0; // staged offset
    this.lookYLift = null; // staged override; null = auto 0.4 at 4+ stars on foot
    this.current = new THREE.Vector3(190, 12, 60);
    this.lookAt = new THREE.Vector3(190, 2, 40);
  }

  cycleView() { this.view = (this.view + 1) % 3; }

  update(dt, targetX, targetZ, targetHeading, speedNorm, orbitDX) {
    // orbit with mouse, otherwise ease behind the heading (+ staged offset)
    if (Math.abs(orbitDX) > 0.5) {
      this.yaw -= orbitDX * 0.0032;
    } else {
      this.yaw = angleLerp(this.yaw, targetHeading + Math.PI + this.yawOffset, Math.min(1, dt * 1.6));
    }
    // driving: close chase-cam + speed pullback; on foot: close + low
    const onFoot = G.onFoot;
    const baseDist = onFoot ? TUNE.cameraFootDistance : TUNE.cameraDistance;
    const wantDist = baseDist + (onFoot ? 0 : speedNorm * 1.0) + (onFoot ? 0 : VIEWS[this.view][0]);
    this.distance += (wantDist - this.distance) * Math.min(1, dt * 2);
    const tx = targetX;
    const tz = targetZ;
    // Look target: horizon in the upper half; on foot at 4+ stars it lifts
    // so the heli stays in frame.
    const baseLookY = onFoot ? 1.7 : 2.6;
    const lift = this.lookYLift ?? (G.wanted >= 4 && onFoot ? 0.4 : 0);
    const lookY = baseLookY + lift;
    const camY = baseLookY + (onFoot ? TUNE.cameraFootHeight : TUNE.cameraDriveHeight) + (onFoot ? 0 : VIEWS[this.view][1]);
    const camX = tx + Math.sin(this.yaw) * this.distance;
    const camZ = tz + Math.cos(this.yaw) * this.distance;
    // keep the camera out of buildings: shorten the boom on contact
    let dist = this.distance;
    const hit = this.world.collide(camX, camZ, 1.2);
    if (hit.x !== camX || hit.z !== camZ) dist = Math.max(2.5, this.distance * 0.45);
    const fx = tx + Math.sin(this.yaw) * dist;
    const fz = tz + Math.cos(this.yaw) * dist;
    // Stiff follow (20/s): the lag stays under 3 m.
    const k = Math.min(1, dt * 20);
    this.current.x += (fx - this.current.x) * k;
    this.current.y += (camY - this.current.y) * k;
    this.current.z += (fz - this.current.z) * k;
    this.lookAt.x += (tx - this.lookAt.x) * k;
    this.lookAt.y += (lookY - this.lookAt.y) * k;
    this.lookAt.z += (tz - this.lookAt.z) * k;
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.lookAt);
  }

  snapTo(x, z, heading) {
    this.yaw = heading + Math.PI + this.yawOffset;
    const onFoot = G.onFoot;
    const dist = onFoot ? TUNE.cameraFootDistance : TUNE.cameraDistance + VIEWS[this.view][0];
    const baseLookY = onFoot ? 1.7 : 2.6;
    const lift = this.lookYLift ?? (G.wanted >= 4 && onFoot ? 0.4 : 0);
    const lookY = baseLookY + lift;
    const camY = baseLookY + (onFoot ? TUNE.cameraFootHeight : TUNE.cameraDriveHeight) + (onFoot ? 0 : VIEWS[this.view][1]);
    this.current.set(x + Math.sin(this.yaw) * dist, camY, z + Math.cos(this.yaw) * dist);
    this.lookAt.set(x, lookY, z);
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.lookAt);
  }
}
