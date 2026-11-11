import { createApp } from '../js/app.js';
import { AudioEngine } from '../js/audio.js';
import { MockAudioContext } from './mock-audio.mjs';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; console.log('  ok - ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL - ' + name + (detail ? ' [' + detail + ']' : '')); }
}

function mockUI() {
  const rec = { chord: [], key: [], bpm: [], armed: [], prog: [], conf: [] };
  return {
    rec,
    setChordDisplay: (sym, label) => { rec.chord.push(sym); },
    setKey: name => { rec.key.push(name); },
    setBpm: n => { rec.bpm.push(n); },
    setConfidence: f => { rec.conf.push(f); },
    setProgression: syms => { rec.prog.push([...syms]); },
    setDetectLed: () => { },
    setPlayLed: () => { },
    setArmed: on => { rec.armed.push(on); },
    setModePanels: () => { },
    setStyleDisplay: () => { },
    setAuto: () => { },
    setMuted: () => { },
    pulseDetect: () => { },
    setStatusText: () => { },
  };
}

const CHORDS = {
  C: [60, 64, 67],
  Am: [57, 60, 64],
  F: [53, 57, 60],
  G: [55, 59, 62],
};

function makePianist() {
  const events = [];
  function chord(name, at, dur = 0.5) {
    CHORDS[name].forEach((m, i) => {
      events.push({ t: at + i * 0.012, fn: 'on', midi: m });
      events.push({ t: at + dur + i * 0.008, fn: 'off', midi: m });
    });
  }
  return {
    events,
    chord,
  };
}

function runSimulation(script, endT) {
  const mock = new MockAudioContext();
  const audio = new AudioEngine({ createContext: () => mock, nowMs: () => mock.currentTime * 1000 });
  const ui = mockUI();
  const app = createApp({ audio, ui, nowMs: () => mock.currentTime * 1000, ocarinaSeed: 321 });
  const fired = new Set();
  for (let t = 0; t <= endT + 0.001; t += 0.02) {
    mock.currentTime = t;
    for (const ev of script) {
      if (!fired.has(ev) && ev.t <= t) {
        fired.add(ev);
        if (ev.fn === 'on') app.noteOn(ev.midi, 90);
        else if (ev.fn === 'off') app.noteOff(ev.midi);
        else if (ev.fn === 'call') ev.call(app, ui, mock);
      }
    }
    app.tick();
  }
  mock.currentTime = endT;
  return { app, ui, mock };
}

console.log('integration: pad follows C Am F G at 100 BPM');
{
  const p = makePianist();
  const script = [];
  script.push({ t: 0.5, fn: 'call', call: app => app.start() });
  for (let beat = 0; beat < 30; beat++) {
    const chordName = ['C', 'Am', 'F', 'G'][beat % 4];
    p.chord(chordName, 1.0 + beat * 0.6);
  }
  for (const e of p.events) script.push(e);
  const { app, ui, mock } = runSimulation(script, 24);

  const seq = app.state.detectedChordSeq;
  const firstPass = [];
  for (const s of seq) if (firstPass[firstPass.length - 1] !== s) firstPass.push(s);
  check('detects C Am F G cycle', JSON.stringify(firstPass.slice(0, 8)) === JSON.stringify(['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G']), JSON.stringify(firstPass));
  check('key estimated C major', app.keyEst.current && app.keyEst.current.name === 'C major', app.keyEst.current && app.keyEst.current.name);
  check('tempo locked near 100', Math.abs(app.tempo.bpm - 100) <= 4, app.tempo.bpm.toFixed(1));
  check('tempo confidence high', app.tempo.confidence > 0.4, app.tempo.confidence.toFixed(2));
  check('pad followed chord changes', app.pad.voicingHistory.length >= 12, app.pad.voicingHistory.length);
  check('pad voiced only chord tones', app.pad.voicingHistory.every(v => {
    const chord = app.prog.entries.find(e => e.chord.id === v.chordId);
    return !chord || v.voicing.every(m => chord.chord.pcs.includes(m % 12));
  }));
  check('pad active while playing', ui.rec.armed.includes(true));
  check('pad fades after pianist stops', !app.pad.active());
  check('no stuck voices after idle fade', mock.unstoppedVoices().length === 0, mock.unstoppedVoices().length);
}

console.log('integration: switch to ocarina mid-performance');
{
  const p = makePianist();
  const script = [];
  script.push({ t: 0.5, fn: 'call', call: app => app.start() });
  for (let beat = 0; beat < 24; beat++) {
    p.chord(['C', 'Am', 'F', 'G'][beat % 4], 1.0 + beat * 0.6);
  }
  for (const e of p.events) script.push(e);
  script.push({ t: 8.0, fn: 'call', call: app => app.setMode('ocarina') });
  script.push({ t: 14.0, fn: 'call', call: app => app.setStyle('ariaria') });
  const { app, ui, mock } = runSimulation(script, 18);

  check('pad released after mode switch', !app.pad.active());
  const ocaNotes = app.oca.notesPlayed;
  check('ocarina played notes', ocaNotes.length >= 10, ocaNotes.length);
  const cScale = [0, 2, 4, 5, 7, 9, 11];
  check('ocarina notes in key', ocaNotes.every(n => cScale.includes(n.midi % 12)), JSON.stringify(ocaNotes.filter(n => !cScale.includes(n.midi % 12)).slice(0, 3).map(n => n.midi)));
  const mkNotes = ocaNotes.filter(n => n.style === 'makossa');
  const arNotes = ocaNotes.filter(n => n.style === 'ariaria');
  check('both styles produced music', mkNotes.length > 0 && arNotes.length > 0, mkNotes.length + '/' + arNotes.length);
  const mkOdd = mkNotes.filter(n => n.pos % 2 === 1).length / Math.max(1, mkNotes.length);
  const arOdd = arNotes.filter(n => n.pos % 2 === 1).length / Math.max(1, arNotes.length);
  check('makossa syncopated, ariaria even', mkOdd > arOdd, mkOdd.toFixed(2) + ' vs ' + arOdd.toFixed(2));
}

