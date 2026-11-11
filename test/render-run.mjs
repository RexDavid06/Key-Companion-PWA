import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AudioEngine } from '../js/audio.js';
import { PadEngine } from '../js/pad.js';
import { OcarinaEngine } from '../js/ocarina.js';
import { makeChord, CHORD_TEMPLATES, scalePcs } from '../js/theory.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.find(a => a.startsWith('--out='));
const OUT = path.resolve(ROOT, outArg ? outArg.slice(6) : 'audio-previews');
fs.mkdirSync(OUT, { recursive: true });

async function loadWebAudio() {
  try {
    const m = await import('node-web-audio-api');
    return m.OfflineAudioContext || (m.default && m.default.OfflineAudioContext);
  } catch (e) {
    const { createRequire } = await import('node:module');
    for (const base of [path.join(ROOT, 'package.json'), '/tmp/opencode/package.json']) {
      try {
        const req = createRequire(base);
        const m = req('node-web-audio-api');
        return m.OfflineAudioContext || (m.default && m.default.OfflineAudioContext);
      } catch (e2) { }
    }
  }
  return null;
}

const OfflineAudioContext = await loadWebAudio();
if (!OfflineAudioContext) {
  console.error('node-web-audio-api not available. Install it with: npm i -D node-web-audio-api');
  process.exit(2);
}

const SR = 44100;

function engineFor(ctx) {
  const audio = new AudioEngine({ createContext: () => ctx, nowMs: () => 0 });
  audio.ensure();
  return audio;
}

function chordBySymbol(sym) {
  const map = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const m = /^([A-G][#b]?)(m|maj7|m7|7|dim|aug|sus4|m7b5|6)?$/.exec(sym);
  if (!m) throw new Error('bad chord ' + sym);
  const root = map[m[1]];
  const suffix = m[2] || '';
  const tpl = CHORD_TEMPLATES.find(t => t.suffix === suffix);
  if (!tpl) throw new Error('no template ' + suffix);
  return makeChord(root, tpl, root);
}

function encodeWav(buffer) {
  const ch = buffer.numberOfChannels;
  const n = buffer.length;
  const bytes = 44 + n * ch * 2;
  const out = Buffer.alloc(bytes);
  out.write('RIFF', 0); out.writeUInt32LE(bytes - 8, 4); out.write('WAVE', 8);
  out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(ch, 22);
  out.writeUInt32LE(buffer.sampleRate, 24); out.writeUInt32LE(buffer.sampleRate * ch * 2, 28);
  out.writeUInt16LE(ch * 2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(n * ch * 2, 40);
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      out.writeInt16LE(Math.round(s * 32767), off);
      off += 2;
    }
  }
  return out;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

function analyze(buffer) {
  const L = buffer.getChannelData(0);
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  const n = buffer.length;
  let peak = 0, sum = 0, side = 0, mid = 0, corr = 0, l2 = 0, r2 = 0, dc = 0, clipped = 0, maxSlew = 0;
  let pl = 0, pr = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R[i];
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    dc += l + r;
    const dl = Math.abs(l - pl), dr = Math.abs(r - pr);
    if (dl > maxSlew) maxSlew = dl;
    if (dr > maxSlew) maxSlew = dr;
    pl = l; pr = r;
    sum += l * l + r * r;
    side += (l - r) * (l - r);
    mid += (l + r) * (l + r);
    corr += l * r; l2 += l * l; r2 += r * r;
  }
  const rms = Math.sqrt(sum / (2 * n));
  const N = 2048, hop = 4096;
  let centSum = 0, lowSum = 0, midSum = 0, highSum = 0, frames = 0;
  const hann = new Float32Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  for (let start = 0; start + N <= n; start += hop) {
    let e = 0;
    for (let i = 0; i < N; i++) { const v = (L[start + i] + R[start + i]) * 0.5 * hann[i]; e += v * v; }
    if (e / N < 1e-7) continue;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = (L[start + i] + R[start + i]) * 0.5 * hann[i];
    fft(re, im);
    let w = 0, cen = 0, lo = 0, md = 0, hi = 0;
    for (let k = 1; k < N / 2; k++) {
      const f = k * buffer.sampleRate / N;
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      w += mag; cen += f * mag;
      if (f < 250) lo += mag; else if (f < 2000) md += mag; else hi += mag;
    }
    if (w > 0) {
      centSum += cen / w; lowSum += lo / w; midSum += md / w; highSum += hi / w; frames++;
    }
  }
  return {
    peak: +peak.toFixed(4),
    peakDb: +(20 * Math.log10(Math.max(peak, 1e-9))).toFixed(1),
    rms: +rms.toFixed(4),
    rmsDb: +(20 * Math.log10(Math.max(rms, 1e-9))).toFixed(1),
    centroidHz: frames ? Math.round(centSum / frames) : 0,
    low: frames ? +(lowSum / frames).toFixed(3) : 0,
    mid: frames ? +(midSum / frames).toFixed(3) : 0,
    high: frames ? +(highSum / frames).toFixed(3) : 0,
    sideMid: +Math.sqrt(side / Math.max(mid, 1e-9)).toFixed(3),
    lrCorr: +(corr / Math.sqrt(Math.max(l2 * r2, 1e-9))).toFixed(3),
    dc: +(dc / (2 * n)).toFixed(5),
    maxSlew: +maxSlew.toFixed(4),
    clipped,
    seconds: +(n / buffer.sampleRate).toFixed(2),
  };
}

async function render(seconds, build) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const audio = engineFor(ctx);
  const extra = build(audio);
  const buf = await ctx.startRendering();
  return { buf, extra };
}

