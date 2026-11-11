import { AudioEngine } from '../js/audio.js';
import { MockAudioContext } from './mock-audio.mjs';
import { createSoundLab } from '../js/soundlab.js';
import { makeChord, CHORD_TEMPLATES } from '../js/theory.js';

const TPL = suffix => CHORD_TEMPLATES.find(t => t.suffix === suffix);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; console.log('  ok - ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL - ' + name + (detail ? ' [' + detail + ']' : '')); }
}

function makeLab() {
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  let panics = 0;
  const app = {
    audio,
    panic: () => { panics++; audio.panic(audio.currentTime); },
    setMasterVolume: v => audio.setMasterVolume(v),
  };
  return { mock, audio, app, lab: createSoundLab(app), panics: () => panics };
}

console.log('sound lab: switching pad examples silences previous sounds');
{
  const { mock, lab } = makeLab();
  lab.playPadNote();
  mock.currentTime = 0.5;
  lab.playPadChord(makeChord(0, TPL(''), 0));
  const switchAt = 0.53;
  const active = mock.activeVoicesAt(switchAt + 0.01);
  const old = active.filter(n => n.startedAt < switchAt);
  check('no earlier pad voices survive a chord switch', old.length === 0, old.length);
  check('new chord is sounding', active.length > 0, active.length);
  lab.stopAll();
}

console.log('sound lab: switching from ocarina to pad silences ocarina');
{
  const { mock, lab } = makeLab();
  lab.playOcaNote(72);
  mock.currentTime = 0.2;
  lab.playPadNote();
  const switchAt = 0.23;
  const active = mock.activeVoicesAt(switchAt + 0.05);
  const old = active.filter(n => n.startedAt < switchAt);
  check('no ocarina voices survive the switch', old.length === 0, old.length);
  check('pad note is sounding after switch', active.length > 0, active.length);
  lab.stopAll();
}

console.log('sound lab: individual stop buttons');
{
  const { mock, lab } = makeLab();
  lab.playOcaNote(76);
  mock.currentTime = 0.3;
  lab.stopOca();
  check('stop ocarina silences immediately', mock.activeVoicesAt(0.36).length === 0, mock.activeVoicesAt(0.36).length);
  lab.playPadChord(makeChord(0, TPL('m'), 0));
  mock.currentTime = 0.8;
  lab.stopPad();
  check('stop pad silences immediately', mock.activeVoicesAt(0.86).length === 0, mock.activeVoicesAt(0.86).length);
  lab.stopAll();
}

console.log('sound lab: texture comparison restarts cleanly');
{
  const { mock, lab } = makeLab();
  lab.setTexture('glass');
  check('texture state updated', lab.state.texture === 'glass');
  const firstStart = 0.03;
  const first = mock.activeVoicesAt(firstStart + 0.01);
  check('glass chord sounding', first.length > 0, first.length);
  mock.currentTime = 1.0;
  lab.setTexture('choir');
  const second = mock.activeVoicesAt(1.03 + 0.01);
  const old = second.filter(n => n.startedAt < 1.03);
  check('previous texture is silenced on switch', old.length === 0, old.length);
  check('choir chord sounding', second.length > 0, second.length);
  lab.stopAll();
}

console.log('sound lab: bpm change restarts a running phrase');
{
  const { mock, lab } = makeLab();
  lab.playOcaPhrase('makossa');
  mock.currentTime = 0.5;
  lab.setBpm(130);
  check('bpm state updated', lab.state.bpm === 130);
  check('phrase ownership retained', lab.state.owner === 'oca');
  check('style retained', lab.state.ocaStyle === 'makossa');
  const active = mock.activeVoicesAt(0.56);
  const old = active.filter(n => n.startedAt < 0.53);
  check('no old phrase voices after bpm change', old.length === 0, old.length);
  lab.stopAll();
}

console.log('sound lab: stop all is immediate and clears timers');
{
  const { mock, lab, panics } = makeLab();
  lab.playPadWalk();
  mock.currentTime = 1.0;
  lab.playOcaPhrase('ariaria');
  mock.currentTime = 1.5;
  lab.stopAll();
  check('stop all leaves no active voices', mock.activeVoicesAt(1.56).length === 0, mock.activeVoicesAt(1.56).length);
  check('stop all triggers app panic', panics() === 1, panics());
  check('stop all clears timers', lab.state.owner === null);
}

console.log('sound lab: volume control clamps');
{
  const { audio, lab } = makeLab();
  lab.setVolume(1.5);
  check('volume clamps at 1', audio.volume === 1, audio.volume);
  lab.setVolume(-0.5);
  check('volume clamps at 0', audio.volume === 0, audio.volume);
  lab.setVolume(0.4);
  check('volume set in range', Math.abs(audio.volume - 0.4) < 1e-9, audio.volume);
}

export function report() {
  return { passed, failed, failures };
}
