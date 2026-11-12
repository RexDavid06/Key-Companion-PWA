import { AudioEngine } from './audio.js';
import { PadEngine } from './pad.js';
import { OcarinaEngine } from './ocarina.js';
import { ChordDetector, KeyEstimator, NoteTracker, Progression, scalePcs } from './theory.js';
import { TempoTracker } from './rhythm.js';
import { MidiInput } from './midi.js';
import { OnscreenPiano } from './piano.js';

export function createApp(deps = {}) {
  const audio = deps.audio || new AudioEngine();
  const nowMs = deps.nowMs || (() => performance.now());
  const ui = deps.ui || {};

  const tracker = new NoteTracker();
  const tempo = new TempoTracker();
  const detector = new ChordDetector();
  const keyEst = new KeyEstimator();
  const prog = new Progression();
  const pad = new PadEngine(audio);
  const oca = new OcarinaEngine(audio, { seed: deps.ocarinaSeed });

  const state = {
    armed: false,
    mode: 'pad',
    lastActivityMs: 0,
    lastDetectMs: 0,
    lastUiMs: 0,
    detectedChordSeq: [],
  };

  function uiCall(fn, ...args) {
    if (typeof ui[fn] === 'function') ui[fn](...args);
  }

  function noteOn(midi, vel) {
    const t = nowMs();
    tracker.noteOn(midi, vel, t);
    tempo.feed(t, Math.max(0.3, vel / 127));
    keyEst.feedNotes([midi], t);
    state.lastActivityMs = t;
    detectCycle(t);
    uiCall('pulseDetect');
  }

  function noteOff(midi) {
    tracker.noteOff(midi);
    detectCycle(nowMs());
  }

  function sustain(on) {
    tracker.setSustain(on);
    detectCycle(nowMs());
  }

  function detectCycle(t) {
    const sounding = tracker.sounding();
    const res = detector.update(sounding, t, keyEst.current ? { key: keyEst.current } : null);
    if (res.changed && res.chord) {
      prog.push(res.chord, t);
      keyEst.feedChord(res.chord);
      keyEst.estimate();
      state.detectedChordSeq.push(res.chord.symbol);
      const scale = keyEst.current ? scalePcs(keyEst.current.tonic, keyEst.current.mode) : null;
      if (state.armed) {
        if (state.mode === 'pad') pad.setChord(res.chord, audio.toAudioTime(t));
        oca.setChord(res.chord, scale, audio.ctx ? audio.currentTime : undefined);
      } else {
        oca.setChord(res.chord, scale);
      }
      uiCall('setChordDisplay', res.chord.symbol, res.chord.label);
      uiCall('setProgression', prog.symbols(8));
    }
    if (state.armed && state.mode === 'pad' && detector.current && !pad.active()) {
      pad.setChord(detector.current, audio.toAudioTime(t));
    }
  }

  function tick() {
    const t = nowMs();
    if (t - state.lastDetectMs > 100) {
      state.lastDetectMs = t;
      detectCycle(t);
    }

    if (audio.ctx) {
      const anchor = tempo.anchor();
      const phaseSec = audio.toAudioTime(anchor.phaseMs);
      oca.setBeat({ periodSec: anchor.periodMs / 1000, phaseSec, confidence: anchor.confidence });
      const recent = tracker.recentOnsets(3000, t).length;
      oca.setBusyness(Math.min(1, recent / 24));
      const idle = t - state.lastActivityMs;
      oca.setIdleMs(idle);
      if (state.armed && state.mode === 'pad' && pad.active() && idle > 2500 && tracker.sounding().length === 0) {
        pad.release(audio.currentTime);
      }
      if (state.armed && state.mode === 'ocarina') oca.tick(audio.currentTime);
    }

    if (t - state.lastUiMs > 150) {
      state.lastUiMs = t;
      uiCall('setBpm', Math.round(tempo.bpm));
      uiCall('setConfidence', tempo.confidence);
      if (keyEst.current) uiCall('setKey', keyEst.current.name);
      const playing = state.armed && (pad.active() || (audio.ctx && oca.playingRecently(audio.currentTime)));
      uiCall('setPlayLed', !!playing);
      uiCall('setDetectLed', t - state.lastActivityMs < 400);
      uiCall('setArmed', state.armed);
    }
  }

  function start() {
    audio.ensure();
    state.armed = true;
    if (state.mode === 'ocarina') {
      oca.setIdleMs(nowMs() - state.lastActivityMs);
      if (detector.current) oca.setChord(detector.current, currentScale(), audio.currentTime);
      oca.start(audio.currentTime);
    } else if (detector.current) {
      pad.setChord(detector.current, audio.currentTime);
    }
    uiCall('setArmed', true);
  }

  function stop() {
    state.armed = false;
    const now = audio.ctx ? audio.currentTime : 0;
    pad.release(now);
    oca.stop();
    uiCall('setArmed', false);
  }

  function panic() {
    state.armed = false;
    const now = audio.ctx ? audio.currentTime : 0;
    pad.kill(now);
    oca.panic(now);
    audio.panic(now);
    uiCall('setArmed', false);
  }

  function currentScale() {
    return keyEst.current ? scalePcs(keyEst.current.tonic, keyEst.current.mode) : null;
  }

  function setMode(mode) {
    if (mode !== 'pad' && mode !== 'ocarina') return;
    const prev = state.mode;
    state.mode = mode;
    if (state.armed) {
      const now = audio.ctx ? audio.currentTime : 0;
      if (prev === 'pad' && mode === 'ocarina') {
        pad.release(now);
        oca.setIdleMs(nowMs() - state.lastActivityMs);
        if (detector.current) oca.setChord(detector.current, currentScale(), now);
        oca.start(now);
      } else if (prev === 'ocarina' && mode === 'pad') {
        oca.stop();
        if (detector.current) pad.setChord(detector.current, now);
      }
    }
    uiCall('setModePanels', mode);
  }

  function setStyle(style) {
    oca.setParams({ style });
    uiCall('setStyleDisplay', style);
  }

  function setPadParams(p) {
    pad.setParams(p);
  }

  function setOcarinaParams(p) {
    oca.setParams(p);
  }

  function setMasterVolume(v) {
    audio.setMasterVolume(v);
  }

  function setMuted(m) {
    audio.setMuted(m);
    uiCall('setMuted', m);
  }

  function nudgeBpm(delta) {
    tempo.setAuto(false);
    tempo.setManualBpm(Math.max(50, Math.min(200, Math.round(tempo.bpm) + delta)));
    uiCall('setAuto', false);
  }

  function setAutoTempo(on) {
    tempo.setAuto(on);
    uiCall('setAuto', on);
  }

  function handleMidiDisconnect() {
    tracker.clearAll();
    detector.current = null;
    detector.pending = null;
    prog.clear();
    oca.stop();
    const now = audio.ctx ? audio.currentTime : 0;
    pad.release(now);
    uiCall('setChordDisplay', '–', 'MIDI disconnected. Reconnect your keyboard.');
  }

  return {
    noteOn, noteOff, sustain, tick, start, stop, panic,
    setMode, setStyle, setPadParams, setOcarinaParams,
    setMasterVolume, setMuted, nudgeBpm, setAutoTempo,
    handleMidiDisconnect,
    detectCycle,
    state, tracker, tempo, detector, keyEst, prog, pad, oca, audio,
  };
}

