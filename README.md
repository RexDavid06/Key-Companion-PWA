# Keys Companion

A real-time intelligent accompaniment app for pianists and keyboardists. Connect a MIDI keyboard, play normally, and the app listens: it detects your chords (including inversions), estimates the musical key, tracks your chord progression, follows your tempo, and plays a complementary accompaniment instrument of your choice.

This is not a piano-learning app or a chord dictionary. It is a performance companion: you concentrate on playing, it accompanies.

## How it works

1. Press **Connect MIDI** and pick your keyboard (or leave "All inputs").
2. Play. The big display shows the detected chord; the key and chord-progression history appear above it; BPM and tempo confidence update live.
3. Choose an accompaniment instrument: **Pad** (sustained harmonic pad that follows your chords with voice leading) or **Ocarina** (melodic vamp).
4. For Ocarina, choose a rhythm style: **Makossa** (syncopated, staccato, call-and-response) or **Araria** (flowing highlife-style phrases).
5. Press **Start accompaniment**. Press **Stop** to end, **Mute** to silence temporarily, **■ Stop all** for an emergency stop.

## Musical behavior

- Chord recognition works across voicings and inversions and does not flip on passing notes or ornaments (candidates must be confirmed before a switch).
- The pad uses voice-leading voicings to minimize jumps between chords, crossfades on chord changes, and fades out after you stop playing.
- The ocarina plays phrases (not note-for-note echoes), uses chord tones plus scale passing tones, leaves musical space, rests between phrases, and follows your detected tempo and beat phase.
- When pianists play dense passages, the ocarina thins out and rests more (anti-clash). When tempo confidence is low, the accompaniment becomes conservative instead of erratic.
- The sustain pedal (CC 64) is tracked — chords keep sounding while you hold the pedal.
- Tempo is estimated from MIDI note-on timings; use the − / + buttons for manual override, or Auto to re-enable tempo following.

## Run locally

Web MIDI and service workers require a secure context (`https` or `localhost`):

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in Chrome or Edge (desktop or Android). iOS Safari does not support Web MIDI, so MIDI-following is unavailable there; the on-screen piano and computer keys still work.

## Tests

```sh
npm test
```

The Node test suite covers chord detection (major, minor, 7ths, inversions, passing notes), key estimation, progression tracking, tempo detection and adaptation, pad voice leading, ocarina phrase generation and style differences, MIDI message parsing (including sustain), audio engine voice budgets/scheduling/headroom, and an end-to-end simulation with a mock AudioContext (start/stop, mode switching, panic, stuck-note prevention, MIDI disconnect). Physical MIDI hardware testing is a separate manual acceptance step — see below.

## Audio previews and sound lab

Render the actual engine to WAV files with a real Web Audio implementation (`node-web-audio-api`, installed outside the repo):

```sh
npm run render -- --out=audio-previews/after
```

This writes seven 16-bit stereo WAVs plus `metrics.json` (peak, RMS, spectral centroid, band balance, stereo width, clipping, max slew). To audition pad textures, chords, ocarina notes and both rhythm styles interactively, open the app with `?lab` in the URL (for example `http://localhost:8000/?lab`) and use the **Sound lab** panel.

Ready-to-listen copies and a per-file evaluation guide are in [`audio-previews/human-evaluation/`](audio-previews/human-evaluation/README.md).

## Connecting a real MIDI keyboard

1. Plug a USB MIDI keyboard into your computer (or pair a Bluetooth MIDI device), then load the app over `https` or `localhost`.
2. Click **Connect MIDI** and accept the browser permission prompt.
3. Pick your device in the **Input** dropdown if several are listed.
4. Play a C major triad — the display should show `C`, the key should converge to `C major`, and the progression should log `C`.
5. Press **Start accompaniment** with **Pad**, play `C → Am → F → G` and confirm the pad follows each chord.
6. Switch to **Ocarina**, try both styles, and confirm they sound different.
7. Pull the keyboard's USB cable mid-performance: the app should mute the accompaniment and ask you to reconnect.

For a full step-by-step evaluation script (including how to identify latency, clipping, unwanted notes and poor transitions), see [`docs/midi-testing.md`](docs/midi-testing.md).

## PWA files

- `index.html` / `style.css` — performance-oriented interface
- `js/midi.js` — Web MIDI access, device selection, sustain pedal, graceful disconnects
- `js/theory.js` — note tracking, chord detection with hysteresis, key estimation, progression
- `js/rhythm.js` — tempo/beat estimation, confidence, manual override
- `js/pad.js` — pad voicing with voice leading
- `js/ocarina.js` — Makossa and Araria phrase engines
- `js/audio.js` — Web Audio synthesis (pads, ocarina voices, buses, panic)
- `js/piano.js` — on-screen piano and computer-key input
- `js/app.js` — integration, control logic, UI wiring
- `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png` — installable PWA shell

## Notes

- Rhythm patterns and phrase templates live in the `STYLES` object in `js/ocarina.js`.
- Microphone-based pitch detection is a possible future phase; the input layer is deliberately isolated (`js/midi.js` feeds a note event stream) so a mic front end could feed the same pipeline. A feedback-loop guard would be required before accompaniment sounds are analyzed by a mic input.
