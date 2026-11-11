import { midiToFreq, mulberry32 } from './theory.js';

const PAD_TEXTURES = {
  warm: {
    oscs: [{ type: 'sawtooth', detune: -7 }, { type: 'sawtooth', detune: 7 }],
    sub: 0.30,
    filter: { type: 'lowpass', freq: 1250, q: 0.9 },
    shelf: { freq: 2800, gain: 3.0 },
    level: 0.30,
    lfo: { rate: 0.07, depth: 180 },
    vib: null,
    pan: 0.26,
  },
  glass: {
    oscs: [{ type: 'triangle', detune: 0 }, { type: 'sine', detune: 4, octave: 1 }, { type: 'sine', detune: -4, octave: 2 }],
    sub: 0.16,
    filter: { type: 'lowpass', freq: 3200, q: 0.45 },
    shelf: { freq: 5200, gain: 1.0 },
    level: 0.26,
    lfo: { rate: 0.05, depth: 220 },
    vib: null,
    pan: 0.30,
  },
  strings: {
    oscs: [{ type: 'sawtooth', detune: -11 }, { type: 'sawtooth', detune: 11 }],
    sub: 0.22,
    filter: { type: 'lowpass', freq: 1700, q: 0.7 },
    shelf: { freq: 3200, gain: 1.5 },
    level: 0.24,
    lfo: { rate: 0.09, depth: 260 },
    vib: { rate: 4.6, depth: 5 },
    pan: 0.34,
  },
  choir: {
    oscs: [{ type: 'sawtooth', detune: -5 }, { type: 'sawtooth', detune: 6 }],
    sub: 0.24,
    filter: { type: 'bandpass', freq: 760, q: 0.9 },
    shelf: { freq: 4000, gain: 1.0 },
    level: 0.28,
    lfo: { rate: 0.06, depth: 160 },
    vib: { rate: 5.0, depth: 4 },
    pan: 0.30,
  },
};

