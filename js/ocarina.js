import { mulberry32, orderedPcs } from './theory.js';

const LOW_MIDI = 67;
const HIGH_MIDI = 86;
const HORIZON = 0.18;

export const STYLES = {
  makossa: {
    name: 'Makossa',
    bars: 1,
    restBias: 0.38,
    call: [
      [{ p: 0, d: 'R', len: 2, a: 1 }, { p: 3, d: '5', len: 1 }, { p: 6, d: 'R', len: 2, a: 1 }, { p: 8, d: '3', len: 1 }, { p: 11, d: '5', len: 2 }, { p: 14, d: 'R', len: 2, a: 1 }],
      [{ p: 0, d: '5', len: 1 }, { p: 2, d: 'R', len: 1 }, { p: 4, d: '3', len: 2, a: 1 }, { p: 7, d: '5', len: 1 }, { p: 10, d: 'R', len: 2, a: 1 }, { p: 13, d: '3', len: 1 }, { p: 15, d: '5', len: 1 }],
      [{ p: 0, d: 'R', len: 2, a: 1 }, { p: 2, d: 'P', len: 1, dir: 1 }, { p: 4, d: '3', len: 2 }, { p: 8, d: '5', len: 1 }, { p: 9, d: 'P', len: 1, dir: -1 }, { p: 10, d: 'R', len: 2, a: 1 }, { p: 14, d: '5', len: 2 }],
      [{ p: 0, d: 'R', len: 2, a: 1 }, { p: 3, d: '3', len: 1 }, { p: 6, d: '5', len: 2, a: 1 }, { p: 9, d: 'P', len: 1, dir: 1 }, { p: 10, d: 'O', len: 2 }, { p: 14, d: 'R', len: 2 }],
    ],
    response: [
      [{ p: 0, d: 'R', len: 3, a: 1 }, { p: 6, d: '5', len: 2 }, { p: 10, d: 'R', len: 3, a: 1 }, { p: 14, d: '3', len: 2 }],
      [{ p: 0, d: '5', len: 2, a: 1 }, { p: 4, d: '3', len: 2 }, { p: 8, d: 'R', len: 3, a: 1 }, { p: 13, d: '5', len: 2 }],
      [{ p: 2, d: 'R', len: 2, a: 1 }, { p: 6, d: '5', len: 2 }, { p: 10, d: '3', len: 2, a: 1 }, { p: 14, d: 'R', len: 2 }],
    ],
  },
  ariaria: {
    name: 'Araria',
    bars: 2,
    restBias: 0.2,
    call: [
      [{ p: 0, d: 'O', len: 2, a: 1 }, { p: 2, d: '5', len: 2 }, { p: 4, d: '3', len: 2 }, { p: 6, d: '5', len: 2, a: 1 }, { p: 8, d: '3', len: 2 }, { p: 10, d: 'R', len: 2 }, { p: 12, d: '3', len: 2 }, { p: 14, d: '5', len: 2, a: 1 }, { p: 16, d: '5', len: 2, a: 1 }, { p: 18, d: '3', len: 2 }, { p: 20, d: 'R', len: 2 }, { p: 22, d: '3', len: 2, a: 1 }, { p: 24, d: '5', len: 2 }, { p: 26, d: 'O', len: 2 }, { p: 28, d: '7', len: 2 }, { p: 30, d: '5', len: 2, a: 1 }],
      [{ p: 0, d: 'R', len: 3, a: 1 }, { p: 4, d: '3', len: 2 }, { p: 8, d: '5', len: 3, a: 1 }, { p: 12, d: '3', len: 2 }, { p: 14, d: 'P', len: 2, dir: 1 }, { p: 16, d: 'O', len: 2, a: 1 }, { p: 20, d: '5', len: 2 }, { p: 24, d: '3', len: 3, a: 1 }, { p: 28, d: 'R', len: 4 }],
      [{ p: 2, d: 'L', len: 2 }, { p: 4, d: 'R', len: 2, a: 1 }, { p: 8, d: '3', len: 2 }, { p: 12, d: '5', len: 2, a: 1 }, { p: 16, d: 'O', len: 1 }, { p: 18, d: 'P', len: 1, dir: -1 }, { p: 20, d: '5', len: 2, a: 1 }, { p: 24, d: '3', len: 2 }, { p: 28, d: 'R', len: 4 }],
    ],
    response: [
      [{ p: 0, d: 'R', len: 2, a: 1 }, { p: 4, d: '5', len: 2 }, { p: 8, d: 'O', len: 2, a: 1 }, { p: 12, d: '5', len: 2 }, { p: 16, d: '3', len: 2, a: 1 }, { p: 20, d: '5', len: 2 }, { p: 24, d: 'R', len: 4, a: 1 }],
      [{ p: 0, d: '3', len: 3, a: 1 }, { p: 4, d: 'R', len: 3 }, { p: 8, d: '5', len: 3, a: 1 }, { p: 12, d: '3', len: 3 }, { p: 16, d: 'R', len: 4, a: 1 }, { p: 22, d: '5', len: 2 }, { p: 26, d: '3', len: 2 }, { p: 30, d: 'R', len: 2 }],
    ],
  },
};

