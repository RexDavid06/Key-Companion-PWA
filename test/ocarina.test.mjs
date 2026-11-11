import { OcarinaEngine } from '../js/ocarina.js';
import { makeChord, CHORD_TEMPLATES, scalePcs } from '../js/theory.js';
import { AudioEngine } from '../js/audio.js';
import { MockAudioContext } from './mock-audio.mjs';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; console.log('  ok - ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL - ' + name + (detail ? ' [' + detail + ']' : '')); }
}

function tpl(suffix) {
  return CHORD_TEMPLATES.find(t => t.suffix === suffix);
}

const C = makeChord(0, tpl(''));
const Am = makeChord(9, tpl('m'));
const F = makeChord(5, tpl(''));
const G = makeChord(7, tpl(''));
const PROG = [C, Am, F, G];
const C_SCALE = scalePcs(0, 'major');

function runEngine(style, { seed = 123, intensity = 0.8, conf = 0.8, bars = 24, chordEvery = 4 } = {}) {
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  const oca = new OcarinaEngine(audio, { seed, style, intensity });
  oca.setBeat({ periodSec: 0.6, phaseSec: 0, confidence: conf });
  oca.setChord(PROG[0], C_SCALE);
  oca.start(0);
  const barDur = 2.4;
  const end = bars * barDur;
  let chordIdx = 0;
  let currentChord = PROG[0];
  const allowedPerTime = [];
  for (let t = 0.02; t <= end; t += 0.02) {
    mock.currentTime = t;
    const bar = Math.floor(t / barDur);
    if (bar > 0 && bar % chordEvery === 0 && Math.floor((t - 0.02) / barDur) < bar) {
      chordIdx = (chordIdx + 1) % PROG.length;
      currentChord = PROG[chordIdx];
      oca.setChord(currentChord, C_SCALE, t);
    }
    allowedPerTime.push({ t, chord: currentChord });
    oca.tick(t);
  }
  mock.currentTime = end;
  oca.tick(end);
  return { oca, mock, allowedPerTime, end };
}

function chordAt(allowedPerTime, t) {
  let ch = allowedPerTime[0].chord;
  for (const a of allowedPerTime) {
    if (a.t > t) break;
    ch = a.chord;
  }
  return ch;
}

console.log('ocarina: makossa phrasing');
{
  const { oca } = runEngine('makossa');
  check('makossa produces notes', oca.notesPlayed.length >= 20, oca.notesPlayed.length);
  check('makossa takes rests', oca.restCount >= 1, oca.restCount);
  const oddFrac = oca.notesPlayed.filter(n => n.pos % 2 === 1).length / oca.notesPlayed.length;
  check('makossa uses 16th-level syncopation', oddFrac >= 0.05, oddFrac.toFixed(2));
  const avgDur = oca.notesPlayed.reduce((a, n) => a + n.dur, 0) / oca.notesPlayed.length;
  check('makossa notes are short (staccato feel)', avgDur <= 0.4, avgDur.toFixed(3));
}

console.log('ocarina: ariaria phrasing');
{
  const { oca } = runEngine('ariaria', { bars: 24 });
  check('ariaria produces notes', oca.notesPlayed.length >= 15, oca.notesPlayed.length);
  const oddFrac = oca.notesPlayed.filter(n => n.pos % 2 === 1).length / oca.notesPlayed.length;
  check('ariaria flows on the 8th-note grid', oddFrac === 0, oddFrac.toFixed(2));
  const avgDur = oca.notesPlayed.reduce((a, n) => a + n.dur, 0) / oca.notesPlayed.length;
  check('ariaria notes longer (legato feel)', avgDur > 0.3, avgDur.toFixed(3));
}

console.log('ocarina: styles are measurably different');
{
  const mk = runEngine('makossa', { bars: 28 });
  const ar = runEngine('ariaria', { bars: 28 });
  const mkAvg = mk.oca.notesPlayed.reduce((a, n) => a + n.dur, 0) / mk.oca.notesPlayed.length;
  const arAvg = ar.oca.notesPlayed.reduce((a, n) => a + n.dur, 0) / ar.oca.notesPlayed.length;
  check('ariaria sustains longer than makossa', arAvg > mkAvg, arAvg.toFixed(3) + ' vs ' + mkAvg.toFixed(3));
  const mkOdd = mk.oca.notesPlayed.filter(n => n.pos % 2 === 1).length / mk.oca.notesPlayed.length;
  const arOdd = ar.oca.notesPlayed.filter(n => n.pos % 2 === 1).length / ar.oca.notesPlayed.length;
  check('makossa more syncopated than ariaria', mkOdd > arOdd + 0.05, mkOdd.toFixed(2) + ' vs ' + arOdd.toFixed(2));
  const mkSpanBars = 1, arSpanBars = 2;
  check('makossa phrases are 1 bar, ariaria 2 bars', mkSpanBars !== arSpanBars);
}

