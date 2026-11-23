// Vehicles: low-poly car meshes + the arcade driving model shared by the
// player, traffic and police. No loaded models.

import * as THREE from 'three';
import { clamp } from './state.js';

// Body shapes per class (metres). w/h/l/y = body, cw/ch/cl/cz = cabin,
// wr = wheel radius; wing/scoop/curve are extras.
const SHAPES = {
  SUPER: { w: 2.15, h: 0.52, l: 4.6, y: 0.58, cw: 1.6, ch: 0.42, cl: 1.9, cz: -0.35, wr: 0.4, wing: 1, curve: 1 },
  SPORTS: { w: 2.1, h: 0.58, l: 4.5, y: 0.6, cw: 1.65, ch: 0.48, cl: 2.0, cz: -0.25, wr: 0.4, wing: 1, curve: 1 },
  COUPE: { w: 2.05, h: 0.6, l: 4.4, y: 0.6, cw: 1.6, ch: 0.5, cl: 1.9, cz: -0.3, wr: 0.4, curve: 1 },
  MUSCLE: { w: 2.15, h: 0.66, l: 4.7, y: 0.62, cw: 1.65, ch: 0.52, cl: 1.8, cz: -0.45, wr: 0.42, scoop: 1 },
  SEDAN: { w: 2.05, h: 0.64, l: 4.4, y: 0.62, cw: 1.7, ch: 0.56, cl: 2.1, cz: -0.15, wr: 0.4 },
  'OFF-ROAD': { w: 2.1, h: 0.7, l: 4.3, y: 0.78, cw: 1.7, ch: 0.6, cl: 2.2, cz: -0.1, wr: 0.5 },
  VAN: { w: 2.15, h: 1.15, l: 4.6, y: 0.85, cw: 2.0, ch: 0.85, cl: 3.4, cz: -0.3, wr: 0.42 },
};

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const glassGeo = new THREE.BoxGeometry(1.66, 0.52, 0.06);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 8);
const roofGeo = new THREE.SphereGeometry(1, 12, 8);
const lightGeo = new THREE.BoxGeometry(0.34, 0.16, 0.1);
const barGeo = new THREE.BoxGeometry(0.8, 0.16, 0.45);
const decalGeo = new THREE.PlaneGeometry(1.7, 0.42);

const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const rimMat = new THREE.MeshLambertMaterial({ color: 0xd8dce2 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x16242f });
const windshieldMat = new THREE.MeshLambertMaterial({ color: 0x8fc8e8 }); // sky reflection in the glass
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const barRedMat = new THREE.MeshBasicMaterial({ color: 0xff2030 });
const barBlueMat = new THREE.MeshBasicMaterial({ color: 0x2080ff });

let pbpdTexture = null;
function getPbpdTexture() {
  if (pbpdTexture) return pbpdTexture;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.font = '900 44px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#1848c8';
  g.fillText('PBPD', 128, 34);
  pbpdTexture = new THREE.CanvasTexture(c);
  pbpdTexture.colorSpace = THREE.SRGBColorSpace;
  return pbpdTexture;
}

