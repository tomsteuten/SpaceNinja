# Current implementation and handover

## Current checkpoint — reconciled 4 October 2026

The owner approved the isolated UI study's screenshots and authorized implementation and
publication to `main`. This supersedes the September layout and serif-title direction.
The guided adventure remains the product. The Sun visit was already shipped at `70b34e8`.

The adventure now uses a single bottom row with equal cells, ordered Space map, Listen,
Day & night, Journal. Supported activities are visible from settled arrival; Sun has three
cells. World identity and the instruction are at top left; small gold progress pips or the
day/night key are at top right. Facts open deliberately in a reading/listening panel. Photos
and the journal use contained panels with pictured returns. Photo and reading-panel X
controls close immediately; journal pointer closes retain the opening guard. All
24 real discoveries and visit persistence remain, rather than the study's illustrative book.

`src/ui/adventure.css` owns this layout; the competing geometry was removed from `ui.css`
and `theme.css`. `pictures.ts` owns world and discovery pictures. The existing camera keeps
its lifecycle ownership and uses an off-center projection to reserve the row on landscape
and tablet. Marker projections and picking use that same camera. The adventure's startup
shell has an independent failure/retry guard, and the offline worker serves the game shell
only at the root/index routes, not nested design previews.

Full-resolution screenshots and the baseline comparison are in
`design/ui-implementation-2026-10-03/`. The approved study is in
`design/ui-prototype-2026-10-03/`. Physical-tablet performance, speaker sound and child
comprehension still need observation. In particular, observe whether Listen is understood
as opening a fact, and whether the Day & night invitation is apparent without adult help.

## Routes and ownership

The default `/` route is the guided adventure. `?explorer`, `?freeflight` and `?outing`
explicitly select comparison/steering experiments. `?classic` is no longer a distinct route.
Manual flight is also available from the grown-ups panel and Shift+F, with Back to adventure.
The outing is the limited Earth-to-Moon/Tycho experiment, not an expansion baseline.

`src/main.ts` owns adventure wiring, visit reset and frame orchestration;
`src/session/lifecycle.ts` coordinates browser suspension, crash and final disposal with
route-owned callbacks. Scripted flight, home return and day turn each own the camera
exclusively while active. Mission setup and target reveal remain separate operations, but
settled adventure arrivals reveal targets immediately and offer supported Day & night.

Geometry/framing and generic orbiting-body construction are implemented through
`src/worlds/catalogue.ts` and `src/scene/Bodies.ts`. Copy/reveal prerequisites stay in
`src/config.ts`; the Sun observation destination is outside the four-world catalogue.
Expansion still has manual dependencies; use [the world checklist](worlds-roadmap.md).

Narration plays available recordings per cue. The default generator is ElevenLabs, with
Kokoro and OpenAI alternatives; the Sun arrival has a recorded Kokoro exception. See
[recording instructions](../src/audio/recordings/README.md). Full discovery photographs are
lazy; small derivatives used by controls and journal are precached for offline use.

## Continuing work

Before choosing a baseline, check the current checkout, HEAD, working changes, registered
worktrees, remote main and deployed revision when verifiable. Old branch names, saved
checkpoints and an open browser tab do not select the canonical version. Preserve existing
work. This checkpoint contains no new deployment or visual approval claim.

Follow AGENTS.md for verification: typecheck and unit tests for changes; only affected
browser files/viewports for UI or behavior changes; full-resolution before/after images and
owner approval for visual changes. Do not rerun a full local browser suite for documentation
cleanup. Current device observation priorities are Listen/Words, Day & night, pictured exits,
steering experiments, frame pacing and speaker sound.

Detailed September checkpoints and their test counts are in
[dated implementation history](implementation-history-2026-09.md). Dated reviews and
[decision history](decision-history.md) preserve evidence, rather than instructions to
repeat completed work.
