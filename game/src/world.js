// The city of Paloma Bay: a golden-hour coastal grid built procedurally
// from boxes, cylinders and canvas textures. No external assets.

import * as THREE from 'three';
import { BLOCK, ROAD, PITCH, GRID, STREETS, CITY_EDGE, BEACH_X, OCEAN_X, WORLD_EDGE } from './config.js';
import { range, pick } from './random.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture(base, lit, v = 0) {
  // Three window patterns so facades don't repeat one grid.
  const step = [22, 26, 18][v], ww = [12, 16, 10][v], wh = [14, 10, 18][v], lr = [0.55, 0.4, 0.7][v];
  const mapC = document.createElement('canvas');
  mapC.width = 128; mapC.height = 256;
  const emC = document.createElement('canvas');
  emC.width = 128; emC.height = 256;
  const g = mapC.getContext('2d');
  const e = emC.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  e.fillStyle = '#000000'; e.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 256 - 12; y += step) {
    for (let x = 10; x < 128 - 10; x += 20) {
      const on = Math.random() < lr;
      g.fillStyle = on ? lit : 'rgba(20,26,40,0.85)';
      g.fillRect(x, y, ww, wh);
      if (on) { e.fillStyle = lit; e.fillRect(x, y, ww, wh); }
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 256 - 10, 128, 10);
  const map = new THREE.CanvasTexture(mapC);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emC);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

function sidewalkTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#c4b8a0'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 120; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.strokeStyle = 'rgba(90,80,60,0.55)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke();
      g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
    }
  });
}

function glowTexture(inner, outer) {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

// Sun directions (unit-ish vectors, scaled to ~980 m for the sprites).
const DUSK_SUN_DIR = new THREE.Vector3(-0.96, 0.24, -0.16);
const NOON_SUN_DIR = new THREE.Vector3(-0.45, 0.8, -0.2);

// One grade per phase of the day — sun, sky, fog, light, window glow and
const PHASES = {
  night: { sun: 0x8a9ac8, si: 0.5, sp: [120, 160, 60], top: 0x0e1430, mid: 0x1a2448, hor: 0x2a3358, fog: 0x1a2438, hc: 0x8a9ac8, hg: 0x3a3a48, hi: 0.35, em: 1.15, dir: null },
  dusk: { sun: 0xff9040, si: 2.6, sp: [-220, 55, -40], top: 0x5a3578, mid: 0xd06090, hor: 0xff9a4d, fog: 0xeab0a8, hc: 0xffc8b8, hg: 0x7a5a48, hi: 1.2, em: 0.9, dir: DUSK_SUN_DIR },
  day: { sun: 0xfff2d8, si: 3.0, sp: [-120, 220, -60], top: 0x4a90d9, mid: 0x8fc4e8, hor: 0xd8ecf5, fog: 0xb8d4e4, hc: 0xc8dcff, hg: 0x8a7a5a, hi: 1.2, em: 0.15, dir: NOON_SUN_DIR },
};

function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#453e44'; g.fillRect(0, 0, w, h); // warm asphalt, not cold grey
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 200; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.fillStyle = '#e8c832';
    g.fillRect(w / 2 - 2, 8, 4, 40);
    g.fillRect(w / 2 - 2, 80, 4, 40);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
  });
}

function neonTexture(text, color) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#14101e'; g.fillRect(0, 0, w, h);
    g.font = 'bold 34px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18;
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 1);
  });
}

