export const PC_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const PC_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const CHORD_TEMPLATES = [
  { suffix: '', intervals: [0, 4, 7], quality: 'major' },
  { suffix: 'm', intervals: [0, 3, 7], quality: 'minor' },
  { suffix: '7', intervals: [0, 4, 7, 10], quality: 'dominant' },
  { suffix: 'maj7', intervals: [0, 4, 7, 11], quality: 'major' },
  { suffix: 'm7', intervals: [0, 3, 7, 10], quality: 'minor' },
  { suffix: '6', intervals: [0, 4, 7, 9], quality: 'major' },
  { suffix: 'm6', intervals: [0, 3, 7, 9], quality: 'minor' },
  { suffix: 'dim7', intervals: [0, 3, 6, 9], quality: 'diminished' },
  { suffix: 'dim', intervals: [0, 3, 6], quality: 'diminished' },
  { suffix: 'm7♭5', intervals: [0, 3, 6, 10], quality: 'half-diminished' },
  { suffix: 'aug', intervals: [0, 4, 8], quality: 'augmented' },
  { suffix: 'sus4', intervals: [0, 5, 7], quality: 'suspended' },
  { suffix: '7sus4', intervals: [0, 5, 7, 10], quality: 'suspended' },
  { suffix: 'sus2', intervals: [0, 2, 7], quality: 'suspended' },
  { suffix: 'add9', intervals: [0, 4, 7, 2], quality: 'major' },
  { suffix: '9', intervals: [0, 4, 7, 10, 2], quality: 'dominant' },
  { suffix: 'maj9', intervals: [0, 4, 7, 11, 2], quality: 'major' },
  { suffix: 'm9', intervals: [0, 3, 7, 10, 2], quality: 'minor' },
];

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];

const KRUMHANSL_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 4.09];
const KRUMHANSL_MINOR = [6.33, 2.68, 3.52, 5.19, 2.39, 3.63, 2.75, 5.13, 4.75, 3.98, 2.51, 3.14];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function orderedPcs(chord) {
  return chord.template.intervals.map(i => (chord.root + i) % 12);
}

export function scalePcs(tonic, mode) {
  const steps = mode === 'minor' ? NATURAL_MINOR : MAJOR_SCALE;
  return steps.map(s => (tonic + s) % 12);
}

export function makeChord(root, template, bassPc) {
  const pcs = template.intervals.map(i => (root + i) % 12);
  const bass = bassPc === undefined ? root : bassPc;
  const nameRoot = PC_FLAT[root % 12];
  const slash = bass !== root ? '/' + PC_FLAT[bass % 12] : '';
  return {
    root,
    template,
    pcs,
    bass,
    symbol: nameRoot + template.suffix + slash,
    label: nameRoot + template.suffix + ' (' + template.quality + ')',
    id: root + '|' + template.suffix + '|' + bass,
  };
}

function scoreCandidate(pcsSet, bass, root, template, keyCtx, incumbentRoot, incumbentSuffix) {
  const tones = template.intervals.map(i => (root + i) % 12);
  let matched = 0;
  for (const t of tones) if (pcsSet.has(t)) matched++;
  if (matched < 2) return null;
  let extra = 0;
  for (const p of pcsSet) if (!tones.includes(p)) extra++;
  const missing = tones.length - matched;
  let s = matched * 2.0 - extra * 1.5 - missing * 0.9;
  if (bass === root) s += 0.9;
  else if (tones.includes(bass)) s += 0.2;
  else s -= 1.0;
  if (tones.length === 3) s += 0.3;
  if (keyCtx && chordFitsKey(root, template, keyCtx)) s += 0.4;
  if (incumbentRoot === root && incumbentSuffix === template.suffix) s += 0.9;
  return s;
}

export function chordFitsKey(root, template, key) {
  const scale = new Set(scalePcs(key.tonic, key.mode));
  const core = template.intervals.slice(0, 3).map(i => (root + i) % 12);
  return core.every(p => scale.has(p));
}

