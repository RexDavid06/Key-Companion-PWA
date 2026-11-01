# Keys Companion

A PWA for pianists. Connect a MIDI keyboard to your Android phone (USB or Bluetooth MIDI) and a pad or ocarina follows your chords and rhythm (reggae, makossa, ariaria).

## Run locally
Web MIDI and service workers need a secure context (https or localhost):

    python3 -m http.server 8000
    # open http://localhost:8000 in Chrome

## Deploy
Any static host works (GitHub Pages, Netlify, Render static site). Upload this folder as is.

## Files
- `index.html`: page structure
- `style.css`: styling, light and dark
- `app.js`: MIDI input, chord detection, pad, ocarina vamp, tempo detection
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support

## Notes
- Web MIDI works in Chrome on Android. iOS Safari does not support it, so iOS needs a native app later.
- Rhythm patterns live in the `PAT` object in `app.js`.
