# Space Ninja

A gentle 3D space explorer for young children (roughly ages 5–8). Two destinations so
far: the Moon, and Mars.

Tap a destination, press **Fly**, watch a small spaceship arc across space and hear a
fact read aloud. Glowing rocks are waiting on the surface — collect them for a sticker in
the discovery journal, or just look around and fly home. Either way, having been to the
Moon widens the view far enough to notice Mars.

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
npm test
```

```bash
npm run build
```

`npm run build` type-checks first, then emits `dist/`. `npm run preview` serves that build
on the network the same way. `npm test` runs the unit tests — they cover the journal
persistence, the collectible placement rule and the flight's easing curve — the pieces
whose failure is easy to miss by eye.

---

## Artwork

### Credits

**Earth day and night maps, Moon, Mars and the star field** — `earth.jpg`,
`earth-night.jpg`, `moon.jpg`, `mars.jpg` and `starfield.jpg` in `public/assets/`, from
[Solar System Scope](https://www.solarsystemscope.com/textures/), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Based on NASA elevation and
imagery data.

The Sun, the spaceship and everything else on screen is generated at runtime or built
from Three.js primitives.

`design/` holds reference art that is *not* shipped — it deliberately sits outside
`public/`, because everything under `public/` is copied into the deployed build whether
anything loads it or not.

### Adding more

The game generates all of its textures at runtime, so it looks finished with nothing
downloaded. To upgrade to real photography, drop image files into `public/assets/` and
reload — the loader picks them up automatically and no code changes are needed. Anything
you add under a CC BY licence needs crediting in the list above.

Earth is the one that needs care, because its colour and roughness maps are only correct
as a pair — see `resolveEarthMaps` in `textures.ts`. Supplying `earth.jpg` on its own is
the intended path: the roughness map is derived from it, so the sea catches the light and
the land does not. `public/assets/README.txt` has the details.

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
  config.ts              scene scale, speeds, timings, and the destination copy
  scene/
    Stage.ts             renderer, camera, bloom, resize, adaptive quality
    quality.ts           device tiering (low / medium / high)
    Bodies.ts            Sun, Earth + atmosphere, Moon, Mars, lights
    Spaceship.ts         the ship, built from primitives
    EngineTrail.ts       the exhaust the ship leaves behind it
    Starfield.ts         gradient sky, star map, layered point stars
    textures.ts          load-a-file-or-generate-one, and the generators
  controls/OrbitInput.ts drag to rotate, pinch/wheel to zoom
  flight/FlightSequence.ts  the scripted flight out to any destination
  mission/CollectMission.ts  the collectibles, for any body
  ui/                    interface layer (ui.ts + ui.css + icons.ts)
  audio/narration.ts     SpeechSynthesis wrapper, entirely optional
  audio/sfx.ts           two synthesised cues, entirely optional
  state/progress.ts      stickers and visits, persisted in localStorage
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

**The flight owns the camera outright.** Orbit input is disabled and the orbits are frozen
so the destination holds still. On arrival the ship is re-parented to the destination so it
rides along, and the orbit controller re-derives its angles from wherever the camera
finished — so control returns without a snap.

**Destinations are data.** `DESTINATIONS` in `config.ts` holds the copy; `Bodies.ts` holds
the geometry; `main.ts` matches them by id and builds a flight, a fact and a mission for
each the same way. `FlightSequence.start()` takes the destination as an argument, so
nothing in the flight knows which body it is aiming at — only its radius and where it is
right now. Adding the next planet is a config entry and a body, not new logic.

**Mars gets its own compressed path around the scene centre**, not a heliocentric orbit.
At true scale it would be thousands of Earth-radii away and the Sun is already at 105;
this keeps every destination inside one composable frame. Radii, though, stay true — the
Moon really is 0.27 Earths and Mars really is 0.53 — because relative size is something a
child can learn from a picture, and relative distance at this scale is unshowable.

**The opening shot only widens once it has earned the right to.** Fitting Mars from the
first frame shrinks Earth and the Moon to a third of the size, which is a poor first
impression for a child with no reason to care about Mars yet. *Visiting* the Moon is what
makes the world visibly get bigger — visiting, not finishing. Flying out, looking at it
and coming home is the thing this game is about, and gating the rest of the solar system
behind a tapping game would have said otherwise. `progress.ts` therefore tracks visits
separately from stickers: where you have been and what you finished are different facts.

**Collecting is ambient, not modal.** The rocks are simply present when the ship arrives —
there is no button that starts a mission and no state to be finished before leaving. That
is a deliberate reversal: the collect mission used to be a mode, and the only way out of
it was to complete it, which is what made "how do I get back?" the most common reaction to
the game. **Fly Home** is on screen from arrival onward and never moves. The mission still
exists, still awards its sticker, and still teaches the drag gesture — it just no longer
holds the door shut.

**The mission knows nothing about the Moon.** `CollectMission` takes a `CelestialBody` and
derives collectible size, float height, hit-target size and particle scale from its radius,
so the next destination is a definition object rather than new code. The `config.ts` entry
holds only the strings and the count. Placement is measured in angles away from wherever
the camera is looking when the mission starts, and the last collectible is deliberately
placed past the limb: reaching it needs a drag, which teaches the camera control through
need rather than through instructions a five-year-old cannot read.

**Every stateful module owns a `reset()`**, and `main.ts` is the only caller. That is what
makes **Fly Home** work without reloading the page — the flight, the ship, the trail, the
world, the camera, the UI and the mission each undo exactly their own state. The bodies keep
orbiting throughout, so the Moon is deliberately *not* put back where it was.

**Sound is synthesised and optional by design.** Two cues, no audio files. The AudioContext
is created from the Fly button press, because mobile browsers start audio suspended and
only allow it to resume inside a user gesture — and that press is the last one guaranteed
to happen before the ship reaches somewhere with sounds to make. If Web Audio is missing the calls no-op.

**Narration is optional by design.** If SpeechSynthesis is missing the button simply does
not appear and everything else works.

**Reduced motion is respected**: `prefers-reduced-motion` shortens the flight to a brief
cut, removes camera inertia, and stops the UI animations.

---

## Not yet

No planets past Mars, no fly-back-to-Earth, no ambient or thruster sound, no downloaded
models, and no real orbital physics. Those are deliberately still out of scope.
