# Space Ninja architecture review — 2026-09-14

Reviewed from clean `main` at `f014d4a`. Scope: architecture, interaction paths, asset lifetime,
offline generation and the existing browser regression suite. No additional world or change to
the child progression model is included.

## Findings and changes

| Priority | Finding and evidence | Resolution |
| --- | --- | --- |
| High | `main.ts` restarted Stage on visibility even after a frame crash. Free flight did not pause on visibility and reported crashes only in its hint. | Both use `session/lifecycle.ts`, which stops rendering, runs suspension cleanup and makes a crash terminal until reload. Shared failure UI provides the restart button. |
| High | Both routes unconditionally disposed on `pagehide`. A persisted history page could resume with disposed GPU resources. | Persisted exits suspend; `pageshow` resumes. Ordinary exits dispose once and unregister lifecycle listeners. |
| Medium | Short-landscape postcard text overlapped the fixed Keep exploring button in the browser screenshot. | Reserve an exit row and reduce photo height on short screens; browser tests assert text clears the button. |
| Medium | Interrupted steering could remain held when leaving the page without a pointer release. | Suspension clears manual steering and orbit gestures without moving the camera or enabling an inactive camera owner. |
| Medium | Direct `?freeflight` boot returned before offline registration. | Both routes register after the first rendered frame. Free flight never permits an update to reload active play. |
| Medium | Browser tests duplicated device setup, console collection and screenshot handling; free-flight exit checked only boot. | Shared automatic fixture checks errors across navigation and saves named screenshots. Exit now completes a normal Moon trip. New route tests verify stopped/resumed frames and released steering around persisted history events. |

## Ownership and extension boundaries

**Session.** The extraction removes browser lifetime, failure presentation and offline registration
from the main entry point. Adventure still owns its ordered mission/day-turn/flight/home-return,
ship, world, controls and UI reset. Keeping that reset together preserves surface release and
ship reparenting order. The coordinator invokes it through a reset callback and rejects resets
after crash/disposal. It does not own or clear persisted progress.

`main.ts` still carries visit setup, map suggestions, camera handback and frame orchestration.
The next useful extraction is a visit owner for the mission dictionary, active mission, selected
discovery set and follow target. A generic event bus would add indirection without removing
those dependencies. Camera ownership remains enforced by the existing flight/day-turn/home
guards and controller enablement; a future change should unify the handback state before adding
another camera activity.

**Worlds.** `CelestialBody` already exposes useful capabilities: surface hold/release/turn,
`viewRadius`, a world-position accessor and surface attachment. Discovery placement has an
explicit ring radius; flight/mission geometry use the real parent axis rather than body-name
branches. Free flight now derives its destination list from config.

A fifth world is not yet a config-only addition. `Bodies.ts` separately maintains constructors,
body records, selection rings, roots, hit meshes, per-frame orbit/spin updates and disposal.
`BodyId`, the map's framing tiers and test radius dictionaries need parallel edits. The next
world refactor should register each constructed body's root, hits, silhouette extent, update
and disposal together, then derive framing from revealed extents. Keep Earth's paired maps and
Moon's inherited tidal lock as explicit construction capabilities. Do not flatten these into
generic spin constants. Complete media/provenance and reachability tests are still required.

**Discovery and replay.** Selection enumerates playable triples and favors unseen IDs. Tests
check every authored place occurs in a playable set, tilted arrival clearance, ring inclination,
hit separation and far-side occlusion. Arrival and collection consume the same selected set.
The journal derives totals from configured IDs and replay suggests unfinished collections.
These are strong seams to preserve. The last-in-list hidden target is still a design dependency
shared by selection and composition, so changing that hypothesis requires an explicit visible/
hidden target model in both. Candidate enumeration should be measured before enlarging pools
substantially; it currently repeats geometric scoring at departure.