console.log('integration: tempo change followed');
{
  const p = makePianist();
  const script = [];
  script.push({ t: 0.5, fn: 'call', call: app => app.start() });
  let t = 1.0;
  for (let beat = 0; beat < 20; beat++) { p.chord(['C', 'Am', 'F', 'G'][beat % 4], t); t += 0.6; }
  for (let beat = 0; beat < 34; beat++) { p.chord(['C', 'Am', 'F', 'G'][beat % 4], t); t += 60000 / 130 / 1000; }
  for (const e of p.events) script.push(e);
  const { app } = runSimulation(script, t + 1);
  check('adapts to 130 BPM', Math.abs(app.tempo.bpm - 130) <= 4, app.tempo.bpm.toFixed(1));
  check('confidence stays high through change', app.tempo.confidence > 0.4, app.tempo.confidence.toFixed(2));
}

console.log('integration: stop and panic leave no stuck notes');
{
  const p = makePianist();
  const script = [];
  script.push({ t: 0.5, fn: 'call', call: app => app.start() });
  script.push({ t: 0.9, fn: 'call', call: app => app.setMode('ocarina') });
  for (let beat = 0; beat < 12; beat++) p.chord(['C', 'Am', 'F', 'G'][beat % 4], 1.0 + beat * 0.6);
  for (const e of p.events) script.push(e);
  script.push({ t: 9.0, fn: 'call', call: app => app.stop() });
  const { app, mock } = runSimulation(script, 14);
  check('stopped: no new ocarina notes', app.oca.notesPlayed.filter(n => n.at > 9.3).length === 0, app.oca.notesPlayed.filter(n => n.at > 9.3).length);
  const active = mock.activeVoicesAt(14);
  check('all voices stopped after stop', active.length === 0, active.length);
}
{
  const p = makePianist();
  const script = [];
  script.push({ t: 0.5, fn: 'call', call: app => app.start() });
  for (let beat = 0; beat < 8; beat++) p.chord(['C', 'Am', 'F', 'G'][beat % 4], 1.0 + beat * 0.6);
  for (const e of p.events) script.push(e);
  script.push({ t: 6.0, fn: 'call', call: (app, ui, mock) => { mock.currentTime = 6.0; app.panic(); } });
  const { app, mock } = runSimulation(script, 6.4);
  const active = mock.activeVoicesAt(6.05);
  check('panic kills voices immediately', active.length === 0, active.length);
  check('panic disarms', app.state.armed === false);
}

console.log('integration: sustain pedal end-to-end');
{
  const script = [];
  script.push({ t: 0.5, fn: 'call', call: app => app.start() });
  script.push({ t: 1.0, fn: 'call', call: app => { app.noteOn(60, 90); app.noteOn(64, 90); app.noteOn(67, 90); } });
  script.push({ t: 1.4, fn: 'call', call: app => app.sustain(true) });
  script.push({ t: 1.5, fn: 'call', call: app => { app.noteOff(60); app.noteOff(64); app.noteOff(67); } });
  script.push({ t: 1.6, fn: 'call', call: app => {} });
  const mid = runSimulation(script, 1.65);
  check('chord still sounding under pedal', mid.app.tracker.sounding().length === 3, mid.app.tracker.sounding());
  const script2 = [];
  script2.push({ t: 0.5, fn: 'call', call: app => app.start() });
  script2.push({ t: 1.0, fn: 'call', call: app => { app.noteOn(60, 90); app.noteOn(64, 90); app.noteOn(67, 90); } });
  script2.push({ t: 1.4, fn: 'call', call: app => app.sustain(true) });
  script2.push({ t: 1.5, fn: 'call', call: app => { app.noteOff(60); app.noteOff(64); app.noteOff(67); } });
  script2.push({ t: 1.7, fn: 'call', call: app => app.sustain(false) });
  const end = runSimulation(script2, 1.75);
  check('pedal release ends chord', end.app.tracker.sounding().length === 0, end.app.tracker.sounding());
  check('chord detected through pedal', end.app.state.detectedChordSeq.includes('C'), JSON.stringify(end.app.state.detectedChordSeq));
}

console.log('integration: MIDI disconnect handled gracefully');
{
  const p = makePianist();
  const script = [];
  script.push({ t: 0.5, fn: 'call', call: app => app.start() });
  for (let beat = 0; beat < 6; beat++) p.chord(['C', 'Am', 'F', 'G'][beat % 4], 1.0 + beat * 0.6);
  for (const e of p.events) script.push(e);
  script.push({ t: 5.0, fn: 'call', call: app => app.handleMidiDisconnect() });
  const { app, ui, mock } = runSimulation(script, 8);
  check('disconnect clears sounding notes', app.tracker.sounding().length === 0);
  check('disconnect mutes pad', !app.pad.active());
  check('disconnect stops ocarina', app.oca.running === false);
  check('disconnect shows message', ui.rec.chord.includes('–'), JSON.stringify(ui.rec.chord));
  script.push({ t: 6.5, fn: 'call', call: app => { app.noteOn(60, 90); app.noteOn(64, 90); app.noteOn(67, 90); } });
  const { app: app2, ui: ui2 } = runSimulation(script, 8.2);
  check('detection resumes after reconnect', app2.state.detectedChordSeq.includes('C'), JSON.stringify(app2.state.detectedChordSeq));
}

export function report() {
  return { passed, failed, failures };
}
