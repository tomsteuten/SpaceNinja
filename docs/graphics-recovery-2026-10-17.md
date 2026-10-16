# Graphics-loss recovery — 17 October 2026

Based on GitHub main `6a8b891`, isolated on `codex/graphics-recovery`.

## Reproduced failure

Losing the WebGL context during a flight through the browser's real
`WEBGL_lose_context` extension left the world blank with no recovery screen.
`Stage` skipped frames while waiting for restoration but never notified the
route's lifecycle coordinator. Continuous engine audio could therefore remain
active. This reproduces a concrete failure path; it does not establish the cause
of the earlier one-off black screen recorded in the main checkpoint.

## Recovery behavior and ownership

`Stage` reports context loss through the existing crash callback. The same path
handles a thrown frame. It stops rendering and cancels pending viewport work;
duplicate loss events, driver restoration and browser history/visibility events
cannot restart a failed stage. A loss during asynchronous loading is retained
until the route installs its crash handler. Disposal removes listeners and
cancels queued work.

The existing route-owned lifecycle suspends audio and gestures. The shared
failure screen makes the game surfaces inert, closes any native modal that would
otherwise cover the restart screen, and focuses Start again. Restart reloads the
page with a fresh renderer. Saved places, visits, stickers and settings are not
reset. An unfinished flight returns to the normal title/map flow.

This deliberately uses explicit restart even if the driver restores itself;
silent resumption would require proving every GPU resource and route state safe.
No automatic retry loop or speculative watchdog was added. Normal suspension
continues to preserve and resume the existing scene.

No adventure/day-night orchestration, activity UI, content, persistence schema or
map navigation files changed. Claude's parallel work can remain independent.

## Validation and limits

- Typecheck, all 366 unit tests, production build and whitespace checks passed.
- Native context-loss tests cover flight and discovery-photo recovery on phone,
  tablet and short landscape; they check keyboard/pointer retry, saved data,
  stopped rendering and resistance to driver restoration/history events.
- The flight test observes real Web Audio source start/end events and narration
  state, proving active sources stop after loss. This is not a speaker-quality test.
- Shared-renderer recovery is also exercised on `?freeflight`, `?outing` and
  `?explorer` at the phone viewport.
- All 12 targeted browser checks passed: nine graphics-recovery cases plus the
  existing adventure/outing/freeflight history-suspension cases on phone. The
  normal pause/resume path remains operational.
- A restoration assertion was corrected after an isolated rerun: Three rebuilds
  WebGLInfo on driver restoration, resetting its frame counter. The test now checks
  that the restored counter remains stationary rather than expecting the old value.
- Full-resolution before/after captures are in
  [the recovery-screen review](../design/graphics-recovery-2026-10-17/README.md).
  Owner approval is pending; no main deployment is authorized by this document.
- No full local browser suite, physical Android-tablet test or child observation
  was performed. Only the affected browser checks were run.
