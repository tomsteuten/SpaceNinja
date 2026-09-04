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
index.html                  boot markup + inline loading/error/crash state
sw/                         service worker: sw.js (template), build.ts (pure builder), tests
public/manifest.webmanifest the web app manifest — installable, standalone
public/icons/               home-screen icons: icon.svg is the source, the PNGs render from it
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
  state/progress.ts         discoveries, stickers and visits, in localStorage
  state/settings.ts         the grown-up's device choices (sound on/off), in localStorage
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

**Never generate a stand-in for a discovery photograph, and do not offer to source one from
inside an assistant environment.** The nine that are installed were fetched and checked by a
person, because every image host — NASA, Wikimedia, all of them — is refused at this
environment's egress gateway, and `WebFetch` is blocked for them too. An assistant that
offers to "source them" from in here is about to invent something. That matters more than
usual here: the game tells a child *this is the real Sahara*, and a synthesised picture
under a NASA credit is a lie told to a five-year-old. If a photograph needs replacing, say
what is wanted and let a person fetch it.

**The fact card is a column — name, then words at full width, then a row with the photo and
the speaker — and that is load-bearing, not cosmetic.** It used to flank the words with the
photo on one side and the speaker on the other, which squeezed a long fact into a strip so
narrow it ran ten lines deep: a card that covered most of the planet a child had just flown
to and hid the very markers it was asking them to tap. Full-width words wrap in half as many
lines. Do not put the photo or the speaker back *beside* the paragraph. And the photo carries
a magnifier chip (the `expand` icon) because it is a button that opens the picture full
screen, and a bare thumbnail was read as decoration — by an adult on a phone, not just a
child; that was the actual report behind "the Earth photos don't pop up" even though the
Earth photos loaded fine. If you make the card smaller again, the picture is the last thing to
cut: it is the part of the card a pre-reader can actually take something from.

**The full-screen photo viewer dismisses only on a fresh press on its backdrop, never on
the tail of the tap that opened it.** Reported from a Samsung phone: the photo opened and
shut instantly, on Earth, every time. It is a touch "ghost click" — a tap on the thumbnail
shows the overlay at those same coordinates, and the device then delivers the tap's trailing
compatibility click straight onto the overlay now under the finger. It does not reproduce in
a headless browser, which emits no ghost, so do not "simplify" the guard away because a
driver shows the viewer closing fine. The guard is in `ui/photos.ts`: a dismiss is honoured
only when a `pointerdown` actually begins on the overlay (the opening tap's landed on the
thumbnail) and not within `OPEN_GUARD_MS` of opening. The ✕ button bypasses both, because a
deliberately-found control must always work.

**A media query adds no specificity.** This bit the fact card: a `@media (max-width: 560px)`
block written *above* the base `.fact-card p` rule loses to it outright, so the card ran at
full desktop type on a 390px phone — eight lines deep, covering 93% of the planet a child
had just flown to. Responsive overrides in `ui.css` go *below* the rules they override, and
the landscape dock block only works where it does because it sets properties the base rule
never sets. Measure a layout claim rather than reading it: `percentOfPlanetCovered` in the
scratch driver projects the destination's disc and samples what is on top of it.

**The service worker is built, not written, and it is what makes the game work with no
signal.** `sw/sw.js` is a template with three placeholders; the Vite plugin in
`vite.config.ts` fills them from the built bundle, because Vite hashes its output names and
the worker cannot know them ahead of time. Everything that *decides* the worker's contents
lives in `sw/build.ts`, which is pure and has a test — two things it pins are load-bearing.
The shell cache is named after a version hash that includes `index.html`'s *contents*, not
just the hashed file names: a page-only change leaves every file name identical, and a
byte-identical worker is one the browser never reinstalls, so the stale `index.html` would
be served from cache forever. And the globe textures go in a *separate* cache that is not
named after the build, because they do not change when the code does and re-downloading
three megabytes on every deploy is not worth it — bump `MEDIA_CACHE` in the template by hand
to force those. The discovery photographs are deliberately never precached: nothing is
fetched until a place is found, and a photograph fetched once is then kept. Nothing registers
in development — a worker there serves stale modules over the dev server's live ones — so this
is only ever exercised against a `build` + `preview`, never `dev`.

