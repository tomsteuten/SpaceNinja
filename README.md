# Space Ninja

A gentle 3D space explorer for young children (roughly ages 5–8). Three destinations so
far: Earth, the Moon, and Mars.

Tap a destination, press **Fly**, watch a small spaceship arc across space and arrive
close enough to see the surface. Three real places are marked on each world — the first
footprints on the Moon, the volcano on Mars, the Sahara from orbit — and finding one tells
you about it and puts it in the discovery journal. One of the three is always round the back, so getting it
means learning to drag. Or just look around and fly home. Either way, having been to the
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
  mission/CollectMission.ts  the places to find, for any body
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

**Earth is a destination too.** A child's first instinct is to tap their own planet, and
for a long time the game answered by not offering a Fly button at all. "Flying" to the
planet you are already at is not a contradiction: the opening shot is a wide view of the
whole neighbourhood, and this drops you into low orbit over it, close enough to pick out
the Sahara. It needed no special case in the flight — home and destination being the same
body simply leaves the departure axis at zero.

**The places to find are real places.** Each entry in `config.ts` carries the feature's
actual latitude and longitude, and the marker is placed from them onto the body's own
surface mesh — so the ring a child taps really is sitting on Tycho's rays or on Olympus
Mons, not somewhere plausible. That is the whole difference from the collectibles this
replaced: a rock could be anywhere, so finding one taught nothing about where you were.

**The body is turned to face them, and the flight aims at them.** Only two things about an
arrival are free — which way the body happens to have rotated, and which latitude you
approach over — and both are chosen from the destination's own list. The body turns about
its own axis to bring the near ones round; the camera swings to the latitude they sit at.
Neither moves a feature relative to another, so every angle between them stays true. Real
missions time their arrivals for the same reasons.

**One of them is always over the horizon**, because reaching it needs a drag, which teaches
the camera control through need rather than through instructions a five-year-old cannot
read. On the Moon that one is round the far side, where having to go around to see it *is*
the fact. There is a test for how far round it is: past the limb teaches the gesture, but
far past it is half a turn of dragging across an unlit hemisphere, which a small child
abandons.

**The mission knows nothing about the Moon.** `CollectMission` takes a `CelestialBody` and
derives marker size, hit-target size and particle scale from its radius, so the next
destination is a definition object rather than new code.

**Every stateful module owns a `reset()`**, and `main.ts` is the only caller. That is what
makes **Fly Home** work without reloading the page — the flight, the ship, the trail, the
world, the camera, the UI and the mission each undo exactly their own state. The bodies keep
orbiting throughout, so the Moon is deliberately *not* put back where it was.

**You can turn a world through a day and watch morning arrive.** Children playing this
asked about the sunrise, which is better evidence than any of the reasoning elsewhere in
this file. The scene had always answered the question correctly and never shown it: the
city lights are masked by the world-space Sun direction and the sunlight is a world-space
directional light, so turning the surface makes places cross into darkness with their
lights coming on, and back out into morning. All of it already worked and none of it ever
moved. **Spin the Earth** drives the rotation the surface hold is already reproducing — no
new physics — and swings the camera side-on first, because the flight arrives near the
sub-solar point where the day/night line hugs the limb and nothing appears to change.

**A marker cannot be tapped through the planet it is on.** The hit spheres are many times
the size of the marker they surround, deliberately, so that a five-year-old's aim on a
tablet is enough — and the raycast tests only those spheres, with no idea the body is in
between. At Earth's arrival the Sahara and the hidden night-side marker project within
thirty pixels of each other, one in front of the globe and one behind it, so tapping twice
in the same place used to collect the far-side discovery through the whole planet. Every
hit is now checked against the horizon the camera can actually see over.

**The Moon keeps one face towards Earth**, as the real one does — which is exactly why its
far side went unseen until a spacecraft flew round the back, and the game says so to a
child. Locking it means giving it no rotation of its own: the surface simply rides the
orbit it already inherits.

**The destination's surface is held still while you are there.** A marker fixed to a
turning body slides out from under the finger reaching for it. What `holdSurface()` freezes
is the body's orientation against the stars, and the mission releases it on the way home.

**Sound is synthesised and optional by design.** Two cues, the flight's engine and the day
turn's sunrise — all generated at runtime, no audio files. The AudioContext is created from
the Fly button press, because mobile browsers start audio suspended and only allow it to
resume inside a user gesture — and that press is the last one guaranteed to happen before
the ship reaches somewhere with sounds to make. If Web Audio is missing the calls no-op.
The two continuous sounds follow a value the picture is already using, frame by frame,
rather than starting a timed ramp, so they stay with the picture on a slow device.

**Narration is optional by design, and off until asked for.** The read-aloud voice is the
browser's own, which means it is whatever the operating system ships — and playtesting said
it was bad enough that no narration beat this narration. So nothing speaks by itself: the
speaker button on the fact card is the only thing that starts a reading, and if
SpeechSynthesis is missing the button does not appear at all.

**To choose the voice, open the game with `?voices` on the end of the address** — on the
published site that is
[tomsteuten.github.io/SpaceNinja/?voices](https://tomsteuten.github.io/SpaceNinja/?voices),
and locally `http://localhost:5173/?voices`. It lists every voice the device offers, best
first; tap one to hear it read a line from the game, and the last one tapped is remembered
and used from then on. There is no button to it inside the game, deliberately — it is a job
for a grown-up, once, and a query string is the cheapest door that a child will not open by
accident. Voice quality is a property of the device and cannot be judged from a development
machine, so this page is the only honest way to pick.

**Reduced motion is respected**: `prefers-reduced-motion` shortens the flight to a brief
cut, removes camera inertia, and stops the UI animations.

---

## Not yet

No planets past Mars, no downloaded models, and no real
orbital physics. Those are deliberately still out of scope.

Only Earth can be spun through a day. The Moon and Mars have terminators too, and the
button is a config entry rather than a special case, so they could have one — but "why does
the Sun come up?" is a question about *here*, and answering it three times would dilute it.

The Moon can wander into the shot while you are exploring Earth, and at these compressed
distances it is large when it does. The flight steers its *arrival* clear of anything that
would loom, but the camera then orbits on a shell that the Moon's own orbit crosses, so
dragging far enough round will still find it. Moving the Moon out would change every other
shot in the game, so it stays.

The read-aloud voice is the browser's own `SpeechSynthesis`, which sounds different and
mostly poor on every platform. Replacing it with pre-generated audio is the one known
weak spot — see the notes in `AGENTS.md`.
