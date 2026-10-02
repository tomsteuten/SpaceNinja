# Explorer polish plan — 21 September 2026

Status: proposal following a local repository audit. No gameplay changes made during this review.

Follow-up direction: the user's next observation was that the new explorer still feels like
isolated planet clicks, with too little space exploration and a plain rocket. Prioritise a
playable journey over the initial UI-first sequence below. A local implementation now lives
in `.moon-trial`: a shared four-world space playground, manual steering/braking, optional
destination assistance, and an expressive rocket shared with globe flight. This has not been
deployed. The original audit and proposed discovery improvements below remain useful context.

## Establish the baseline first

There are two dirty working trees, not one failed implementation:

- The project root is `codex/session-lifecycle-audit` at `6015a93`. It still defaults to adventure. Twelve tracked files are modified, with additional accessibility/offline/texture tests and a dialog helper. Changes include media timeouts, focus handling, body definitions, and delayed hunt guidance.
- `.moon-trial` is a registered worktree on `codex/moon-exploration-trial` at `f014d4a`. Its dirty files implement the newer default explorer, with `?classic` retaining adventure. The main explorer code, tests and assets are currently untracked in that worktree.
- `.release-git` is separate Git metadata whose branch points to `2aa88dc`. History traversal reports a missing parent object. Release bundles also exist inside `.moon-trial`. Preserve these until the release history has been reconciled; their presence does not establish what is currently deployed.

Before implementation, preserve both trees, including untracked assets, and reconcile the explorer with the intended release commit. Use one authoritative checkout outside the parent test search path. Do not use `git add .` from the root or discard either tree. Port the shared lifecycle fixes deliberately: the explorer currently has its own `src/moon/lifecycle.ts`, while the root has `src/session/lifecycle.ts`.

Validation so far: both typechecks pass; explorer unit tests pass (25 files, 276 tests). The root unit run includes tests from the nested worktree (49 files, 552 tests total) and fails one nested asset-existence test because its relative path resolves against the root's `public`. Both tracked diffs pass `git diff --check`. These results do not validate physical tablet performance or child comprehension.

Fresh browser verification: the existing all-world explorer flow passes on phone and tablet (2 tests). It selects each world, enters exploration, checks six Places, opens an archive image and returns to Worlds while preserving local storage. Inspected phone chooser/Earth exploration and tablet Moon exploration screenshots: the world has strong visual space, but small labels and thin icons carry much of the guidance; the phone title has more prominence than the world choices. This targeted run did not exercise steering feel, offline operation or short-landscape layout. Screenshots use the suite's half-resolution rasterisation, so they are composition evidence rather than a native-device sharpness assessment.

## Proposed experience

**Tap a world → fly freely → notice a place → see its real picture → keep a postcard → wander or choose another world.**

Keep the explorer's freedom, clear scenery, release-to-stop control and open access to all worlds. Bring back the adventure's concrete invitations, short authored voice cues, rewarding discoveries and dependable escape route. Collection is a memory of the outing, never a prerequisite for continuing it.

## First slice: make entering and moving self-explanatory

1. Make each large picture of a world launch that world with one tap. Show immediate pressed/loading feedback in that same place. Keep a loading failure recoverable through another world or retry. Remove the separate select-then-Explore step.
2. Demonstrate holding, steering and releasing with a short hand animation tied to the actual input model. A static hand beside text is insufficient for a pre-reader. Dismiss it on demonstrated movement; offer it again after inactivity if the child has not successfully moved and stopped.
3. Clarify the ship's heading and movement with restrained banking/engine feedback. Review the actual camera response: the current heading affects both the ship and the camera, so it may look more like moving scenery than piloting. Avoid increasing speed to disguise unclear control.
4. Keep a stable, large Worlds picture button. Use a single compact contextual control cluster; maintain clear central and lower-middle playfield. Give Places a recognisable picture-book/map symbol. Make zoom secondary to exploration and discovery.

Acceptance: a child can enter a chosen world, move, stop and return to Worlds without an adult explaining a written instruction. Compare existing hold/slide flight with direct globe drag on the same tablet before choosing a long-term control default.

## Second slice: make discovery visible and rewarding

1. Arrive near one recognisable subject with one quiet invitation. Offer a generous picture-based action while stopped; avoid bringing back a screen of glowing targets.
2. Rework Places into a picture-led chooser. The current entries repeat a world texture and distinguish destinations chiefly by names and descriptions. Use distinct simple illustrations or existing lightweight thumbnails. Keep full mission photos lazy; opening a list must not fetch all documentary images.
3. A tap on a place uses the existing assisted glide. It must be interruptible by steering, and reduced motion must use a cut. On arrival, offer the corresponding image without forcing a modal while the child is flying.
4. Keep the current real-photo viewer, accessible close control and explicit missing-photo state. Add a large replay control for a short authored fact. Reuse existing recordings only where their words match the new action/content.
5. Add a quiet postcard acknowledgement and an optional picture journal. No visible quota, locked destinations or completion interruption in normal exploration. Keep classic progress intact; define explorer storage and an explicit mapping from explorer IDs to discovery IDs (some lunar IDs differ) before persistence work.

Acceptance: without reading, a child can find/open one interesting subject, return to flying, and later recognise its postcard. All six places remain reachable; unseen places may be suggested without hiding familiar favourites.

## Third slice: restore selected educational moments

- Trial a contextual day/night activity on Earth once the entry/movement/discovery loop is clear. Use a visible example of light changing and allow immediate exit. The explorer currently uses view-following illustrative lighting, so copying the old Spin button would not reproduce the old lesson; lighting and camera ownership need deliberate design.
- Offer narration through the existing sound preference, with sparse bundled cues and immediate interruption when the child acts. Keep equivalent visual guidance and words. Do not automatically invoke platform speech.
- Give Saturn an orbital invitation and archive imagery rather than implying the child can land on its clouds or find permanent storm coordinates.

## Implementation boundaries

Promote `src/moon/` to an explorer-owned module only after establishing the canonical checkout. Share world/discovery content, narration, image provenance, persistence helpers and browser lifecycle. Keep flight controls and explorer view state separate from classic mission orchestration. Avoid copying the whole adventure UI into the explorer.

Review the root's unfinished hardening separately from design work. In particular, verify dialog focus against CSS-hidden controls and nested overlays, and verify narration timeout behaviour for a stalled response body as well as delayed headers. The root's proposed 5/12-second hunt timers hide the day control and delay visual coaching; do not adopt them as the hybrid experience without evidence.

## Verification and rollout

Implement the first slice before collection or day/night. Capture and inspect chooser, moving, stopped, place chooser and photo states at phone, tablet and short-landscape sizes. Exercise actual touch down/move/up, modal pause, navigation interruption, world-load races, missing photos, resize, sleep/wake, return and offline reopening. Run typecheck, unit tests and relevant browser suites from the authoritative checkout.

Then observe a short session on the older Android tablet: first movement, successful stopping, finding something interesting, returning from a photo, changing worlds and asking for help. Record adult interventions and moments of confusion; do not interpret automated geometry or UI tests as evidence of enjoyment. Retain `?classic` for comparison until those observations support the replacement.
