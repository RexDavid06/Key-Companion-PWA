# Keys Companion

A pianist's musical companion. Connect a MIDI keyboard and play along with pads or an ocarina vamp in reggae, makossa, or ariaria style.

## Run locally

Web MIDI and service workers require a secure context (`https` or `localhost`). From the project folder run:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser that supports Web MIDI, such as Chrome. The app shell is cached for offline use after the first successful load.

## Deploy and install

Deploy the repository as a static site over HTTPS. GitHub Pages is supported; enable Pages for the repository in its Settings and wait for the deployment to finish. Open the deployed site in a supported browser and use its **Install app** / **Add to Home Screen** option. The site must be opened online once so the service worker can install and cache the app shell.

## PWA files

- `index.html`: app interface and PWA metadata
- `style.css`: styling, light and dark themes
- `app.js`: MIDI input, chord detection, pad, ocarina vamp, and tempo detection
- `manifest.webmanifest`: app name, scope, display mode, theme, and icons
- `sw.js`: service worker for install-time caching and offline app shell
- `icon-192.png`, `icon-512.png`: app icons

## Notes

- Web MIDI works in supported browsers on Android and desktop. iOS Safari does not support Web MIDI, so MIDI keyboard following is not available there through this web app.
- Install prompts and MIDI support vary by browser and platform.
- Rhythm patterns live in the `PAT` object in `app.js`.
