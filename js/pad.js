import { orderedPcs } from './theory.js';

const UPPER_LO = 55;
const UPPER_HI = 80;
const BASS_LO = 41;
const BASS_HI = 55;

function nearestPcInstance(pc, target, lo, hi) {
  let midi = pc + Math.round((target - pc) / 12) * 12;
  while (midi < lo) midi += 12;
  while (midi > hi) midi -= 12;
  return midi;
}

function permutations(n) {
  if (n === 0) return [[]];
  const out = [];
  const rest = permutations(n - 1);
  for (const p of rest) {
    for (let i = 0; i < n; i++) {
      const arr = [...p.slice(0, i), n - 1, ...p.slice(i)];
      out.push(arr);
    }
  }
  return out;
}

const PERM_CACHE = new Map();

export function chordVoicing(chord, prevVoicing) {
  const tones = [...new Set(orderedPcs(chord))];
  const bassPc = tones[0];
  const bass = nearestPcInstance(bassPc, prevVoicing ? prevVoicing[0] : 48, BASS_LO, BASS_HI);

  const upperCount = tones.length >= 4 ? 4 : 3;
  const upperTones = tones.slice(0, upperCount);
  let prevUpper = prevVoicing ? prevVoicing.slice(1) : [62, 65, 69, 72];
  while (prevUpper.length < upperCount) prevUpper = [...prevUpper, 72];
  prevUpper = prevUpper.slice(0, upperCount);

  if (!PERM_CACHE.has(upperCount)) PERM_CACHE.set(upperCount, permutations(upperCount));
  const perms = PERM_CACHE.get(upperCount);

  let best = null;
  let bestCost = Infinity;
  for (const perm of perms) {
    let cost = 0;
    const assigned = [];
    for (let i = 0; i < upperCount; i++) {
      const pc = upperTones[i];
      const target = prevUpper[perm[i]];
      const midi = nearestPcInstance(pc, target, UPPER_LO, UPPER_HI);
      assigned.push(midi);
      cost += Math.abs(midi - prevUpper[perm[i]]);
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = assigned;
    }
  }

  let voices = spreadFix([bass, ...best]);
  if (voices.length > 5) voices = voices.slice(0, 5);
  return voices;
}

function spreadFix(voices) {
  const v = [...voices].sort((a, b) => a - b);
  for (let i = 1; i < v.length; i++) {
    let guard = 0;
    while (v[i] - v[i - 1] < 2 && guard++ < 4) {
      if (v[i] + 12 <= UPPER_HI) v[i] += 12;
      else if (v[i - 1] - 12 >= BASS_LO && i - 1 >= 1) v[i - 1] -= 12;
      else break;
      v.sort((a, b) => a - b);
    }
  }
  return v;
}

export class PadEngine {
  constructor(audio) {
    this.audio = audio;
    this.texture = 'warm';
    this.attackTime = 0.6;
    this.releaseTime = 1.2;
    this.volume = 0.8;
    this.handle = null;
    this.chordId = null;
    this.lastVoicing = null;
    this.voicingHistory = [];
  }

  setParams(p) {
    if (p.texture !== undefined) this.texture = p.texture;
    if (p.attack !== undefined) this.attackTime = p.attack;
    if (p.release !== undefined) this.releaseTime = p.release;
    if (p.volume !== undefined) {
      this.volume = p.volume;
      this.audio.setPadVolume(p.volume);
    }
  }

  setChord(chord, tAudio) {
    if (!chord) return false;
    if (this.chordId === chord.id && this.handle) return false;
    if (this.handle) this.handle.release(tAudio);
    const voicing = chordVoicing(chord, this.lastVoicing);
    this.lastVoicing = voicing;
    this.voicingHistory.push({ chordId: chord.id, voicing });
    this.handle = this.audio.padChord(voicing, tAudio, {
      texture: this.texture,
      attack: this.attackTime,
      release: this.releaseTime,
    });
    this.chordId = chord.id;
    return true;
  }

  release(tAudio) {
    if (this.handle) {
      this.handle.release(tAudio);
      this.handle = null;
      this.chordId = null;
    }
  }

  active() {
    return !!this.handle;
  }

  kill(now) {
    if (this.handle) {
      this.handle.kill(now);
      this.handle = null;
      this.chordId = null;
    }
  }

  reset() {
    this.lastVoicing = null;
    this.voicingHistory = [];
  }
}
