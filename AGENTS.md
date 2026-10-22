# Working on Space Ninja

Context for an assistant picking this project up cold. `CLAUDE.md` points here so Claude,
Codex and Gemini read the same guidance. `README.md` has the product overview,
[`DECISIONS.md`](DECISIONS.md) the current product decisions, and
[`docs/toys.md`](docs/toys.md) the plan of work. History lives in `docs/decision-history.md`.

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

Fresh child observation, reported by the owner, carries the most weight. Report child
comprehension, tablet performance and listening as unverified until observed.

Correctness invariants (below) are backed by tests and hold through any redesign. Everything
else (layouts, button order, copy) is the current design, not law: replace it when a clearer
design keeps the child safe, unblocked and able to get back to the Space map.

## Working agreement

These hold for every assistant, not only the one the owner last briefed.

- Commit and push freely to your own branches.
- Work on a branch, never directly on `main`. Every pushed branch runs the full unit and
  browser checks on GitHub (`deploy.yml`, about 15–20 minutes). Merge to `main` only when
  your branch's latest run has passed, then check the deploy run on `main` too. A small
  docs-only change may go straight to `main`. Only one session merges to `main` at a time.
- Use the GitHub token from the user environment: in PowerShell,
  `[Environment]::GetEnvironmentVariable('GH_TOKEN','User')`. The copy Git Bash inherits
  may be stale.
- Visual changes: a new look needs the owner's approval from before/after screenshots first.
  Once a look is approved, roll it out without stopping per screen: restyle, run the affected
  checks, merge, then send one before/after review of every screen touched. Never
  self-approve appearance.
- Ask first before spending money, creating accounts, deleting the owner's data or changing
  the product direction.
- Prefer small focused commits. Write a doc only when it saves the next person real time;
  shorter is better. When you finish a piece of work, add a checkpoint of at most ten lines
  at the top of `docs/current-implementation.md`.
- Art: prefer free CC0 assets (Kenney, Quaternius) and NASA 3D models. Paid tools and
  commissioned art are out of scope for now. The mascot is undecided.

## Owner's machine