async function renderPadChord(notes, texture) {
  return render(5.5, audio => {
    audio.padChord(notes, 0.05, { texture, attack: 0.6, release: 1.4 });
  });
}

async function renderPadTextures() {
  return render(9.5, audio => {
    const textures = ['warm', 'glass', 'strings', 'choir'];
    let h = null;
    textures.forEach((tex, i) => {
      if (h) h.release(0.1 + i * 2.2);
      h = audio.padChord([48, 55, 60, 64, 67], 0.1 + i * 2.2, { texture: tex, attack: 0.35, release: 0.9 });
    });
    h.release(0.1 + 4 * 2.2);
  });
}

async function renderPadProgression(bpm, symbols, texture) {
  return render(11.5, audio => {
    const pad = new PadEngine(audio);
    pad.setParams({ texture, attack: 0.5, release: 1.2 });
    const bar = 240 / bpm;
    symbols.forEach((s, i) => pad.setChord(chordBySymbol(s), 0.1 + i * bar));
    pad.release(0.1 + symbols.length * bar);
  });
}

async function renderOcarinaNotes() {
  return render(4.2, audio => {
    const seq = [[72, 0.15], [76, 1.05], [79, 1.95], [84, 2.85]];
    for (const [m, t] of seq) audio.ocarinaNote(m, t, 0.7, 0.85, {});
  });
}

async function renderOcarinaPhrase(style, bpm, symbols) {
  return render(11.5, audio => {
    const oca = new OcarinaEngine(audio, { seed: 7, style, intensity: 0.72 });
    oca.setParams({ style: style === 'makossa' ? 'ariaria' : 'makossa' });
    oca.setParams({ style });
    oca.setBeat({ periodSec: 60 / bpm, phaseSec: 0.1, confidence: 0.9 });
    oca.setIdleMs(0);
    const scale = scalePcs(0, 'major');
    const bar = 240 / bpm;
    const barsPer = style === 'ariaria' ? 2 : 1;
    oca.setChord(chordBySymbol(symbols[0]), scale);
    oca.start(0.1);
    let ci = 0;
    const dur = 9.5;
    for (let t = 0; t < dur; t += 0.02) {
      if (t >= 0.1 + (ci + 1) * bar * barsPer && ci + 1 < symbols.length) {
        ci++;
        oca.setChord(chordBySymbol(symbols[ci]), scale, t);
      }
      oca.tick(t);
    }
    oca.stop();
    return oca.notesPlayed.length;
  });
}

const results = [];
const add = async (name, p) => {
  const { buf, extra } = await p;
  const metrics = analyze(buf);
  if (extra !== undefined) metrics.noteCount = extra;
  fs.writeFileSync(path.join(OUT, name + '.wav'), encodeWav(buf));
  results.push({ name, ...metrics });
  console.log(name.padEnd(44) + ' peak ' + String(metrics.peak).padEnd(6) + ' rms ' + String(metrics.rmsDb).padEnd(6) + 'dB centroid ' + String(metrics.centroidHz).padEnd(5) + 'Hz low/mid/high ' + metrics.low + '/' + metrics.mid + '/' + metrics.high + ' width ' + metrics.sideMid + ' clip ' + metrics.clipped + ' slew ' + metrics.maxSlew + (metrics.noteCount !== undefined ? ' notes ' + metrics.noteCount : ''));
};

await add('pad-warm-chord', renderPadChord([48, 55, 60, 64, 67], 'warm'));
await add('pad-textures-shootout', renderPadTextures());
await add('pad-progression-c-am-f-g-100bpm', renderPadProgression(100, ['C', 'Am', 'F', 'G', 'C'], 'warm'));
await add('ocarina-single-notes', renderOcarinaNotes());
await add('ocarina-makossa-c-am-f-g-100bpm', renderOcarinaPhrase('makossa', 100, ['C', 'Am', 'F', 'G', 'C']));
await add('ocarina-ariaria-c-am-f-g-100bpm', renderOcarinaPhrase('ariaria', 100, ['C', 'Am', 'F', 'G', 'C']));
await add('ocarina-makossa-130bpm', renderOcarinaPhrase('makossa', 130, ['C', 'Am', 'F']));

fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(results, null, 2));
console.log('wrote ' + results.length + ' WAVs + metrics.json to ' + OUT);
