const MIN_LAG_MS = 240;
const MAX_LAG_MS = 1300;
const MIN_BPM = 62;
const MAX_BPM = 164;
const HISTORY_MS = 9000;
const RECENCY_MS = 6000;

export class TempoTracker {
  constructor() {
    this.onsets = [];
    this.bpm = 90;
    this.periodMs = 60 / 90 * 1000;
    this.phaseMs = 0;
    this.confidence = 0;
    this.auto = true;
    this.lastAnalyzeMs = 0;
  }

  feed(tMs, vel = 1) {
    this.onsets.push({ t: tMs, v: vel });
    while (this.onsets.length > 0 && tMs - this.onsets[0].t > HISTORY_MS) this.onsets.shift();
    if (this.auto && tMs - this.lastAnalyzeMs > 60) this.analyze(tMs);
  }

  setAuto(on) {
    this.auto = on;
  }

  setManualBpm(bpm) {
    this.auto = false;
    this.bpm = bpm;
    this.periodMs = 60 / bpm * 1000;
  }

  analyze(nowMs) {
    this.lastAnalyzeMs = nowMs;
    const on = this.onsets;
    if (on.length < 4) {
      this.confidence = Math.max(0, this.confidence * 0.85);
      return;
    }

    const weight = o => o.v * Math.exp(-(nowMs - o.t) / RECENCY_MS);
    const buckets = new Map();
    for (let i = 0; i < on.length; i++) {
      for (let j = i + 1; j < on.length; j++) {
        const dt = on[j].t - on[i].t;
        if (dt < MIN_LAG_MS || dt > MAX_LAG_MS) continue;
        const b = Math.round(dt / 10) * 10;
        buckets.set(b, (buckets.get(b) || 0) + weight(on[i]) * weight(on[j]));
      }
    }
    if (buckets.size === 0) {
      this.confidence = Math.max(0, this.confidence * 0.9);
      return;
    }

    let bestLag = 0, bestVal = 0, total = 0;
    for (const [lag, val] of buckets) {
      total += val;
      if (val > bestVal) { bestVal = val; bestLag = lag; }
    }
    let smoothed = 0, wsum = 0;
    for (const [lag, val] of buckets) {
      if (Math.abs(lag - bestLag) <= 30) { smoothed += lag * val; wsum += val; }
    }
    if (wsum > 0) bestLag = smoothed / wsum;

    const phase = this.computePhase(on, bestLag);
    let aligned = 0;
    let wtotal = 0;
    for (const o of on) {
      const w = weight(o);
      wtotal += w;
      const off = ((o.t - phase) % bestLag + bestLag) % bestLag;
      const d = Math.min(off, bestLag - off);
      if (d < bestLag * 0.12) aligned += w;
    }
    const supportFrac = wtotal > 0 ? aligned / wtotal : 0;

    let bpm = 60000 / bestLag;
    while (bpm < MIN_BPM) bpm *= 2;
    while (bpm > MAX_BPM) bpm /= 2;

    const peakNorm = bestVal / (total / buckets.size);
    const volume = Math.min(1, on.length / 18);
    const conf = Math.max(0, Math.min(1, 0.4 * Math.min(1, peakNorm / 3) + 0.6 * supportFrac)) * volume;

    if (conf > 0.3) {
      const w = 0.18 + 0.12 * conf;
      this.bpm = this.bpm * (1 - w) + bpm * w;
    }
    this.periodMs = 60 / this.bpm * 1000;
    this.confidence = Math.min(1, conf * 1.15);
    this.phaseMs = this.computePhase(on, this.periodMs);
  }

  computePhase(on, periodMs) {
    let S = 0, C = 0;
    const last = on[on.length - 1].t;
    const cutoff = last - 6000;
    for (const o of on) {
      if (o.t < cutoff) continue;
      const theta = 2 * Math.PI * (o.t / periodMs);
      S += o.v * Math.sin(theta);
      C += o.v * Math.cos(theta);
    }
    if (S === 0 && C === 0) return 0;
    let phase = Math.atan2(S, C) / (2 * Math.PI) * periodMs;
    phase = phase % periodMs;
    if (phase < 0) phase += periodMs;
    return phase;
  }

  anchor() {
    return {
      bpm: this.bpm,
      periodMs: this.periodMs,
      phaseMs: this.phaseMs,
      confidence: this.confidence,
      auto: this.auto,
    };
  }
}
