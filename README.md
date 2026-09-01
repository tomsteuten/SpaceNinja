# Space Ninja — Journey to the Moon

A gentle 3D space explorer for young children (roughly ages 5–8). This is the first
vertical slice: one journey, from Earth to the Moon.

Tap the Moon, press **Fly to the Moon**, watch a small spaceship arc across space, hear a
Moon fact read aloud, and earn a sticker for the discovery journal.

Built with Vite, TypeScript and Three.js. No backend, no accounts, no build-time assets.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>.

### On a phone or tablet on the same WiFi

The dev server already binds to every interface, so the LAN address works as-is:

```bash
npm run dev
```

Vite prints the address next to `Network:` when it starts — something like
`http://192.168.1.x:5173`. Type that into the browser on the device. Nothing else needs
configuring.

If it does not connect, it is almost always a firewall prompting (or silently blocking)
Node on a private network — allow it and reload. On Windows, ignore any `192.168.56.x`
address: that is a VirtualBox adapter, not your WiFi.

### Other commands

```bash
npm run typecheck
```

```bash
npm run build
```

`npm run build` type-checks first, then emits `dist/`. `npm run preview` serves that build
on the network the same way.

---

## Artwork

The game generates all of its textures at runtime, so it looks finished with nothing
downloaded. To upgrade to real photography, drop image files into `public/assets/` and
reload — the loader picks them up automatically and no code changes are needed.

`public/assets/README.txt` lists the exact filenames, resolutions and where to get them.
The browser console logs one line per texture saying whether it used a file or a
placeholder.

The spaceship and celestial bodies are Three.js primitives. Each lives in its own module
(`src/scene/Bodies.ts`, `src/scene/Spaceship.ts`) so they can be swapped for GLB models
later without touching the flight or UI code.

---

## Structure

```
index.html               boot markup + inline loading/error state
src/
  main.ts                wiring, frame loop, teardown
  config.ts              scene scale, speeds, timings, the Moon fact
  scene/
    Stage.ts             renderer, camera, bloom, resize, adaptive quality
    quality.ts           device tiering (low / medium / high)
    Bodies.ts            Sun, Earth + atmosphere, Moon, lights
    Spaceship.ts         the ship, built from primitives
    Starfield.ts         gradient sky + layered point stars
    textures.ts          load-a-file-or-generate-one, and the generators
  controls/OrbitInput.ts drag to rotate, pinch/wheel to zoom
  flight/FlightSequence.ts  the scripted Earth → Moon cutscene
  ui/                    interface layer (ui.ts + ui.css)
  audio/narration.ts     SpeechSynthesis wrapper, entirely optional
  state/progress.ts      sticker persistence in localStorage
public/assets/           drop real textures here
```

### Notes on a few decisions

**Distances are compressed, hard.** At true scale the Moon would be thirty Earth-diameters
away and invisible. `config.ts` holds the numbers; `FRAMING_RADIUS` is derived from the
Moon's orbit so a portrait phone — whose horizontal field of view is very narrow — never
loses the destination off the edge of the screen.

**Rendering always goes through EffectComposer**, even when bloom is disabled, so tone
mapping and colour conversion happen in exactly one place for every material including the
custom atmosphere and sky shaders.

**Quality adapts.** Hardware hints pick a starting tier, then real frame times are measured
for a few seconds after startup and the tier steps down if the budget is being missed.
Pixel ratio and bloom are the levers; geometry and texture sizes are fixed at construction.

**The flight owns the camera outright.** Orbit input is disabled and the Moon's orbit is
frozen so the destination holds still. On arrival the ship is re-parented to the Moon so it
rides along, and the orbit controller re-derives its angles from wherever the camera
finished — so control returns without a snap.

**Narration is optional by design.** If SpeechSynthesis is missing the button simply does
not appear and everything else works.

**Reduced motion is respected**: `prefers-reduced-motion` shortens the flight to a brief
cut, removes camera inertia, and stops the UI animations.

---

## Not in this slice

No other planets, no fly-back-to-Earth, no sound effects or music, no downloaded models,
and no real orbital physics. Those are deliberately out of scope for the first slice.