export class AudioEngine {
  constructor(opts = {}) {
    this.createContext = opts.createContext || (() => new (window.AudioContext || window.webkitAudioContext)());
    this.nowMs = opts.nowMs || (() => performance.now());
    this.ctx = null;
    this.master = null;
    this.padBus = null;
    this.ocarinaBus = null;
    this.reverb = null;
    this.reverbReturn = null;
    this.comp = null;
    this.volume = 0.75;
    this.muted = false;
    this.voices = new Set();
    this.offsetMs = 0;
    this.noiseBuffer = null;
    this.reverbLevel = 0.9;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = this.createContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.comp = comp;
      if (comp.threshold) comp.threshold.value = -14;
      if (comp.knee) comp.knee.value = 20;
      if (comp.ratio) comp.ratio.value = 3;
      if (comp.attack) comp.attack.value = 0.008;
      if (comp.release) comp.release.value = 0.25;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.makeImpulse(2.4, 0.62);
      this.reverbReturn = this.ctx.createGain();
      this.reverbReturn.gain.value = this.reverbLevel;
      this.reverb.connect(this.reverbReturn);
      this.reverbReturn.connect(this.master);

      this.padBus = this.ctx.createGain();
      this.padBus.gain.value = 1;
      this.padBus.connect(this.master);
      const padSend = this.ctx.createGain();
      padSend.gain.value = 0.38;
      this.padBus.connect(padSend);
      padSend.connect(this.reverb);

      this.ocarinaBus = this.ctx.createGain();
      this.ocarinaBus.gain.value = 1;
      this.ocarinaBus.connect(this.master);
      const ocaSend = this.ctx.createGain();
      ocaSend.gain.value = 0.16;
      this.ocarinaBus.connect(ocaSend);
      ocaSend.connect(this.reverb);

      const rng = mulberry32(99991);
      const len = Math.floor(this.ctx.sampleRate * 1.5 || 66150);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate || 44100);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = rng() * 2 - 1;
      const fade = Math.floor((this.ctx.sampleRate || 44100) * 0.008);
      for (let i = 0; i < fade; i++) {
        const w = i / fade;
        data[i] *= w;
        data[len - 1 - i] *= w;
      }
      this.noiseBuffer = buf;
      this.offsetMs = this.ctx.currentTime * 1000 - this.nowMs();
    }
    if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') this.ctx.resume();
    return this.ctx;
  }

  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate || 44100;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    const pre = Math.floor(rate * 0.018);
    for (let ch = 0; ch < 2; ch++) {
      const rng = mulberry32(4242 + ch * 17);
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len - pre; i++) {
        const t = i / rate;
        const env = Math.pow(1 - t / seconds, 2) * Math.exp(-t / decay);
        lp = lp * 0.70 + (rng() * 2 - 1) * 0.30;
        d[i + pre] = lp * env;
      }
    }
    return buf;
  }

  get currentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  toAudioTime(msPerf) {
    return (msPerf + this.offsetMs) / 1000;
  }

  setMasterVolume(v) {
    this.volume = v;
    if (this.master && !this.muted) this.master.gain.setTargetAtTime(v, this.currentTime, 0.03);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.currentTime, 0.03);
  }

  setPadVolume(v) {
    if (this.padBus) this.padBus.gain.setTargetAtTime(v, this.currentTime, 0.03);
  }

  setOcarinaVolume(v) {
    if (this.ocarinaBus) this.ocarinaBus.gain.setTargetAtTime(v, this.currentTime, 0.03);
  }

  registerVoice(voice) {
    const now = this.currentTime;
    for (const v of [...this.voices]) {
      if (v.endTime !== Infinity && v.endTime <= now) this.voices.delete(v);
    }
    this.voices.add(voice);
  }

  panic(now) {
    const at = now === undefined ? this.currentTime : now;
    for (const v of [...this.voices]) v.kill(at);
    this.voices.clear();
    if (this.reverbReturn) {
      this.reverbReturn.gain.cancelScheduledValues(at);
      this.reverbReturn.gain.setValueAtTime(this.reverbReturn.gain.value, at);
      this.reverbReturn.gain.setTargetAtTime(0, at, 0.02);
    }
  }

  wakeReverb(t) {
    if (this.reverbReturn) this.reverbReturn.gain.setTargetAtTime(this.reverbLevel, t, 0.05);
  }

  ocarinaNote(midi, t, durSec, vel, opts = {}) {
    this.ensure();
    this.wakeReverb(t);
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const g = ctx.createGain();
    const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = Math.max(-1, Math.min(1, (midi - 76) / 36)) * 0.12;
      g.connect(pan);
      pan.connect(this.ocarinaBus);
    } else {
      g.connect(this.ocarinaBus);
    }
    const out = pan || this.ocarinaBus;

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(opts.glissFrom ? midiToFreq(opts.glissFrom) : f, t);
    if (opts.glissFrom) o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    o.connect(g);

    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(f * 2, t);
    if (opts.glissFrom) o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.05);
    const g2 = ctx.createGain();
    g2.gain.value = 0.055;
    o2.connect(g2);
    g2.connect(g);

    const o3 = ctx.createOscillator();
    o3.type = 'sine';
    o3.frequency.setValueAtTime(f * 3, t);
    if (opts.glissFrom) o3.frequency.exponentialRampToValueAtTime(f * 3, t + 0.05);
    const g3 = ctx.createGain();
    g3.gain.value = 0.018;
    o3.connect(g3);
    g3.connect(g);

    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 5.4;
    const vibGain = ctx.createGain();
    vibGain.gain.setValueAtTime(0, t);
    vibGain.gain.linearRampToValueAtTime(11, t + 0.3);
    vib.connect(vibGain);
    vibGain.connect(o.detune);

    const pk = 0.32 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(pk, t + 0.02);
    g.gain.linearRampToValueAtTime(pk * 0.7, t + durSec * 0.6);
    g.gain.linearRampToValueAtTime(0, t + durSec);

    const end = t + durSec + 0.06;
    o.start(t); o2.start(t); o3.start(t); vib.start(t);
    o.stop(end); o2.stop(end); o3.stop(end); vib.stop(end);

    const noiseSources = [];
    if (this.noiseBuffer && vel > 0.25) {
      const chiff = ctx.createBufferSource();
      chiff.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(f * 2.5, 9000);
      bp.Q.value = 1.1;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.045 * vel, t);
      bg.gain.exponentialRampToValueAtTime(0.0005, t + 0.07);
      chiff.connect(bp); bp.connect(bg); bg.connect(out);
      chiff.start(t);
      chiff.stop(t + 0.09);
      noiseSources.push(chiff);

      const air = ctx.createBufferSource();
      air.buffer = this.noiseBuffer;
      air.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0, t);
      ag.gain.linearRampToValueAtTime(0.005 * vel, t + 0.04);
      ag.gain.linearRampToValueAtTime(0, t + durSec);
      air.connect(hp); hp.connect(ag); ag.connect(out);
      air.start(t);
      air.stop(end);
      noiseSources.push(air);
    }

    const voice = {
      endTime: end,
      midi,
      kill: (at) => {
        try {
          g.gain.cancelScheduledValues(at);
          g.gain.setValueAtTime(g.gain.value, at);
          g.gain.linearRampToValueAtTime(0, at + 0.02);
          o.stop(at + 0.03); o2.stop(at + 0.03); o3.stop(at + 0.03); vib.stop(at + 0.03);
          for (const n of noiseSources) n.stop(at + 0.03);
        } catch (e) { }
        this.voices.delete(voice);
      },
    };
    this.voices.add(voice);
    const prune = () => this.voices.delete(voice);
    if (typeof setTimeout === 'function') setTimeout(prune, Math.max(0, (end - this.currentTime) * 1000 + 200));
    return voice;
  }

  padChord(midis, t, params = {}) {
    this.ensure();
    this.wakeReverb(t);
    const ctx = this.ctx;
    const tex = PAD_TEXTURES[params.texture || 'warm'] || PAD_TEXTURES.warm;
    const attack = params.attack !== undefined ? params.attack : 0.6;
    const release = params.release !== undefined ? params.release : 1.2;

    const chordGain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = tex.filter.type;
    filt.frequency.value = tex.filter.freq;
    filt.Q.value = tex.filter.q;
    let tail = filt;
    if (tex.shelf && typeof ctx.createBiquadFilter === 'function') {
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'highshelf';
      shelf.frequency.value = tex.shelf.freq;
      shelf.gain.value = tex.shelf.gain;
      filt.connect(shelf);
      tail = shelf;
    }
    chordGain.connect(filt);
    tail.connect(this.padBus);
    chordGain.gain.setValueAtTime(0, t);
    chordGain.gain.linearRampToValueAtTime(tex.level, t + Math.max(0.02, attack));

    const oscs = [];
    if (tex.lfo) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = tex.lfo.rate;
      const lg = ctx.createGain();
      lg.gain.value = tex.lfo.depth;
      lfo.connect(lg);
      lg.connect(filt.frequency);
      lfo.start(t);
      oscs.push(lfo);
    }

    const perNote = 0.24 / Math.sqrt(midis.length);
    midis.forEach((m, idx) => {
      const f = midiToFreq(m);
      const noteGain = ctx.createGain();
      noteGain.gain.value = perNote;
      let out = noteGain;
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        const width = tex.pan + 0.09 * (idx % 3);
        panner.pan.value = (idx % 2 === 0 ? -1 : 1) * width;
        noteGain.connect(panner);
        out = panner;
      }
      out.connect(chordGain);
      for (const spec of tex.oscs) {
        const o = ctx.createOscillator();
        o.type = spec.type;
        o.frequency.value = f * (spec.octave || 1);
        o.detune.value = spec.detune;
        if (tex.vib) {
          const v = ctx.createOscillator();
          v.type = 'sine';
          v.frequency.value = tex.vib.rate;
          const vg = ctx.createGain();
          vg.gain.value = tex.vib.depth;
          v.connect(vg);
          vg.connect(o.detune);
          v.start(t);
          oscs.push(v);
        }
        o.connect(noteGain);
        o.start(t);
        oscs.push(o);
      }
    });

    if (tex.sub) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = midiToFreq(midis[0] - 12);
      const sg = ctx.createGain();
      sg.gain.value = tex.sub;
      sub.connect(sg);
      sg.connect(chordGain);
      sub.start(t);
      oscs.push(sub);
    }

    let ended = false;
    const voice = {
      endTime: Infinity,
      notes: midis,
      kill: (at) => {
        try {
          chordGain.gain.cancelScheduledValues(at);
          chordGain.gain.setValueAtTime(chordGain.gain.value, at);
          chordGain.gain.linearRampToValueAtTime(0, at + 0.02);
          for (const o of oscs) o.stop(at + 0.03);
        } catch (e) { }
        voice.endTime = at + 0.05;
        ended = true;
      },
      release: (at) => {
        if (ended) return;
        ended = true;
        try {
          chordGain.gain.cancelScheduledValues(at);
          chordGain.gain.setValueAtTime(chordGain.gain.value, at);
          chordGain.gain.setTargetAtTime(0, at, Math.max(0.03, release / 3.5));
          for (const o of oscs) o.stop(at + release + 0.15);
        } catch (e) { }
        voice.endTime = at + release + 0.2;
      },
    };
    this.registerVoice(voice);
    return voice;
  }
}

export { PAD_TEXTURES };
