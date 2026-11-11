# Real MIDI Keyboard Testing Guide

Use this guide to evaluate Keys Companion with an actual keyboard. It assumes no
audio-quality conclusions — only you can judge what you hear.

## 1. Before you start

- Use Chrome or Edge (desktop, or Chrome on Android). Safari/Firefox do not
  expose Web MIDI.
- Serve the app over `https` or `localhost` — browsers block MIDI on plain
  `http` pages. From the repo: `npm run serve` then open
  `http://localhost:8000/`.
- Use headphones or decent speakers at a comfortable level. Start with the
  app's Master volume at about 70–75%.
- Have a MIDI keyboard connected by USB (or paired Bluetooth MIDI) before
  loading the page, if possible.

## 2. Connect the keyboard

1. Open the app. The status line should say to plug in a keyboard or use the
   on-screen keys.
2. Click **Connect MIDI** and accept the browser permission prompt.
3. If several devices are listed, open the **Input** dropdown and pick yours.
   "All inputs" works when only one keyboard is connected.
4. Play a few notes. The **Detect** LED should light and the on-screen piano
   should highlight the keys.
5. If nothing happens: check the cable/pairing, reload the page, confirm the
   permission was granted, and try the dropdown again. Some keyboards need to
   be switched to "MIDI" or "computer" mode.

## 3. Basic detection check

1. Play a C major triad (C–E–G) and hold it.
2. Confirm the chord display shows `C`, the key display converges to
   `C major`, and the progression strip logs `C`.
3. Play Am, F and G in turn — the names should update without flicker when you
   move between them. Passing notes while changing chords should not produce a
   stream of wrong chord names.
4. Play single notes only: the chord display should say to play two or more
   keys, and the key estimate should not jump wildly.
5. Use the sustain pedal while changing chords — it should behave like a
   normal piano and not confuse detection.

## 4. Test the Pad

1. Select **Pad**, choose **Warm**, then press **Start accompaniment**.
2. Hold a chord. The pad should fade in smoothly (Attack slider) and sustain
   without wobble, clicks or distortion.
3. Change chords every bar or two. Listen for:
   - smooth voice leading (small moves, no big jumps);
   - no thumps, clicks or gaps at the change;
   - release tails from the previous chord not smearing the new harmony.
4. Try all four textures (**Warm / Glass / Strings / Choir**) on the same
   progression. Note which are usable and whether loudness stays consistent.
5. Sweep the **Attack** and **Release** sliders slowly. No zipper noise or
   clicks should be audible.
6. Stop playing for ~3 seconds. The pad should fade out on its own (idle fade),
   and the **Play** LED should go off. Play again — it should come back.
7. Move the **Volume** slider while the pad sounds: changes should be smooth.

## 5. Test the Ocarina

1. Select **Ocarina**, choose **Makossa**, press **Start accompaniment**.
2. Play a chord progression (for example C–Am–F–G) in a steady tempo.
3. The ocarina should enter with short phrases that follow your chord and key,
   with rests between phrases. It should not play constantly.
4. Change the **Activity** slider: low values should mean sparser, calmer
   phrases; high values busier but still musical.
5. Play slower and faster. With **Auto** tempo on, the phrase timing should
   follow you after a few beats. With Auto off, use the BPM −/+ buttons to set
   the tempo manually.
6. Stop playing. After a few seconds of silence the ocarina should rest.

## 6. Compare Makossa and Araria

1. While a progression is running, switch **Makossa → Araria** and back.
2. Expect the new style to take effect on the next phrase (not mid-note) and no
   stuck or doubled notes at the switch.
3. Makossa: one-bar phrases, syncopated, more rests. Araria: two-bar phrases,
   denser and more even. Judge whether the difference is clear and musical.
4. Try both at 80, 100 and 130 BPM.

## 7. What to listen for (and how to identify problems)

**Latency**
- Play a note and compare the piano sound (if your keyboard makes its own
  sound) with the on-screen response and the accompaniment entry.
- Noticeable delay before the pad changes chord or the ocarina phrase starts is
  a problem. Bluetooth MIDI and Bluetooth audio both add delay; test wired
  first.
- Note whether latency affects detection (chords named late/wrong) or only
  audio scheduling.

**Clipping / distortion**
- Listen at high Master volume and with many notes held. Crackling, fizzing or
  a flat "pinched" sound indicates clipping. The engine includes a compressor
  and the renders contain no clipped samples, so report any distortion with the
  volume setting and chord used.

**Unwanted notes**
- Wrong chord tones (notes outside the chord/scale) in pad or ocarina.
- Stuck notes after release, after stopping accompaniment, after **Stop all**,
  or after switching mode/style.
- Stray ocarina notes during rests, double-triggered notes, or notes that
  continue after you stop playing.
- Pad chords that keep sounding after you release the keys and the release time.

**Poor transitions**
- Abrupt or clicking chord changes; pitch glides that sound wrong.
- Style/mode switches that cut off abruptly mid-note or leave the old phrase
  running.
- Tails colliding into mud, or a gap of silence at every change.
- Tempo changes that make phrases land off-beat.

**Other**
- Disconnect the keyboard mid-performance: audio should mute/stop, and
  reconnecting should resume detection. Check for stuck notes across
  disconnect.
- Press **Mute**, then **Stop all** (panic). Everything should stop immediately
  with no residue, and the next note should work normally.

## 8. Reporting what you find

For each issue, note:

1. What you played (chords, tempo, style/texture, sliders).
2. What you expected.
3. What you heard (latency, click, wrong note, stuck note, transition).
4. Browser and OS, wired or Bluetooth, headphones or speakers, volume level.
5. Whether it reproduces, and roughly when in the session it happened.

That is enough for a developer to reproduce and fix it.

## Quick checklist

- [ ] MIDI connects and the input device is selectable
- [ ] Chord names, key and progression update correctly
- [ ] Pad: smooth attack/release, no clicks, clean chord changes
- [ ] Pad: all four textures usable and level-matched
- [ ] Pad: idle fade-out and resume work
- [ ] Ocarina: phrases follow chord, key and tempo
- [ ] Ocarina: rests are natural; no stray notes
- [ ] Makossa vs Araria clearly different; style switch is clean
- [ ] Tempo following works at slow and fast tempos
- [ ] No stuck notes after stop, mute, panic, mode/style switch or disconnect
- [ ] No distortion at high volume
- [ ] Latency acceptable for live playing