**A crash has to be made visible, because the last good frame is not.** An exception thrown
inside the frame loop used to propagate to the console and leave the last rendered frame on
screen, which looks completely fine — a bug report from a tablet then reads only "it just
stopped". `Stage.tick` now wraps the whole frame in a try/catch, stops the loop (the same
throw would repeat sixty times a second otherwise) and calls `onCrash`; `main.ts` turns that
into the crash screen, which is the boot screen reused. That is why `#boot` is now *hidden*
on a successful start rather than removed, and why its `z-index` sits above every panel. The
crash screen prints the actual error small and selectable for whoever files the report, and
its one button reloads the page — the journal is in localStorage and survives.

**Finishing everything is its own moment, once.** Finding the ninth place completes the whole
game, and it used to get the same celebration as finding the third. `foundEverything()` in
`progress.ts` decides it — it takes the id list rather than importing config, so it is pinned
without a scene — and `main.ts` fires `ui.completeGame()` from a world's completion whenever
the book is now full, awarding the `space-ninja` sticker the first time only, exactly like
every other sticker. The finale is the journal shown full and big, badges popping in the
order they were found; it follows the world's own sticker rather than fighting it for the top
of the screen (a 3.2s delay), and closes on any tap or by itself. Adding a destination needs
no change here: the total is counted, not written down.

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

### Latest playtest — Samsung S25, a parent and their son (the live https build)

The most valuable input the project has had in a while, because it is real use by the actual
audience. Recorded here rather than left to be rediscovered:

- **The lit collectibles read as the Sun, and confused the child.** He thought the glowing
  gold rings were the sun or sunlight, not places to find. This is the single most important
  finding: the marker is a warm, additively-blended halo, and to a five-year-old a warm glow
  *is* a light source, not a target. The warmth was chosen deliberately (separation from grey
  regolith and rust — see the marker notes in `CollectMission.ts`), so the fix is not just
  "make it another colour"; it wants a shape/metaphor a child reads as *here is a thing to
  tap* — a pin, a ring that reads as drawn-on, a peek of the real photo, a "?" — and it needs
  watching, not a blind swap.
- **Touch rotation is too sensitive** — the view spins away faster than a child (or the
  parent) can control. `OrbitInput` maps a drag across the short screen edge to about a half
  turn (`scale = π / min(edge)`) and then adds glide (`inertia = 0.86`). Both are worth
  dropping for a coarse pointer; this is a safe, contained change.
- **The discovery photo still closes itself "about half the time" on the device**, even after
  the ghost-click guard in `photos.ts` (which fixed it in every headless run and reproduces
  nowhere here). Two live suspects, both needing the device to tell apart: a service worker
  still serving the previous build (a full close-and-reopen, or clearing the app's storage,
  forces the update), and a ghost whose synthetic `pointerdown` lands on the overlay outside
  the current 450ms guard. A stronger guard is to swallow the first synthetic click after
  opening at the document capture level; ship it only with someone holding the phone.
- **The Earth day-turn is beautiful on the planet, but its text card still distracts** from
  the one moment whose whole point is watching the light move.
- **The speech is still bad.** This is the known weak spot; the only real fix is recorded
  audio, not tuning the platform voice (see *Known weak spot*).

The parent's own direction — make **audio the primary guide** for a pre-reading audience,
default it **on**, and make the on-screen **text less prominent** — is the right shape, and
it is gated correctly on fixing the voice first. A synthesised voice defaulted-on would make
the game worse, not better; a *recorded human* voice defaulted-on could carry the whole "what
do I do", which is exactly the wordless-teaching gap this file keeps pointing at. Sequence:
record the lines, wire the file-backed `Narrator` (the interface is already there), *then*
flip the default and demote the text.

The first three below need a person and a device, not a session. They are first because no
amount of code substitutes for them.

1. **Listen to the sound on the real device.** The engine and the sunrise are in and the
   graph is measured, but nobody has *heard* them: the development machine has no audio,
   and loudness balance is a property of a tablet speaker. The likeliest things to want
   tuning are `THRUSTER_PEAK` and the bell peak in `dawn` — headlessly they measure about
   equally loud, and a bell should probably sit under an engine. Everything worth adjusting
   is a named constant at the top of its section in `sfx.ts`.

