// Roadblocks: the PBPD's answer to a fast car — three interceptors parked
// across the road ahead of the player. A roadblock unit holds its ground
// (tactic ROADBLOCK) until the heat drops or the player smashes through.

import { makeVehicle } from './vehicles.js';

// Place three police cars across the road 70 m ahead of (x, z) in the
// heading direction. Returns the block; the caller tracks and removes it.
export function spawnRoadblockVehicles(scene, carDef, x, z, heading, nameFn) {
  const fx = x + Math.sin(heading) * 70;
  const fz = z + Math.cos(heading) * 70;
  const meshes = [];
  for (const off of [-4, 0, 4]) {
    const v = makeVehicle(carDef, fx + Math.cos(heading) * off, fz - Math.sin(heading) * off,
      heading + Math.PI / 2, { police: true, unitName: nameFn(), tactic: 'ROADBLOCK' });
    v.speed = 0;
    scene.add(v.mesh);
    meshes.push(v);
  }
  return { x: fx, z: fz, heading, meshes };
}
