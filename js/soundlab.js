import { PadEngine } from './pad.js';
import { OcarinaEngine } from './ocarina.js';
import { makeChord, CHORD_TEMPLATES, scalePcs } from './theory.js';

const TPL = suffix => CHORD_TEMPLATES.find(t => t.suffix === suffix);

export function createSoundLab(app) {
  const audio = app.audio;
  const pad = new PadEngine(audio);
  const ocaVoices = new Set();
  const ocaAudio = Object.create(audio);
  ocaAudio.ocarinaNote = (...args) => {
    const voice = audio.ocarinaNote(...args);
    const kill = voice.kill;
    voice.kill = at => { ocaVoices.delete(voice); kill(at); };
    ocaVoices.add(voice);
    return voice;
  };
  const oca = new OcarinaEngine(ocaAudio, { seed: 2026, intensity: 0.78 });
  const state = { texture: 'warm', bpm: 100, ocaStyle: null, owner: null };
  let tick = null;
  let chordTimer = null;
  let lastHandle = null;

  function clearTimers() {
    if (tick) { clearInterval(tick); tick = null; }
    if (chordTimer) { clearInterval(chordTimer); chordTimer = null; }
    state.owner = null;
  }

  function killPad() {
    pad.kill(audio.currentTime);
    if (lastHandle) { lastHandle.release(audio.currentTime); lastHandle = null; }
  }

  function killOca() {
    const now = audio.currentTime;
    for (const v of [...ocaVoices]) {
      if (v.endTime !== Infinity && v.endTime <= now) { ocaVoices.delete(v); continue; }
      v.kill(now);
    }
    ocaVoices.clear();
    oca.stop();
  }

  function silenceAll() {
    clearTimers();
    killPad();
    killOca();
    if (audio.ctx) audio.panic(audio.currentTime);
  }

  function stopPad() {
    killPad();
    if (state.owner === 'pad') clearTimers();
  }

  function stopOca() {
    killOca();
    clearTimers();
  }

  function stopAll() {
    silenceAll();
    app.panic();
  }

  function playPadNote() {
    silenceAll();
    audio.ensure();
    lastHandle = audio.padChord([60], audio.currentTime + 0.03, { texture: state.texture, attack: 0.6, release: 1.4 });
  }

  function playPadChord(chord) {
    silenceAll();
    audio.ensure();
    pad.setParams({ texture: state.texture });
    pad.setChord(chord, audio.currentTime + 0.03);
  }

  function playPadWalk() {
    silenceAll();
    audio.ensure();
    pad.setParams({ texture: state.texture });
    const chords = [makeChord(0, TPL(''), 0), makeChord(9, TPL('m'), 9), makeChord(5, TPL(''), 5), makeChord(7, TPL(''), 7)];
    let i = 0;
    const step = () => pad.setChord(chords[i++ % chords.length], audio.currentTime + 0.03);
    step();
    state.owner = 'pad';
    chordTimer = setInterval(step, (240 / state.bpm) * 1000);
  }

  function playOcaNote(midi) {
    silenceAll();
    audio.ensure();
    ocaAudio.ocarinaNote(midi, audio.currentTime + 0.03, 1.0, 0.9, {});
  }

  function playOcaRun() {
    silenceAll();
    audio.ensure();
    const now = audio.currentTime + 0.03;
    [72, 76, 79, 84].forEach((m, i) => ocaAudio.ocarinaNote(m, now + i * 0.55, 0.5, 0.88, {}));
  }

  function playOcaPhrase(style) {
    silenceAll();
    audio.ensure();
    state.ocaStyle = style;
    oca.setParams({ style: style === 'makossa' ? 'ariaria' : 'makossa' });
    oca.setParams({ style });
    const bar = 240 / state.bpm;
    oca.setBeat({ periodSec: 60 / state.bpm, phaseSec: audio.currentTime + 0.1, confidence: 0.9 });
    oca.setIdleMs(0);
    const scale = scalePcs(0, 'major');
    const prog = [makeChord(0, TPL(''), 0), makeChord(9, TPL('m'), 9), makeChord(5, TPL(''), 5), makeChord(7, TPL(''), 7)];
    oca.setChord(prog[0], scale);
    oca.start(audio.currentTime + 0.1);
    let i = 0;
    state.owner = 'oca';
    tick = setInterval(() => oca.tick(audio.currentTime), 40);
    const barsPer = style === 'ariaria' ? 2 : 1;
    chordTimer = setInterval(() => {
      i = (i + 1) % prog.length;
      oca.setChord(prog[i], scale, audio.currentTime);
    }, bar * barsPer * 1000);
  }

  function setVolume(v) {
    const fn = typeof app.setMasterVolume === 'function'
      ? app.setMasterVolume.bind(app)
      : audio.setMasterVolume.bind(audio);
    fn(Math.max(0, Math.min(1, v)));
  }

  function setTexture(name) {
    state.texture = name;
    playPadChord(makeChord(0, TPL(''), 0));
  }

  function setBpm(n) {
    state.bpm = n;
    if (state.owner === 'oca' && state.ocaStyle) playOcaPhrase(state.ocaStyle);
    else if (state.owner === 'pad') playPadWalk();
  }

  return {
    playPadNote, playPadChord, playPadWalk,
    playOcaNote, playOcaRun, playOcaPhrase,
    stopPad, stopOca, stopAll, setVolume, setTexture, setBpm,
    state,
  };
}

export function setupSoundLab(app, root) {
  const lab = createSoundLab(app);

  const seg = (sel, fn) => {
    const el = root.querySelector(sel);
    if (!el) return;
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      fn(b.dataset.v);
    });
  };

  seg('#labPad', v => {
    if (v === 'note') lab.playPadNote();
    else if (v === 'maj') lab.playPadChord(makeChord(0, TPL(''), 0));
    else if (v === 'min') lab.playPadChord(makeChord(0, TPL('m'), 0));
    else if (v === 'maj7') lab.playPadChord(makeChord(0, TPL('maj7'), 0));
    else if (v === 'walk') lab.playPadWalk();
  });
  seg('#labTex', v => lab.setTexture(v));
  seg('#labOca', v => {
    if (v === 'c5') lab.playOcaNote(72);
    else if (v === 'g5') lab.playOcaNote(79);
    else if (v === 'c6') lab.playOcaNote(84);
    else if (v === 'run') lab.playOcaRun();
    else if (v === 'makossa' || v === 'ariaria') lab.playOcaPhrase(v);
  });
  seg('#labBpm', v => lab.setBpm(+v));

  const stopBtn = root.querySelector('#labStop');
  if (stopBtn) stopBtn.addEventListener('click', lab.stopAll);
  const stopPadBtn = root.querySelector('#labStopPad');
  if (stopPadBtn) stopPadBtn.addEventListener('click', lab.stopPad);
  const stopOcaBtn = root.querySelector('#labStopOca');
  if (stopOcaBtn) stopOcaBtn.addEventListener('click', lab.stopOca);

  const vol = root.querySelector('#labVol');
  const volVal = root.querySelector('#labVolVal');
  const master = document.querySelector('#masterVol');
  const masterVal = document.querySelector('#masterVolVal');
  const syncVolume = (v, fromLab) => {
    lab.setVolume(v / 100);
    if (vol && !fromLab) vol.value = String(v);
    if (volVal) volVal.textContent = v + '%';
    if (master && fromLab) master.value = String(v);
    if (masterVal && fromLab) masterVal.textContent = v + '%';
  };
  if (vol) vol.addEventListener('input', () => syncVolume(+vol.value, true));
  if (master) master.addEventListener('input', () => syncVolume(+master.value, false));

  return lab;
}
