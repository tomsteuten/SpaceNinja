# Working on Space Ninja

Context for an assistant picking this project up cold. `CLAUDE.md` points here so other
coding assistants read the same guidance. Read `README.md` for the product overview.

This file deliberately contains only current operating guidance. Historical decisions and
the September 2026 rule audit live in `docs/decision-history.md`.

## Product north star

Space Ninja is a gentle 3D space explorer for children roughly 5–8, built with Vite,
TypeScript and Three.js. It has no backend or accounts and deploys to GitHub Pages from
`main`. The target device is an older Android tablet.

Judge changes in this order:

1. Is it enjoyable and understandable in a child's hands?
2. Does the first touch get an immediate, visible response?
3. Is the main invitation obvious without covering the world?
4. Does it remain forgiving, accessible, private and usable offline?
5. Is the implementation correct, maintainable and fast enough on the target device?

Fresh observation outranks an old design decision. A previous failure explains risk; it does
not permanently forbid every alternative. When playtest feedback conflicts with a current UI
choice, change the choice while preserving any independently tested correctness property.

## Rules have different strength

Do not treat every note as an invariant.

- **Product constraints** protect the audience: generous touch targets, immediate feedback,
  low reading burden, no dead ends, privacy and accessibility.
- **Correctness invariants** prevent reproducible bugs and should normally be backed by tests.
- **Design choices** are the current solution, not law. Replace them when a clearer design
  preserves the product constraints.
- **Experiments** are hypotheses. Keep them measurable and easy to enter and leave; promote,
  revise or remove them after real-device observation.

