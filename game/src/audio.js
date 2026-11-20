// Sound effects, synthesized with WebAudio — engine hum, sirens, gunshots,
// explosions, UI blips. No audio files, nothing downloaded.

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  blip(freq, dur, type = 'square', gain = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, gain = 0.25, lowpass = 1200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shot(kind) {
    if (kind === 'harpoon') { this.noise(0.5, 0.4, 900); this.blip(70, 0.4, 'sine', 0.3); }
    else if (kind === 'mule') { this.noise(0.25, 0.35, 700); }
    else if (kind === 'melee') { this.blip(160, 0.08, 'sine', 0.2); }
    else { this.noise(0.12, 0.28, 2400); this.blip(900, 0.05, 'square', 0.06); }
  }

  explosion() { this.noise(0.9, 0.5, 500); this.blip(55, 0.7, 'sine', 0.35); }
  pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(880, 0.12), 70); }
  missionPass() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.16), i * 110)); }
  wantedUp() { this.blip(440, 0.15, 'sawtooth', 0.12); setTimeout(() => this.blip(330, 0.2, 'sawtooth', 0.12), 130); }
  uiClick() { this.blip(700, 0.05, 'square', 0.07); }

  setEngine(running, speedNorm) {
    if (!this.ctx) return;
    if (running && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineGain.gain.value = 0.03;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + speedNorm * 130;
      this.engineGain.gain.value = running ? 0.03 + speedNorm * 0.03 : 0;
    }
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this._sirenT = 0;
    }
    if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
    }
  }

  update(dt) {
    if (this.sirenOsc) {
      this._sirenT += dt;
      this.sirenOsc.frequency.value = 650 + Math.sin(this._sirenT * 4) * 250;
    }
  }
}