Windows, PowerShell 5.1 (no `&&`: one command per line); a Git Bash tool may also be available.
No `gh` CLI: a fine-grained token for this repo is in the `GH_TOKEN` user environment variable.
Use it with `curl` or `Invoke-RestMethod` against `api.github.com/repos/tomsteuten/SpaceNinja`
for runs, logs, artifacts and PRs, and never print it. Don't run `python -` (the Windows stub
waits on stdin). No GPU: WebGL renders in software, so flights take 1–2 minutes and the full
browser suite about 50.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run narration:generate          # shipped pack, ElevenLabs (needs ELEVENLABS_API_KEY; --force, --only=<cue>)
npm run narration:generate:kokoro   # keyless local fallback (needs ffmpeg + npm i --no-save kokoro-js)
npm run narration:generate:openai   # optional keyed alternative (needs OPENAI_API_KEY)
```

### Testing: what to run, and when

- **Every commit:** `npm run typecheck` and `npm test`. Seconds.
- **UI, gameplay, camera or layout change:** run only the Playwright file(s) for the screen you
  touched, and only the affected viewports, e.g.
  `npx playwright test e2e/earth-day.pw.ts --project=phone`. Let CI run the rest.
- **A failing browser test:** rerun it alone once before diagnosing; machine load causes false
  timeouts. The Moon rotation tolerance check in `e2e/visit.pw.ts` is known to fail on slow
  machines.
- **After pushing a branch:** wait for its Actions run before merging; if it fails, read the
  job log or download its `browser-checks` artifact, fix and push again.
- **Screenshots for review:** the suite's own screenshots are half-resolution and weak evidence.
  Use `e2e/style-capture.pw.ts`, skipped unless `STYLE_OUT` is set; in Git Bash:
  `STYLE_OUT=design/<folder> npx playwright test e2e/style-capture.pw.ts --project=phone`.
  It captures tablet, phone and short landscape at full resolution. The browser pane's own
  screenshots crop on the owner's high-DPI screen.
- **Fast flights:** in the playtest build, `/?fast` shortens flights to 0.3 s (a normal build
  ignores it). Captures and checks that aren't about the flight itself use it; flight,
  lifecycle, offline and graphics-recovery checks keep the full-length flight.
- **"Before" screenshots:** use a temporary `git worktree` of the previous commit and run
  `npm ci` inside it. Never junction or symlink `node_modules` into it: `git worktree remove`
  follows the link and deletes the real `node_modules`.

## Toys

Each destination gets one hands-on toy that teaches one big idea with real numbers
([`docs/toys.md`](docs/toys.md) has the ideas and the order). The Moon jump is the pattern:

- One toy per world, self-contained in `src/toys/` (logic, overlay and its own CSS).
- Physics and numbers are pure functions with unit tests (`jumpPhysics.ts` and its test).
- Opened from a button in the world's visit row with its own crayon colour (Jump on the Moon,
  Bath on Saturn; Earth's Day & night opens the bedtime spin).
- The overlay is detached from the DOM while closed, not merely hidden: tests use
  `locator('canvas')` and expect exactly one canvas.
- Leave the 3D scene alone; a toy is an overlay with a pictured way back.
- One short caption at most, plus one narrated line (Kokoro while building).
- The toy button carries class `toy-btn`: it is held back during the hunt and pops in as the
  next step after the third find (`setVisitStage` in `src/ui/ui.ts`, `e2e/quiet-arrival.pw.ts`).
  A new visit button changes the row's cells; narrow phones must still fit it with wrapping
  labels and touch targets of at least 54 px.

## Visual style

"Storybook crayons": paper, ink outlines, flat offset shadows, a slightly tilted photo snapshot
on postcards. It lives in `src/ui/storybook.css`, loaded after `adventure.css`, with Patrick
Hand and Andika bundled offline via `@fontsource` (Latin subsets). Each control keeps one
crayon colour everywhere it appears, so a pre-reader can say "the yellow one":

| Control | Crayon |
| --- | --- |
| Space map, Keep exploring (any way back to the world) | sky |
| Listen (and the panels' replay button) | grape |
| Day & night, the current day/night state | grass |
| Jump, Find places, Start playing, Hooray!, the hunt arrow | sun |
| Turn Earth (in the bedtime spin) | teal |
| Bath (Saturn's toy) and Plop! inside it | bubble |
| Journal, All places, the open journal page | tomato |

Panels (Words card, journal, postcard, finale, grown-ups) are paper with an ink outline and a
flat shadow. Home-map destination cards are paper; the suggested one is gold.

New controls take a colour from the variables at the top of `storybook.css`; add them here.

## Current child loop

The home map (paged neighbourhoods) offers destination buttons and tappable moving worlds. A tap
launches one flight; misses and locked choices are acknowledged. Arrivals show discovery places
to find; the first Earth arrival offers Turn Earth (the bedtime spin toy) or Find places. A visit's action row fills
in as the visit goes on: during the hunt only Space map and Listen (plus Day & night on Earth);
after the third find the toy pops in; once it is played, Journal and Day & night join. Held
controls keep their grid cells, so Space map never moves, and it is always the escape route. Discovery postcards have a pictured world-return as well
as a large X. These are current choices: protect the playfield and the escape route, not the
position of each button.

## Correctness invariants

### Scene lifecycle

Every stateful subsystem owns a reset/dispose operation that undoes its own state. One
lifecycle coordinator handles Fly Home, progress reset, crash handling and page teardown, so
none of them partially resets the scene. `src/session/lifecycle.ts` coordinates browser
suspension, crash and disposal. A persisted `pagehide` suspends resources for history
restoration; a real exit disposes them. Adventure reset remains a route-owned callback.

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

Arrival composition and discovery selection share the same placement maths. Selected targets
must be visible and reachable, ring targets viewed at a readable inclination, and far-side
targets not collectable through the body. Every authored place stays reachable over repeated
visits.

Framing accounts for the *current* UI footprint and a body's visible silhouette. Saturn's
`viewRadius` includes its rings. Outer-world reveal and framing gates must agree so a newly
visible body is also navigable. Unusual bodies expose explicit capabilities (rings, custom
framing, non-spherical marker placement) rather than one-off branches.

The spaceship's authored forward direction is +Z. A replacement model must match it or adapt
at the model boundary.

### Rendering and assets

Rendering goes through `EffectComposer` so tone mapping and color conversion are consistent.
Coarse-pointer devices begin at the medium quality tier. Measure on the target tablet before
raising baseline cost.

Earth's color and roughness maps are a pair: `resolveEarthMaps()` derives roughness from the
color map that actually loaded.

Everything in `public/` ships; reference art belongs in `design/`. Full discovery photographs
are lazy: do not preload them or make the journal fetch every full image. Small thumbnails are
precached separately. A missing photograph produces an intentional no-photo state, never a
broken image.

Planet imagery and discovery photographs are real, with provenance recorded in
`public/assets/discoveries/README.txt`. Never synthesize a documentary image or attach a false
NASA credit.

### Input, UI and accessibility

Touch drag applies each pointer delta once and inertia is time-based. Hit targets may be much
larger than their drawn controls, but far-side occlusion still applies.

Keep the center and lower-middle playfield substantially clear during normal interaction.
Controls have readable names, keyboard/focus behavior where relevant, and large touch areas.
A child-facing route cannot depend on reading; a short label may reinforce a picture or a
narrated action.

The photo viewer dismisses only on a fresh backdrop pointer sequence after its opening guard.
Do not add a backdrop `click` handler: Android compatibility clicks closed it the instant it
opened. Guarded pointer closes for the journal, reading panel and photo share
`src/ui/panelGuard.ts`: no guarded close within half a second of opening, and never from the
press that opened it. Photo and reading-panel X controls remain immediate; pictured returns
use the panel guard. Keyboard closes are immediate.

### Audio and persistence

Only bundled authored narration starts automatically. Device SpeechSynthesis is a manual
fallback. A missing clip must not silence a different recording. Written words remain
available in every audio mode.

Continuous sounds follow the visual value every frame and stop on reset, crash and background.
Do not schedule a wall-clock envelope that can finish before a slowed render sequence.

Visits, discoveries, stickers and settings are different persisted facts. Adult progress reset
removes only adventure progress, not sound choices, grown-up acknowledgement or offline caches.
Counts derive from configured discovery IDs rather than a second handwritten total.

### Offline and failure behavior

The service worker is generated from `sw/sw.js` by `sw/build.ts`. Its shell cache version
includes `index.html` contents; media uses a separate stable cache. Development does not
register the worker. An update may reload at the settled title but never interrupt active play.

Frame-loop failures stop the loop, silence continuous audio and show the reusable crash screen.
A frozen last frame is not an acceptable error state.

## Verification notes

Playwright drives an isolated `VITE_PLAYTEST=1` build. The exposed scene snapshot is read-only
and must never appear in a normal build. Use `e2e/fixtures.ts` for device setup, browser-error
checks and named screenshots. The most valuable checks are layout clearance (controls never
covering gold places) and lifecycle/offline edge cases.

Software WebGL stretches nominal durations because `Stage.tick` clamps large frame deltas: wait
for state, not wall-clock time. Treat `pageerror` and console errors as failures. Audio checks
prove lifecycle, not whether narration sounds good on a tablet.

## Architecture map

```text
index.html                  boot/error shell
sw/                         generated offline worker and tests
public/                     shipped manifest, icons and real media
src/main.ts                 adventure wiring, visit reset and frame orchestration
src/session/                shared browser lifecycle, failure screen and offline registration
src/map/                    paged neighbourhood map model and page framing
src/config.ts               destination data and scene constants
src/worlds/                 the world catalogue (docs/worlds-roadmap.md)
src/scene/                  renderer, worlds, ship, sky, textures, day turn
src/controls/               orbit input
src/flight/                 cinematic and home return
src/mission/                discovery selection and collection
src/toys/                   one hands-on toy per world (Moon jump, Earth bedtime spin, Saturn bath)
src/ui/                     DOM interface, styles (storybook.css last), grown-ups panel, photos
src/audio/                  narration and sound
src/state/                  progress, replay and settings
design/                     unshipped reference material and review captures
e2e/                        browser playthroughs and screenshot checks
```

When a module becomes a change bottleneck, split it along ownership boundaries. Small DOM
components or a state machine are fine when they make transitions clearer.