export function bootBrowser() {
  const $ = s => document.querySelector(s);
  const refs = {
    setStatusText: t => { $('#st').textContent = t; },
    setChordDisplay: (sym, label) => { $('#cn').textContent = sym; $('#cs').textContent = label; },
    setKey: name => { $('#keyName').textContent = name; },
    setBpm: n => { $('#bpm').textContent = n; },
    setConfidence: f => { $('#conf').style.width = Math.round(f * 100) + '%'; },
    setProgression: syms => {
      const el = $('#prog');
      el.innerHTML = '';
      syms.forEach((s, i) => {
        const chip = document.createElement('span');
        chip.className = 'chip' + (i === syms.length - 1 ? ' cur' : '');
        chip.textContent = s;
        el.appendChild(chip);
      });
    },
    setDetectLed: on => { $('#ledDetect').classList.toggle('on', on); },
    setPlayLed: on => { $('#ledPlay').classList.toggle('on', on); },
    setArmed: on => {
      const b = $('#play');
      b.textContent = on ? 'Stop accompaniment' : 'Start accompaniment';
      b.setAttribute('aria-pressed', on);
    },
    setModePanels: mode => {
      $('#padPanel').hidden = mode !== 'pad';
      $('#ocaPanel').hidden = mode !== 'ocarina';
    },
    setStyleDisplay: s => { },
    setAuto: on => {
      const b = $('#auto');
      b.textContent = 'Auto: ' + (on ? 'on' : 'off');
      b.setAttribute('aria-pressed', on);
    },
    setMuted: m => {
      const b = $('#mute');
      b.textContent = m ? 'Unmute' : 'Mute';
      b.setAttribute('aria-pressed', m);
    },
    pulseDetect: () => { },
  };

  const app = createApp({ ui: refs });

  const seg = (id, fn) => {
    $(id).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      fn(b.dataset.v);
    });
  };

  seg('#mode', v => app.setMode(v));
  seg('#styleSeg', v => app.setStyle(v));
  seg('#texture', v => app.setPadParams({ texture: v }));

  const bindSlider = (id, fn, fmt) => {
    const el = $(id);
    el.addEventListener('input', () => {
      fn(+el.value);
      const out = $(id + 'Val');
      if (out) out.textContent = fmt ? fmt(+el.value) : el.value;
    });
  };
  bindSlider('#padVol', v => app.setPadParams({ volume: v / 100 }), v => v + '%');
  bindSlider('#padAtk', v => app.setPadParams({ attack: v / 1000 }), v => (v / 1000).toFixed(2) + 's');
  bindSlider('#padRel', v => app.setPadParams({ release: v / 1000 }), v => (v / 1000).toFixed(2) + 's');
  bindSlider('#ocaVol', v => app.setOcarinaParams({ volume: v / 100 }), v => v + '%');
  bindSlider('#ocaInt', v => app.setOcarinaParams({ intensity: v / 100 }), v => v + '%');
  bindSlider('#masterVol', v => app.setMasterVolume(v / 100), v => v + '%');

  $('#play').addEventListener('click', () => { app.state.armed ? app.stop() : app.start(); });
  $('#mute').addEventListener('click', () => app.setMuted(!app.audio.muted));
  $('#panic').addEventListener('click', () => app.panic());
  $('#dn').addEventListener('click', () => app.nudgeBpm(-4));
  $('#up').addEventListener('click', () => app.nudgeBpm(4));
  $('#auto').addEventListener('click', () => app.setAutoTempo(!app.tempo.auto));

  const midi = new MidiInput({
    onMessage: msg => {
      if (msg.type === 'noteon') app.noteOn(msg.note, msg.velocity);
      else if (msg.type === 'noteoff') app.noteOff(msg.note);
      else if (msg.type === 'sustain') app.sustain(msg.on);
    },
    onDevices: devices => {
      const sel = $('#midiSel');
      const current = sel.value;
      sel.innerHTML = '';
      const optAll = document.createElement('option');
      optAll.value = 'auto';
      optAll.textContent = 'All inputs';
      sel.appendChild(optAll);
      for (const d of devices) {
        const o = document.createElement('option');
        o.value = d.id;
        o.textContent = d.name;
        sel.appendChild(o);
      }
      sel.value = devices.some(d => d.id === current) ? current : 'auto';
      refs.setStatusText(midi.statusText());
    },
    onDisconnect: () => {
      app.handleMidiDisconnect();
      refs.setStatusText('Keyboard disconnected. Accompaniment muted until you reconnect.');
    },
  });

  $('#conn').addEventListener('click', async () => {
    try {
      await midi.connect();
      refs.setStatusText(midi.statusText());
    } catch (err) {
      if (err.message === 'unsupported') {
        refs.setStatusText('This browser can’t read MIDI. Open this page in Chrome or Edge on desktop or Android.');
      } else {
        refs.setStatusText('MIDI access was blocked. Allow it in the browser prompt, then try again.');
      }
    }
  });

  $('#midiSel').addEventListener('change', e => midi.setDevice(e.target.value));

  setInterval(() => app.tick(), 40);

  const piano = new OnscreenPiano($('#piano'), {
    onNoteOn: (m, v) => app.noteOn(m, v),
    onNoteOff: m => app.noteOff(m),
  });
  setInterval(() => piano.paint(app.tracker.sounding()), 80);

  if (typeof location !== 'undefined' && /[?&]lab(?:[=&]|$)/.test(location.search)) {
    const lab = $('#soundlab');
    if (lab) {
      lab.hidden = false;
      import('./soundlab.js')
        .then(m => m.setupSoundLab(app, lab))
        .catch(() => {});
    }
  }
}

if (typeof document !== 'undefined' && document.getElementById('kc-app')) {
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
    });
  }
  bootBrowser();
}
