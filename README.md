# Space Ninja

A gentle 3D space explorer for young children (roughly ages 5–8). Five destinations so
far: the Sun, Earth, the Moon, Mars, and Saturn.

The guided adventure is the default game. Tap a world or its large destination button and
ride with the spaceship to a close view. Earth and the Moon are available first; visiting
the Moon reveals Mars, and visiting Mars reveals Saturn. Earth, Moon, Mars and Saturn have
real places to discover; the Sun is a look-around visit. Every visit offers narration, a
journal and a clear Space map return. Earth's **Day & night**
activity shows a full turn of the globe and its city lights.

### Guided adventure

Tap a world — the big buttons along the bottom, or the planet itself in space — and you go
there. One tap, one journey: ride with the spaceship along its safe route and arrive close
enough to see the surface.
Three real places are marked on each planet/moon visit — the first footprints on the Moon,
the volcano on Mars, the Sahara from orbit — and finding one tells you about it and puts it
in the discovery
journal. One of the three is always round the back, so getting it means learning to drag. Or
just look around and fly home.

The Sun is available from the start. Fly close to look around our star from space, then
use the same **Space map** control to choose another trip. It has no surface hunt or
day/night button: it emits light and has no solid ground to land on, as described in
[NASA's Sun facts](https://science.nasa.gov/sun/facts/). Its welcome uses bundled narration,
and its textured appearance is a generated illustration.

Discovery photographs have a large return arrow beside a picture of the world you are
exploring, plus a large X. The space-map exit uses a Sun/Earth/Moon picture and a return
arrow in a contrasting button; words reinforce both exits without being their only clue.
First-find photos show **Saved to your journal** and the visit count. The third find also
offers **See discoveries**. The journal opens to the visited world's six-place page, with
pictured buttons for switching worlds. Found places open their story, photograph and
narration; **All places** returns to the page. After all three finds, Journal is highlighted
while Space map remains available.

The first Earth visit offers **Space map · Turn Earth · Find places**, so the lesson is a
clear choice and exploration remains available. Earth's day/night activity is hands-on:
drag the globe, tap it, or press Turn Earth to move it through fixed sunlight. Done returns
to discoveries. Later visits use **Space map · Listen · Day & night · Journal**; other
worlds keep their timed day turns. Listen replays narration directly. The Words button
beside the world heading opens the written fact; with sound off, Listen also becomes Words.
World pictures and real discovery thumbnails carry the visual identity across the map,
returns and journal. Startup failures offer **Start again**, including a missing script
download, rather than leaving the loading message indefinitely.

Earth, Moon, Mars and Saturn each hold **six** real places and show three, picked fresh each
visit and weighted towards the ones you have not found, so returning offers new discoveries.
Having been there reveals Mars, and visiting Mars reveals Saturn. Find every place on all four
worlds and the whole game is won — with a celebration to say so.

It installs to a home screen and works offline once loaded, with nothing ever leaving the
device.

Built with Vite, TypeScript and Three.js. No backend or accounts; the checked textures,
photographs and narration are bundled into the static offline build.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>.

The **neighborhood map prototype** is available at <http://localhost:5173/?mapstudy>.
Page with the large arrows or swipe the world area, then tap a pictured destination to use
the existing adventure. Earth, Moon, Sun, Mars and Saturn retain their existing unlocks;
other planets and moons are clearly unavailable layout fixtures. The map remembers its
neighborhood until reload. This is an opt-in screen study awaiting visual approval.
See the [full-resolution map comparisons](design/map-study-2026-10-08/index.html) and
[scope and rationale](docs/map-proposal-2026-10-08.md).

For a local browser preview, use <http://localhost:5173/>. The newer close-flight explorer
remains available for comparison at <http://localhost:5173/?explorer>. Its worlds are all
open, and holding and sliding steers the ship over real mapped places. It has not replaced
the guided game while tablet playtesting and the screen-by-screen review continue.

The optional manual-flight experiment is available from **Fly it yourself** in the grown-ups
panel, with **Shift+F** on a keyboard, or directly at
<http://localhost:5173/?freeflight>. The deployed route is
<https://tomsteuten.github.io/SpaceNinja/?freeflight>. It reuses the real solar system with
one-finger steering, assisted braking, collision protection and optional autopilot. **Back to
adventure** returns to the normal game. The experiment is deliberately easy to test without
assuming it has already earned a place in the main child loop.

A second steering experiment, the Earth-to-Moon outing, is at
<http://localhost:5173/?outing>: fly a visible ship to the Moon, find Tycho, see its photo and
fly home. Its current status is in [the checkpoint](docs/current-implementation.md), with its original
contract and ownership in [September history](docs/implementation-history-2026-09.md).

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
`src/audio/narration-script.json` using the owner-selected ElevenLabs voice; it requires
`ELEVENLABS_API_KEY`. `npm run narration:generate:kokoro` is the local, keyless fallback
(needs `ffmpeg` and `npm install --no-save kokoro-js`);
`npm run narration:generate:openai` is an alternative requiring `OPENAI_API_KEY`. See
[recording instructions](src/audio/recordings/README.md) for per-cue generation and provenance.

---

## Artwork

### Credits

**Explorer Moon maps and Tycho close-up** — NASA LROC and LOLA datasets from the
[NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), plus the real LROC NAC M162350671
[Tycho central-peak photograph](https://svs.gsfc.nasa.gov/4220/). Credit NASA/GSFC/ASU/SVS
and NASA/GSFC/MIT for LOLA. Exact URLs, processing and original checksums are recorded in
`public/assets/moon-trial/README.txt` and `sources.json`. `scripts/prepare-moon-assets.py`
reproduces the compact files without shipping source TIFFs.

**Planet and sky textures** — `earth.jpg`, `earth-night.jpg`, `moon.jpg`, `mars.jpg`,
`saturn.jpg` and `starfield.jpg` in `public/assets/`, from [Solar System
Scope](https://www.solarsystemscope.com/textures/), licensed [CC BY
4.0](https://creativecommons.org/licenses/by/4.0/). They are based on NASA elevation and
imagery data. Solar System Scope notes that unmapped areas are artistically completed and
colours are slightly saturated, so Saturn's body is a visual reconstruction rather than a
wholly observed global photograph.

**Saturn's rings** — the radial ring texture is derived from Cassini natural-colour mosaic
PIA06175, credit NASA/JPL/Space Science Institute. The source search and exact limitations
of the archival Cassini body map are documented in `public/assets/README.txt`.

**Discovery photographs** in `public/assets/discoveries/` — real mission imagery: Earth
views from NASA/USGS satellites; lunar imagery from the Lunar Reconnaissance Orbiter;
Mars views from Mars Reconnaissance Orbiter and Curiosity; and Saturn views from Cassini.
The original twelve and the twelve repeat-visit places now all have photographs. The source
pages, image identifiers and credit lines are listed in
[`public/assets/discoveries/README.txt`](public/assets/discoveries/README.txt).

**Narration** in `src/audio/recordings/` — generated with the owner-selected ElevenLabs
Emma voice, with a Kokoro `bf_emma` exception for the Sun arrival. The actual pack and
per-cue exception are recorded in `provenance.json` and
[the recording notes](src/audio/recordings/README.md). Generated speech is disclosed on the
grown-ups screen. The local fallback uses [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M),
whose weights are [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).

The Sun's surface map is a generated illustration, credited in `public/assets/README.txt`.
The spaceship and scene geometry use Three.js primitives and runtime effects.

World-completion stickers also stay in the world: each earned reward becomes a bold,
runtime-drawn decal on the spaceship, and finding everything adds the Space Ninja crest.
They follow the saved progress record, so restarting a scene keeps the livery while **Start
a new adventure** removes it with the other earned rewards.

`design/` holds reference art that is *not* shipped — it deliberately sits outside
`public/`, because everything under `public/` is copied into the deployed build whether
anything loads it or not.

### Adding more

The shipped worlds load bundled maps, with generated fallbacks if a map is missing.
Replace a configured map in `public/assets/` to change that world; adding a new world
requires [the expansion checklist](docs/worlds-roadmap.md). Record provenance and licence
credits for each asset in the relevant asset README.

**Photographs of the places a child finds** work the same way, and are the most worthwhile
thing you can add. A first find opens its real photograph as a large postcard once it has
loaded; revisits retain a thumbnail that opens full screen on a tap. Files are named after
their discovery in `public/assets/discoveries/`.
That folder's `README.txt` names the specific NASA image used for every place and why that
one fits the discovery. They remain optional and can be replaced one at a time: a place with
no file has an intentional no-photo state. Full photographs are requested on a find or
when deliberately opened, then cached for later offline use. Small 160px discovery
derivatives used by the journal and controls are precached; the full set is not preloaded.

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
  main.ts                adventure wiring, frame loop and visit reset
  session/               shared browser lifetime, offline registration and crash screen
  config.ts              destination copy/reveal gates, timings, geometry re-exports
  worlds/catalogue.ts    geometry, surface/ring specifications, derived framing/badges
  explorer/              explicit ?explorer comparison route
  experience/            explicit ?outing Earth-to-Moon experiment
  scene/
    Stage.ts             renderer, camera, bloom, resize, adaptive quality
    quality.ts           device tiering (low / medium / high)
    Bodies.ts            Sun/Earth builders, catalogue-driven orbiting worlds, lights
    TeachingSun.ts       visible daylight source for day/night activity
    DayTurn.ts           held-surface turn and scripted camera ownership
    Spaceship.ts         the ship, built from primitives
    EngineTrail.ts       the exhaust the ship leaves behind it
    Starfield.ts         gradient sky, star map, layered point stars
    textures.ts          load-a-file-or-generate-one, and the generators
  controls/OrbitInput.ts drag to rotate, pinch/wheel to zoom
  flight/                scripted flight, home return and manual-flight experiment
  mission/CollectMission.ts  the places to find, for any body
  ui/                    DOM components, panels, coach and grown-ups controls
    adventure.css        adventure layout ownership
    pictures.ts          world and discovery picture identity
    panelGuard.ts        guarded pointer closing and keyboard exceptions
  audio/narration.ts     keyed MP3 narrator + manual SpeechSynthesis fallback
  audio/narration-script.json  short child-directed lines for generated narration
  audio/sfx.ts           two synthesised cues, entirely optional
  state/progress.ts      discoveries, stickers and visits, persisted in localStorage
public/assets/           drop real textures here
```

### Notes on a few decisions

**It installs, and it works offline.** A web app manifest makes Space Ninja add to a home
screen and run standalone — no address bar, no tabs, just the planet. Measured off a Surface
screenshot, browser furniture had been eating close to a fifth of the screen, so this is the
single biggest lever on how big the planet looks, and it is a small file. A service worker
precaches the app and the globe textures on the first visit, so from the second launch on the
game opens with no internet at all — which is squarely how a tablet game gets used: in a car,
on a plane, at a grandparent's with bad wifi. Small discovery thumbnails are precached too;
full photographs stay lazy and are cached after a find or deliberate opening. The
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
away and invisible. `src/worlds/catalogue.ts` owns the geometry and derives map framing
from the revealed worlds and their visible silhouettes. `config.ts` re-exports legacy
geometry names; the Sun has separate framing. Stage reserves the current UI footprint.

**Rendering always goes through EffectComposer**, even when bloom is disabled, so tone
mapping and colour conversion happen in exactly one place for every material including the
custom atmosphere and sky shaders.

**Quality adapts.** Hardware hints pick a starting tier, then real frame times are measured
for a few seconds after startup and the tier steps down if the budget is being missed.
Pixel ratio and bloom are the levers; geometry and texture sizes are fixed at construction.

**The flight owns the camera outright.** Orbit input is disabled and the orbits are frozen
so the destination holds still. On arrival the ship is re-parented to the destination so it
rides along, and the orbit controller re-derives its angles from wherever the camera
finished — so control returns without a snap. The journey is deliberately cinematic: a
drag used to add a safe sideways offset, but the chase camera followed that offset and made
the ship appear almost stationary while its contrail wiggled. Removing that unexplained
gesture leaves the child free to watch the destination approach and keeps interaction for
the world itself, where a drag has an immediate purpose.

**The solar-system view is scenery and navigation has dependable controls.** Every world has
a stable, finger-sized button along the bottom. The moving 3D bodies remain tappable, but
finding a tiny speck in the widest Saturn shot is no longer the only route to the next
flight.

**One tap is one journey.** Touching a world starts the flight — there is no separate Fly
button. It used to take two presses, and the second one was somewhere else on screen, so the
natural response to "I touched Mars and nothing happened" was to touch Mars again. That
defeated adults as reliably as children. The worlds not yet earned still appear in the bar,
padlocked: the bodies stay reveal-gated so an un-earned planet cannot loom into the shot, but
hiding them completely also hid the fact that there was anywhere else to go.

**Arrival offers an action immediately.** The first Earth visit invites turning Earth or
finding places, with a visible way back to the map. Gold places are available immediately
on other arrivals and Earth revisits. There is no compulsory demonstration or listening gate.

**Day & night is an activity with a visible name.** The visit controls share one row:
Space map, Listen (Words with sound off), supported Day & night, Journal. The Sun omits
Day & night. Earth's activity replaces Journal with a tap/keyboard Turn Earth control;
dragging directly turns its surface and stops when the finger stops. The lesson remains
open until **Done** or Space map. Other worlds keep Stop and timed demonstrations.
The first-Earth invitation uses a bounded visual cue, with a still reduced-motion equivalent.
Choosing Find places suppresses repeated invitations for that visit. The hunt arrow moves
the viewpoint around the world, preserving sunlight so the Night Side remains night.
Child comprehension and enjoyment still need observation on the actual tablet.

**A hand shows the gesture when nothing is happening.** After six seconds with nothing
touched, a finger appears on a gold place and taps it; once only the hidden one is left, it
sweeps across the planet instead. Every instruction here had become a caption written for
somebody who cannot read, and narration answers that once. An arrow at the edge of the screen
has never meant "put your finger down and slide it".

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

**The map only widens and reveals a world once it has earned the right to.** Fitting every
destination from the first frame shrinks Earth and the Moon to specks, which is a poor first
impression for a child with no reason to care about the outer worlds yet. *Visiting* the
Moon widens the view and reveals Mars; visiting Mars does the same for Saturn. The new world
fades and grows into the settled home map, alongside its new destination button, rather than
appearing during a flight. Visiting, not finishing, is the gate: flying out, looking and
coming home is what this game is about, and locking the solar system behind a tapping task
would say otherwise. `progress.ts` therefore tracks visits separately from stickers: where
you have been and what you finished are different facts.

**Collecting is ambient, not modal.** The rocks are simply present when the ship arrives —
there is no button that starts a mission and no state to be finished before leaving. That
is a deliberate reversal: the collect mission used to be a mode, and the only way out of
it was to complete it, which is what made "how do I get back?" the most common reaction to
the game. **Fly Home** is on screen from arrival onward and never moves. The mission still
exists, still awards its sticker, and still teaches the drag gesture — it just no longer
holds the door shut.

**A visit has a visual focus without losing its setting.** The destination stays solid while
the other earned worlds fade to quiet, still-visible context, and the parked spaceship does
the same. A Moon or ship that crosses the camera can therefore no longer become an opaque
wall over a real-coordinate target. Full colour returns as Fly Home pulls back to the map.

**Earth is a destination too.** A child's first instinct is to tap their own planet, and
for a long time the game answered by doing nothing at all when they did. "Flying" to the
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

**The mission uses the destination's geometry.** `CollectMission` takes a `CelestialBody` and
derives marker size, hit-target size and particle scale from its radius. A new destination
still needs capability, selection and responsive checks; follow the world checklist.

**Stateful systems own reset and disposal.** `src/session/lifecycle.ts` coordinates browser
suspension, crash and final disposal through route callbacks. `main.ts` owns the adventure's
ordered visit reset. Space map first returns the camera to the map, then resets the visit;
each subsystem undoes its own state. A cached browser-history exit suspends resources,
while a real exit disposes them. Settings and adventure progress remain separate.

**Day & night turns the held surface.** The activity advances the same surface orientation
used by markers and moves the camera to a teaching view. The visible teaching Sun explains
the light direction; Earth's night lights follow the world-space illumination. The activity
starts only from the child's press and can be stopped or left via Space map. Its explanation
is available through Listen/Words in the deliberate reading panel.

**A touch drag is distance, not frame-rate-dependent velocity.** A full short-edge drag
turns about 180 degrees and each pointer delta is applied once. Only the measured release
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
the press that launches a flight, because mobile browsers start audio suspended and only
allow it to resume inside a user gesture — and that press is the last one guaranteed to
happen before the ship reaches somewhere with sounds to make. If Web Audio is missing the calls no-op.
The two continuous sounds follow a value the picture is already using, frame by frame,
rather than starting a timed ramp, so they stay with the picture on a slow device.

**Authored narration guides the child.** Keyed MP3 cues in `src/audio/recordings/` start
automatically when available and sound is on. Listen opens the current fact, full-width
words, optional photograph and replay/return actions. With sound off the entry is Words.
Queued completion facts wait while the reading panel is open; facts do not fold themselves
into a compact card. Available recordings work individually; a missing cue never starts
`SpeechSynthesis` automatically. Device speech remains a manual replay fallback.

The shipped voice, generator alternatives and per-cue exception are documented in
[recording instructions](src/audio/recordings/README.md). Imported MP3s are fingerprinted
Vite assets and precached with the application shell.

**Without recorded cues, the voice is chosen on the grown-ups panel.** It appears by itself
the first time the game is opened on a device and lists every voice that device offers,
best first. Tap one to audition a real line; the last one tapped is remembered. This is a
fallback, not the route for making audio primary.

**Sound can be turned off there too.** It silences narration and sound effects, hides audio
replay controls, and labels the reading entry Words so the written facts remain available.

**To open it again: press and hold the round book button for two seconds.** A hold rather
than a visible button, because a settings control on screen is a settings control a
five-year-old will press — and the panel says so in writing, which works precisely because
the person it is hiding from cannot read it yet. `?grownups` on the end of the address does
the same thing, which is the way back in if the browser's storage has been cleared
(`?voices` still works too).

**Start a new adventure lives in that grown-ups panel.** It takes two deliberate presses
and removes only visits, discoveries and earned stickers. Sound, the one-time grown-up
greeting and the offline installation remain device choices rather than game progress.

**Reduced motion removes motion rather than speeding it up**: `prefers-reduced-motion`
skips the exhaust trail and the widening view, removes camera inertia, thins the collect
particles and stops the UI animations. It deliberately does *not* shorten the flight or the
day turn any more — running the same sweeping camera move in a fifth of the time is more
motion per second, not less, which is the opposite of what the preference is asking for.

---

## Not yet

No additional planets beyond the current catalogue, imported ship models or real orbital
physics are implemented. Future world expansion follows [the roadmap](docs/worlds-roadmap.md);
it does not require a general engine rewrite.

All four worlds can be spun through a day — the button is a config entry rather than a
special case. This was once true of Earth alone, on the reasoning that "why does the Sun come
up?" is a question about *here* and answering it four times would dilute it. The dilution is
real, so each world's card now names what is different about its own day (a fortnight of
sunshine on the Moon, ten hours on Saturn) rather than all four reading "Day and Night". It
is offered by its own button and never plays on its own; it was briefly an automatic arrival
introduction on every world, which put eleven seconds of watching between arriving and being
allowed to touch anything, four times over.

The Moon can wander into the shot while you are exploring Earth, and at these compressed
distances it is large when it does. The flight steers its *arrival* clear of anything that
would loom, but the camera then orbits on a shell that the Moon's own orbit crosses, so
dragging far enough round will still find it. Moving the Moon out would change every other
shot in the game, so it stays.

The included narration pack still needs a real-device listen and child playtest. Its audio
format, levels, duration and offline bundling are checked, but only a child can establish
whether the delivery actually prompts the intended tap or swipe. `SpeechSynthesis` remains
the manual fallback for any future cue whose MP3 has not yet been generated.

## Current guidance and historical records

Read [AGENTS.md](AGENTS.md) for operating rules, [the current checkpoint](docs/current-implementation.md)
for ownership and route status, and [the world checklist](docs/worlds-roadmap.md) before
expansion. Dated reviews, [September checkpoints](docs/implementation-history-2026-09.md)
and [decision history](docs/decision-history.md) preserve earlier evidence. Their old UI
contracts, cue counts and next steps do not override the approved October interface.

## Browser regression checks

Use only affected Playwright files/viewports locally for a UI or behavior change, per
[AGENTS.md](AGENTS.md). Do not run the full suite locally; deployment CI runs it.
For example: `npx playwright test e2e/earth-day.pw.ts --project=phone`. Rerun a failing
browser test alone once before diagnosis. Documentation/comment-only changes need no
browser run.

`npm run test:e2e` builds an isolated `dist-playtest/` and serves it on port 4180.
Run `npx playwright install chromium` once first (CI uses `--with-deps`). Set `PLAYTEST_PORT`
to another port if a separate checkout is already using 4180. The suite runs every
`e2e/*.pw.ts` file. For the adventure it uses
phone, touch-tablet and short-landscape viewports on the existing low graphics tier; it checks real pointer-driven flights,
three-slot hunts, target clearance above the dock, hidden-target dragging, journal photo
and narration controls, repeat visits, outer-world arrivals, and Earth resizing. Screenshots
are attached to `playwright-report/`; failures retain traces in `test-results/`. Larger
viewports use half-resolution rasterisation while preserving CSS dimensions, keeping
software rendering affordable. The `?outing` files cover steering, stop, help, Tycho, return,
modal and Escape boundaries and reduced motion. Offline and history-suspension checks run on
the adventure and both experiments. This suite is a layout/interaction gate, not a GPU benchmark.

The test build alone enables `VITE_PLAYTEST=1`, a read-only scene snapshot for locating
canvas targets and checking renderer activity. It cannot launch, collect or alter progress.
Normal `npm run build` omits it. Passing geometry checks and browser automation do not
establish narration quality or child comprehension. Visual changes require owner review of
full-resolution before/after images on phone, tablet and short landscape, one screen at a
time; the suite's half-resolution captures are weak visual evidence. Device listening and
child observation remain necessary.

The day/night browser pass checks the supported activity at arrival, optional Earth invitation,
64px-high contextual controls, keyboard start/stop, preserved surface orientation after
skipping, canvas skipping, and Fly Home during a turn. It includes 319 × 561 and 640 × 360
layouts alongside the configured phone, tablet and short-landscape viewports.

Arrivals now choose elevation against the real tilted surface axis. Every selectable set
must offer two surface directions at least 0.46 aligned with the arrival camera, leave its
hidden target behind the limb, and view ring discoveries at least 24 degrees above/below
the ring plane. Tests also ensure no discovery is made unreachable by those constraints.
The journal shows each world's collection; after visiting every world, the map suggests an
unfinished page. Finds say New or Seen before, without penalising revisits.


### Architecture references

The [September 14 audit](docs/architecture-review.md) records the boundaries and risks at
that baseline. Current ownership is summarized above and in the checkpoint; later changes
are recorded in decision history. Shared lifecycle handling pauses resources on backgrounding,
retains scenes for cached browser-history return and keeps crashes stopped until reload.
Browser screenshots are written to named PNGs under `test-results/` as well as attached to the
HTML report. The history tests exercise browser lifecycle events deterministically; they do not
assert that every browser will choose to put the page into its back/forward cache.
