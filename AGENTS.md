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
  ui/                       ui.ts, ui.css, icons.ts
  audio/narration.ts        SpeechSynthesis wrapper — see "Known weak spot"
  audio/sfx.ts              two synthesised cues, no audio files
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

**Reduced motion is respected throughout.** `prefers-reduced-motion` shortens the flight,
removes camera inertia, skips the trail and the FOV punch, and stops UI animation. New
motion should check it.

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

---

## Known weak spot: the narration

`src/audio/narration.ts` uses the browser's `SpeechSynthesis` API. Its own docstring calls
it temporary, and **the voice quality is poor** — that is the top complaint about the
current build.

It cannot really be fixed in place. `pickVoice()` regex-matches over `getVoices()` and
takes what it finds; the actual voice is whatever the operating system ships, so the same
code sounds different and mostly bad on every platform, and rate/pitch tuning cannot
rescue it.

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

Generating the audio needs a TTS account and is a human step. An assistant can write the
manifest, the loader, the fallback and the config changes — but should not claim to have
produced audio it cannot produce.

---

## Suggested next steps

Ordered. The reasoning matters more than the order.

1. **Give the flight sound.** `sfx.ts` has exactly two cues, both fired by the mission. The
   flight is the best-looking part of the game and is completely silent. A synthesised
   thruster driven by the same throttle value the trail already uses needs no audio files.

2. **Then add a planet.** Cheap by design: a config entry with three real places on it, and
   a body. Saturn over Venus — the rings are the most recognisable object in the solar
   system to a small child, and a torus is trivial geometry. Check the new discovery list
   against `CollectMission.test.ts`, which covers every destination automatically.

3. **Replace the narration voice.** Still the top complaint, and still needs pre-generated
   audio and a human with a TTS account. See *Known weak spot* above.

Known and left alone: the Moon can wander into the shot while a child explores Earth, and
at these compressed distances it is large when it does. The arrival steers clear of it;
the camera then orbits on a shell the Moon's orbit crosses, so dragging far enough round
still finds it. Moving the Moon out would change every other shot in the game.

Done since this file was written: collecting became discovering (real places at real
coordinates, each telling you something that goes in the journal), the flight now arrives
about three body-radii out instead of nine and a half, and Earth is a destination.

Not yet in scope: real orbital physics, planets past Mars, downloaded models.

---

## Assets

Real textures go in `public/assets/` and are picked up automatically — see
`public/assets/README.txt` for exact filenames and sources. Images wider than 2048 are
rescaled in the browser before reaching the GPU, so an oversized drop-in costs a console
warning rather than a dead tab. Anything under a CC BY licence must be credited in
`README.md`; the current Solar System Scope textures already are.
