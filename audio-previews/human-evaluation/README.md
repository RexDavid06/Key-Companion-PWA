# Keys Companion — Human Listening Evaluation

Seven reference recordings rendered from the app's real synthesis code using an
OfflineAudioContext (44100 Hz, 16-bit stereo PCM WAV). They are copies of the
files in `audio-previews/after/`; the originals were not modified.

All files were verified: valid RIFF/WAVE PCM headers, stereo 44.1 kHz, expected
duration, non-silent, zero clipped samples, DC offset below 0.0001. They play in
standard Windows (Media Player, VLC, foobar2000) and Android (Play Music, VLC,
Files) players.

Listen on headphones first (stereo width and reverb are part of the sound), then
on a phone/laptop speaker (typical real-world use).

## 1. pad-warm-chord.wav

- Instrument: Pad
- Texture: Warm
- Chord: C major voicing C3–G3–C4–E4–G4, sustained
- BPM: not applicable (single sustained chord)
- Duration: 5.5 s
- Peak / RMS: 0.199 / −24.1 dBFS
- Evaluate: warmth and body, attack smoothness, stereo spread, reverb depth,
  whether the low end is muddy, any harshness or audible beating.

## 2. pad-textures-shootout.wav

- Instrument: Pad
- Textures: Warm (0–2.3 s), Glass (2.3–4.5 s), Strings (4.5–6.7 s),
  Choir (6.7–8.9 s), each on the same C major voicing
- BPM: not applicable
- Duration: 9.5 s
- Peak / RMS: 0.541 / −24.0 dBFS
- Evaluate: are the four textures clearly distinct and usable? Is Glass too
  bright/thin, Strings too buzzy, Choir too nasal? Is the loudness consistent
  when switching?

## 3. pad-progression-c-am-f-g-100bpm.wav

- Instrument: Pad
- Texture: Warm
- Progression: C → Am → F → G → C
- BPM: 100 (one chord per bar)
- Duration: 11.5 s
- Peak / RMS: 0.564 / −21.1 dBFS
- Evaluate: smoothness of chord changes and voice leading, level consistency,
  muddiness in the low midrange, whether held-over release tails collide
  pleasantly or smear the harmony.

## 4. ocarina-single-notes.wav

- Instrument: Ocarina
- Notes: C5, E5, G5, C6 (one every 0.9 s, 0.7 s each)
- BPM: not applicable
- Duration: 4.2 s
- Peak / RMS: 0.199 / −22.8 dBFS
- Evaluate: tone realism, breath/chiff character, tuning, vibrato naturalness,
  attack and release smoothness, any hiss or whistle artifacts.

## 5. ocarina-makossa-c-am-f-g-100bpm.wav

- Instrument: Ocarina
- Style: Makossa (1-bar phrases, syncopated, more rests)
- Progression: C → Am → F → G → C
- BPM: 100
- Notes played: 13
- Duration: 11.5 s
- Peak / RMS: 0.163 / −29.4 dBFS
- Evaluate: rhythmic feel and groove, placement of rests, whether it sounds
  musical rather than random, fit with the chord changes.

## 6. ocarina-ariaria-c-am-f-g-100bpm.wav

- Instrument: Ocarina
- Style: Araria (2-bar phrases, denser, more even)
- Progression: C → Am → F → G → C
- BPM: 100
- Notes played: 21
- Duration: 11.5 s
- Peak / RMS: 0.173 / −26.8 dBFS
- Evaluate: contrast against the Makossa file, density and busyness, whether the
  two-bar phrase feels coherent, any awkward leaps or repeated notes.

## 7. ocarina-makossa-130bpm.wav

- Instrument: Ocarina
- Style: Makossa
- Progression: C → Am → F
- BPM: 130
- Notes played: 17
- Duration: 11.5 s
- Peak / RMS: 0.157 / −29.0 dBFS
- Evaluate: does the phrase still groove at a faster tempo? Are note lengths and
  rests appropriate, or does it sound rushed/thin? Compare with file 5.

## Comparison suggestions

- Files 5 vs 6: Makossa vs Araria at the same tempo and harmony.
- Files 5 vs 7: same style at 100 vs 130 BPM.
- Files 1 vs 3: single sustained chord vs moving progression.
- File 2: direct A/B of all four pad textures.

## What is still unknown

These are deterministic offline renders. They do not prove how the app sounds on
a real device (browser sample-rate conversion, speakers, Bluetooth latency) or
how the engines behave under live MIDI input. A human must listen and, ideally,
run the MIDI keyboard test in `docs/midi-testing.md`.
