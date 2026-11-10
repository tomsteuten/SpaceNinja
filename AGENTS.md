# Working on Space Ninja

Guidance for any assistant (Claude, Codex, Gemini) picking this project up cold; `CLAUDE.md`
points here. Space Ninja is a gentle 3D solar-system explorer for children roughly 5-8 (Vite,
TypeScript, Three.js; no backend; GitHub Pages from `main`). [`DECISIONS.md`](DECISIONS.md) is
the scope and `docs/current-implementation.md` the plan and progress. `README.md` is the
product overview; history is in `docs/decision-history.md`.

Work on a branch, never directly on `main`. Commit and push freely to your own branches. Merge
to `main` only when the branch's latest CI run has passed, then check the deploy run too. Ask
first before spending money or creating accounts. Owner's machine: Windows, PowerShell 5.1 (no
`&&`; Git Bash is also available), `gh` CLI installed. Playwright uses software WebGL, so
flights there take 1-2 minutes.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test                            # vitest
npm run build                       # typecheck + vite build
npm run test:e2e                    # full Playwright suite: CI only
npm run narration:generate          # ElevenLabs (needs ELEVENLABS_API_KEY; --force, --only=<cue>)
```

## Testing

- Every commit: `npm run typecheck && npm test`.
- UI, gameplay, camera or layout change: run only the affected Playwright file(s) with
  `--project=phone`, e.g. `npx playwright test e2e/earth-day.pw.ts --project=phone`.
- Never the full browser suite locally; CI runs it on every pushed branch (15-20 minutes).
- A failing browser test: rerun it alone once before diagnosing (load causes false timeouts).
- Playtest builds accept `?fast` for short flights; a normal build ignores it.
- Judge appearance from real screenshots: `STYLE_OUT=design/<folder> npx playwright test
  e2e/style-capture.pw.ts --project=phone` (full resolution; suite screenshots are half-size).
- Before screenshots: a temporary `git worktree` plus `npm ci`. Never junction or symlink
  `node_modules` into it: `git worktree remove` follows the link and deletes the real one.

## Narration

New lines are script-only for now (DECISIONS.md #9): write them to
`src/audio/narration-script.json`, show them as words, generate no audio until the owner
approves the final recording pass.

## Invariants

- **Lifecycle:** every stateful subsystem owns a reset/dispose. One coordinator
  (`src/session/lifecycle.ts`) handles Fly Home, progress reset, crash and teardown; none
  partially resets. A persisted `pagehide` suspends; a real exit disposes.
- **Camera:** ownership is exclusive during flight, home return and day turn; orbit input must
  not fight it. Reduced motion cuts or drops motion, never plays the sweep faster.
- **Surfaces:** discovery lat/long are genuine and markers stay on the surface. Earth, Moon
  and Mars axial tilt sits above the rotating surface. `holdSurface()` keeps a visited surface
  under the finger; `DayTurn` advances the held value instead of fighting it.
- **Moon:** tidal lock comes from scene-graph inheritance (constant local rotation). No
  independent Moon spin.
- **Placement:** arrival composition and discovery selection share one placement maths; targets
  are visible and reachable, ring targets readable, far-side ones not collectable through the body.
- **Framing:** accounts for the current UI footprint and the body's visible silhouette (Saturn's
  `viewRadius` includes its rings). Unusual bodies expose capabilities, not one-off branches.
- **Ship:** authored forward is +Z; adapt a replacement model at the model boundary.
- **Rendering:** goes through `EffectComposer`. Earth colour and roughness maps are a pair
  (`resolveEarthMaps()`). Coarse pointers start at the medium tier; measure on a phone first.
- **Assets:** everything in `public/` ships (reference art goes in `design/`). Full discovery
  photos are lazy: no preloading, no journal fetching them all; thumbnails precache separately.
  A missing photo gives an intentional no-photo state. Provenance is in
  `public/assets/discoveries/README.txt`.
- **Input:** touch drag applies each pointer delta once; inertia is time-based. Hit targets may
  exceed drawn controls but far-side occlusion still applies. Keep the centre playfield clear;
  controls have names, focus behaviour and large touch areas; no route depends on reading.
- **Panels:** the photo viewer closes only on a fresh backdrop pointer sequence after its
  guard. Never add a backdrop `click` handler (Android compatibility clicks closed it at once).
  Guarded closes share `src/ui/panelGuard.ts` (nothing within 0.5 s of opening, nor from the
  opening press). X buttons and keyboard closes are immediate.
- **Audio:** only bundled authored narration autoplays; SpeechSynthesis is a manual fallback; a
  missing clip never silences another. Written words exist in every audio mode. Continuous
  sounds follow the visual value per frame and stop on reset, crash and background.
- **Persistence:** visits, discoveries, stickers and settings are separate facts. Adult reset
  removes only progress (not sound choices, grown-up acknowledgement or caches). Counts derive
  from configured discovery IDs.
- **Service worker:** generated from `sw/sw.js` by `sw/build.ts`. Shell cache version includes
  `index.html` contents; media has a separate stable cache. Dev does not register it. An update
  may reload at the settled title, never during play.
- **Failure:** a frame-loop error stops the loop, silences audio and shows the crash screen;
  a frozen last frame is never acceptable.
- **Playtest:** the `VITE_PLAYTEST=1` scene snapshot never ships in a normal build.

## Visual style

"Storybook crayons" (`src/ui/storybook.css`, loaded after `adventure.css`; Patrick Hand and
Andika bundled via `@fontsource`): paper, ink outlines, flat offset shadows, tilted photo
snapshots. One crayon colour per control everywhere, so a pre-reader can say "the yellow one".
New controls take a variable from the top of `storybook.css`; add them here.

| Control | Crayon |
| --- | --- |
| Space map, Keep exploring (any way back) | sky |
| Listen, panel replay | grape |
| Day & night and its state; done tick on map cards and journal snapshots | grass |
| Jump, Find places, Start playing, Hooray!, hunt/next-world arrows; found dots, "3 found!", world star | sun |
| Turn Earth (teal), Bath/Plop! (bubble), Rover (lime), Moonlight/Move Moon (moon, silver), Far away (star, indigo) | per toy |
| Journal, All places, open journal page | tomato |

## Architecture map

```text
sw/              generated offline worker and tests
public/          shipped manifest, icons and real media
src/main.ts      adventure wiring, visit reset, frame orchestration
src/config.ts    destination data and scene constants
src/session/     browser lifecycle, failure screen, offline registration
src/map/         paged neighbourhood map model and framing
src/worlds/      world catalogue (docs/worlds-roadmap.md)
src/scene/       renderer, worlds, ship, sky, textures, day turn
src/controls/ flight/ audio/   orbit input, cinematics and home return, narration and sound
src/mission/     discovery selection and collection
src/toys/        hands-on toys (Moon jump and Moonlight, Earth bedtime spin, Sun Far away, Saturn bath, Mars rover)
src/ui/          DOM interface, styles, grown-ups panel, photos
src/state/       progress, replay, settings
content/ design/ e2e/ docs/    world data, unshipped reference, Playwright, plan and ideas
```
