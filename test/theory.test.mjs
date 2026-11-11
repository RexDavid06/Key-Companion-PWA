import { ChordDetector, KeyEstimator, NoteTracker, Progression, CHORD_TEMPLATES, makeChord, detectChordCandidates } from '../js/theory.js';
import { parseMessage } from '../js/midi.js';

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

function detectSequence(detector, steps) {
  const symbols = [];
  for (const [tMs, sounding] of steps) {
    const res = detector.update(sounding, tMs);
    if (res.changed) symbols.push(res.chord.symbol);
  }
  return symbols;
}

console.log('theory: chord detection');
{
  let d = new ChordDetector();
  const syms = detectSequence(d, [
    [1000, [60, 64, 67]],
  ]);
  check('major triad C', syms[syms.length - 1] === 'C' || syms[0] === 'C', syms.join(','));
  check('detector current is C', d.current.symbol === 'C', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([57, 60, 64], 1000);
  check('minor triad Am', d.current.symbol === 'Am', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([60, 64, 67, 70], 1000);
  check('dominant 7 C7', d.current.symbol === 'C7', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([60, 64, 67, 71], 1000);
  check('major 7 Cmaj7', d.current.symbol === 'Cmaj7', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([57, 60, 64, 67], 1000);
  check('minor 7 Am7', d.current.symbol === 'Am7', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([60, 65, 67], 1000);
  check('suspended Csus4', d.current.symbol === 'Csus4', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([60, 63, 66, 69], 1000);
  check('diminished 7 Cdim7', d.current.symbol === 'Cdim7', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([59, 62, 67], 1000);
  check('inversion G/B detected as G family', d.current.root === 7 && d.current.bass === 11, d.current.symbol);
  check('inversion slash symbol', d.current.symbol === 'G/B', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([55, 59, 62, 43], 1000);
  check('wide voicing with bass octave G', d.current.root === 7, d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([60], 1000);
  check('single note yields no chord', d.current === null);
}
{
  const d = new ChordDetector();
  d.update([62, 66, 69], 1000);
  check('D major first inversion area', d.current.root === 2, d.current.symbol);
}

console.log('theory: passing note stability');
{
  const d = new ChordDetector();
  d.update([60, 64, 67], 1000);
  const symbols = detectSequence(d, [
    [1100, [60, 62, 64, 67]],
    [1200, [60, 62, 64, 67]],
    [1300, [60, 64, 67]],
    [1400, [60, 64, 67]],
  ]);
  check('passing note does not flip chord', symbols.length === 0, symbols.join(','));
  check('still C after passing note', d.current.symbol === 'C', d.current.symbol);
}
{
  const d = new ChordDetector();
  d.update([60, 64, 67], 1000);
  const symbols = detectSequence(d, [
    [1100, [60, 62, 64, 67]],
    [1200, [60, 62, 64, 67]],
    [1300, [60, 62, 64, 67]],
    [1450, [60, 62, 64, 67]],
  ]);
  check('sustained added tone confirmed as add9', symbols.length === 1 && symbols[0] === 'Cadd9', symbols.join(','));
}

console.log('theory: chord progression tracking');
{
  const p = new Progression();
  const C = makeChord(0, tpl(''));
  const Am = makeChord(9, tpl('m'));
  const F = makeChord(5, tpl(''));
  const G = makeChord(7, tpl(''));
  p.push(C, 0); p.push(C, 500); p.push(Am, 1000); p.push(F, 2000); p.push(G, 3000); p.push(G, 3500);
  check('progression dedupes consecutive chords', p.symbols().length === 4, JSON.stringify(p.symbols()));
  check('progression order C Am F G', JSON.stringify(p.symbols()) === JSON.stringify(['C', 'Am', 'F', 'G']), JSON.stringify(p.symbols()));
}

console.log('theory: key estimation');
{
  const k = new KeyEstimator();
  const melody = [60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 62, 60, 69, 65, 64, 62, 60, 57, 59, 60, 64, 67, 72, 71, 69, 67, 65, 64, 62];
  melody.forEach(m => k.feedNotes([m], 0));
  for (const ch of [makeChord(0, tpl('')), makeChord(9, tpl('m')), makeChord(5, tpl('')), makeChord(7, tpl(''))]) k.feedChord(ch);
  const key = k.estimate();
  check('key estimate C major', key && key.name === 'C major', key && key.name);
}
{
  const k = new KeyEstimator();
  const melody = [67, 69, 71, 72, 74, 76, 78, 79, 66, 67, 69, 71, 74, 76, 79, 78, 76, 74, 71, 69, 67];
  melody.forEach(m => k.feedNotes([m], 0));
  for (const ch of [makeChord(7, tpl('')), makeChord(4, tpl('m')), makeChord(0, tpl('')), makeChord(2, tpl(''))]) k.feedChord(ch);
  const key = k.estimate();
  check('key estimate G major', key && key.name === 'G major', key && key.name);
}

console.log('theory: note tracker with sustain');
{
  const t = new NoteTracker();
  t.noteOn(60, 90, 0);
  t.setSustain(true);
  t.noteOff(60);
  check('note held by pedal', JSON.stringify(t.sounding()) === '[60]');
  t.noteOn(62, 90, 10);
  t.noteOff(62);
  check('second note also held by pedal', t.sounding().length === 2);
  t.setSustain(false);
  check('pedal release clears sounding', t.sounding().length === 0);
  t.noteOn(64, 90, 20);
  t.noteOff(64);
  check('no pedal: note off releases', t.sounding().length === 0);
  t.noteOn(64, 90, 30);
  t.setSustain(true);
  t.noteOff(64);
  t.noteOn(64, 90, 40);
  check('re-press removes from sustained', t.sounding().length === 1);
}

console.log('midi: message parsing');
{
  check('note on', JSON.stringify(parseMessage([0x90, 60, 100]).type) === '"noteon"');
  check('note on velocity', parseMessage([0x90, 60, 100]).velocity === 100);
  check('note on ch2', parseMessage([0x91, 60, 100]).channel === 1);
  check('note off status', parseMessage([0x80, 60, 0]).type === 'noteoff');
  check('note on vel 0 is noteoff', parseMessage([0x90, 60, 0]).type === 'noteoff');
  check('sustain down', parseMessage([0xb0, 64, 127]).type === 'sustain' && parseMessage([0xb0, 64, 127]).on === true);
  check('sustain up', parseMessage([0xb0, 64, 0]).on === false);
  check('other cc', parseMessage([0xb0, 7, 100]).type === 'cc');
  check('sysex ignored', parseMessage([0xf0, 1]).type === 'other');
}

export function report() {
  return { passed, failed, failures };
}