Document an important reversal in `docs/decision-history.md`, including what evidence changed
the decision. Do not append a new prohibition to this file for every bug fix.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run narration:generate
```

Run `npm run typecheck && npm test` before every commit. Run `npm run test:e2e` for gameplay,
camera, arrival, responsive layout or UI-flow changes. Browser screenshots are part of the
result for WebGL work; DOM assertions alone do not establish visual quality.

## Current child loop

- The home map offers stable destination controls as well as tappable moving worlds.
- A tap launches one journey and must acknowledge misses or locked choices.
- Arrival exposes discoveries immediately. Finding is ambient and Fly Home remains available.
- Each world carries six real places and selects three per visit, favoring unseen places while
  requiring every authored place to remain reachable over repeated visits.
- A short visual coach may demonstrate tapping or looking around after inactivity.
- Day/night is a contextual activity. It must be discoverable and understandable, especially
  on Earth, but it must not trap the child in a long uninterruptible introduction.

These are current choices, not permanent markup requirements. In particular, the destination
bar, journal, fact card, day/night control and Fly Home may be recomposed into a clearer
responsive control system. Protect the playfield and the child's escape route, not the
historical position of each button.

## Correctness invariants

### Scene lifecycle

Every stateful subsystem owns a reset/dispose operation that undoes its own state. There must
be one lifecycle coordinator so Fly Home, progress reset, crash handling and page teardown do
not partially reset the scene. That coordinator may move out of `main.ts`; central ownership,
not the filename, is the invariant.

Camera ownership is exclusive during scripted flight, home return and a day turn. Orbit or
manual input must not fight the active camera owner. Reduced motion may replace a move with a
cut or remove nonessential motion; it must not play the same sweeping move much faster.

### Worlds, framing and coordinates

Discovery latitude and longitude are genuine and markers stay attached to the body's surface.
Earth, Moon and Mars axial tilt belongs above the rotating surface so longitude remains
correct. `holdSurface()` keeps a visited surface and its markers under the child's finger.
`DayTurn` must advance the held surface value rather than separately fighting it.

The Moon is tidally locked through scene-graph inheritance: a constant local rotation keeps
one face toward Earth. Do not add an independent Moon spin without rechecking that property.

Arrival composition and discovery selection share the same placement maths. Automated checks
must ensure selected targets are visible/reachable, ring targets are viewed at a readable
inclination, and far-side targets cannot be collected through the body. Whether every visit
must include a hidden target is a design hypothesis, not a correctness requirement.

Framing must account for the *current* UI footprint and a body's visible silhouette. Saturn's
`viewRadius` includes its rings. Outer-world reveal and framing gates must agree so a newly
visible body is also navigable. The exact tiers, gates and map composition may be redesigned.

Destinations share common data, but unusual bodies may expose explicit capabilities such as
rings, custom framing or non-spherical marker placement. Avoid one-off branches when a small
capability models the difference clearly; do not force a false uniformity.

The spaceship's authored forward direction is +Z. Any replacement model must match it or adapt
at the model boundary.

### Rendering and assets

Rendering goes through `EffectComposer` so tone mapping and color conversion are consistent.
Coarse-pointer devices begin at the medium quality tier; do not spend detail the capped pixel
ratio cannot display. Measure on the target tablet before raising baseline cost.

Earth's color and roughness maps are a pair. `resolveEarthMaps()` derives roughness from the
color map that actually loaded; independent fallback selection misaligns ocean sheen and land.

Everything in `public/` ships. Reference art belongs in `design/`. Discovery photographs are
lazy: do not preload the full set or make the journal fetch every image. A missing photograph
must produce an intentional no-photo state, never a broken image.

Discovery photographs must be real and their provenance recorded in
`public/assets/discoveries/README.txt`. Never synthesize a documentary image or attach a false
NASA credit. An assistant may source a real image when its tools can reach and verify an
authoritative photographic archive; inability in one shell or past environment is not a
permanent process rule.

### Input, UI and accessibility

Touch drag must apply each pointer delta once and inertia must be time-based. Hit targets may
be much larger than their drawn controls, but far-side occlusion still applies.

Keep the center and lower-middle playfield substantially clear during normal interaction.
Prefer one primary contextual control cluster and at most one small secondary control. Controls
must have readable names, keyboard/focus behavior where relevant, and comfortably large touch
areas. A child-facing route cannot depend on reading, but a short label may reinforce a visual
or narrated action; “show, don't only tell” is guidance, not a ban on words.

The fact card currently keeps title, full-width words, then photograph/audio actions because a
side-by-side phone layout covered the globe. A redesign may change this if screenshots and
responsive checks demonstrate equal or better playfield protection and accessibility.

The photo viewer dismisses only on a fresh backdrop pointer sequence after its opening guard.
Do not add a backdrop `click` handler: Android compatibility clicks previously closed it the
instant it opened. The explicit close button remains immediate.

### Audio and persistence

Only bundled authored narration starts automatically. Device SpeechSynthesis is manual
fallback. Available recordings work per discovery; a missing clip must not silence a different
recording. Written words remain available in every audio mode.

Continuous sounds follow the visual value every frame and stop on reset, crash and background.
Do not schedule a wall-clock envelope that can finish before a slowed render sequence.

Visits, discoveries, stickers and settings are different persisted facts. Adult progress reset
removes only adventure progress, not sound choices, grown-up acknowledgement or offline caches.
Counts derive from configured discovery IDs rather than a second handwritten total.

### Offline and failure behavior

The service worker is generated from `sw/sw.js` by `sw/build.ts`. Its shell cache version
includes `index.html` contents; media uses a separate stable cache; discovery photographs are
not precached. Development does not register the worker. An update may reload at the settled
title but never interrupt active play.

Frame-loop failures stop the loop, silence continuous audio and show the reusable crash screen.
A frozen last frame is not an acceptable error state.

## Manual flight experiment

Manual flight is a supported experiment, not forbidden gameplay. The current `?freeflight`
route reuses the real scene with one-finger steering, assistive braking/collision handling and
optional autopilot. It should be reachable from the grown-ups panel and by a documented
keyboard shortcut, and it must offer a clear route back to the normal adventure.

Do not assume the experiment must remain separate forever or that technical success earns it a
place in the main loop. Evaluate it on the target tablet against observable questions:

- Does holding relative to screen center feel like steering rather than dragging scenery?
- Does the ship visibly lead the camera through a turn?
- Can a child reach a world without adult correction?
- Is autopilot understood as help rather than a different game mode?
- Can the child stop, recover from a mistake and return to the adventure?

Promoting manual flight should be a product decision based on this evidence. Iterating on and
shipping the clearly labelled experiment does not require prior proof.

## Verification notes

Playwright drives an isolated `VITE_PLAYTEST=1` build. The exposed scene snapshot is read-only
and must never appear in a normal build. Exercise boot, real pointer input, scene transitions,
arrival, return, resize and representative phone/tablet/short-landscape viewports. Capture and
inspect screenshots for overlay weight, alignment, target clearance and legibility.

Software WebGL can stretch nominal durations because `Stage.tick` clamps large frame deltas.
Wait for state rather than assuming a seven-second flight takes seven wall-clock seconds. Treat
`pageerror` and console errors as failures.

Automated audio graph checks can prove lifecycle and envelope behavior, not whether narration
or sound is pleasant on a tablet speaker. Real-device listening and child observation remain
necessary and should be reported as unverified until performed.

## Architecture map

```text
index.html                  boot/error shell
sw/                         generated offline worker and tests
public/                     shipped manifest, icons and real media
src/main.ts                 current game orchestration
src/config.ts               destination data and scene constants
src/scene/                  renderer, worlds, ship, sky, textures, day turn
src/controls/               orbit input
src/flight/                 cinematic, home return and manual-flight experiment
src/mission/                discovery selection and collection
src/ui/                     DOM interface, grown-ups panel, photos and coach
src/audio/                  narration and sound
src/state/                  progress, replay and settings
design/                     unshipped reference material
e2e/                        browser playthroughs and screenshot checks
```

When a module becomes a change bottleneck, split it along ownership boundaries. “No framework”
does not mean “no components” or “one giant file”; use small DOM components or a state machine
when they make transitions and responsive layouts clearer.
