# Working on Space Ninja

Context for an AI assistant picking this project up cold. `AGENTS.md` is the
cross-assistant convention; `CLAUDE.md` points here so Claude Code finds it too.

Read `README.md` as well — it explains *why* the scene is built the way it is. This file
covers how to work on it without breaking things.

---

## What this is, and who it is for

A gentle 3D space explorer for children roughly 5–8, built with Vite, TypeScript and
Three.js. No backend, no accounts, no framework. It deploys to GitHub Pages from `main`.

**The audience is the design constraint, and it decides arguments.** When a change trades
fidelity against legibility, legibility wins. A five-year-old on a tablet cannot read
instructions, has imprecise aim, and reads an unresponsive tap as a broken app. Several
things that look like oddities are deliberate consequences of that — see *Invariants*.

The target device is an older Android tablet. `detectQuality()` sends any coarse-pointer
device to the `medium` tier: 512px generated textures, no antialiasing, pixel ratio capped
at 1.5. There is a hard ceiling on what fidelity spending buys you; authored light,
composition and motion have no such ceiling.

---

## Commands

```bash
npm install
npm run dev         # vite, binds to every interface (LAN address works as-is)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # typechecks first, then emits dist/
```

Run `npm run typecheck && npm test` before every commit. Both are fast.

---

## Layout

```
index.html                  boot markup + inline loading/error state
src/
  main.ts                   wiring, frame loop, restart, teardown
  config.ts                 scene scale, speeds, timings, destination copy
  scene/
    Stage.ts                renderer, camera, bloom, resize, adaptive quality
    quality.ts              device tiering (low / medium / high)
    Bodies.ts               Sun, Earth + atmosphere + night lights, Moon, Mars, lights
    Spaceship.ts            the ship, built from primitives
    EngineTrail.ts          exhaust, one THREE.Points in world space
    Starfield.ts            gradient sky + optional star map + point stars
    textures.ts             load-a-file-or-generate-one, and the generators
  controls/OrbitInput.ts    drag to rotate, pinch/wheel to zoom
  flight/FlightSequence.ts  the scripted flight out to any destination
  mission/CollectMission.ts the real places to find, for any body
  ui/                       ui.ts, ui.css, icons.ts, grownups.ts (the adult's one
                            screen), photos.ts (real photographs of the places)
  audio/narration.ts        SpeechSynthesis wrapper — see "Known weak spot"
  audio/sfx.ts              every sound: two cues, the engine, the sunrise. No files
  state/progress.ts         stickers and visits, in localStorage
public/assets/              real textures, dropped in and picked up automatically
design/                     reference art that is NOT shipped
```

---

## Invariants — break these and something subtle goes wrong

**`main.ts` is the only caller of `reset()`.** Every stateful module owns a `reset()` that
undoes exactly its own state. That is what makes *Fly Home* work without reloading the
page. If you add a module that holds state across a flight, give it a `reset()` and call it
from `restart()` in `main.ts`.

**Destinations are data.** `DESTINATIONS` in `config.ts` holds the copy, `Bodies.ts` holds
the geometry, `main.ts` matches them by id. Nothing branches per destination. Adding a
planet should be a config entry plus a body — if you find yourself writing `if (id ===
'mars')`, stop.

**The ship's nose points along +Z.** `Spaceship.orient()` maps that to any direction. A GLB
replacement must match the same convention or the flight will fly backwards.

**Everything under `public/` is copied into the build**, referenced or not. Reference art
lives in `design/` for exactly this reason — a 1.6MB PNG nobody loads was previously being
served to every visitor.

**Earth's colour and roughness maps are only correct as a pair.** The generated pair are
cut from the same noise field. Dropping a real photo in beside the *generated* roughness
map would put ocean sheen on the wrong side of every coastline, so `resolveEarthMaps()`
derives roughness from whichever colour map actually won. Do not "simplify" that back into
two independent `resolveTexture` calls.

**Rendering always goes through `EffectComposer`**, even when bloom is off, so tone mapping
and colour conversion happen in one place for every material including the custom shaders.

**Finding is ambient, not modal.** The markers are simply present on arrival; there is no
button to start a mission and nothing to finish before leaving. *Fly Home* is on screen
from arrival onward and never moves. This was a deliberate reversal — the mission used to
be a mode whose only signposted exit was completing it, which made "how do I get back?" the
most common reaction to the game.