function nearestInstance(pc, target, lo, hi) {
  let midi = pc + Math.round((target - pc) / 12) * 12;
  while (midi < lo) midi += 12;
  while (midi > hi) midi -= 12;
  return midi;
}

function chordTonePc(deg, chord) {
  const pcs = orderedPcs(chord);
  switch (deg) {
    case 'R': return pcs[0];
    case '3': return pcs[1] !== undefined ? pcs[1] : pcs[0];
    case '5': return pcs[2] !== undefined ? pcs[2] : pcs[1] !== undefined ? pcs[1] : pcs[0];
    case '7': return pcs[3] !== undefined ? pcs[3] : pcs[0];
    case 'O': return pcs[0];
    default: return pcs[0];
  }
}

function passingPc(prevPc, dir, scale) {
  const target = (((prevPc + dir * 2) % 12) + 12) % 12;
  let best = null;
  let bestDist = 99;
  for (const p of scale) {
    if (p === prevPc) continue;
    const dist = Math.min(Math.abs(p - target), 12 - Math.abs(p - target));
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return best === null ? prevPc : best;
}

function scaleStepBelow(pc, scale) {
  let best = null;
  let bestGap = 99;
  for (const p of scale) {
    const gap = ((pc - p) % 12 + 12) % 12;
    if (gap >= 1 && gap < bestGap) { bestGap = gap; best = p; }
  }
  return best === null ? ((pc - 1 + 12) % 12) : best;
}

function nextChordToneDegAfter(template, index) {
  for (let i = index + 1; i < template.length; i++) {
    const d = template[i].d;
    if (d !== 'P' && d !== 'L') return d;
  }
  return 'R';
}

export class OcarinaEngine {
  constructor(audio, opts = {}) {
    this.audio = audio;
    this.rng = opts.rng || mulberry32(opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9));
    this.style = opts.style || 'makossa';
    this.intensity = opts.intensity !== undefined ? opts.intensity : 0.6;
    this.volume = 0.8;
    this.running = false;
    this.chord = null;
    this.scale = null;
    this.periodSec = 0.6;
    this.phaseSec = 0;
    this.confidence = 0;
    this.busyness = 0;
    this.pianistIdleMs = 0;
    this.phraseStartTime = 0;
    this.phraseSpanSec = 0;
    this.pending = [];
    this.phraseCount = 0;
    this.restCount = 0;
    this.barCount = 0;
    this.lastMidi = null;
    this.notesPlayed = [];
  }

  setParams(p) {
    if (p.style !== undefined && STYLES[p.style] && p.style !== this.style) {
      this.style = p.style;
      this.forceNextPhrase = true;
      if (this.running && this.pending.length === 0) {
        this.phraseStartTime = this.gridAligned(this.audio.currentTime + 0.05);
        this.planPhrase();
      }
    }
    if (p.intensity !== undefined) this.intensity = Math.max(0, Math.min(1, p.intensity));
    if (p.volume !== undefined) {
      this.volume = p.volume;
      this.audio.setOcarinaVolume(p.volume);
    }
  }

  setBeat({ periodSec, phaseSec, confidence }) {
    if (periodSec && periodSec > 0.2 && periodSec < 1.6) this.periodSec = periodSec;
    if (phaseSec !== undefined) this.phaseSec = phaseSec;
    if (confidence !== undefined) this.confidence = confidence;
  }

  setBusyness(b) {
    this.busyness = Math.max(0, Math.min(1, b));
  }

  setIdleMs(ms) {
    this.pianistIdleMs = ms;
  }

  setChord(chord, scalePcs, nowAudio) {
    this.chord = chord;
    if (scalePcs) this.scale = scalePcs;
    if (this.pending.length) {
      this.rerealizePending();
    } else if (this.running && nowAudio !== undefined && nowAudio >= this.phraseStartTime + this.phraseSpanSec) {
      this.phraseStartTime = this.gridAligned(Math.max(nowAudio + 0.05, this.phraseStartTime));
      this.planPhrase();
    }
  }

  start(now) {
    this.audio.ensure();
    this.running = true;
    const barDur = 4 * this.periodSec;
    let start = this.phaseSec + Math.ceil((now + 0.05 - this.phaseSec) / barDur - 1e-6) * barDur;
    if (start < now + 0.02) start += barDur;
    this.phraseStartTime = start;
    this.phraseSpanSec = barDur;
    this.planPhrase();
  }

  stop() {
    this.running = false;
    this.pending = [];
  }

  panic(now) {
    this.running = false;
    this.pending = [];
    this.lastMidi = null;
  }

  playingRecently(now) {
    return this.notesPlayed.some(n => now - n.at < 1.5);
  }

  effectiveIntensity() {
    return Math.max(0.15, Math.min(1, this.intensity * (1 - 0.45 * this.busyness)));
  }

  gridAligned(candidate) {
    const barDur = 4 * this.periodSec;
    if (barDur <= 0) return candidate;
    return this.phaseSec + Math.ceil((candidate - this.phaseSec) / barDur - 1e-6) * barDur;
  }

  planPhrase() {
    if (!this.running) return;
    const style = STYLES[this.style];
    const barDur = 4 * this.periodSec;
    this.phraseSpanSec = style.bars * barDur;
    this.barCount += style.bars;
    const forced = this.forceNextPhrase;
    this.forceNextPhrase = false;

    if (!this.chord) {
      this.pending = [];
      return;
    }
    const eff = this.effectiveIntensity();

    if (this.pianistIdleMs > 3000) {
      this.pending = [];
      this.restCount++;
      this.phraseCount++;
      return;
    }

    if (this.confidence < 0.35) {
      this.pending = [];
      this.phraseCount++;
      if (this.confidence < 0.15) {
        this.restCount++;
        return;
      }
      if (this.phraseCount % 2 === 1) {
        this.restCount++;
        return;
      }
      const pc = chordTonePc('R', this.chord);
      const midi = nearestInstance(pc, this.lastMidi || 74, LOW_MIDI, HIGH_MIDI);
      this.pending = [{
        at: this.phraseStartTime, deg: 'R', dir: 0, midi, dur: barDur * 0.9,
        vel: 0.4 * (0.55 + 0.45 * eff), pos: 0, glissFrom: null,
      }];
      this.lastMidi = midi;
      return;
    }

    if (!forced && this.busyness > 0.75 && this.rng() < 0.5) {
      this.pending = [];
      this.restCount++;
      this.phraseCount++;
      return;
    }

    const restProb = Math.max(0.05, Math.min(0.8, style.restBias * (1.45 - eff)));
    if (!forced && this.rng() < restProb) {
      this.pending = [];
      this.restCount++;
      this.phraseCount++;
      return;
    }

    const pool = this.phraseCount % 2 === 0 ? style.call : style.response;
    const tpl = pool[Math.floor(this.rng() * pool.length)];
    this.realizePhrase(tpl, eff);
    this.phraseCount++;
  }

  realizePhrase(tpl, eff) {
    const scale = this.scale || [0, 2, 4, 5, 7, 9, 11].map(s => (this.chord.root + s) % 12);
    const stepSec = this.periodSec / 4;
    const keepProb = 0.35 + 0.65 * eff;
    const velScale = 0.55 + 0.45 * eff;
    const ornProb = 0.35 * eff;
    const events = [];
    let prev = this.lastMidi;
    let prevEnd = -Infinity;

    for (let i = 0; i < tpl.length; i++) {
      const ev = tpl[i];
      if (!ev.a && this.rng() > keepProb) continue;
      const at = this.phraseStartTime + ev.p * stepSec;
      const dur = ev.len * stepSec;
      const vel = (ev.a ? 0.85 : 0.6) * velScale;
      let pc;
      let targetPc = null;
      if (ev.d === 'P') {
        pc = passingPc(prev !== null ? prev % 12 : this.chord.root, ev.dir || 1, scale);
      } else if (ev.d === 'L') {
        const nextDeg = nextChordToneDegAfter(tpl, i);
        targetPc = chordTonePc(nextDeg, this.chord);
        pc = scaleStepBelow(targetPc, scale);
      } else {
        pc = chordTonePc(ev.d, this.chord);
      }
      const midi = nearestInstance(pc, prev !== null ? prev : 74, LOW_MIDI, HIGH_MIDI);
      const glissFrom = prev !== null && at - prevEnd < 0.04 && Math.abs(midi - prev) <= 2 ? prev : null;
      events.push({ at, deg: ev.d, dir: ev.dir || 0, targetPc, midi, dur, vel, pos: ev.p, glissFrom });
      if (ev.a && this.rng() < ornProb) {
        const gpc = scaleStepBelow(pc, scale);
        const gmidi = nearestInstance(gpc, midi, LOW_MIDI, HIGH_MIDI);
        events.push({
          at: at - 0.07, deg: 'grace', dir: 0, targetPc: null, midi: gmidi, dur: 0.055,
          vel: vel * 0.55, pos: ev.p, glissFrom: null,
        });
      }
      prev = midi;
      prevEnd = at + dur;
    }
    events.sort((a, b) => a.at - b.at);
    this.pending = events;
    if (prev !== null) this.lastMidi = prev;
  }

  rerealizePending() {
    if (!this.chord || !this.pending.length) return;
    const scale = this.scale || [0, 2, 4, 5, 7, 9, 11].map(s => (this.chord.root + s) % 12);
    let prev = this.lastMidi;
    const out = [];
    for (const ev of this.pending) {
      let midi = ev.midi;
      if (ev.deg === 'grace') {
        const gpc = scaleStepBelow(midi % 12, scale);
        midi = nearestInstance(gpc, midi, LOW_MIDI, HIGH_MIDI);
      } else if (ev.deg === 'P') {
        const pc = passingPc(prev !== null ? prev % 12 : this.chord.root, ev.dir, scale);
        midi = nearestInstance(pc, prev !== null ? prev : 74, LOW_MIDI, HIGH_MIDI);
      } else if (ev.deg === 'L') {
        const tp = ev.targetPc !== null && ev.targetPc !== undefined ? ev.targetPc : this.chord.root;
        const pc = scaleStepBelow(tp, scale);
        midi = nearestInstance(pc, prev !== null ? prev : 74, LOW_MIDI, HIGH_MIDI);
      } else {
        midi = nearestInstance(chordTonePc(ev.deg, this.chord), prev !== null ? prev : 74, LOW_MIDI, HIGH_MIDI);
      }
      out.push({ ...ev, midi });
      prev = midi;
    }
    this.pending = out;
  }

  tick(now) {
    if (!this.running) return;
    const horizon = HORIZON;
    while (this.pending.length > 0 && this.pending[0].at < now + horizon) {
      const ev = this.pending.shift();
      if (ev.at < now - 0.06) continue;
      const at = Math.max(ev.at, now + 0.005);
      this.audio.ocarinaNote(ev.midi, at, ev.dur, ev.vel, { glissFrom: ev.glissFrom });
      this.notesPlayed.push({ at, midi: ev.midi, dur: ev.dur, vel: ev.vel, pos: ev.pos, style: this.style, chordId: this.chord ? this.chord.id : null });
      this.lastMidi = ev.midi;
    }
    if (now >= this.phraseStartTime + this.phraseSpanSec - horizon) {
      const candidate = this.phraseStartTime + this.phraseSpanSec;
      this.phraseStartTime = this.gridAligned(candidate);
      if (this.phraseStartTime < now) this.phraseStartTime = this.gridAligned(now + 0.02);
      this.planPhrase();
    }
  }
}
