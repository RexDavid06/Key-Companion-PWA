import { AudioEngine, PAD_TEXTURES } from '../js/audio.js';
import { makeChord, CHORD_TEMPLATES } from '../js/theory.js';
import { PadEngine } from '../js/pad.js';
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

function engine() {
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  return { mock, audio };
}

console.log('audio: pad texture definitions');
{
  const names = ['warm', 'glass', 'strings', 'choir'];
  check('four textures defined', names.every(n => PAD_TEXTURES[n]), Object.keys(PAD_TEXTURES).join(','));
  for (const n of names) {
    const t = PAD_TEXTURES[n];
    check(n + ' has 1-3 oscillators', t.oscs.length >= 1 && t.oscs.length <= 3, t.oscs.length);
    check(n + ' level within safe range', t.level >= 0.2 && t.level <= 0.35, t.level);
    check(n + ' filter cutoff musical', t.filter.freq >= 500 && t.filter.freq <= 4000, t.filter.freq);
    check(n + ' sub within safe range', t.sub >= 0 && t.sub <= 0.35, t.sub);
    check(n + ' stereo width sane', t.pan >= 0.2 && t.pan <= 0.4, t.pan);
  }
}

console.log('audio: two-chord headroom estimate');
{
  for (const n of Object.keys(PAD_TEXTURES)) {
    const t = PAD_TEXTURES[n];
    const perChord = t.level * (0.24 * t.oscs.length * Math.sqrt(5)) + t.level * t.sub;
    check(n + ' two overlapping chords stay under full scale', perChord * 2 < 1.0, perChord.toFixed(3));
  }
}

console.log('audio: master signal chain');
{
  const { mock, audio } = engine();
  audio.ensure();
  const kinds = mock.allNodes.map(n => n.kind);
  check('compressor on master bus', kinds.includes('compressor'));
  check('reverb convolver present', kinds.includes('convolver'));
  check('master feeds compressor', audio.master._connections.includes(audio.comp));
  check('compressor feeds destination', audio.comp._connections.includes(mock.destination));
  check('pad bus feeds master', audio.padBus._connections.includes(audio.master));
  check('ocarina bus feeds master', audio.ocarinaBus._connections.includes(audio.master));
  check('reverb return feeds master', audio.reverbReturn._connections.includes(audio.master));
}

console.log('audio: pad chord scheduling and voice budget');
{
  const { mock, audio } = engine();
  audio.ensure();
  const before = mock.oscillators.length;
  const voice = audio.padChord([48, 55, 60, 64, 67], 0.1, { texture: 'warm', attack: 0.5, release: 0.8 });
  const oscs = mock.oscillators.length - before;
  check('warm 5-note chord uses at most 14 oscillators', oscs <= 14, oscs);
  check('pad chord starts no noise sources', mock.sources.length === 0);
  const chordOscs = mock.oscillators.slice(before);
  check('all pad oscillators start on time', chordOscs.every(o => o.startedAt === 0.1));
  voice.release(1.0);
  check('all pad oscillators scheduled to stop', chordOscs.every(o => o.stoppedAt !== null));
  check('pad tail stops within release window', chordOscs.every(o => o.stoppedAt <= 1.0 + 0.8 + 0.16));
  check('no pad voices left after release window', mock.activeVoicesAt(2.2).length === 0);
}

console.log('audio: ocarina note scheduling and voice budget');
{
  const { mock, audio } = engine();
  audio.ensure();
  const beforeOsc = mock.oscillators.length;
  const beforeSrc = mock.sources.length;
  audio.ocarinaNote(72, 0.1, 0.7, 0.9);
  const oscs = mock.oscillators.slice(beforeOsc);
  const srcs = mock.sources.slice(beforeSrc);
  check('ocarina note uses 4 oscillators', oscs.length === 4, oscs.length);
  check('ocarina note uses chiff and air sources', srcs.length === 2, srcs.length);
  check('ocarina oscillators start on time', oscs.every(o => o.startedAt === 0.1));
  check('ocarina sources start on time', srcs.every(s => s.startedAt === 0.1));
  check('all ocarina voices stop', [...oscs, ...srcs].every(n => n.stoppedAt !== null));
  check('ocarina tail stops within note window', [...oscs, ...srcs].every(n => n.stoppedAt <= 0.1 + 0.7 + 0.07));
  check('no ocarina voices left after note', mock.activeVoicesAt(1.0).length === 0);
  const pan = mock.allNodes.filter(n => n.kind === 'panner').pop();
  check('ocarina note is panned by pitch', pan && Math.abs(pan.pan.value) <= 0.12 && Math.abs(pan.pan.value - ((72 - 76) / 36) * 0.12) < 1e-6, pan && pan.pan.value);
}

console.log('audio: panic and reverb recovery');
{
  const { mock, audio } = engine();
  audio.ensure();
  audio.padChord([48, 55, 60, 64], 0.1, { texture: 'warm', release: 2.0 });
  audio.ocarinaNote(76, 0.1, 1.2, 0.9);
  audio.ocarinaNote(79, 0.2, 1.2, 0.9);
  mock.currentTime = 0.5;
  audio.panic(0.5);
  check('panic silences every voice', mock.activeVoicesAt(0.6).length === 0, mock.activeVoicesAt(0.6).length);
  const muted = audio.reverbReturn.gain.evaluate(1.5);
  check('panic mutes reverb return', muted < 0.05, muted.toFixed(4));
  audio.ocarinaNote(72, 1.6, 0.5, 0.9);
  const restored = audio.reverbReturn.gain.evaluate(3.0);
  check('next note restores reverb', restored > 0.5, restored.toFixed(3));
}

console.log('audio: pad engine leaves no stuck voices');
{
  const { mock, audio } = engine();
  const pad = new PadEngine(audio);
  pad.setChord(makeChord(0, tpl('')), 0.1);
  mock.currentTime = 1.0;
  pad.setChord(makeChord(9, tpl('m')), 1.0);
  mock.currentTime = 2.0;
  pad.kill(2.0);
  check('no stuck pad oscillators after kill', mock.unstoppedVoices().length === 0, mock.unstoppedVoices().length);
}

export function report() {
  return { passed, failed, failures };
}
