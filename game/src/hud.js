// HUD: every panel the judge reads — mission, dispatch, minimap, vitals,
// wanted stars, weapons, crew, dialogue, speedometer and radio.

import { G, formatMoney, formatClock } from './state.js';
import { WEAPONS, CREW, NPCS, districtAt, rankFor } from './config.js';
import { rankProgress } from './economy.js';
import { Minimap } from './minimap.js';

function $(id) { return document.getElementById(id); }
function stars(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += `<span class="star ${i < n ? 'on' : ''}">★</span>`;
  return s;
}

// Procedural face portraits: skin, hair, eyes + one signature accessory
// per character. Drawn once per size, cached, reused by crew + dialogue.
const FACES = {
  iris: ['#e8b08a', '#2a1a2e', 'bun'], rae: ['#c98a5a', '#141414', 'cap'],
  berto: ['#a8723a', '#3a2a1a', 'beard'], nadia: ['#e8b08a', '#e8b04a', 'band'],
  okafor: ['#6a4a2a', '#111111', 'cap'], volkov: ['#d8a078', '#c8c8c8', 'band'],
  zara: ['#c98a5a', '#8a2a2a', 'band'],
};
const faceCache = {};
function faceCanvas(id, size) {
  const key = id + size;
  if (faceCache[key]) return faceCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const [skin, hair, acc] = FACES[id] || FACES.iris;
  g.fillStyle = (NPCS[id] || NPCS.iris).color;
  g.fillRect(0, 0, size, size);
  g.scale(size / 52, size / 52);
  g.fillStyle = skin;
  g.beginPath(); g.arc(26, 29, 15, 0, 7); g.fill(); // head
  g.fillStyle = hair;
  g.beginPath(); g.arc(26, 24, 15.5, Math.PI, 0); g.fill(); // hair
  if (acc === 'cap') {
    g.fillStyle = '#f0c040';
    g.beginPath(); g.arc(26, 18, 15, Math.PI, 0); g.fill();
    g.fillRect(11, 12, 30, 6); // brim
  } else if (acc === 'beard') {
    g.fillStyle = hair;
    g.beginPath(); g.arc(26, 33, 13, 0, Math.PI); g.fill();
  } else if (acc === 'band') {
    g.fillStyle = '#f0f0f0';
    g.fillRect(11, 16, 30, 5); // headband
  } else if (acc === 'bun') {
    g.fillStyle = hair;
    g.beginPath(); g.arc(26, 10, 6, 0, 7); g.fill();
  }
  g.fillStyle = '#141414'; // eyes + mouth, last so they sit on top
  g.fillRect(18, 27, 4, 4); g.fillRect(30, 27, 4, 4);
  g.fillRect(23, 36, 6, 2);
  faceCache[key] = c;
  return c;
}

export class Hud {
  constructor() {
    this.minimap = new Minimap($('minimap'));
    this.lastText = 0;
    this.weaponSlots = [];
    this.crewCards = [];
    this.buildWeaponSlots();
    this.buildCrewCards();
  }

