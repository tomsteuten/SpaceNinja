# Current implementation and handover

## Status and direction — 24 September 2026 (read this first)

**Product direction, chosen by the owner:** the guided adventure is the game. The goal is the
original adventure with UI polish and flight polish, then more planets. The Earth-to-Moon
outing (`?outing`) and manual flight (`?freeflight`) are experiments, not the product. Do not
build on the outing's screens; they were an unstyled prototype.

**Working method, also the owner's call:** judge visuals by eye. Change one screen at a time
and show before/after screenshots at full resolution on phone and tablet before rolling a
style out further. Passing tests do not mean a screen looks good.

**Visual language:** the 22 September explorer (`.unified-one-shot`): calm dark glass, a
hairline edge, a light primary pill, line icons from `src/ui/icons.ts`, and a serif name for
each world. Keep child-sized targets (54–62px) and readable labels; the explorer's 10–13px
text was too small for 5–8 year olds. The markers stay gold, because the recorded narration
says "tap the gold" places.

**Done on `codex/session-lifecycle-audit`, not pushed, `main` untouched:**

1. The adventure is the default route again.
2. The Moon arrival screen is restyled through `src/ui/theme.css`, layered over `ui.css`, plus a
   hint icon, a world thumbnail in the arrival title and slimmer gold markers. The owner saw the
   before/after comparison but has not explicitly approved it. The home map and Earth arrival
   now have screen-specific work; later screens still only inherit shared button and panel styles.
3. Earth now offers Day & night as the primary arrival action. About opens words on demand,
   Done ends the lesson, and gold places pause and resume without losing progress. Full-resolution
   arrival, active and guided-hunt captures are in `design/earth-review-2026-09-24/`.

**Verification and approval, 24 September home pass:**

- The requested initial visit rerun passed tablet and short landscape: the compact arrival
  title clears both visible gold places. Phone failed at journal narration, not at the previous
  last-step timeout. Its trace shows the visible Stop reading discovery state after the click;
  the driver polled too late for the short recording. The test now latches that visible state
  in the browser, armed by the real click. No narration behavior was changed.
- Typecheck, all 287 unit tests (25 files), and the production build passed. The final
  visit/home/accessibility browser run passed all 9 checks across phone, tablet and short
  landscape (6.9 minutes, one worker). This includes all three full visits and the phone's
  final return; the earlier last-step timeout did not recur. The full browser suite was not
  rerun. Real-tablet performance, listening and child observation remain unverified.
- The home candidate restores visit-based visibility, navigation and framing together, removes
  the oversized suggestion halo, and uses textured world buttons, a light Moon invitation,
  line icons and a separate journal corner. Full-resolution phone/tablet before and after
  images are in `design/home-review-2026-09-24/`. Before is the untouched `6f86ca5` worktree,
  installed with its own `npm ci`; after is this branch. Home and Moon arrival still await
  owner approval. No flight or additional planet work is included.
- Live-site correction: on this date the root GitHub Pages URL opens the four-world explorer.
  Its Original adventure route (`?classic`) shows the gated Earth/Moon view, confirmed in
  phone/tablet captures. Do not equate the root deployment with local `main`. Two missing
  resource console errors occurred on the live classic page; local before/after captures
  had no browser errors. Nothing was deployed.
- Earth follow-up: a delayed screenshot showed the guided-hunt counter covering a gold place in
  short landscape. Its landscape position now uses the free left side space; a browser check
  verifies both visible places clear it. Earth day/night browser checks pass on phone, tablet
  and short landscape, including return from a persisted page suspension. Real-tablet viewing
  and listening, and owner approval of the Earth screen, remain outstanding.

**Next steps, in order:** owner approval of the home screen, Moon arrival and Earth arrival; the discovery postcard and
journal; the remaining screens; then flight polish (the parked ship sits half off the right
edge at arrival; the tested free-flight steering model is the candidate); then more planets.

**Strategy verdict, checked against code and screenshots:**

- **Keep the guided adventure as the product.** Default-route dispatch in `main.ts` isolates
  the two experiments; the actual visit run exercises discovery, return and repeat visits.
  This is a sound base for polish, though target-tablet child observation remains unverified.
- **Removing the reveal gates was wrong for this composition.** The baseline code always
  chose the widest framing and suggested Saturn first; both baseline screenshots show its
  halo crowding a shrunken Earth. The live classic view demonstrates the clearer staged
  opening. Restore those visit gates and drop the halo; keep future worlds pictured in the bar.
- **Keep the explorer styling and screen-by-screen approval, with a limit on shared CSS.**
  The reference `.unified-one-shot/src/moon/moon.css` uses small 10–13px copy; the home
  candidate instead has 16–19px world labels and 54–62px minimum-height controls. Inspected
  phone/tablet images show a clear playfield. Inherited styles on other screens are still
  unapproved; the theme layer is a transitional implementation, not evidence those screens work.

---

## Record from 23 September

## Authoritative local version

The **project root** is the single working version for this milestone, on
`codex/session-lifecycle-audit` at base commit `6015a93e9601c39629cc44dd47914f460216dc60`
plus its pre-existing dirty work and the Earth-to-Moon changes. This selection follows the
module evidence: root has the tested browser lifecycle, real Tycho media and narration,
persistence, Stage, bodies, and visible-ship flight model. The dirty unified continuation
has a useful shared scene but hides the ship during exploration and does not record or
narrate discoveries. The Moon trial has useful steering and authored maps but lacks the
root lifecycle and shared progress flow. The clean travel-hardening and committed unified
worktrees are reference baselines. No variant was deleted or overwritten.

