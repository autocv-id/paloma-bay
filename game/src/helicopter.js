// The police helicopter: arrives at 4 stars, circles above the player and
// paints them with a visible spotlight cone. While the spotlight holds, the
// player counts as seen — no heat decay under the light.

import * as THREE from 'three';
import { WANTED, HELI_CALLSIGN } from './config.js';
import { G } from './state.js';

// The heli flies low (12 m) so it stays in the chase camera's frame and
// big enough to read at 25 m — the air pursuit reads in the cover frame.
const ALT = 12;
const BODY_SCALE = 1.5;

export class Helicopter {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.active = false;
    this.staged = false; // a shot can force a patrol flight with no wanted level
    this.angle = 0;
    this.x = 0; this.z = 0;
    // Orbit geometry (instance fields so a shot can stage them): the heli
    // circles a point `orbitLead` metres ahead of the player's nose.
    this.orbitRadius = 16;
    this.orbitLead = 20;
    this.build();
  }

  build() {
    const g = new THREE.Group();
    // airframe in its own sub-group so it can be scaled without stretching
    // the spotlight cone (the cone's length must equal the altitude)
    const bodyG = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8ecf0 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5.2), bodyMat);
    body.castShadow = true;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 1.4), darkMat);
    nose.position.set(0, -0.2, 2.8);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), bodyMat);
    tail.position.set(0, 0.3, -4.2);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), darkMat);
    rotor.position.y = 1.1;
    const rotor2 = rotor.clone();
    rotor2.rotation.y = Math.PI / 2;
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), darkMat);
    tailRotor.position.set(0.4, 0.4, -6.2);
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 4.4), darkMat);
    skidL.position.set(-1.2, -1.1, 0);
    const skidR = skidL.clone();
    skidR.position.x = 1.2;
    bodyG.add(body, nose, tail, rotor, rotor2, tailRotor, skidL, skidR);
    bodyG.scale.setScalar(BODY_SCALE);
    g.add(bodyG);
    g.userData.rotors = [rotor, rotor2];
    const coneGeo = new THREE.ConeGeometry(7, ALT, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.18,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = -ALT / 2;
    cone.rotation.x = Math.PI;
    g.add(cone);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = -(ALT - 0.3);
    g.add(pool);
    g.visible = false;
    this.mesh = g;
    this.scene.add(g);
  }

  update(dt, px, pz, heading = 0) {
    const want = (G.wanted >= WANTED.heliAt || this.staged) && !G.car?.burnt;
    if (want && !this.active) {
      this.active = true;
      this.mesh.visible = true;
      // arrive at the orbit ahead of the player, already settled
      const fx = Math.sin(heading), fz = Math.cos(heading);
      this.x = px + fx * this.orbitLead + 25;
      this.z = pz + fz * this.orbitLead;
      this.angle = Math.atan2(px - this.x, pz - this.z);
    } else if (!want && this.active) {
      this.active = false;
      this.mesh.visible = false;
    }
    if (!this.active) return;
    this.angle += dt * 0.35;
    // Circle the lead point at 45 m/s, so it keeps up with a fast car.
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const cx = px + fx * this.orbitLead, cz = pz + fz * this.orbitLead;
    const tx = cx + Math.cos(this.angle) * this.orbitRadius;
    const tz = cz + Math.sin(this.angle) * this.orbitRadius;
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const step = Math.min(d, 45 * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    const y = ALT + Math.sin(performance.now() / 900) * 0.5;
    this.mesh.position.set(this.x, y, pz + (this.z - pz));
    this.mesh.position.z = this.z;
    this.mesh.rotation.y = Math.atan2(px - this.x, pz - this.z);
    for (const r of this.mesh.userData.rotors) r.rotation.y += dt * 22;
  }

  get callsign() { return HELI_CALLSIGN; }
}