**The places are real, and so are their coordinates.** `Discovery` in `config.ts` carries a
genuine latitude and longitude, and `surfaceDirection` puts the marker there on the body's
own surface mesh. The ring is therefore *on* the feature in the actual NASA map. Do not
"simplify" this back into positions chosen relative to the camera — that was the previous
design, and a rock that could be anywhere is exactly what made finding one teach nothing.

**Two things about an arrival are free, and both are spent on the discoveries.** The body's
rotation about its own axis (`facingLongitude`) brings the near ones round to the camera,
and the flight's arrival latitude (`facingLatitude`, passed into `start()`) swings the
camera to the band they sit in. Neither moves a feature relative to another. Without the
second one the Sun dominates the arrival direction, the camera looks down from 33 degrees
up, and everything near the equator projects onto the bottom limb underneath the dock.

**The last discovery in the list is the hidden one**, past the limb, so reaching it needs a
drag. There is a bound on *how far* past: much beyond ~130 degrees is half a turn of
dragging over an unlit hemisphere, which a small child gives up on. Both halves of that are
tested, because both have been got wrong.

**A marker cannot be tapped through its own body.** `withinVisibleFace` rejects any hit on
the far side. The hit spheres are many times the marker's size on purpose, and the raycast
tests only them — it never learns the planet is in the way. This is not theoretical: at
Earth's arrival the Sahara and the hidden night-side marker project within thirty pixels of
each other, so tapping the same spot twice collected the far-side discovery through the
planet, without the drag the whole design exists to teach.

**Earth's axial tilt lives on a group above the sphere, not on the sphere.** It looks
identical and is not. The mission sets the surface's rotation *about Y* and reads the
camera's bearing in the surface's parent space to decide what to set it to; a z-tilt on the
mesh itself sits inside that y-rotation and silently moves every marker off its
coordinates. The Moon and Mars carry their tilt on a container for the same reason.

**The day turn drives the hold, it does not fight it.** `DayTurn` moves the value
`holdSurface` is already reproducing every frame, via `turnSurface`, so a mission's markers
stay exactly where they are relative to the ground while the world underneath them turns
into the light. Exactly one full turn, clamped against what is left rather than against the
clock, so every marker ends on its real coordinates — a few thousandths of a radian of
overshoot per press is invisible and cumulative. And it swings the camera level with the
equator *and* square to the Sun before turning anything: square to the Sun alone leaves the
camera high, where the day/night line lies across the disc and an east-west rotation slides
everything along it instead of over it. Both halves are tested; the second one looked
right until it was watched.

**The Moon is tidally locked, and locking means doing nothing.** Its mesh inherits the
orbit from the spin group above it, so a *constant* local rotation keeps one face towards
Earth; any rotation of its own is what unlocks it. There used to be a `MOON_SPIN` and a
counter-turn that subtracted the inherited orbit back out, under a comment claiming tidal
locking — the opposite of it, leaving the Moon near enough fixed against the stars and
turning once against Earth every two minutes. The game *tells* a child the Moon keeps the
same face towards us, so this is a claim the scene has to honour. Not unit-testable (it is
a scene-graph property); check it by measuring the angle between the Moon's local +X in
world space and its direction to Earth over ~20s — constant means locked.

**A visited body's surface is held still.** `holdSurface()` freezes it; the mission calls
it in `build()` and releases it in `teardown()`. Markers are children of the surface mesh,
and a turning one carries them out from under a child's finger. The Moon needs both its
spin and its orbit-compensating counter-turn stopped, which is why the hold stores the sum
rather than the raw rotation.

**Only one fold timer for the fact card.** Facts overlap — finding a place replaces the
arrival fact, and completing a body queues the success line behind the last discovery — and
a stale timer from the previous fact will otherwise close the new one. There is also a
floor on how briefly a fact can be shown: speech that fails reports itself finished
immediately, and the fold hangs off the end of the reading.

**The journal holds discoveries, not stickers, and its size is counted rather than set.**
`JOURNAL_SLOTS` is `Object.keys(DISCOVERIES).length`, so finishing the game fills the grid
by construction. It was a hand-written 6 against a journal that showed the two stickers,
which left it two-thirds question marks for a child who had done everything — and a
hand-written number goes wrong again the next time a destination is added. Stickers are
still earned and still celebrated; they just are not what the grid shows.