Before editing, all five registered checkout working trees were archived with **tracked
and nonignored untracked files**, including dirty source, media and tests, in
`.preservation/2026-09-23-before-reconstruction/`. Each ZIP contains
`SNAPSHOT-MANIFEST.json` with path, HEAD, branch, status and file count. Every ZIP passed
`ZipFile.testzip()`. The root archive also includes the untracked `.release-git` directory;
the two nested worktrees have their own archives. The archives are excluded from Git and
must be retained locally.

| Archive | HEAD | Files | SHA-256 |
| --- | --- | ---: | --- |
| root.zip | `6015a93` | 442 | `99991429566FF0A83C51E3FFB90C6973E03676B1A5B36ADFB8D1FCEAFDDAF15E` |
| moon-trial.zip | `f014d4a` | 200 | `C28803B72D68C49C20CB53ECFB8CE9BCCCF3531AEECEB0B11B29021BE437E4B1` |
| unified-one-shot.zip | `2e27e72` | 203 | `8C2F2EAF6976691CE3857E61629C34F0C71C587EA3D3F94BA0FFF91B66A816AD` |
| travel-hardening.zip | `749ab52` | 193 | `F23D11EDA1BC5951F1F06ED62001BAA8FAC5A73CDB98FF4B7C87075F6D9B8087` |
| unified-committed.zip | `2e27e72` | 195 | `D74234CF48EA1DBBEDDF9DF255B329DCBBEFF0C8FE109D79B4781FFAB30BBD7D` |

The live GitHub Pages build ID was not verifiable locally. Do not equate this checkout with
the deployed version. No deployment was attempted.

## Current product contract

“I can fly my ship from Earth to the Moon, find a real place, see and hear what it is, and
choose to fly home.” Holding the playfield steers and accelerates; release and **Stop**
brake. Moon help is optional and yields to touch. One gold marker sits at Tycho's authored
coordinates. Finding it opens the NASA-provenance photograph and matching bundled narration,
records the stable `moon-tycho` ID, and leaves a Memory button on later visits. There is no
quota or gate. This scheme needs a child/tablet observation before being treated as proven.
The Moon's orbital movement is held during this small outing so it stays in view on return;
distances and travel time are illustrative navigation staging, not scientific measurements.

## Ownership

| Owner | Current slice |
| --- | --- |
| Session | `src/session/lifecycle.ts` pauses, resumes, crashes and disposes; the outing releases held input and audio on suspension. |
| Experience | `src/experience/outingState.ts` is the single, DOM-free transition owner: phase, open photo and whether the child has acted. `src/experience/outing.ts` turns every input into an event and performs the returned effects. |
| Camera | `src/experience/cameraDirector.ts` is the sole pose writer; Stage owns projection and resize. |
| Movement | `src/flight/freeFlightModel.ts` remains the tested, time-based model; the departure Earth supplies collision clearance without destination braking. |
| Scene and content | Existing Stage, world, ship, trail, one-place CollectMission, Tycho config, photograph, narrator and progress store. |

**Update, 23 September, later:** the owner reviewed the outing's screens and chose the guided
adventure as the product: the original adventure with UI and flight polish, eventually more
worlds. The adventure is the default route again. The outing remains at `?outing` as a steering
experiment and `?freeflight` is unchanged. `vitest.config.ts` includes only canonical `src` and
`sw` tests, avoiding nested worktrees. Playwright runs every browser file.

The four interaction-boundary defects in `review-sol-outing-2026-09-23.md` are fixed. A photo
is modal and holds a stopped ship. One Escape closes only an open photo. Reduced-motion help
cuts to the Moon hover. A service-worker update reloads only an untouched opening view.

The outing has no grown-ups panel; that matters only if it is ever promoted.

## Verification and next gate

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. The browser test
uses real pointer events, checks stop and optional help, taps the actual Tycho marker,
checks photo/memory/return, and saves named screenshots. Software WebGL can make its flight
take much longer than simulated seconds. Inspect the screenshots as well as the assertions.

Latest check, after the boundary fixes: typecheck and production build passed, the unit
suite passed **25 files / 287 tests**, and the full browser suite passed **27 of 27** across
phone, tablet and short landscape. Screenshots were inspected for the held memory photo,
the reduced-motion cut to the Moon hover and the photo closed by Escape. This is software
WebGL verification, not a native tablet performance or audio-quality measurement.

The offline browser check had not passed locally before this change. The local preview
server sends `Vary: Origin`, which made the worker's cache lookup miss the module script
and stylesheet offline. The worker now ignores `Vary` for its content-hashed shell and
URL-keyed media. The live GitHub Pages bundle sends `Vary: Accept-Encoding`, so production
was probably unaffected; an offline launch of production has not been checked.

To try the outing on the tablet without deploying, run `npm run build` then `npm run preview`
and open the printed network address on the tablet over the same Wi-Fi. `main` still deploys
the guided adventure; do not merge this branch before the observation below.

The next gate is a five-minute unprompted tablet observation: note the first purposeful
touch, whether the child understands steering and stopping, whether they reach and tap
Tycho, close the photograph, recall anything about the crater, and choose to return. Listen
to the bundled narration on the tablet speaker and watch frame pacing. Stop here before
adding worlds or changing the engine.