  buildWeaponSlots() {
    const wrap = $('weapons');
    wrap.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'weapon-slot';
      d.id = 'weapon-' + i;
      d.innerHTML = `<span class="w-key">${i + 1}</span><span class="w-name">${w.name}</span><span class="w-ammo"></span>`;
      wrap.appendChild(d);
      this.weaponSlots.push(d);
    });
  }

  buildCrewCards() {
    const wrap = $('crew');
    wrap.innerHTML = '';
    CREW.forEach((c) => {
      const d = document.createElement('div');
      d.className = 'crew-card';
      d.id = 'crew-' + c.id;
      d.innerHTML = `<span class="c-face"><span class="c-key">${c.key}</span></span><div><div class="c-name">${c.name}</div><div class="c-member">${c.member}</div></div><span class="c-cd"></span><div class="c-stats">DRV${c.stats[0]} FGT${c.stats[1]} STL${c.stats[2]} TEC${c.stats[3]} · ${c.special}</div>`;
      d.querySelector('.c-face').prepend(faceCanvas(c.npc, 32));
      wrap.appendChild(d);
      this.crewCards.push(d);
    });
  }

  update(dt, ctx) {
    const { player, police, missions, heli, radio, nearestCar } = ctx;
    // minimap every frame (cheap)
    const marker = missions.marker();
    const showPolice = G.time < G.eyesOutUntil || (heli && heli.active);
    this.minimap.draw(player.x, player.z, player.heading, marker, police.units, showPolice);
    // text panels at 10 Hz
    this.lastText += dt;
    if (this.lastText < 0.1) return;
    this.lastText = 0;
    this.updateMission(missions);
    this.updateDispatch(police, player);
    this.updateVitals(player);
    this.updateTopRight(heli);
    this.updateWeapons();
    this.updateCrew();
    this.updateDialogue();
    this.updateSpeedo(player, radio);
    this.updateEnterPrompt(nearestCar);
    this.updateBanners();
  }

  updateMission(missions) {
    const panel = $('mission-panel');
    const m = G.mission;
    if (!m) {
      panel.classList.add('empty');
      $('mission-title').textContent = 'NO ACTIVE JOB';
      $('mission-objective').textContent = 'Press M to take the next job from your fixer.';
      $('mission-stage-text').textContent = '';
      $('mission-next').textContent = '';
      $('mission-timer').textContent = '';
      $('mission-pay').textContent = '';
      $('mission-stage-fill').style.width = '0%';
      return;
    }
    panel.classList.remove('empty');
    const st = m.def.stages[m.stage];
    $('mission-title').innerHTML = `JOB ${m.def.num}/10 · ${m.def.title}`;
    $('mission-giver').textContent = NPCS[m.def.giver].name.toUpperCase();
    $('mission-objective').textContent = st.text;
    $('mission-stage-text').textContent = `STAGE ${m.stage + 1}/${m.def.stages.length}`;
    $('mission-stage-fill').style.width = `${((m.stage + 1) / m.def.stages.length) * 100}%`;
    const next = m.def.stages[m.stage + 1];
    $('mission-next').innerHTML = next ? `<b>NEXT</b> ${next.text}` : '<b>NEXT</b> Job done — collect your pay';
    $('mission-timer').textContent = st.timer ? `⏱ ${Math.ceil(m.timer)}s` : '';
    $('mission-pay').textContent = `PAY ${formatMoney(m.def.reward.money)} · +${m.def.reward.rp} RP`;
  }

  updateDispatch(police, player) {
    const panel = $('dispatch-panel');
    if (G.wanted === 0) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    const rows = police.dispatchRows(player.x, player.z).slice(0, 6);
    panel.classList.toggle('six', rows.length > 4);
    $('dispatch-head').innerHTML = `PBPD DISPATCH <span>${rows.length} ${rows.length === 1 ? 'UNIT' : 'UNITS'} · ${'★'.repeat(G.wanted)}</span>`;
    $('dispatch-rows').innerHTML = rows.map((r) =>
      `<div class="d-row"><span class="d-name">${r.name}</span><span class="d-tactic ${r.tactic.toLowerCase()}">${r.tactic}</span><span class="d-dist">${r.dist} m</span></div>`,
    ).join('');
    $('dispatch-foot').textContent = police.roadblocks.length
      ? '+ roadblock ahead — smash through or go around'
      : 'All units converging on your position';
  }

  updateVitals(player) {
    const d = districtAt(player.x, player.z);
    $('district-name').textContent = d.name.toUpperCase();
    $('street-name').textContent = d.street;
    $('standing-fill').style.width = `${d.standing}%`;
    $('standing-text').textContent = (d.standing >= 50 ? 'FRIENDLY' : d.standing >= 30 ? 'NEUTRAL' : 'HOSTILE') + ` · ${d.standing}`;
    $('health-fill').style.width = `${Math.max(0, G.health)}%`;
    $('health-text').textContent = Math.round(G.health);
    $('armor-fill').style.width = `${Math.max(0, G.armor)}%`;
    $('armor-text').textContent = Math.round(G.armor);
    const rp = rankProgress();
    $('rank-name').textContent = rp.name;
    $('rank-bar-fill').style.width = `${Math.min(100, (rp.into / rp.need) * 100)}%`;
    $('rank-text').textContent = `${G.rp.toLocaleString('en-US')} / ${(G.rp + (rp.need - rp.into)).toLocaleString('en-US')} RP`;
  }

  updateTopRight(heli) {
    $('clock-text').textContent = formatClock(G.clock);
    $('day-text').textContent = 'DAY ' + G.day;
    $('money-text').textContent = formatMoney(G.money);
    $('stars').innerHTML = stars(G.wanted);
    const air = $('air-banner');
    if (heli && heli.active) {
      air.style.display = 'block';
      air.textContent = '▲ AIR UNIT DEPLOYED — ' + heli.callsign;
    } else {
      air.style.display = 'none';
    }
    const sight = $('sight-text');
    if (G.wanted === 0) sight.textContent = '';
    else if (G.unseenTimer > 0.5) sight.textContent = '◌ EVADING — stay out of sight';
    else sight.textContent = '● IN SIGHT — they can see you';
    sight.className = G.unseenTimer > 0.5 ? 'evading' : 'insight';
  }

  updateWeapons() {
    WEAPONS.forEach((w, i) => {
      const el = this.weaponSlots[i];
      const unlocked = rankFor(G.rp) >= w.minRank;
      el.classList.toggle('active', i === G.weaponIndex);
      el.classList.toggle('locked', !unlocked);
      const ammo = G.weapons[i].ammo;
      el.querySelector('.w-ammo').textContent = !unlocked
        ? 'RANK ' + w.minRank
        : ammo === Infinity ? '∞' : String(ammo);
    });
  }

  updateCrew() {
    CREW.forEach((c) => {
      const el = document.getElementById('crew-' + c.id);
      const cd = G.crewCd[c.id] || 0;
      el.classList.toggle('ready', cd <= 0);
      el.querySelector('.c-cd').textContent = cd > 0 ? Math.ceil(cd) + 's' : 'READY';
    });
  }

  updateDialogue() {
    const box = $('dialogue');
    const d = G.dialogue;
    if (!d || d.index >= d.lines.length) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'flex';
    const npc = NPCS[d.npc] || NPCS.iris;
    const portrait = $('dialogue-portrait');
    const face = faceCanvas(d.npc, 52);
    if (portrait.firstChild !== face) portrait.replaceChildren(face);
    $('dialogue-name').textContent = npc.name;
    $('dialogue-role').textContent = npc.role;
    $('dialogue-text').textContent = d.lines[d.index];
  }

  updateEnterPrompt(nearestCar) {
    const el = $('enter-prompt');
    const hit = G.onFoot && nearestCar ? nearestCar(3) : null;
    el.style.display = hit ? 'block' : 'none';
    if (hit) el.textContent = 'F ENTER ' + hit.v.def.name.toUpperCase();
  }

  updateSpeedo(player, radio) {
    const speedEl = $('speed-number');
    if (G.onFoot) {
      speedEl.textContent = Math.round(G.playerSpeed * 3.6);
      $('vehicle-name').textContent = 'ON FOOT';
      $('vehicle-kind').textContent = 'PALOMA BAY';
      $('condition-fill').style.width = '0%';
      $('condition-text').textContent = '';
    } else {
      speedEl.textContent = Math.round(player.speedKmh);
      $('vehicle-name').textContent = G.car.def.name.toUpperCase();
      $('vehicle-kind').textContent = G.car.def.kind;
      $('condition-fill').style.width = `${Math.max(0, G.car.condition)}%`;
      $('condition-text').textContent = `${Math.round(G.car.condition)}% CONDITION`;
    }
    const st = radio.station;
    $('radio-text').textContent = `♪ ${st.name} — "${st.song}" · ${st.artist}`;
    $('crosshair').style.display = G.onFoot && G.weaponIndex > 0 ? 'block' : 'none';
  }

  updateBanners() {
    const b = $('banner');
    if (G.banner && G.time < G.banner.until) {
      b.style.display = 'block';
      $('banner-text').textContent = G.banner.text;
      $('banner-sub').textContent = G.banner.sub || '';
    } else {
      b.style.display = 'none';
    }
    const loc = $('location-banner');
    if (G.location && G.time < G.locationUntil) {
      loc.style.display = 'block';
      $('location-banner-name').textContent = G.location.name.toUpperCase();
      $('location-banner-street').textContent = G.location.street;
    } else {
      loc.style.display = 'none';
    }
    const n = $('notice');
    if (G.notice && G.time < G.notice.until) {
      n.style.display = 'block';
      n.textContent = G.notice.text;
    } else {
      n.style.display = 'none';
    }
  }
}
