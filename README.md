# Space Ninja

A gentle 3D space explorer for young children (roughly ages 5–8). Three destinations so
far: Earth, the Moon, and Mars.

Tap a destination, press **Fly**, watch a small spaceship arc across space and arrive
close enough to see the surface. Three real places are marked on each world — the first
footprints on the Moon, the volcano on Mars, the Sahara from orbit — and finding one tells
you about it and puts it in the discovery journal. One of the three is always round the back, so getting it
means learning to drag. Or just look around and fly home. Either way, having been to the
Moon widens the view far enough to notice Mars. Find every place on all three worlds and the
whole game is won — with a celebration to say so.

It installs to a home screen and works offline once loaded, with nothing ever leaving the
device.

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

```bash
npm run narration:generate
```

`npm run build` type-checks first, then emits `dist/`. `npm run preview` serves that build
on the network the same way. `npm test` runs the unit tests — they cover the journal
persistence, collectible placement and visibility, touch-camera maths, photo dismissal,
narration cue coverage and the flight's easing curve — the pieces whose failure is easy
to miss by eye. Narration generation creates the offline MP3 cue pack from
`src/audio/narration-script.json` with a local open-weight model; it needs `ffmpeg`, but no
account or API key.

---

## Artwork

### Credits

**Earth day and night maps, Moon, Mars and the star field** — `earth.jpg`,
`earth-night.jpg`, `moon.jpg`, `mars.jpg` and `starfield.jpg` in `public/assets/`, from
[Solar System Scope](https://www.solarsystemscope.com/textures/), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Based on NASA elevation and
imagery data.

**Saturn texture and rings** — the colour map is a derived Cassini ISS RGB product from
the [NASA Planetary Data System](https://atmos.nmsu.edu/data_and_services/atmospheres_data/Cassini/sat_global_map.html)
(Li, West, Jiang and Knowles, 2023; DOI 10.17189/rkkb-6y30). The radial ring texture is
derived from Cassini natural-colour mosaic PIA06175, credit NASA/JPL/Space Science Institute.
Both transformations and source links are documented in `public/assets/README.txt`.

**Discovery photographs** in `public/assets/discoveries/` — Sahara/Africa and Amazon
River imagery from NASA Earth Observatory; Black Marble 2016 from NASA Goddard Space
Flight Center; Apollo 11 bootprint from NASA/Buzz Aldrin; Tycho and the lunar far side
from NASA/JPL/USGS and NASA/GSFC/Arizona State University; and Olympus Mons, Valles
Marineris and Elysium from NASA/JPL/USGS; and Saturn's rings, north-polar hexagon and
northern storm from NASA/JPL/Space Science Institute and NASA/JPL-Caltech/Space Science
Institute. All public domain. The source pages and image identifiers are listed in
[`public/assets/discoveries/README.txt`](public/assets/discoveries/README.txt).

**Narration** in `src/audio/recordings/` — generated locally with
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), whose model weights are licensed
[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0). The included voice is disclosed
as AI-generated on the grown-ups screen.

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

**Photographs of the places a child finds** work the same way, and are the most worthwhile
thing you can add. Each discovery can show a real photograph of itself — a thumbnail in its
card, full screen on a tap — from a file named after it in `public/assets/discoveries/`.
That folder's `README.txt` names the specific NASA image used for each of the twelve places
and why that one rather than another. They are entirely optional and added one at a time: a
place with no file simply has no photograph. **Nothing is downloaded until a place is
actually found**, so all twelve cost the game nothing at startup, and a child who finds three
fetches three.

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
index.html               boot markup + inline loading/error/crash state
sw/                      service worker (offline): sw.js template + build.ts, built into dist/
public/manifest.webmanifest  web app manifest — installable, runs standalone
public/icons/            home-screen icons (icon.svg is the source; PNGs render from it)
src/
  main.ts                wiring, frame loop, teardown, offline + crash
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
  audio/narration.ts     keyed MP3 narrator + manual SpeechSynthesis fallback
  audio/narration-script.json  short child-directed lines for generated narration
  audio/sfx.ts           two synthesised cues, entirely optional
  state/progress.ts      stickers and visits, persisted in localStorage
public/assets/           drop real textures here
```

### Notes on a few decisions

**It installs, and it works offline.** A web app manifest makes Space Ninja add to a home
screen and run standalone — no address bar, no tabs, just the planet. Measured off a Surface
screenshot, browser furniture had been eating close to a fifth of the screen, so this is the
single biggest lever on how big the planet looks, and it is a small file. A service worker
precaches the app and the globe textures on the first visit, so from the second launch on the
game opens with no internet at all — which is squarely how a tablet game gets used: in a car,
on a plane, at a grandparent's with bad wifi. The discovery photographs stay lazy, fetched
only when a place is found and then kept, so the offline promise costs nothing at startup. The
worker is built from the bundle rather than hand-written, because Vite hashes its file names;
`sw/build.ts` is the pure, tested core of that. Nothing runs in development.
The grown-ups panel shows the deployed Git build id so an intermittent phone report can be
separated from an old service worker still serving the previous shell.

**Privacy is a feature, so it is claimed.** No backend, no accounts, no analytics — nothing
ever leaves the device, and the journal lives in the tablet's own storage. The grown-ups
panel says so in one line, because that is exactly what a parent wants to know before handing
a tablet over.

**A crash is made visible.** An exception inside the frame loop used to leave the last good
frame frozen on screen, which looks fine — the only signal was a child saying it stopped. The
loop now catches it and shows a friendly "the spaceship stopped" screen with a button that
reloads (the journal survives), plus the actual error in small print for a bug report.

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
The explanation card folds before the turn starts, even while its narration is playing:
this is the one moment where watching the light move is the entire lesson, so the speaker
button may remain but the full-width words must not cover or compete with the globe.

**A touch drag is distance, not frame-rate-dependent velocity.** A full short-edge drag
turns about 130 degrees and each pointer delta is applied once. Only the measured release
speed becomes a capped, time-based glide. The previous code accumulated drag deltas into a
value applied again on every animation frame, which made a high-refresh phone spin much
farther than a 60Hz screen. Tests pin both sampling-rate independence and equal inertia at
30, 60 and 120fps.

**A collectible looks like a target, not a light.** It keeps its warm gold separation from
grey Moon and rusty Mars, but its meaning comes from an opaque double ring with a dark
keyline. The additive halo is now small and dim and renders behind that silhouette. Do not
solve this by changing only the hue: the reported problem was that a warm luminous blob
read as Sunlight rather than as something to tap.

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

**Good narration is the primary guide; the device voice is not.** Exact keyed MP3 cues in
`src/audio/recordings/` start automatically when sound is on, while the paragraph becomes
less prominent and the photograph, title and replay button remain. Each instructional cue
also names a visible action — tap the gold target, or swipe the planet — so a pre-reader is
not being asked to infer a verb from prose. A missing cue never auto-starts the browser's
poor `SpeechSynthesis` voice; that fallback remains available only from the speaker button.
This makes a partial voice pack safe to ship and keeps silence preferable to bad narration.

`npm run narration:generate` creates the MP3 pack locally with the Apache-licensed
Kokoro-82M model. The default British `bf_emma` voice is slowed slightly, then every cue is
normalised and compressed by `ffmpeg` for a phone speaker. The first run downloads about
90MB of model weights into a temporary cache; no script text or audio is sent to a service.
The command preserves existing files unless passed `--force`, and accepts `--voice=<name>`
and `--speed=<number>`. OpenAI remains an optional alternative via
`npm run narration:generate:openai`. Generated narration is disclosed as AI-generated in
the grown-ups panel. The MP3s are Vite assets, fingerprinted and precached by the existing
service worker, so playback is deterministic and offline.

**Without recorded cues, the voice is chosen on the grown-ups panel.** It appears by itself
the first time the game is opened on a device and lists every voice that device offers,
best first. Tap one to audition a real line; the last one tapped is remembered. This is a
fallback, not the route for making audio primary.

**Sound can be turned off there too**, which covers the read-aloud voice as well and takes
the speaker button away with it.

**To open it again: press and hold the round book button for two seconds.** A hold rather
than a visible button, because a settings control on screen is a settings control a
five-year-old will press — and the panel says so in writing, which works precisely because
the person it is hiding from cannot read it yet. `?grownups` on the end of the address does
the same thing, which is the way back in if the browser's storage has been cleared
(`?voices` still works too).

**Reduced motion removes motion rather than speeding it up**: `prefers-reduced-motion`
skips the exhaust trail and the widening view, removes camera inertia, thins the collect
particles and stops the UI animations. It deliberately does *not* shorten the flight or the
day turn any more — running the same sweeping camera move in a fifth of the time is more
motion per second, not less, which is the opposite of what the preference is asking for.

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

The included narration pack still needs a real-device listen and child playtest. Its audio
format, levels, duration and offline bundling are checked, but only a child can establish
whether the delivery actually prompts the intended tap or swipe. `SpeechSynthesis` remains
the manual fallback for any future cue whose MP3 has not yet been generated.
