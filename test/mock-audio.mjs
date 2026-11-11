export class MockParam {
  constructor(ctx, initial = 0) {
    this.ctx = ctx;
    this.events = [];
    this.initial = initial;
  }
  get value() {
    return this.evaluate(this.ctx.currentTime);
  }
  set value(v) {
    this.events.push({ t: this.ctx.currentTime, type: 'set', v, at: this.ctx.currentTime });
  }
  setValueAtTime(v, t) {
    this.events.push({ t, type: 'set', v, at: this.ctx.currentTime });
    return this;
  }
  linearRampToValueAtTime(v, t) {
    this.events.push({ t, type: 'lin', v, at: this.ctx.currentTime });
    return this;
  }
  exponentialRampToValueAtTime(v, t) {
    this.events.push({ t, type: 'exp', v, at: this.ctx.currentTime });
    return this;
  }
  setTargetAtTime(v, t, tau) {
    this.events.push({ t, type: 'target', v, tau: Math.max(tau, 1e-6), at: this.ctx.currentTime });
    return this;
  }
  cancelScheduledValues(t) {
    this.events = this.events.filter(e => e.t < t);
    return this;
  }
  evaluate(at) {
    const events = [...this.events].sort((a, b) => a.t - b.t);
    let value = this.initial;
    let lastT = null;
    let seg = null;
    const segAt = time => {
      if (!seg) return value;
      if (seg.type === 'lin') {
        const f = (time - seg.t0) / Math.max(seg.t1 - seg.t0, 1e-9);
        return seg.from + (seg.to - seg.from) * Math.max(0, Math.min(1, f));
      }
      if (seg.type === 'exp') {
        if (seg.from <= 0 || seg.to <= 0) return seg.to;
        const f = Math.max(0, Math.min(1, (time - seg.t0) / Math.max(seg.t1 - seg.t0, 1e-9)));
        return seg.from * Math.pow(seg.to / seg.from, f);
      }
      return seg.target + (seg.from - seg.target) * Math.exp(-Math.max(0, time - seg.t0) / seg.tau);
    };
    for (const e of events) {
      if (e.t > at) break;
      value = segAt(e.t);
      const start = lastT !== null ? lastT : e.at;
      if (e.type === 'set') {
        value = e.v;
        seg = null;
      } else if (e.type === 'lin') {
        seg = { type: 'lin', from: value, to: e.v, t0: start, t1: e.t };
      } else if (e.type === 'exp') {
        seg = { type: 'exp', from: value, to: e.v, t0: start, t1: e.t };
      } else if (e.type === 'target') {
        seg = { type: 'target', from: value, target: e.v, t0: e.t, tau: e.tau };
      }
      lastT = e.t;
    }
    return segAt(at);
  }
}

export class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.oscillators = [];
    this.sources = [];
    this.gainNodes = [];
    this.allNodes = [];
    this.destination = this.makeNode('destination');
  }

  makeNode(kind, params = {}) {
    const ctx = this;
    const node = {
      kind,
      _connections: [],
      connect(n) { node._connections.push(n); return n; },
      disconnect() { node._connections = []; },
      ...params,
    };
    this.allNodes.push(node);
    return node;
  }

  createGain() {
    const g = this.makeNode('gain', { gain: new MockParam(this, 1) });
    this.gainNodes.push(g);
    return g;
  }

  createOscillator() {
    const o = this.makeNode('oscillator', {
      frequency: new MockParam(this, 440),
      detune: new MockParam(this, 0),
      type: 'sine',
      startedAt: null,
      stoppedAt: null,
      start(t) { o.startedAt = t === undefined ? ctx.currentTime : t; },
      stop(t) { o.stoppedAt = t === undefined ? ctx.currentTime : t; },
    });
    this.oscillators.push(o);
    return o;
  }

  createBiquadFilter() {
    return this.makeNode('filter', { frequency: new MockParam(this, 350), Q: new MockParam(this, 1), gain: new MockParam(this, 0), type: 'lowpass' });
  }

  createDynamicsCompressor() {
    return this.makeNode('compressor', {
      threshold: new MockParam(this, -24),
      knee: new MockParam(this, 30),
      ratio: new MockParam(this, 12),
      attack: new MockParam(this, 0.003),
      release: new MockParam(this, 0.25),
    });
  }

  createConvolver() {
    return this.makeNode('convolver', { buffer: null, normalize: true });
  }

  createStereoPanner() {
    return this.makeNode('panner', { pan: new MockParam(this, 0) });
  }

  createBuffer(channels, length, rate) {
    return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => new Float32Array(length) };
  }

  createBufferSource() {
    const ctx = this;
    const s = this.makeNode('buffersource', {
      buffer: null,
      startedAt: null,
      stoppedAt: null,
      start(t) { s.startedAt = t === undefined ? ctx.currentTime : t; },
      stop(t) { s.stoppedAt = t === undefined ? ctx.currentTime : t; },
    });
    this.sources.push(s);
    return s;
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  activeVoicesAt(t) {
    const active = list => list.filter(n => n.startedAt !== null && n.startedAt <= t && (n.stoppedAt === null || n.stoppedAt > t));
    return [...active(this.oscillators), ...active(this.sources)];
  }

  unstoppedVoices() {
    const unstopped = list => list.filter(n => n.startedAt !== null && n.stoppedAt === null);
    return [...unstopped(this.oscillators), ...unstopped(this.sources)];
  }
}
