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
  `--project=phone`, e.g. `npx playwright test e2e/visit-shelf.pw.ts --project=phone`. New or
  changed specs run on all three projects (`phone`, `tablet`, `short-landscape`).
- The browser suite is a smoke set while the design moves (DECISIONS.md "Tests"): boot,
  lifecycle, offline, map keyboard (`accessibility`), the visit screen (`visit-shelf`), and the
  Moonlight and Far away toys.
- Never the full browser suite locally; CI runs it on every pushed branch (15-20 minutes).
- A failing browser test: rerun it alone once before diagnosing (load causes false timeouts).
- Playtest builds accept `?fast` for short flights; a normal build ignores it.
- Judge appearance from real screenshots: `VISIT_SHOTS=design/places/built npx playwright
  test e2e/visit-shelf.pw.ts -g pictures --project=phone --project=short-landscape` (full
  resolution; suite screenshots are half-size): each world's visit screen and its first two
  Places photos. `VISIT_SHOTS_OTHERS=<folder>` adds Mars, Saturn and the Sun;
  `STYLE_OUT=<folder>` with `e2e/paged-map-capture.pw.ts` pictures the map.
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
- **Surfaces:** place lat/long are genuine and the place mark sits on the surface. Earth, Moon
  and Mars axial tilt sits above the rotating surface. A visit holds its world's surface from
  arrival to Fly Home (`holdSurface()` in main.ts); `DayTurn` and the Places turn advance the
  held value instead of fighting it.
- **Moon:** tidal lock comes from scene-graph inheritance (constant local rotation). No
  independent Moon spin.
- **Places:** the Places card (owner's pick B, `design/places/places-B.png`) turns the surface
  about its own axis and tilts the camera only part way (`src/places/placeTurn.ts`), so a place
  ends up on the lit face. Nothing is found, counted or collected (no hunt, DECISIONS.md).
- **Framing:** accounts for the current UI footprint and the body's visible silhouette (Saturn's
  `viewRadius` includes its rings), including the place photo while it is up
  (`playfieldView(w, h, photo)`). Unusual bodies expose capabilities, not one-off branches.
- **Ship:** authored forward is +Z; adapt a replacement model at the model boundary.
- **Rendering:** goes through `EffectComposer`. Earth colour and roughness maps are a pair
  (`resolveEarthMaps()`). Coarse pointers start at the medium tier; measure on a phone first.
- **Assets:** everything in `public/` ships (reference art goes in `design/`). Full place
  photos are lazy: fetched only when the Places card shows them; thumbnails precache
  separately. A missing photo gives an intentional no-photo state (the name stays). Provenance
  is in `public/assets/discoveries/README.txt`.
- **Input:** touch drag applies each pointer delta once; inertia is time-based. Hit targets may
  exceed drawn controls but far-side occlusion still applies. Keep the centre playfield clear;
  controls have names, focus behaviour and large touch areas; no route depends on reading.
- **Panels:** never add a backdrop `click` handler (Android compatibility clicks closed panels
  at once). Guarded closes share `src/ui/panelGuard.ts` (nothing within 0.5 s of opening, nor
  from the opening press). X buttons and keyboard closes are immediate. An open toy makes the
  visit screen `inert`, so Tab stays inside the toy.
- **Audio:** only bundled authored narration autoplays; SpeechSynthesis is a manual fallback; a
  missing clip never silences another. Written words exist in every audio mode. Continuous
  sounds follow the visual value per frame and stop on reset, crash and background.
- **Persistence:** visits and settings are separate facts; progress is only the worlds
  visited (old saves' finds and stickers are ignored). Adult reset removes only visits (not
  sound choices, grown-up acknowledgement or caches). The grown-ups panel opens on first load,
  by `?grownups`, or by holding a visit's Listen button for two seconds.
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
New controls take a variable from the top of `storybook.css`; add them here. Control pictures
are Fluent Emoji flat (Microsoft, MIT) in `src/pictures/`, kept byte for byte; toy cards
compose them (`src/ui/visitPictures.ts`).

The visit screen is the toy shelf (owner's pick, `design/visit-screen/visit-B.png`;
`src/ui/visit.css`): everything is on screen from arrival and never moves. `src/ui/viewport.ts`
mirrors its sizes for the camera's playfield; change the two together.

| Control | Crayon |
| --- | --- |
| Space map (big, top left), Keep exploring (any way back) | sky |
| Listen (small), panel replay | grape |
| Day & night card (Mars, Saturn) and its Stop state; done tick on map cards; the place photo's Next arrow | grass |
| Jump card, Start playing, next-world arrows | sun |
| Turn Earth card (teal), Bath card/Plop! (bubble), Rover card (lime), Moonlight card/Move Moon (moon, silver), Far away card (star, indigo) | per toy |
| Places card | tomato |
| Toy shelf, name chip, panels | paper |

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
src/places/      the Places card's turn-to-a-place maths and the place mark
src/toys/        hands-on toys (Moon jump and Moonlight, Earth bedtime spin, Sun Far away, Saturn bath, Mars rover)
src/ui/          DOM interface, visit screen (toy shelf), styles, grown-ups panel, photos
src/pictures/    Fluent Emoji flat control pictures (MIT, byte for byte)
src/state/       progress, replay, settings
content/ design/ e2e/ docs/    world data, unshipped reference, Playwright, plan and ideas
```