**UI and accessibility.** Named destination controls and the home exit are covered in real
pointer flows. Screenshot checks cover the existing compact dock and postcard on three viewport
shapes. Larger unresolved modules are `ui.ts` (facts, photos, journal, rewards, timers and dock)
and its combined CSS. Extracting a fact-card owner would make stale asynchronous photo handling
easier to test. Photo dialogs declare modal semantics but do not trap/restore keyboard focus;
free-flight's arrival overlay also needs a deliberate keyboard dialog flow. These remain
accessibility gaps, not evidence for a wholesale child-facing layout redesign.

## Assets, performance and offline risks

- Current shipped source media: seven globe images, about 2.85 MiB; 24 discovery photographs,
  about 2.34 MiB; 44 narration clips, about 1.96 MiB. Transfer size is not GPU memory usage.
- All globe maps load before scene creation, including locked worlds. Texture upload is capped
  to 2048 pixels wide, but decoding happens first. More worlds would increase boot work and
  retained textures even when hidden. Keep new texture dimensions bounded at authoring time.
- Quality starts conservatively and adapts pixel ratio/bloom; geometry and texture sizes are
  fixed after construction. Software WebGL tests use low quality and half-resolution raster;
  they establish interaction/layout behavior, not target-tablet frame time or memory ceilings.
- Photos remain lazy and guarded against attaching to a different discovery. Image probes
  cache failures for the page lifetime and have no deadline; transient failure cannot retry,
  and slow probes can hold up initial world loading. Add bounded, retryable probes as a separate
  media change with network-failure tests. No new media preloading is introduced here.
- Narration URLs are fingerprinted and all clips precached as shell assets. Each additional
  world's recordings increase atomic installation cost. Photos remain outside precache.
- Same-name image replacements remain stale until the stable media cache version is bumped.
  Worker activation deletes old shell caches even while an older page may be playing; an
  uncached late request for an old hashed asset remains an update-boundary risk. Build-version
  tests are good, but a two-version browser/offline update test is still missing.
- Stage handles WebGL context loss separately from frame crashes. Recovery and pending resize
  callbacks during teardown deserve dedicated renderer tests; this change does not claim to
  solve context-loss recovery or partial asynchronous boot cleanup.

## Validation scope

Results: typecheck passed; 269 unit tests across 23 files passed; all 12 browser checks
passed across phone, tablet and short landscape; production build passed.
Inspected arrival, postcard, resized Earth and free-flight screenshots across those shapes: home/
modal exits remain visible and normal discovery targets stay clear of the dock. The experiment
still places its ship partly behind the autopilot dock in some initial shots; this is a remaining
composition limitation. Production output
is also checked for absence of executable `spaceNinjaSnapshot`, inclusion of the experiment
chunk and 44 narration clips in shell precache, and exclusion of discovery photos. Browser
screenshots are saved as named PNGs and attached to the report for visual inspection.

History coverage dispatches real browser event types deterministically; it verifies our event
contract, not browser-specific back/forward-cache eligibility. Browser tests preserve real
pointer-driven launches, collection, dragging and return. They use one deterministic selection
seed; exhaustive geometry/reachability remains the unit suite's responsibility. Browser fault
injection, network recovery, keyboard focus, repeated GPU-memory sampling and real-device audio/
performance remain unverified. No human playthrough is required or requested for this work.


## Changed files

- `src/session/lifecycle.ts`, `lifecycle.test.ts`: shared browser lifetime and unit regressions.
- `src/session/failure.ts`, `offline.ts`: shared boot/crash presentation and offline registration.
- `src/main.ts`, `src/flight/freeFlightMode.ts`: route integration and read-only test telemetry.
- `src/controls/OrbitInput.ts`: interrupted-gesture cancellation without camera reset.
- `src/ui/ui.css`: short-landscape postcard text/exit clearance.
- `e2e/fixtures.ts`, `lifecycle.pw.ts`, `freeFlight.pw.ts`, `visit.pw.ts`: shared browser checks,
  screenshots, history suspension, experiment exit and postcard overlap coverage.
- `AGENTS.md`, `README.md`, `docs/decision-history.md`, this review: current ownership,
  rationale, validation and remaining work.
