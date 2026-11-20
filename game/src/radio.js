// Radio: three original stations of procedural music, synthesized live with
// WebAudio — bass, chords and a lead line per station, no audio files. The
// station name and song title are part of the HUD, like the top entries.

import { RADIO } from './config.js';
import { G } from './state.js';

export class Radio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  get station() { return RADIO[G.radioStation]; }

  start() {
    this.ensure();
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  setStation(i) {
    G.radioStation = ((i % RADIO.length) + RADIO.length) % RADIO.length;
    this.step = 0;
  }

  next() { this.setStation(G.radioStation + 1); }

  schedule() {
    if (!this.ctx || !this.playing || G.radioMuted) return;
    const st = this.station;
    const spb = 60 / st.bpm / 2; // eighth notes
    while (this.nextTime < this.ctx.currentTime + 0.3) {
      this.playStep(this.step, this.nextTime, st);
      this.nextTime += spb;
      this.step++;
    }
  }

  tone(freq, t, dur, type, gain) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  playStep(step, t, st) {
    const scale = st.scale;
    const bar = Math.floor(step / 8) % 4;
    const roots = [1, 0.891, 0.794, 1.122]; // chord roots per bar
    const root = st.root * roots[bar];
    // bass on beats
    if (step % 4 === 0) this.tone(root / 2, t, 0.4, 'triangle', 0.5);
    // chords
    if (step % 8 === 0 || step % 8 === 4) {
      this.tone(root, t, 0.5, 'sawtooth', 0.06);
      this.tone(root * 1.5, t, 0.5, 'sawtooth', 0.05);
    }
    // lead line (pentatonic wander)
    if (step % 2 === 0) {
      const idx = [0, 1, 2, 1, 3, 2, 4, 3][Math.floor(step / 2) % 8];
      const semi = scale[idx % scale.length] + 12 * Math.floor(idx / scale.length);
      this.tone(root * Math.pow(2, semi / 12), t, 0.32, 'square', 0.07);
    }
    // hat
    if (step % 2 === 1) this.tone(6000, t, 0.04, 'square', 0.02);
  }
}
