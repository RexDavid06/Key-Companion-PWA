import { chordVoicing, PadEngine } from '../js/pad.js';
import { makeChord, CHORD_TEMPLATES } from '../js/theory.js';
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

console.log('pad: voicing validity');
{
  const C = makeChord(0, tpl(''));
  const v = chordVoicing(C, null);
  check('voicing has 4 voices', v.length === 4, JSON.stringify(v));
  check('all voices are chord tones', v.every(m => [0, 4, 7].includes(m % 12)), JSON.stringify(v));
  check('bass is root in low register', v[0] % 12 === 0 && v[0] >= 41 && v[0] <= 55, v[0]);
  check('uppers in register', v.slice(1).every(m => m >= 55 && m <= 80), JSON.stringify(v));
  check('no muddy clusters', v.every((m, i) => i === 0 || m - v[i - 1] >= 2), JSON.stringify(v));
}

console.log('pad: voice leading through C Am F G');
{
  const chords = [makeChord(0, tpl('')), makeChord(9, tpl('m')), makeChord(5, tpl('')), makeChord(7, tpl(''))];
  let prev = chordVoicing(chords[0], null);
  let maxMotion = 0;
  let allValid = true;
  for (let round = 0; round < 3; round++) {
    for (const ch of chords) {
      const next = chordVoicing(ch, prev);
      const prevUpper = prev.slice(1).sort((a, b) => a - b);
      const nextUpper = next.slice(1).sort((a, b) => a - b);
      let motion = 0;
      for (let i = 0; i < nextUpper.length; i++) motion += Math.abs(nextUpper[i] - prevUpper[i]);
      maxMotion = Math.max(maxMotion, motion);
      if (!next.slice(1).every(m => ch.pcs.includes(m % 12))) allValid = false;
      if (!next.every((m, i) => i === 0 || m - next[i - 1] >= 2)) allValid = false;
      prev = next;
    }
  }
  check('voicings stay chord tones and unclustered', allValid);
  check('voice leading motion bounded', maxMotion <= 12, 'max motion ' + maxMotion);
}

console.log('pad: common tones preserved C -> Am');
{
  const C = makeChord(0, tpl(''));
  const Am = makeChord(9, tpl('m'));
  const vC = chordVoicing(C, null);
  const vAm = chordVoicing(Am, vC);
  const shared = vAm.filter(m => vC.includes(m));
  check('C to Am keeps at least one common voice', shared.length >= 1, JSON.stringify(vC) + ' -> ' + JSON.stringify(vAm));
}

console.log('pad: engine crossfades and releases');
{
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  const pad = new PadEngine(audio);
  pad.setParams({ attack: 0.3, release: 0.8, volume: 0.8 });
  const C = makeChord(0, tpl(''));
  const changed1 = pad.setChord(C, 0.1);
  check('pad activates on chord', changed1 && pad.active());
  check('oscillators started', mock.oscillators.length > 0);
  const G = makeChord(7, tpl(''));
  mock.currentTime = 0.5;
  const changed2 = pad.setChord(G, 0.5);
  check('pad revoices on new chord', changed2);
  const stoppedOscs = mock.oscillators.filter(o => o.stoppedAt !== null);
  check('old chord oscillators scheduled to stop', stoppedOscs.length > 0, stoppedOscs.length + '/' + mock.oscillators.length);
  mock.currentTime = 1.0;
  pad.release(1.0);
  check('pad inactive after release', !pad.active());
  const activeAtEnd = mock.activeVoicesAt(2.2);
  check('all pad voices stopped after release window', activeAtEnd.length === 0, activeAtEnd.length);
}

console.log('pad: kill stops immediately');
{
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  const pad = new PadEngine(audio);
  pad.setChord(makeChord(0, tpl('')), 0.1);
  mock.currentTime = 1.0;
  pad.kill(1.0);
  check('no active voices right after kill', mock.activeVoicesAt(1.05).length === 0, mock.activeVoicesAt(1.05).length);
}

export function report() {
  return { passed, failed, failures };
}