export function detectChordCandidates(soundingMidis, keyCtx, incumbent) {
  if (!soundingMidis || soundingMidis.length === 0) return [];
  const sorted = [...soundingMidis].sort((a, b) => a - b);
  const pcs = [...new Set(sorted.map(m => m % 12))];
  if (pcs.length < 2 && !incumbent) return [];
  const bass = sorted[0] % 12;
  const pcsSet = new Set(pcs);
  const incRoot = incumbent ? incumbent.root : null;
  const incSuffix = incumbent ? incumbent.template.suffix : null;
  const roots = [...new Set([...pcs, ...(incRoot !== null ? [incRoot] : [])])];
  const out = [];
  for (const r of roots) {
    for (const tpl of CHORD_TEMPLATES) {
      const s = scoreCandidate(pcsSet, bass, r, tpl, keyCtx, incRoot, incSuffix);
      if (s !== null) out.push({ score: s, chord: makeChord(r, tpl, bass) });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export class ChordDetector {
  constructor() {
    this.current = null;
    this.pending = null;
    this.lastSwitchMs = 0;
  }

  update(soundingMidis, nowMs, keyCtx = null) {
    const candidates = detectChordCandidates(soundingMidis, keyCtx, this.current);
    if (candidates.length === 0) return { chord: this.current, changed: false };
    const best = candidates[0];

    if (this.current && this.current.id === best.chord.id) {
      this.pending = null;
      return { chord: this.current, changed: false };
    }

    if (!this.current) {
      this.current = best.chord;
      this.pending = null;
      this.lastSwitchMs = nowMs;
      return { chord: this.current, changed: true };
    }

    const sameHarmony = best.chord.root === this.current.root && best.chord.template.suffix === this.current.template.suffix;
    const incumbent = candidates.find(c => c.chord.id === this.current.id);
    const incScore = incumbent ? incumbent.score : -Infinity;
    const margin = sameHarmony ? 0 : 0.4;

    if (best.score > incScore + margin) {
      if (!sameHarmony && best.score > incScore + 3.2) {
        this.current = best.chord;
        this.pending = null;
        this.lastSwitchMs = nowMs;
        return { chord: this.current, changed: true };
      }
      if (!this.pending || this.pending.id !== best.chord.id) {
        this.pending = { id: best.chord.id, since: nowMs };
      }
      if (nowMs - this.pending.since >= 250) {
        this.current = best.chord;
        this.pending = null;
        this.lastSwitchMs = nowMs;
        return { chord: this.current, changed: true };
      }
    } else {
      this.pending = null;
    }
    return { chord: this.current, changed: false };
  }
}

export class NoteTracker {
  constructor() {
    this.held = new Map();
    this.sustained = new Set();
    this.sustainOn = false;
    this.onsets = [];
  }

  noteOn(midi, vel, tMs) {
    this.held.set(midi, { vel, tMs });
    this.sustained.delete(midi);
    this.onsets.push({ t: tMs, midi, vel });
    if (this.onsets.length > 200) this.onsets.shift();
  }

  noteOff(midi) {
    this.held.delete(midi);
    if (this.sustainOn) this.sustained.add(midi);
  }

  setSustain(on) {
    this.sustainOn = on;
    if (!on) this.sustained.clear();
  }

  sounding() {
    const set = new Set(this.sustained);
    for (const m of this.held.keys()) set.add(m);
    return [...set].sort((a, b) => a - b);
  }

  clearAll() {
    this.held.clear();
    this.sustained.clear();
    this.sustainOn = false;
  }

  recentOnsets(withinMs, nowMs) {
    return this.onsets.filter(o => nowMs - o.t <= withinMs);
  }
}

export class KeyEstimator {
  constructor() {
    this.hist = new Array(12).fill(0);
    this.chords = [];
    this.current = null;
    this.challenger = null;
    this.challengerCount = 0;
  }

  feedNotes(midis, nowMs) {
    const sorted = [...midis].sort((a, b) => a - b);
    const bass = sorted.length > 0 ? sorted[0] : null;
    for (let i = 0; i < 12; i++) this.hist[i] *= 0.996;
    for (const m of sorted) {
      const w = m === bass ? 1.7 : 1.0;
      this.hist[m % 12] += w;
    }
  }

  feedChord(chord) {
    this.chords.push(chord);
    if (this.chords.length > 10) this.chords.shift();
  }

  keyScores() {
    const scores = [];
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const mode of ['major', 'minor']) {
        const profile = mode === 'major' ? KRUMHANSL_MAJOR : KRUMHANSL_MINOR;
        let corr = pearson(this.hist, rotate(profile, tonic));
        let diatonic = 0;
        for (const ch of this.chords) {
          if (chordFitsKey(ch.root, ch.template, { tonic, mode })) diatonic += 0.12;
        }
        scores.push({ tonic, mode, score: corr + diatonic, name: PC_FLAT[tonic] + ' ' + mode });
      }
    }
    scores.sort((a, b) => b.score - a.score);
    return scores;
  }

  estimate() {
    const scores = this.keyScores();
    if (scores.length === 0 || this.hist.reduce((a, b) => a + b, 0) < 6) return this.current;
    const best = scores[0];
    if (!this.current) {
      this.current = { tonic: best.tonic, mode: best.mode, name: best.name };
      return this.current;
    }
    const currentScore = scores.find(s => s.tonic === this.current.tonic && s.mode === this.current.mode).score;
    if (best.score > currentScore + 0.05) {
      if (this.challenger && this.challenger.tonic === best.tonic && this.challenger.mode === best.mode) {
        this.challengerCount++;
      } else {
        this.challenger = best;
        this.challengerCount = 1;
      }
      if (this.challengerCount >= 3) {
        this.current = { tonic: best.tonic, mode: best.mode, name: best.name };
        this.challenger = null;
        this.challengerCount = 0;
      }
    } else {
      this.challenger = null;
      this.challengerCount = 0;
    }
    return this.current;
  }
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

function rotate(profile, tonic) {
  return profile.map((_, i) => profile[(i - tonic + 12) % 12]);
}

export class Progression {
  constructor(max = 64) {
    this.entries = [];
    this.max = max;
  }

  push(chord, tMs) {
    const last = this.entries[this.entries.length - 1];
    if (last && last.chord.id === chord.id) {
      last.durMs = tMs - last.tMs;
      return false;
    }
    this.entries.push({ chord, tMs, durMs: 0 });
    if (this.entries.length > this.max) this.entries.shift();
    return true;
  }

  symbols(n = 8) {
    return this.entries.slice(-n).map(e => e.chord.symbol);
  }

  recentChords(n = 8) {
    return this.entries.slice(-n).map(e => e.chord);
  }

  clear() {
    this.entries = [];
  }
}

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