2. **Run it fullscreen, from a home-screen icon — and check it there.** The manifest and a
   service worker are now in (`display: "standalone"`, icons, offline). What is *not* done
   is watching a child launch it from the home screen: the fullscreen gain was measured off
   a Surface screenshot as close to a fifth of the screen, but nobody has installed it on a
   real tablet and confirmed the launcher icon, the standalone chrome and the offline
   reload all behave. The grown-ups panel now tells a parent how to add it and detects
   whether they already have. iOS is the untested platform here as everywhere (see below).

3. **Watch a child use it again.** Every genuinely valuable change in this project came
   from that and not from reading the code: the sunrise, the drag lesson, the badges on the
   markers. This has now happened once on an S25 (see *Latest playtest* above) and it earned
   its keep immediately — the collectibles reading as the Sun is the kind of thing no amount
   of reading the code would have found. Keep doing it; the next round should watch whether a
   recorded voice plus a less sun-like marker fixes "what do I do".

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

5. **~~Finishing everything is not a moment.~~** Done — see the invariant above. Finding the
   ninth place now brings up the finale and the `space-ninja` sticker. Still unwatched with
   a child, like everything in this file that has not been.

6. **It has never run on iOS Safari.** Everything here is driven in headless Chromium and
   played on Android and a Surface. Safari differs in the places this game leans on: audio
   context unlocking, `backdrop-filter` (used on nearly every surface — the `-webkit-`
   prefixes are there, but untested), `localStorage` throwing in private mode (guarded, also
   untested), and `env(safe-area-inset-*)`, which the layout uses for all four paddings and
   which only earns its keep on a notched device. If the game is ever handed to someone with
   an iPad, that is where it will break, and nobody has looked.

7. **Replace the narration voice — and it is now the lever, not a nicety.** Still the top
   complaint, and the S25 playtest confirms it: the parent's whole proposed direction (audio
   as the primary guide, defaulted on, text demoted) hangs on it. The `?grownups` picker made
   the best of what a device ships and it is not enough. The next real step is recorded audio
   behind the file-backed `Narrator` — a parent's voice memo beats any synthesiser for this
   audience, needs no licence, and is what would let audio carry "what do I do". See *Known
   weak spot* above for the migration path, which is already scaffolded.

Known and left alone: the Moon can wander into the shot while a child explores Earth, and
at these compressed distances it is large when it does. The arrival steers clear of it;
the camera then orbits on a shell the Moon's orbit crosses, so dragging far enough round
still finds it. Moving the Moon out would change every other shot in the game.

Done since this file was written: the game is now an installable app with a manifest,
home-screen icons (confirmed working on an S25) and an offline service worker; finishing
every place on every world is its own celebration with its own sticker; the frame loop now
shows a crash screen instead of a frozen last frame; the grown-ups panel states the privacy
property and explains adding to the home screen; the discovery photo is a full-width card
with an obvious magnifier affordance instead of a buried thumbnail, and its full-screen view
no longer dismisses itself to a touch ghost-click (mostly — see *Latest playtest*). Before
that: collecting became discovering (real places at real
coordinates, each telling you something that goes in the journal), the flight now arrives
about three body-radii out instead of nine and a half, Earth is a destination, the narration
no longer starts on its own, Earth can be turned through a day, the flight and the day turn
both make a sound, a found place keeps its own emoji badge and shows a real NASA photograph
of itself, an adult can choose the reading voice and turn the sound off, an arrow points at
the last place while it is round the back, and the dock no longer stands on the planet in
landscape or bury it on a phone.

The nine discovery photographs are installed and credited. They had to be sourced outside
the assistant environment, which cannot reach a single image host — see the note under
*Assets are drop-in* before offering to fetch any more.

Not yet in scope: real orbital physics, planets past Mars, downloaded models.

---

## Assets

Real textures go in `public/assets/` and are picked up automatically — see
`public/assets/README.txt` for exact filenames and sources. Images wider than 2048 are
rescaled in the browser before reaching the GPU, so an oversized drop-in costs a console
warning rather than a dead tab. Anything under a CC BY licence must be credited in
`README.md`; the current Solar System Scope textures already are.
