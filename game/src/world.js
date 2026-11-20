// The city of Paloma Bay: a golden-hour coastal grid built procedurally from
// boxes, cylinders and canvas textures. No external assets — every texture is
// drawn on a canvas at runtime. Exports the colliders and road helpers the
// driving, traffic and police systems use.

import * as THREE from 'three';
import { BLOCK, ROAD, PITCH, GRID, STREETS, CITY_EDGE, BEACH_X, OCEAN_X, WORLD_EDGE, DISTRICTS } from './config.js';
import { range, pick } from './random.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 12; y += 22) {
      for (let x = 10; x < w - 10; x += 20) {
        const on = Math.random() < 0.45;
        g.fillStyle = on ? lit : 'rgba(20,26,40,0.85)';
        g.fillRect(x, y, 12, 14);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 10, w, 10);
  });
}

function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#33363d'; g.fillRect(0, 0, w, h);
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
    this.build();
  }

  addCollider(x0, z0, x1, z1) {
    this.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  build() {
    const { scene, rng } = this;
    // ---- ground: city slab, sand, ocean ----
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

    // ---- roads (asphalt strips with dashes) + sidewalks ----
    const roadTex = roadTexture();
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const walkMat = new THREE.MeshLambertMaterial({ color: 0xb8b4a4 });
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
    // beach boulevard (wider, palm-lined)
    const blvd = new THREE.Mesh(new THREE.PlaneGeometry(16, roadLen), roadMat);
    blvd.rotation.x = -Math.PI / 2;
    blvd.position.set(196, 0.12, 0);
    blvd.receiveShadow = true;
    scene.add(blvd);

    // ---- buildings ----
    const palettes = [
      ['#e8dcc8', '#ffd489'], ['#d8c8b8', '#ffe9a8'], ['#c8d4dc', '#fff0b0'],
      ['#e8c8b0', '#ffd489'], ['#b8c8b8', '#ffe9a8'], ['#d8b8c8', '#ffd489'],
      ['#c8c0d8', '#fff0b0'], ['#e0d0a8', '#ffd489'],
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
          const mat = new THREE.MeshLambertMaterial({ map: windowTexture(base, lit) });
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
          this.addCollider(cx + ox - w / 2, cz + oz - d / 2, cx + ox + w / 2, cz + oz + d / 2);
        }
      }
    }

    // ---- neon signs (downtown + strand) ----
    const signs = [
      { text: 'CASINO', color: '#ff4dd8', x: 150, z: -112, y: 14 },
      { text: 'HOTEL', color: '#4dd8ff', x: -84, z: 28, y: 18 },
      { text: 'DINER', color: '#ffd24d', x: 28, z: 140, y: 10 },
      { text: 'PALOMA BAY', color: '#7dff9a', x: 196, z: -196, y: 12 },
    ];
    for (const s of signs) {
      const mat = new THREE.MeshBasicMaterial({ map: neonTexture(s.text, s.color), transparent: true });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), mat);
      sign.position.set(s.x, s.y, s.z);
      sign.rotation.y = s.x > 100 ? -Math.PI / 2 : 0;
      this.neonMats.push(mat);
      scene.add(sign);
    }

    // ---- palms (instanced trunks + fronds) ----
    const palmSpots = [];
    for (let z = -224; z <= 224; z += 28) {
      palmSpots.push([186, z + range(rng, -4, 4)]);
      palmSpots.push([206, z + range(rng, -4, 4)]);
      palmSpots.push([BEACH_X + 14, z + range(rng, -6, 6)]);
    }
    for (let i = 0; i < 40; i++) {
      palmSpots.push([range(rng, -220, 160), pick(rng, STREETS) + range(rng, -4, 4)]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 8, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
    const frondGeo = new THREE.BoxGeometry(0.5, 0.15, 5.5);
    frondGeo.translate(0, 0, 2.4);
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4f });
    const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 6);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3(1, 1, 1);
    palmSpots.forEach(([x, z], i) => {
      const lean = range(rng, -0.12, 0.12);
      e.set(lean, range(rng, 0, Math.PI * 2), 0); q.setFromEuler(e);
      m4.compose(v.set(x, 4, z), q, sc);
      trunks.setMatrixAt(i, m4);
      for (let f = 0; f < 6; f++) {
        e.set(-0.5 + range(rng, -0.15, 0.15), (f / 6) * Math.PI * 2, 0);
        q.setFromEuler(e);
        m4.compose(v.set(x, 8, z), q, sc);
        fronds.setMatrixAt(i * 6 + f, m4);
      }
    });
    trunks.castShadow = true;
    scene.add(trunks); scene.add(fronds);

    // ---- streetlights along the boulevard ----
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 7, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f48 });
    const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, 32);
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, 32);
    for (let i = 0; i < 32; i++) {
      const z = -224 + i * 14.5;
      const x = i % 2 === 0 ? 186 : 206;
      m4.compose(v.set(x, 3.5, z), q.identity(), sc);
      poles.setMatrixAt(i, m4);
      m4.compose(v.set(x, 7.2, z), q.identity(), sc);
      lamps.setMatrixAt(i, m4);
    }
    scene.add(poles); scene.add(lamps);

    // ---- beach umbrellas + pier ----
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

    // ---- ferris wheel (landmark, slowly turns) ----
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

    // ---- lights: warm golden sun + sky fill ----
    this.sun = new THREE.DirectionalLight(0xffc890, 2.6);
    this.sun.position.set(-160, 140, -120);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 600;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 1.1);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xf2b27a, 260, 900);
    scene.background = new THREE.Color(0xf7c489);
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
      top.castShadow = true;
      tree.add(trunk); tree.add(top);
      tree.position.set(cx + range(rng, -16, 16), 0, cz + range(rng, -16, 16));
      scene.add(tree);
    }
  }

  // ---- queries used by driving / traffic / police ----
  isRoad(x, z) {
    if (Math.abs(x) > CITY_EDGE + 8 || Math.abs(z) > CITY_EDGE + 8) return false;
    if (Math.abs(x - 196) < 9) return true; // boulevard
    for (const s of STREETS) {
      if (Math.abs(x - s) < ROAD / 2 + 1) return true;
      if (Math.abs(z - s) < ROAD / 2 + 1) return true;
    }
    return false;
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

  // Sun + sky follow the in-game clock: golden hour by day, deep blue by night.
  update(dt, clockHours) {
    if (this.ferris) this.ferris.rotation.z += dt * 0.05;
    const day = clockHours > 6 && clockHours < 19.5;
    const dusk = clockHours >= 16.5 && clockHours < 19.5;
    const night = clockHours >= 19.5 || clockHours < 6;
    const sun = this.sun;
    if (night) {
      sun.color.set(0x8a9ac8); sun.intensity = 0.5;
      sun.position.set(120, 160, 60);
      this.scene.background.set(0x1a2438);
      this.scene.fog.color.set(0x1a2438);
      this.hemi.intensity = 0.35;
    } else if (dusk) {
      sun.color.set(0xffa050); sun.intensity = 2.4;
      sun.position.set(-200, 70, -80);
      this.scene.background.set(0xf7b47a);
      this.scene.fog.color.set(0xf2b27a);
      this.hemi.intensity = 0.9;
    } else {
      sun.color.set(0xfff0d0); sun.intensity = 2.8;
      sun.position.set(-120, 220, -60);
      this.scene.background.set(0x9fd0e8);
      this.scene.fog.color.set(0xa8c8d8);
      this.hemi.intensity = 1.2;
    }
    void day;
  }
}