function buildCarMesh(carDef, opts = {}) {
  const S = opts.police ? SHAPES.SEDAN : (SHAPES[carDef.kind.split(' · ')[0]] || SHAPES.SEDAN);
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: opts.police ? 0xf0f0f0 : carDef.colors[opts.colorIndex || 0] });
  // One scaled unit box per body part. sh = casts shadow.
  const box = (w, h, l, mat, x, y, z, rx = 0, sh = 0) => {
    const m = new THREE.Mesh(unitBox, mat);
    m.scale.set(w, h, l);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (sh) m.castShadow = true;
    g.add(m);
    return m;
  };
  const top = S.y + S.h / 2; // body top
  const cabY = top + S.ch / 2; // cabin centre
  const hl = S.l / 2; // half length
  if (carDef.kind === 'SCOOTER') {
    // Scooter: deck, shield, seat, handlebar, two small wheels. It drives
    // like a car (same makeVehicle/driveVehicle).
    box(0.5, 0.14, 1.5, paint, 0, 0.38, 0); // deck
    box(0.55, 0.5, 0.35, paint, 0, 0.72, 0.55, -0.3); // front shield
    box(0.5, 0.12, 0.65, wheelMat, 0, 0.78, -0.45); // seat
    box(0.08, 0.75, 0.08, wheelMat, 0, 0.75, 0.62); // steering column
    box(0.7, 0.07, 0.07, wheelMat, 0, 1.12, 0.62); // handlebar
    box(0.2, 0.14, 0.06, headMat, 0, 0.62, 0.78); // headlight
    for (const z of [0.62, -0.62]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.scale.set(0.67, 1, 0.67);
      w.position.set(0, 0.28, z);
      g.add(w);
    }
    return g;
  }
  box(S.w, S.h, S.l, paint, 0, S.y, 0, 0, 1); // body
  box(S.w * 0.92, 0.14, 1.1, paint, 0, top + 0.02, hl - 0.55, -0.22); // sloped hood
  box(S.w * 0.92, 0.14, 1.1, paint, 0, top + 0.02, -(hl - 0.55), 0.22); // sloped trunk
  box(S.w, S.ch, S.cl, opts.police ? paint : glassMat, 0, cabY, S.cz, 0, 1); // cabin
  if (S.curve) {
    // Curved fastback roof: a squashed sphere, lower half hidden in the cabin.
    const roof = new THREE.Mesh(roofGeo, paint);
    roof.scale.set(S.cw / 2, 0.25, S.cl / 2);
    roof.position.set(0, top + S.ch, S.cz);
    roof.castShadow = true;
    g.add(roof);
  } else {
    box(S.cw * 0.94, 0.1, S.cl * 0.94, paint, 0, top + S.ch + 0.05, S.cz); // flat roof
  }
  for (const s of [1, -1]) {
    const pane = new THREE.Mesh(glassGeo, windshieldMat);
    pane.scale.set(S.cw / 1.66, 1, 1);
    pane.position.set(0, cabY + 0.04, S.cz + s * (S.cl / 2 + 0.02));
    pane.rotation.x = -0.42 * s;
    g.add(pane);
  }
  box(S.w + 0.06, 0.2, 0.3, wheelMat, 0, 0.32, hl + 0.05);
  box(S.w + 0.06, 0.2, 0.3, wheelMat, 0, 0.32, -(hl + 0.05));
  for (const sx of [-1, 1]) box(0.1, 0.16, S.l - 1.4, wheelMat, sx * (S.w / 2 + 0.01), 0.3, 0);
  box(S.w - 0.7, 0.22, 0.06, wheelMat, 0, S.y - 0.05, hl + 0.02); // grille
  if (S.scoop) box(0.8, 0.14, 0.7, wheelMat, 0, top + 0.14, hl - 0.55); // hood scoop
  if (S.wing) {
    box(S.w - 0.2, 0.07, 0.55, wheelMat, 0, top + 0.5, -(hl - 0.45));
    for (const sx of [-1, 1]) box(0.08, 0.4, 0.08, wheelMat, sx * (S.w / 2 - 0.45), top + 0.3, -(hl - 0.45));
  }
  const ws = S.wr / 0.42;
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const wx = x * (S.w / 2 - 0.08), wz = z * (hl - 0.78);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.scale.set(ws, 1, ws);
    w.position.set(wx, S.wr, wz);
    g.add(w);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.scale.set(ws, 1, ws);
    rim.position.set(wx + x * 0.2, S.wr, wz);
    g.add(rim);
  }
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(x * (S.w / 2.05), top - 0.15, hl + 0.02);
    g.add(h);
  }
  box(S.w - 0.5, 0.14, 0.08, tailMat, 0, top - 0.12, -(hl + 0.02));
  if (opts.police) {
    box(S.w + 0.02, 0.3, S.l + 0.02, new THREE.MeshLambertMaterial({ color: 0x1848c8 }), 0, S.y, 0); // blue stripe
    const decalMat = new THREE.MeshBasicMaterial({ map: getPbpdTexture(), transparent: true });
    for (const side of [-1, 1]) {
      const decal = new THREE.Mesh(decalGeo, decalMat);
      decal.position.set(side * (S.w / 2 + 0.02), S.y, 0);
      decal.rotation.y = side * Math.PI / 2;
      g.add(decal);
    }
    box(1.8, 0.1, 0.5, wheelMat, 0, top + S.ch + 0.08, S.cz);
    const bar = new THREE.Group();
    const r = new THREE.Mesh(barGeo, barRedMat);
    r.position.x = -0.45;
    const b = new THREE.Mesh(barGeo, barBlueMat);
    b.position.x = 0.45;
    bar.add(r); bar.add(b);
    bar.position.set(0, top + S.ch + 0.2, S.cz);
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

// Arcade car step: throttle -1..1, steer -1..1. topMult raises the speed
// cap (nitro boost); everyone else calls it with the default 1.
export function driveVehicle(v, throttle, steerInput, dt, collide, topMult = 1) {
  const def = v.def;
  const up = v.upgrades || { engine: 0, armor: 0 };
  const top = def.top * (1 + up.engine * 0.12) * topMult;
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
  if (v.speed > top) v.speed = Math.max(top, v.speed - 20 * dt); // boost bleed-off, not a snap
  else v.speed = clamp(v.speed, -12, top);
  const spd = Math.abs(v.speed);
  const turn = steerInput * clamp(spd / 8, 0, 1) * 1.9 * (v.speed >= 0 ? 1 : -1);
  v.heading += turn * dt * def.grip;
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  if (collide) {
    const hit = collide(nx, nz, 1.7);
    if (hit.x !== nx || hit.z !== nz) {
      const impact = Math.abs(v.speed);
      if (impact > 6) damageVehicle(v, impact * 0.9);
      v.speed *= 0.35;
    }
    v.x = hit.x; v.z = hit.z;
  } else { v.x = nx; v.z = nz; }
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
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
