// Minimap: a 2D canvas under the HUD. Roads, beach and ocean in miniature,
// the player as a white arrow, the mission target as a gold diamond.

import { STREETS, BEACH_X, OCEAN_X } from './config.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
  }

  // World -> map coords (map covers -260..360 on x, -260..260 on z).
  toMap(x, z) {
    const s = this.size;
    const mx = ((x + 260) / 620) * s;
    const mz = ((z + 260) / 520) * s;
    return [mx, mz];
  }

  draw(playerX, playerZ, heading, marker, policeUnits, showPolice) {
    const g = this.ctx;
    const s = this.size;
    g.clearRect(0, 0, s, s);
    // ocean + sand + city base, saturated so the map reads at a glance.
    g.fillStyle = '#22708c';
    g.fillRect(0, 0, s, s);
    const [bx] = this.toMap(BEACH_X, 0);
    const [ox] = this.toMap(OCEAN_X, 0);
    g.fillStyle = '#e8d9a8';
    g.fillRect(bx, 0, ox - bx, s);
    g.fillStyle = '#40485c';
    g.fillRect(0, 0, bx, s);
    // blocks
    g.fillStyle = '#5d6678';
    for (let ix = 0; ix < 8; ix++) {
      for (let iz = 0; iz < 8; iz++) {
        const [x0, z0] = this.toMap(STREETS[ix] + 8, STREETS[iz] + 8);
        const [x1, z1] = this.toMap(STREETS[ix + 1] - 8, STREETS[iz + 1] - 8);
        g.fillRect(x0, z0, x1 - x0, z1 - z0);
      }
    }
    // roads
    g.strokeStyle = '#d8d4c8';
    g.lineWidth = 2.5;
    for (const st of STREETS) {
      const [x] = this.toMap(st, 0);
      const [, z] = this.toMap(0, st);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke();
      g.beginPath(); g.moveTo(0, z); g.lineTo(s, z); g.stroke();
    }
    // boulevard
    const [blx] = this.toMap(196, 0);
    g.strokeStyle = '#e8c832';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(blx, 0); g.lineTo(blx, s); g.stroke();
    // mission marker
    if (marker) {
      const [mx, mz] = this.toMap(marker.x, marker.z);
      const pulse = 6 + Math.sin(performance.now() / 250) * 1.5;
      g.fillStyle = '#ffd24d';
      g.save();
      g.translate(mx, mz);
      g.rotate(Math.PI / 4);
      g.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      g.restore();
      // route line from player to marker
      const [px, pz] = this.toMap(playerX, playerZ);
      g.strokeStyle = 'rgba(255,210,77,0.85)';
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.beginPath(); g.moveTo(px, pz); g.lineTo(mx, mz); g.stroke();
      g.setLineDash([]);
    }
    // police dots (Eyes Out or heli spotlight)
    if (showPolice) {
      g.fillStyle = '#4da8ff';
      for (const u of policeUnits) {
        const [ux, uz] = this.toMap(u.x, u.z);
        g.beginPath(); g.arc(ux, uz, 3.5, 0, Math.PI * 2); g.fill();
      }
    }
    // player arrow
    const [px, pz] = this.toMap(playerX, playerZ);
    g.save();
    g.translate(px, pz);
    g.rotate(heading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111111';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8);
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
    // north tick
    g.fillStyle = '#ffffff';
    g.font = 'bold 13px Arial';
    g.textAlign = 'center';
    g.fillText('N', s / 2, 15);
  }
}
