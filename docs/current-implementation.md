# Current implementation and handover — 23 September 2026

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

The default route is the outing. `?classic` and `?freeflight` retain the earlier routes for
comparison. `vitest.config.ts` includes only canonical `src` and `sw` tests, avoiding nested
worktrees. Playwright runs every browser file: outing, outing boundaries, lifecycle and
offline against the default route, and the guided adventure and accessibility files against
`?classic`.

The four interaction-boundary defects in `review-sol-outing-2026-09-23.md` are fixed. A photo
is modal and holds a stopped ship. One Escape closes only an open photo. Reduced-motion help
cuts to the Moon hover. A service-worker update reloads only an untouched opening view.

Known gap: the outing has no grown-ups panel, so sound, progress reset and the manual-flight
entry are reachable only through `?classic`. Decide after the tablet observation whether the
outing needs them.

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