export class World {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = []; // {x0,z0,x1,z1}
    this.sun = null;
    this.hemi = null;
    this.ferris = null;
    this.neonMats = [];
    this.headlightCones = [];
    this.buildingMats = []; // building materials (emissive windows by phase)
    this.skyMat = null; // gradient sky-dome shader material
    this.sunCore = null; // sun disc sprite
    this.sunGlow = null; // sun halo sprite
    this.build();
  }

  addCollider(x0, z0, x1, z1) {
    this.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  build() {
    const { scene, rng } = this;
    const skyGeo = new THREE.SphereGeometry(1100, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x4a2a6e) },
        midColor: { value: new THREE.Color(0xc85a8a) },
        horizonColor: { value: new THREE.Color(0xff9a4d) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        varying vec3 vDir;
        void main() {
          // Stretched so the deep top colour only arrives high overhead.
          float t = clamp((vDir.y - 0.02) * 1.25, 0.0, 1.0);
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.45, t));
          col = mix(col, topColor, smoothstep(0.42, 1.0, t));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(skyGeo, this.skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -2;
    scene.add(sky);
    const sunTex = glowTexture('rgba(255,244,200,1)', 'rgba(255,180,80,0)');
    this.sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, transparent: true, depthWrite: false, fog: false,
    }));
    this.sunCore.scale.set(130, 130, 1);
    this.sunCore.frustumCulled = false;
    scene.add(this.sunCore);
    const haloTex = glowTexture('rgba(255,150,70,0.55)', 'rgba(255,120,60,0)');
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, transparent: true, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, opacity: 0.85,
    }));
    this.sunGlow.scale.set(460, 460, 1);
    this.sunGlow.frustumCulled = false;
    scene.add(this.sunGlow);
    // White clouds: soft billboard puffs, day phase only — a bright
    // midday sky needs them to read as a tropical postcard, not a void.
    const cloudTex = glowTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
    this.clouds = [];
    for (const [cx, cy, cz, s] of [[300, 340, 520, 330], [520, 300, 180, 270], [120, 380, 680, 300], [-260, 330, 580, 290], [640, 360, -120, 320], [500, 130, -60, 260]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9,
      }));
      sp.position.set(cx, cy, cz);
      sp.scale.set(s, s * 0.42, 1);
      sp.frustumCulled = false;
      scene.add(sp);
      this.clouds.push(sp);
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_EDGE * 2, WORLD_EDGE * 2),
      new THREE.MeshLambertMaterial({ color: 0x9aa08a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(OCEAN_X - BEACH_X + 40, WORLD_EDGE * 2),
      new THREE.MeshLambertMaterial({ color: 0xe8d9a8 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set((BEACH_X + OCEAN_X) / 2, 0.05, 0);
    sand.receiveShadow = true;
    scene.add(sand);

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(400, WORLD_EDGE * 2),
      new THREE.MeshLambertMaterial({ color: 0x2a7a9e, transparent: true, opacity: 0.92 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(OCEAN_X + 200, 0.02, 0);
    scene.add(ocean);

    const roadTex = roadTexture();
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const walkTex = sidewalkTexture();
    walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;
    walkTex.repeat.set(1, 24);
    const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
    const roadLen = CITY_EDGE * 2 + ROAD;
    for (const s of STREETS) {
      for (const [w, l, x, z, rot] of [
        [ROAD, roadLen, s, 0, 0], [ROAD, roadLen, 0, s, Math.PI / 2],
        [ROAD + 6, roadLen, s, 0, 0], [ROAD + 6, roadLen, 0, s, Math.PI / 2],
      ]) {
        const isWalk = w > ROAD;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), isWalk ? walkMat : roadMat);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = rot;
        m.position.set(x, isWalk ? 0.08 : 0.12, z);
        m.receiveShadow = true;
        scene.add(m);
      }
    }
    const blvd = new THREE.Mesh(new THREE.PlaneGeometry(16, roadLen), roadMat);
    blvd.rotation.x = -Math.PI / 2;
    blvd.position.set(196, 0.12, 0);
    blvd.receiveShadow = true;
    scene.add(blvd);

    const palettes = [
      ['#f2d8c8', '#ffcf7a'], ['#e8c8d8', '#ffe9a8'], ['#d8c8e8', '#ffcf7a'],
      ['#f0e0b8', '#ffd489'], ['#e8c8b0', '#ffe9a8'], ['#d8b8c8', '#ffcf7a'],
      ['#c8d4e8', '#fff0b0'], ['#e0d0c0', '#ffd489'],
      ['#e8d8e0', '#ffd489'], ['#c8e0d8', '#ffe9a8'],
    ];
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a6a72 });
    for (let ix = 0; ix < GRID - 1; ix++) {
      for (let iz = 0; iz < GRID - 1; iz++) {
        const cx = STREETS[ix] + PITCH / 2;
        const cz = STREETS[iz] + PITCH / 2;
        if (cx > 168) continue; // boulevard strip stays open
        if (rng() < 0.14) { this.plaza(cx, cz, rng); continue; } // park / plaza
        const n = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          const w = range(rng, 12, 22), d = range(rng, 12, 22);
          const h = range(rng, 9, ix + iz > 8 ? 46 : 26);
          const ox = range(rng, -9, 9), oz = range(rng, -9, 9);
          const [base, lit] = pick(rng, palettes);
          const tex = windowTexture(base, lit, Math.floor(rng() * 3));
          const mat = new THREE.MeshLambertMaterial({
            map: tex.map, emissiveMap: tex.emissiveMap,
            emissive: 0xffffff, emissiveIntensity: 0.15,
          });
          this.buildingMats.push(mat);
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(cx + ox, h / 2, cz + oz);
          b.castShadow = true; b.receiveShadow = true;
          scene.add(b);
          const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.8, d * 0.9), roofMat);
          roof.position.set(cx + ox, h + 0.4, cz + oz);
          scene.add(roof);
          if (rng() < 0.4) {
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.4, 8),
              new THREE.MeshLambertMaterial({ color: 0x8a7a5a }));
            tank.position.set(cx + ox + w * 0.25, h + 2.4, cz + oz);
            tank.castShadow = true;
            scene.add(tank);
          }
          if (rng() < 0.5) { // rooftop AC unit
            const ac = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.6), roofMat);
            ac.position.set(cx + ox - w * 0.25, h + 1.3, cz + oz + d * 0.2);
            scene.add(ac);
          }
          if (rng() < 0.3) { // rooftop antenna
            const an = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 5), roofMat);
            an.position.set(cx + ox + w * 0.3, h + 3.8, cz + oz - d * 0.25);
            scene.add(an);
          }
          this.addCollider(cx + ox - w / 2, cz + oz - d / 2, cx + ox + w / 2, cz + oz + d / 2);
        }
      }
    }

    const signs = [
      { text: 'CASINO', color: '#ff4dd8', x: 150, z: -112, y: 14 },
      { text: 'HOTEL', color: '#4dd8ff', x: -84, z: 28, y: 18 },
      { text: 'DINER', color: '#ffd24d', x: 28, z: 140, y: 10 },
      { text: 'PALOMA BAY', color: '#7dff9a', x: 196, z: -196, y: 12 },
    ];
    for (const s of signs) {
      const mat = new THREE.MeshBasicMaterial({ map: neonTexture(s.text, s.color), transparent: true, side: THREE.DoubleSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), mat);
      sign.position.set(s.x, s.y, s.z);
      sign.rotation.y = s.x > 100 ? -Math.PI / 2 : 0;
      this.neonMats.push(mat);
      scene.add(sign);
    }
    // Low neon billboards on the beach side, at 4 m: below the palm canopy
    // and above the beach furniture, so they read 50-100 m ahead.
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2e38 });
    for (const s of [
      { text: 'CORAL CLUB', color: '#ff4dd8', z: -20 },
      { text: 'PIER 9', color: '#4dd8ff', z: -64 },
    ]) {
      const mat = new THREE.MeshBasicMaterial({ map: neonTexture(s.text, s.color), transparent: true, side: THREE.DoubleSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), mat);
      sign.position.set(209, 4.0, s.z);
      sign.rotation.y = -Math.PI / 2; // faces west, toward the boulevard
      this.neonMats.push(mat);
      scene.add(sign);
      for (const dz of [-5.4, 5.4]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.0, 6), postMat);
        post.position.set(209, 2.0, s.z + dz);
        scene.add(post);
      }
    }

    const palmSpots = [];
    for (let z = -224; z <= 224; z += 16) {
      palmSpots.push([186, z + range(rng, -3, 3)]);
      palmSpots.push([206, z + range(rng, -3, 3)]);
      if (z % 32 === 0) palmSpots.push([BEACH_X + 14, z + range(rng, -6, 6)]);
    }
    for (let i = 0; i < 40; i++) {
      palmSpots.push([range(rng, -220, 160), pick(rng, STREETS) + range(rng, -4, 4)]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.45, 0.68, 8, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
    const frondGeo = new THREE.BoxGeometry(1.1, 0.12, 6.4);
    frondGeo.translate(0, 0, 2.8);
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x35b95c });
    const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 10);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3(1, 1, 1);
    palmSpots.forEach(([x, z], i) => {
      const th = range(rng, 0.9, 1.2); // varied palm heights
      const lean = range(rng, -0.18, 0.18);
      e.set(lean, range(rng, 0, Math.PI * 2), 0); q.setFromEuler(e);
      m4.compose(v.set(x, 4 * th, z), q, sc.set(1, th, 1));
      trunks.setMatrixAt(i, m4);
      for (let f = 0; f < 10; f++) {
        e.set(-0.4 - (f % 2) * 0.25 + range(rng, -0.15, 0.15), (f / 10) * Math.PI * 2, 0);
        q.setFromEuler(e);
        m4.compose(v.set(x, 8 * th, z), q, sc.set(1, 1, 1));
        fronds.setMatrixAt(i * 10 + f, m4);
      }
    });
    trunks.castShadow = true;
    scene.add(trunks); scene.add(fronds);

    const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 7, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f48 });
    const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, 40);
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 40);
    for (let i = 0; i < 40; i++) {
      const z = -224 + i * 11.5;
      const x = i % 2 === 0 ? 186 : 206;
      m4.compose(v.set(x, 3.5, z), q.identity(), sc);
      poles.setMatrixAt(i, m4);
      m4.compose(v.set(x, 7.2, z), q.identity(), sc);
      lamps.setMatrixAt(i, m4);
    }
    scene.add(poles); scene.add(lamps);

    const benchWood = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
    const benchIron = new THREE.MeshLambertMaterial({ color: 0x3a3f48 });
    const planterMat = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x4a9e4a });
    for (let z = -196; z <= 196; z += 21) {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.6), benchWood);
      seat.position.y = 0.5;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.1), benchWood);
      back.position.set(0, 0.85, 0.28);
      bench.add(seat, back);
      for (const dx of [-0.85, 0.85]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.55), benchIron);
        leg.position.set(dx, 0.25, 0);
        bench.add(leg);
      }
      bench.position.set(207, 0, z + range(rng, -3, 3));
      bench.rotation.y = Math.PI / 2; // faces west, toward the road
      bench.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(bench);
      const planter = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.3), planterMat);
      box.position.y = 0.4;
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.85, 7, 6), bushMat);
      bush.position.y = 1.2;
      bush.castShadow = true;
      planter.add(box, bush);
      planter.position.set(185, 0, z + 14 + range(rng, -3, 3));
      scene.add(planter);
    }

    const umbPole = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 5);
    const umbMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    const canopyGeo = new THREE.ConeGeometry(2.4, 1.1, 8);
    const canopyCols = [0xff6a6a, 0x4dc8ff, 0xffd24d, 0x7ae08a, 0xff8ad8];
    for (let i = 0; i < 26; i++) {
      const x = BEACH_X + 8 + rng() * 60;
      const z = -220 + rng() * 440;
      const pole = new THREE.Mesh(umbPole, umbMat);
      pole.position.set(x, 1.3, z);
      scene.add(pole);
      const canopy = new THREE.Mesh(canopyGeo,
        new THREE.MeshLambertMaterial({ color: pick(rng, canopyCols) }));
      canopy.position.set(x, 2.9, z);
      canopy.castShadow = true;
      scene.add(canopy);
    }
    const pier = new THREE.Mesh(new THREE.BoxGeometry(90, 1.2, 10),
      new THREE.MeshLambertMaterial({ color: 0x9a7a52 }));
    pier.position.set(BEACH_X + 45, 0.8, 120);
    pier.castShadow = true;
    scene.add(pier);

    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.8, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0xff5a7a }));
    wheel.add(rim);
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 32, 5),
        new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
      spoke.rotation.z = (i / 8) * Math.PI;
      wheel.add(spoke);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2),
        new THREE.MeshLambertMaterial({ color: pick(rng, canopyCols) }));
      const a = (i / 8) * Math.PI * 2;
      cab.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
      wheel.add(cab);
    }
    const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 20, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a8a92 }));
    legA.position.set(-6, -10, 0); legA.rotation.z = 0.3;
    const legB = legA.clone(); legB.position.x = 6; legB.rotation.z = -0.3;
    wheel.add(legA); wheel.add(legB);
    wheel.position.set(228, 20, -160);
    wheel.rotation.y = Math.PI / 2;
    scene.add(wheel);
    this.ferris = wheel;

    this.sun = new THREE.DirectionalLight(0xffa050, 2.4);
    this.sun.position.set(-220, 55, -40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 600;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffc8b8, 0x7a5a48, 0.9);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xeab0a8, 260, 900); // lavender-pink haze
    scene.background = new THREE.Color(0xf7c489); // fallback behind the dome
  }

  plaza(cx, cz, rng) {
    const { scene } = this;
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 4, BLOCK - 4),
      new THREE.MeshLambertMaterial({ color: 0x7aa85a }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(cx, 0.1, cz);
    grass.receiveShadow = true;
    scene.add(grass);
    for (let i = 0; i < 5; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 4, 6),
        new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
      trunk.position.y = 2;
      const top = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 2.4, 3.6), 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x4a9e4a }));
      top.position.y = 5.5;
      top.scale.set(1.4, 0.7, 1.4); // squash: a spreading canopy, not a lollipop
      top.castShadow = true;
      const t2 = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 1.3, 1.9), 7, 6), top.material);
      t2.position.set(range(rng, -1.8, 1.8), 6.6, range(rng, -1.8, 1.8));
      tree.add(trunk, top, t2);
      tree.position.set(cx + range(rng, -16, 16), 0, cz + range(rng, -16, 16));
      scene.add(tree);
    }
  }

  nearestStreetCoord(v) {
    let best = STREETS[0];
    for (const s of STREETS) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
    return best;
  }

  // Push a circle (x, z, radius) out of buildings and the world bounds.
  collide(x, z, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          x = c.x1 + r; // centre inside: push out east
        }
      }
    }
    x = Math.max(-WORLD_EDGE + 4, Math.min(WORLD_EDGE + 60, x));
    z = Math.max(-WORLD_EDGE + 4, Math.min(WORLD_EDGE + 4, z));
    return { x, z };
  }

  randomRoadPoint(rng) {
    const s = pick(rng, STREETS);
    const along = range(rng, -220, 220);
    if (rng() < 0.5) return { x: s, z: along, heading: rng() < 0.5 ? 0 : Math.PI };
    return { x: along, z: s, heading: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }

  update(dt, clockHours) {
    if (this.ferris) this.ferris.rotation.z += dt * 0.05;
    const dusk = clockHours >= 16.5 && clockHours < 19.5;
    const night = clockHours >= 19.5 || clockHours < 6;
    const sun = this.sun;
    const sky = this.skyMat.uniforms;
    const p = PHASES[night ? 'night' : dusk ? 'dusk' : 'day'];
    sun.color.set(p.sun); sun.intensity = p.si;
    sun.position.set(...p.sp);
    sky.topColor.value.set(p.top);
    sky.midColor.value.set(p.mid);
    sky.horizonColor.value.set(p.hor);
    this.scene.fog.color.set(p.fog);
    this.hemi.color.set(p.hc); this.hemi.groundColor.set(p.hg);
    this.hemi.intensity = p.hi;
    const show = p.dir !== null;
    this.sunCore.visible = show;
    this.sunGlow.visible = show;
    this.sunGlow.material.opacity = dusk ? 0.85 : 0.35; // faint glare at noon
    for (const c of this.clouds) c.visible = !night && !dusk;
    if (show) {
      this.sunCore.position.copy(p.dir).multiplyScalar(980);
      this.sunGlow.position.copy(p.dir).multiplyScalar(975);
    }
    for (const m of this.buildingMats) m.emissiveIntensity = p.em;
  }
}
