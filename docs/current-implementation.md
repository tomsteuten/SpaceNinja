# Current implementation and handover

## Wave 1, step 1: day/night house and the first-session rail — 17 October 2026

DECISIONS.md line 4 changed by owner decision (16 October): the rail's "you did it" is a
marked spot going into night and back. Earth's hands-on day/night now shows a small house
on the surface (`scene/DayMarker.ts`), placed in daylight beside the visible sunset line
(`scene/dayWatch.ts`). The first night and first return to morning are acknowledged in the
heading (and spoken once recordings exist: three new cues, unrecorded). On the first Earth
visit the return suggests the Moon and lights Space map; later it suggests turning more or
Done. Space map and Done never move or hide; nothing is counted or saved. Find places stays.
Typecheck, 324 unit tests and `e2e/day-spot.pw.ts` (phone, tablet, short landscape) pass,
as do the day/night files. Captures: `design/wave-1/day-spot-*`, for owner review.
Known: `main` deploy `6a8b891` is red (map-return guard swallows taps; see PR #4).

## Wave 0 checkpoint: 15 October 2026

Work follows [the expansion handover](handover-2026-10-15-expansion.md) under
[DECISIONS.md](../DECISIONS.md). Wave 0 is done: experiments removed (tag `pre-freeze` marks
`91f27fa`), old handovers and reviews in `docs/archive/`, `mission.singleSet` lets a new world
carry exactly three places, and [content/worlds.md](../content/worlds.md) holds all twelve
worlds' places, coordinates, facts and sources. Every drafted set passes `isPlayableSet`.
Open from Wave 0: Uranus lacks a third place, three photos and three coordinates await
confirmation, and the network blocks NASA/JPL/USGS and Hugging Face (Kokoro's model),
so assets and narration cannot be downloaded or generated from this environment yet.
Next: Wave 1 (first-session rail, paged map as default). Typecheck and all 314 unit tests (after merging main `6a8b891`)
pass; lifecycle, offline and accessibility browser files pass on phone.

## Playability repairs — 15 October 2026

These repairs build on GitHub main `91f27fa`.

The independent browser review's photo overlap, repeated map-return launch and stale
guidance were reproduced against a separate baseline worktree. Local repairs constrain
photo sizing, preserve close-button hover contrast, protect repeated taps over the old
Space map control, and update last-place/visit-completion guidance. After the journal has
been opened on a completed visit, the existing Space map control gains the emphasis.

Validation: typecheck, all 362 unit tests and the production build passed. The affected
Earth-loop and map-return browser checks passed on phone, tablet and short landscape.
One unit-file timeout and one tablet browser failure under concurrent load passed unchanged
on isolated reruns. Layout checks include the review's 1095×539 viewport and narrow phones.
These are regression checks, not simulated child research. No full local browser suite ran.

The owner granted advance visual approval, waived screenshot delivery and authorized
publishing to main on 15 October.
Physical-tablet input/performance, audio and child comprehension remain unverified. The
one-off black screen, day/night completion feedback and larger navigation redesign were
not changed.

## Map foundations — 12 October 2026

The neighborhood model is now the tested source of map membership: every scene body must
sit in exactly one neighborhood. `childNeighborhoods()` removes unbuilt fixtures and empty
pages, so they can never reach a child. The study's page framing is a pure, tested
`neighborhoodBounds()` in `src/map/framing.ts`. The default map is unchanged on screen.

Applying that framing to the default map was prototyped and **not adopted**: it enlarges
phone/tablet worlds but shrinks short landscape, leaves Saturn overlapping Earth, drifts with
the orbits and overrides pinch-zoom. See [the captures](../design/map-framing-2026-10-12/README.md).

Recommended order from here: (1) optionally enlarge only the first-run Earth & Moon shot,
keeping the fixed camera, after screenshot approval; (2) pilot Jupiter, adding a moon-parent
relation to the catalogue first, and introduce paging with picture peeks, animated page moves
and the study framing then, showing children only `childNeighborhoods()`; (3) restyle the
explorer's close flight with the adventure's controls as a mode on an arrived world, per the
[explorer review](../design/explorer-review-2026-10-12/index.html); (4) observe a child on
the tablet as soon as possible.

## Neighborhood map study — 8 October 2026

PR #1 was merged at `430c8df`; [deployment 37739425471](https://github.com/tomsteuten/SpaceNinja/actions/runs/37739425471)
completed successfully. The journal check no longer blocks Pages.

The owner then authorized the recommended map prototype. `?mapstudy` adds paged
neighborhoods over the real scene and existing journeys, with an isolated presentation
model in `src/map/`. The default map remains available. Unbuilt destinations are fixtures;
they cannot launch or enter progress. Paging is a camera cut, supports swipe and native
buttons, and cancels interrupted gestures. Space map remembers the current neighborhood.

Full-resolution [map comparisons](../design/map-study-2026-10-08/index.html) cover fresh
and progressed saves on phone, tablet and short landscape. Owner visual approval,
physical-tablet performance and child comprehension remain pending.

Validation: typecheck, all 350 unit tests and the production build passed. Seven targeted
map-study browser checks passed (two duplicate progression cases intentionally skipped),
including muted feedback, real Moon tapping/collection, Mars unlock, Sun travel, Earth and
Saturn return, measured world clearance, keyboard focus, swipe, resize and history suspension.
The unchanged default-home file also passed on all three viewports. No full local suite ran.

## Deployment regression and next proposal — 8 October 2026

GitHub main `849547b` did not deploy: [run 37400865343](https://github.com/tomsteuten/SpaceNinja/actions/runs/37400865343)
passed 347 unit tests and 68 browser checks, skipped four browser checks, and failed the
journal accessibility check on all three viewports. Deployment was skipped.

The unchanged phone check reproduced the same failure locally. It expected the journal
to have only two keyboard stops; the October world-page buttons correctly introduced
additional stops. The regression test now checks every world selector, forward/reverse
focus wrapping, keyboard page selection after the controls are rebuilt, and Escape/focus
return. No gameplay, layout or focus-trap implementation changed.

Validation of this fix: typecheck and all 347 unit tests passed; the targeted accessibility
file passed on phone, tablet and short landscape (three checks). Named journal screenshots
were inspected as behavior evidence, not visual approval. The full browser suite was not
rerun locally. The subsequent successful main deployment is linked in the checkpoint above.

The [bounded map proposal](archive/map-proposal-2026-10-08.md) led to the opt-in study above;
the proposal itself did not approve a replacement screen.

## Current checkpoint — Earth discovery loop, 6 October 2026

The local Earth pass now connects finding to revisiting. First-find photos show Saved to
your journal and the count for this visit. The third photo offers See discoveries as well
as Keep exploring. Completing a visit highlights Journal and keeps an All three found
instruction visible, including after replaying day/night. Space map stays in place.

The journal opens to the current world's page. Its pictured world buttons select authored
pages, each with six places; unknown places show a neutral target, without revealing their
names or images. Opening a found place switches to its story with All places, photo/audio,
and the pictured world return. Short landscape gives the words their own scrolling region
so the return remains on screen. Full photographs remain lazy and saves are unchanged.

This extends the October 5 work below. The owner authorized publication to main on
October 6; verify the deployment's actual status in GitHub Actions. It has not been tested
with children.
The owner explicitly requested continuing with AI/adult judgement while child testing is
unavailable. Full-resolution before/after captures are in
`/workspace/scratch/earth-loop-polish/`; targeted browser checks cover the entire Earth
loop, muted words, focus return, and phone/tablet/short-landscape control clearance.

## Current checkpoint — Earth interaction pass, 5 October 2026

The current local change suggests Earth first using its existing narration. First Earth
arrival offers Turn Earth or Find places with an always-visible Space map return. Gold
targets wait until the child chooses exploration or finishes the activity. Earth's
day/night mode follows direct horizontal dragging; canvas taps and the accessible Turn
Earth control assist a quarter turn. It stays open until Done/Space map and restores the
original hunt orientation on Done. Other worlds retain timed demonstrations.

The dock and destination controls now have rounded, tactile surfaces and consistent
illustrated controls. Listen replays directly, while Words beside the heading opens the
transcript. The hunt arrow moves the viewpoint around a world's axis, keeping the Night
Side in its original sunlight rather than turning it into daylight. Existing saves and
open exploration are preserved. This pass has not been deployed or child-tested.

### October 4 baseline

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

The guided adventure at `/` is the only route. The experiments were removed on 15 October
2026 (recoverable from tag `pre-freeze`).

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
