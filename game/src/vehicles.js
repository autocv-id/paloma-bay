// Vehicles: low-poly car meshes and the arcade driving model shared by the
// player, traffic and police. Every car is built from boxes, cylinders and
// emissive lights — no loaded models.

import * as THREE from 'three';
import { carById } from './config.js';
import { clamp } from './state.js';

const bodyGeo = new THREE.BoxGeometry(2.1, 0.62, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.8, 0.55, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const lightGeo = new THREE.BoxGeometry(0.34, 0.16, 0.1);
const barGeo = new THREE.BoxGeometry(1.5, 0.18, 0.5);

const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const barRedMat = new THREE.MeshBasicMaterial({ color: 0xff2030 });
const barBlueMat = new THREE.MeshBasicMaterial({ color: 0x2080ff });

export function buildCarMesh(carDef, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: opts.police ? 0xf0f0f0 : carDef.colors[opts.colorIndex || 0] });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(cabinGeo, opts.police ? paint : glassMat);
  cabin.position.set(0, 1.18, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  if (!opts.police) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 2.0), paint);
    roof.position.set(0, 1.5, -0.2);
    g.add(roof);
  }
  // wheels
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  // headlights + taillights
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(x, 0.68, 2.22);
    g.add(h);
    const t = new THREE.Mesh(lightGeo, tailMat);
    t.position.set(x, 0.68, -2.22);
    g.add(t);
  }
  if (opts.police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.3, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x1848c8 }));
    stripe.position.y = 0.62;
    g.add(stripe);
    const bar = new THREE.Group();
    const r = new THREE.Mesh(barGeo, barRedMat);
    r.position.x = -0.4;
    const b = new THREE.Mesh(barGeo, barBlueMat);
    b.position.x = 0.4;
    bar.add(r); bar.add(b);
    bar.position.y = 1.62;
    g.add(bar);
    g.userData.lightBar = { r, b };
  }
  return g;
}

// A vehicle in the world: mesh + arcade physics state.
export function makeVehicle(carDef, x, z, heading, opts = {}) {
  const mesh = buildCarMesh(carDef, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    def: carDef,
    mesh,
    x, z, heading,
    speed: 0, // m/s, signed
    steer: 0,
    condition: 100,
    burning: false,
    burnt: false,
    police: !!opts.police,
    unitName: opts.unitName || null,
    tactic: opts.tactic || 'PURSUE',
    isPlayer: !!opts.isPlayer,
    npc: !!opts.npc,
    target: null, // traffic waypoint {x,z}
    stuck: 0,
    sirenPhase: Math.random() * 10,
    flash: 0,
  };
}

// Arcade car step: throttle -1..1, steer -1..1. Returns nothing; mutates v.
export function driveVehicle(v, throttle, steerInput, dt, collide) {
  const def = v.def;
  const up = v.upgrades || { engine: 0, armor: 0 };
  const top = def.top * (1 + up.engine * 0.12);
  const accel = def.accel * (1 + up.engine * 0.1);
  if (v.burnt) { v.speed *= 0.9; return; }
  if (throttle > 0) v.speed += accel * throttle * dt;
  else if (throttle < 0) {
    if (v.speed > 1) v.speed -= 34 * dt; // brake
    else v.speed = Math.max(-12, v.speed + accel * 0.6 * throttle * dt); // reverse
  } else {
    v.speed -= v.speed * 0.55 * dt; // drag
    if (Math.abs(v.speed) < 0.05) v.speed = 0;
  }
  v.speed = clamp(v.speed, -12, top);
  const spd = Math.abs(v.speed);
  const turn = steerInput * clamp(spd / 8, 0, 1) * 1.9 * (v.speed >= 0 ? 1 : -1);
  v.heading += turn * dt * def.grip;
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (collide) {
    const hit = collide(nx, nz, 1.7);
    if (hit.x !== nx || hit.z !== nz) {
      // crash: lose speed, take damage
      const impact = Math.abs(v.speed);
      if (impact > 6) damageVehicle(v, impact * 0.9);
      v.speed *= 0.35;
    }
    v.x = hit.x; v.z = hit.z;
  } else { v.x = nx; v.z = nz; }
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
  // police light bar flash
  if (v.police && v.mesh.userData.lightBar) {
    v.flash += dt * 10;
    const on = Math.sin(v.flash) > 0;
    v.mesh.userData.lightBar.r.visible = on;
    v.mesh.userData.lightBar.b.visible = !on;
  }
}

export function damageVehicle(v, amount) {
  if (v.burnt) return;
  const up = v.upgrades || { armor: 0 };
  v.condition -= amount * (1 - up.armor * 0.15);
  if (v.condition <= 25 && !v.burning) v.burning = true;
  if (v.condition <= 0) {
    v.condition = 0;
    v.burning = true;
  }
}

export function repairVehicle(v) {
  v.condition = 100;
  v.burning = false;
  v.burnt = false;
}

export function vehicleSpeedKmh(v) {
  return Math.abs(v.speed) * 3.6;
}