**Visits and stickers are different facts.** `progress.ts` tracks both. The opening shot
widens to take in Mars once the Moon has been *visited*, not once its collection is
finished — gating the solar system behind a tapping game contradicts what the game is for.
Saves written before `visited` existed must keep loading (a missing list means "nowhere
yet"); there is a test for that.

**Assets are drop-in, and that now includes the discovery photographs.** Every texture is
HEAD-probed and falls back to a generated one; the photographs work the same way, and a
place whose file has not been sourced yet simply has no photograph rather than a broken
image. `ui/photos.ts` names the file after the discovery's id, so adding one is a correctly
named file and no code at all — the same bargain `public/assets/README.txt` makes, and the
reason `public/assets/discoveries/README.txt` is a list of filenames rather than a schema.

Three things about it that are load-bearing rather than incidental:

- **Nothing is fetched until a place is found.** That is what makes photographs affordable
  where sharpening the globe maps is not: sharper maps spend every byte before the title
  screen, and on a device whose pixel ratio is capped at 1.5 most of that detail is never
  drawn. A child who finds three places fetches three files; the other six are never asked
  for. Do not preload them, and do not put them in the journal grid without thinking about
  this — a journal that shows nine thumbnails has just downloaded all nine.
- **The probe is guarded on the discovery still being on screen.** Facts overlap: a find
  replaces the arrival fact, and the completion line queues behind the last find. A probe
  resolving a moment late would otherwise staple one place's photograph to another's words.
- **It is a thumbnail in the card, not a band across it.** The card already had to be
  taught to fold away during the day turn because it covers the planet; a full-width
  picture would put that back and more.

**Reduced motion removes motion; it does not compress it.** `prefers-reduced-motion` skips
the exhaust trail and the FOV punch, removes camera inertia, halves the collect particles,
and stops UI animation. New motion should check it.

**What it must never do is play the same move faster.** The flight used to run in 1.4s
instead of 7 under this flag, and the day turn in 3.7s instead of 11.2. That is the
identical sweeping camera move at five times the angular rate — more motion per second, not
less, and reported from the tablet the game is played on as faster and more awkward. Both
now have one duration for everyone. If a stronger accommodation is ever wanted, the right
shape is a *cut* (fade out, arrive, fade in), not a fast sweep.

**It deliberately does not mute anything either.** The preference is about discomfort from
movement, and silencing sound for it answers a question nobody asked. If sound should be
silenceable that wants its own control, not this flag.

**Continuous sound is driven a frame at a time, never scheduled.** `sfx.thruster` and
`sfx.dawn` are handed a value the picture is already using and follow it; nothing sets a
timed ramp and walks away. `Stage.tick` clamps dt to 0.05s, so a struggling tablet stretches
a flight or a day turn well past its nominal duration — anything scheduled against the audio
clock finishes early and leaves the rest of the moment silent. Measured headlessly: a 9s day
turn took 16.1s and still rang all six of its bells, one per sixth of a turn.

Three consequences, all of which have a test. The sound's *level* comes from the same value
the picture does — the engine follows `thrust`, which is what the exhaust is emitted at, not
the `cruise` bell that drives the FOV punch, or it would fade out while the flame was still
visibly firing. Every continuous sound must stop in `sfx.reset()`, because nothing else in
the game would ever stop it: a Fly Home mid-flight is a thruster running for the rest of the
session. And `sfx.reset()` is called when the tab is backgrounded too, since `stage.stop()`
halts the loop that does the driving and would otherwise leave the engine droning at
whatever gain it had reached.

---

## Conventions

Comments explain **why**, not what — and specifically why *this* choice over the obvious
alternative, usually with the failure it avoids. Several constants carry the number they
were changed *from* and what went wrong at the old value. Match that; it is the most useful
property of the codebase and the easiest to erode.

Tests cover the pieces whose failure is easy to miss by eye, not everything: journal
persistence, the collectible placement rule (hit spheres must not overlap), and the
flight's easing curve. If you find a bug that only appears at one specific constant, add a
test rather than only fixing it.

---

## Verifying visual work

There are no visual regression tests. The workflow that has worked is driving the real app
in headless Chromium and looking at screenshots:

```js
// Chromium is pre-installed in some environments at /opt/pw-browsers/.
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-<ver>/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
```

**Software rendering runs slowly, and `Stage.tick` clamps `dt` to 0.05s** so a dropped
frame cannot teleport the ship. At ~15fps that means flight time advances far slower than
wall-clock: a 7-second flight can take ~16 real seconds to complete headlessly. Wait
generously, or you will screenshot a flight you think has finished. This is a harness
artifact, not a bug — at 60fps `dt` never reaches the clamp.

Listen for `pageerror` in these scripts. A shader or maths bug shows up there and nowhere
else; a crash inside the frame loop leaves the last good frame on screen and looks fine in
a screenshot.

## Verifying sound

You cannot hear it. Say so rather than claiming a sound is good — how it lands is a property
of a tablet speaker in a child's hands, and the only honest answer is to ask.

What *is* checkable is everything that goes wrong silently, and all of it is a graph fact.
`sfx.test.ts` installs a fake `window.AudioContext` (no seam in the module: it reads the
constructor off `window`, so a test can simply provide one) and asserts that one engine is
built rather than one per frame, that gain follows the throttle, that every voice is stopped
and disconnected, and that nothing survives a `reset()`. The envelope maths is exported as
pure functions and pinned separately, like the flight's easing.

Headless Chromium has real Web Audio — a running context at 44.1kHz — so the same drive-the-
app workflow above measures the actual output: subclass `window.AudioContext` in an init
script, wrap `createOscillator` and friends to count starts and stops, and redefine
`destination` as a gain feeding an `AnalyserNode` feeding the real one. `getFloatTimeDomainData`
then gives you the RMS of everything the game is playing, frame by frame. That is how the
plateau shape, the six bells and the silence after every reset were checked here.

---

## Known weak spot: the narration

`src/audio/narration.ts` uses the browser's `SpeechSynthesis` API. Its own docstring calls
it temporary, and **the voice quality is poor** — that is the top complaint about the
current build.

It cannot really be fixed in place. The actual voice is whatever the operating system
ships, so the same code sounds different and mostly bad on every platform, and rate/pitch
tuning cannot rescue it.

**Nothing is read aloud unless someone asks.** Playtesting was blunt: this narration is bad
enough that none beats it. It used to start on its own for every fact and for the hunt
line, so there was no way to not have it; the speaker button is now the only thing that
starts a reading. That is a default and one line in `ui.ts`, not a deletion — put it back
the moment there is a voice worth hearing.

Two things were worth doing anyway, and both are tested:

- `pickVoice` **ranks** rather than first-matches. The old rule took the first voice
  matching any of a set of patterns in whatever order the platform listed them, so a
  device carrying both a good voice and a poor one was a coin toss decided by enumeration
  order. It also prefers a voice the device *fetches* over one it ships: on Android and
  desktop Chrome those are the neural ones, and the local fallbacks are where the
  complaint comes from. Weighted below the name rank, because on iOS everything is local
  and the good Siri voices would otherwise be buried by a mediocre network voice.
- `speechText` cleans the words before they reach the engine: em dashes become commas, and
  each sentence becomes its own utterance so a weak voice stops for breath. The text on
  screen keeps its dashes, where they read correctly.

**Let a person choose the voice, on the grown-ups panel.** None of the above can be heard
from a development machine — this one reports the API present and zero voices installed,
and quality is entirely a property of the device. `ui/grownups.ts` lists every voice the
tablet offers, best first; tapping one reads a real line from the game in it and remembers
it, and `pickVoice` then honours that saved choice over its own ranking. A ranking over
voice *names* is guessing at a quality it cannot observe, and an adult holding the tablet
can simply listen — so the heuristic is the default, not the verdict. The saved choice
falls back to the ranking if that voice is ever uninstalled.

The panel shows itself once per device and afterwards only on a two-second hold of the
journal button (or `?grownups`). It is a hold rather than a button because anything on
screen that opens settings is something a five-year-old will open, and it can say so in
writing precisely because the person it hides from cannot read yet. If you add anything to
it, keep it operational — a parent about to hand over a tablet reads one screen, and the
reasoning behind the game belongs in `README.md` where it can be as long as it likes.

Replacing it properly means pre-generated audio (ElevenLabs or similar), which is a real
tradeoff, not a free win — it breaks the project's "no build-time assets" property and adds
payload. The migration path that preserves the most:

- `Narrator` is already an interface (`available`, `speaking`, `speak`, `stop`, `onChange`,
  `dispose`). Write a file-backed implementation behind it; nothing else needs to change.
- **The one real friction:** `speak(text)` takes arbitrary text, and file playback needs a
  *key*. Either give every line an id in `config.ts` and change the signature to something
  like `speak(id, fallbackText)`, or keep a text→filename manifest. Decide this before
  generating any audio.
- Keep SpeechSynthesis as the fallback for any line without a file, so the game never goes
  silent and lines can be migrated incrementally.
- Budget it: the fact copy lives in `DESTINATIONS` in `config.ts` and is short. Prefer
  `.ogg`/`.mp3`, and credit/licence the voice in `README.md` like the textures.

Generating the audio is a human step. An assistant can write the manifest, the loader, the
fallback and the config changes — but should not claim to have produced audio it cannot
produce.

It does not need a TTS account either. There are sixteen lines and they total about 465
words — three minutes read aloud, counted rather than estimated, and up from the nine lines
this paragraph used to claim, because Earth and Mars arrived since. A phone voice memo is
free, needs no licence line in the README, and for this audience a parent reading to a child
beats any synthesiser, because it lands in a register no synthesiser reaches.

---

## Suggested next steps

Ordered. The reasoning matters more than the order.

The first three need a person and a device, not a session. They are first because no amount
of code substitutes for them.

1. **Listen to the sound on the real device.** The engine and the sunrise are in and the
   graph is measured, but nobody has *heard* them: the development machine has no audio,
   and loudness balance is a property of a tablet speaker. The likeliest things to want
   tuning are `THRUSTER_PEAK` and the bell peak in `dawn` — headlessly they measure about
   equally loud, and a bell should probably sit under an engine. Everything worth adjusting
   is a named constant at the top of its section in `sfx.ts`.

2. **Drop the nine photographs in.** The feature is finished and waiting;
   `public/assets/discoveries/README.txt` names the specific image wanted for each place
   and why that one. It needs a network that can reach NASA, which the assistant
   environment does not have — every image host is refused at the egress gateway, and an
   assistant that offers to "source them" from in here is about to invent something.
   **Never generate a stand-in for one of these.** The game tells a child *this is the real
   Sahara*; a synthesised picture under a NASA credit is a lie told to a five-year-old.

3. **Watch a child use it again.** Every genuinely valuable change in this project came
   from that and not from reading the code: the sunrise, the drag lesson, the badges on the
   markers. The open question is whether finding places still feels clunky now the dock has
   moved off the planet.

Then, in code:

4. **Add Saturn.** Cheap by design — a config entry with three real places and a body — but
   with one design decision that is not: a `Discovery` is a lat/lon on the surface mesh, and
   Saturn's recognisable feature is the rings, which are not a surface coordinate. The polar
   hexagon cannot be the hidden one either, because the hidden one has to sit ~120° round in
   *longitude* and a pole does not hide behind the limb that way. Either pick three cloud
   features spread in longitude, which wastes the reason to add Saturn at all, or let one
   discovery live on the ring plane at a radius instead of on the sphere — a contained
   change that keeps the drag rule intact. Assets: an equirectangular `saturn.jpg`, and a
   ring strip **as a PNG** because it needs alpha, which is the one exception to the
   "use .jpg" rule. Watch the ring UVs: `THREE.RingGeometry` does not map `u` across the
   radius by default and rewriting that attribute is the classic Saturn gotcha.

5. **Give sound a way to be turned off.** There is none, and `ui/grownups.ts` is now the
   obvious home for it. Worth doing before any music: an unmuteable children's game is a
   well-earned complaint.

6. **Replace the narration voice.** Still the top complaint. The `?grownups` picker made the
   best of what a device ships, which may be enough — ask before spending an afternoon on
   recordings. See *Known weak spot* above.

Known and left alone: the Moon can wander into the shot while a child explores Earth, and
at these compressed distances it is large when it does. The arrival steers clear of it;
the camera then orbits on a shell the Moon's orbit crosses, so dragging far enough round
still finds it. Moving the Moon out would change every other shot in the game.

Done since this file was written: collecting became discovering (real places at real
coordinates, each telling you something that goes in the journal), the flight now arrives
about three body-radii out instead of nine and a half, Earth is a destination, the narration
no longer starts on its own, Earth can be turned through a day, the flight and the day turn
both make a sound, a found place keeps its own emoji badge and can show a real photograph,
an adult can choose the reading voice, and in landscape the dock lies along the bottom
instead of standing on the planet.

Not yet in scope: real orbital physics, planets past Mars, downloaded models.

---

## Assets

Real textures go in `public/assets/` and are picked up automatically — see
`public/assets/README.txt` for exact filenames and sources. Images wider than 2048 are
rescaled in the browser before reaching the GPU, so an oversized drop-in costs a console
warning rather than a dead tab. Anything under a CC BY licence must be credited in
`README.md`; the current Solar System Scope textures already are.