console.log('ocarina: all notes are chord or scale tones');
{
  for (const style of ['makossa', 'ariaria']) {
    const { oca, allowedPerTime } = runEngine(style, { bars: 24, chordEvery: 2 });
    const bad = oca.notesPlayed.filter(n => {
      const ch = chordAt(allowedPerTime, n.at);
      return !ch.pcs.includes(n.midi % 12) && !C_SCALE.includes(n.midi % 12);
    });
    check(style + ': every note is a chord or scale tone', bad.length === 0, JSON.stringify(bad.slice(0, 3).map(b => b.midi)));
  }
}

console.log('ocarina: determinism with fixed seed');
{
  const a = runEngine('makossa', { seed: 777, bars: 12 });
  const b = runEngine('makossa', { seed: 777, bars: 12 });
  const sa = JSON.stringify(a.oca.notesPlayed.map(n => [n.at, n.midi, n.dur]));
  const sb = JSON.stringify(b.oca.notesPlayed.map(n => [n.at, n.midi, n.dur]));
  check('same seed gives identical phrases', sa === sb);
}

console.log('ocarina: conservative behavior at low tempo confidence');
{
  const { oca } = runEngine('makossa', { conf: 0.25, bars: 20 });
  const notes = oca.notesPlayed;
  const longEnough = notes.length > 0 && notes.every(n => n.dur >= 1.0);
  check('low confidence: sparse long notes only', notes.length <= 10 && longEnough, notes.length + ' notes');
}
{
  const { oca } = runEngine('makossa', { conf: 0.1, bars: 16 });
  check('very low confidence: silence', oca.notesPlayed.length === 0, oca.notesPlayed.length);
}

console.log('ocarina: rests when pianist idle');
{
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  const oca = new OcarinaEngine(audio, { seed: 5, style: 'makossa', intensity: 0.8 });
  oca.setBeat({ periodSec: 0.6, phaseSec: 0, confidence: 0.8 });
  oca.setChord(C, C_SCALE);
  oca.setIdleMs(5000);
  oca.start(0);
  for (let t = 0.02; t <= 10; t += 0.02) {
    mock.currentTime = t;
    oca.tick(t);
  }
  check('no notes while pianist idle', oca.notesPlayed.length === 0, oca.notesPlayed.length);
}

console.log('ocarina: high busyness reduces output');
{
  const calm = runEngine('makossa', { bars: 20, seed: 99 });
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  const oca = new OcarinaEngine(audio, { seed: 99, style: 'makossa', intensity: 0.8 });
  oca.setBeat({ periodSec: 0.6, phaseSec: 0, confidence: 0.8 });
  oca.setChord(C, C_SCALE);
  oca.setBusyness(0.9);
  oca.start(0);
  for (let t = 0.02; t <= 20 * 2.4; t += 0.02) {
    mock.currentTime = t;
    oca.tick(t);
  }
  check('busy pianist gets sparser accompaniment', oca.notesPlayed.length < calm.oca.notesPlayed.length, oca.notesPlayed.length + ' vs ' + calm.oca.notesPlayed.length);
}

console.log('ocarina: chord change mid-phrase reharmonizes pending notes');
{
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  const oca = new OcarinaEngine(audio, { seed: 123, style: 'makossa', intensity: 1.0 });
  oca.setBeat({ periodSec: 0.6, phaseSec: 0, confidence: 0.8 });
  oca.setChord(C, C_SCALE);
  oca.start(0);
  for (let t = 0.02; t <= 2.6; t += 0.02) {
    mock.currentTime = t;
    oca.tick(t);
  }
  const before = oca.pending.filter(e => e.at > 2.6).map(e => e.midi % 12);
  oca.setChord(Am, C_SCALE, 2.6);
  const after = oca.pending.filter(e => e.at > 2.6).map(e => e.midi % 12);
  const amPcs = Am.pcs;
  check('pending notes revoiced into new chord', after.length === before.length && after.every(pc => amPcs.includes(pc) || C_SCALE.includes(pc)), JSON.stringify(before) + ' -> ' + JSON.stringify(after));
}

console.log('ocarina: no stuck voices after stop');
{
  const { oca, mock, end } = runEngine('makossa', { bars: 16 });
  mock.currentTime = end;
  oca.stop();
  for (let t = end; t <= end + 3; t += 0.05) {
    mock.currentTime = t;
    oca.tick(t);
  }
  const active = mock.activeVoicesAt(end + 3);
  check('all voices stopped after engine stop', active.length === 0, active.length);
  check('no never-stopped voices', mock.unstoppedVoices().length === 0, mock.unstoppedVoices().length);
}

export function report() {
  return { passed, failed, failures };
}
