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
| Experience | `src/experience/outing.ts` accepts flight, explore, discovery and home actions; only one phase updates the flight model. |
| Camera | `src/experience/cameraDirector.ts` is the sole pose writer; Stage owns projection and resize. |
| Movement | `src/flight/freeFlightModel.ts` remains the tested, time-based model; the departure Earth supplies collision clearance without destination braking. |
| Scene and content | Existing Stage, world, ship, trail, one-place CollectMission, Tycho config, photograph, narrator and progress store. |

The default route is the outing. `?classic` and `?freeflight` retain the earlier routes for
comparison. `vitest.config.ts` includes only canonical `src` and `sw` tests, avoiding nested
worktrees. The default Playwright selection is the bounded outing flow across phone,
tablet and short landscape. `PLAYWRIGHT_LEGACY=1` selects the older browser files; their
route assumptions predate this default switch.

## Verification and next gate

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. The browser test
uses real pointer events, checks stop and optional help, taps the actual Tycho marker,
checks photo/memory/return, and saves named screenshots. Software WebGL can make its flight
take much longer than simulated seconds. Inspect the screenshots as well as the assertions.

At this milestone, typecheck and production build passed, and the scoped suite passed
**24 files / 277 tests**. The browser outing passed on phone and short landscape; the
isolated tablet rerun passed after the orbit hold, including rendering after return. One
earlier combined tablet run reached the returned Earth view but exhausted the test's
original four-minute total timeout during its final frame assertion; the isolated run
passed. Screenshots were inspected at ready, steering, Moon hover, Tycho target, photo,
discovered state, and tablet return. The return screenshot shows Earth, Moon, ship and
the repeat invitation together. This is software WebGL verification, not a native tablet
performance or audio-quality measurement.

The next gate is a five-minute unprompted tablet observation: note the first purposeful
touch, whether the child understands steering and stopping, whether they reach and tap
Tycho, close the photograph, recall anything about the crater, and choose to return. Listen
to the bundled narration on the tablet speaker and watch frame pacing. Stop here before
adding worlds or changing the engine.
