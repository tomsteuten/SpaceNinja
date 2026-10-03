# UI layout study — 3 October 2026

Status: owner approved the screenshots and authorized implementation and publication.
The real-game comparison is in `../ui-implementation-2026-10-03/`. The study itself remains
isolated; the statements below about unchanged game code describe the original prototype pass.
Baseline: 70b34e8. Existing `.worktrees/` is unrelated and untouched.

## Decision

Keep one aligned bottom action row. Space map stays at the left and Journal at the
right; Listen and Day & night occupy the middle. Use equal cells within the row,
consistent illustrated controls, and written labels. Sun omits the unsupported
day/night activity. Do not move navigation into opposite top corners as proposed in
the earlier review: that scatters the child's choices and adds a new navigation pattern.

Facts become an intentional reading/listening panel rather than an always-visible
card competing with the navigation row. A photo keeps its pictured world-return
button and immediate X. World pictures replace operating-system emoji.

## Prototype boundary

This directory contains an isolated, clickable layout study. Backgrounds are direct
captures from the current game with its DOM UI temporarily hidden in the capture
browser. They are not edited photographs or generated substitutes for the scene.
Navigation between study screens is simulated; the study does not test 3D movement,
day-turn animation, production persistence, or child comprehension.

The scene images are positioned slightly higher on tablet and short landscape to
reserve space for the row. This is a visual composition proposal. Production must
refit the camera to the new UI footprint, rather than translate the canvas.

## Open the study

While the project Vite server is running on port 4181:

http://127.0.0.1:4181/design/ui-prototype-2026-10-03/index.html

To restart from the repository root:

```powershell
npm run dev -- --host 127.0.0.1 --port 4181 --strictPort
```

Use the screen and device buttons above the scene. Current / Proposed compares the
published interface with this study. Within the proposal, the gold places, controls,
photo return, journal and day/night start/stop are clickable. Listen reuses bundled
arrival recordings. The journal shows one illustrative earned postcard; it is not
reading or updating real saved progress. Moon day/night demonstrates the control's
start/stop state; the captured Earth scene demonstrates the teaching composition.

## Completed verification

- Captured 15 scene backgrounds from the real development game using pointer journeys,
  a read-only snapshot and `deviceScaleFactor: 1`.
- Captured and inspected the proposal on phone 390×844, tablet 1024×768 and landscape
  844×390. `review/` contains 18 main views, six reading/journal views and the review page.
- `verify.mjs` passed on all three sizes: equal action-cell dimensions and row alignment,
  visible controls within viewport, discovery return, journal/photo nesting, Listen and
  Escape, map-to-Sun return, and Earth day/night start/stop. No page or console errors.
- Checked Current Earth/day comparison images load, and the review page's device,
  screen and version switches work.
- Screenshot review prompted extra globe clearance on short landscape. It also caught
  a premature journal capture; the verifier now waits for the thumbnail to decode.
- Corrected a stale audio error notification when closing a panel during media loading.
- No production typecheck/unit suite was run: game source is untouched and no commit
  was made. Physical-tablet performance, listening and child comprehension are unverified.

## Approved implementation checkpoint

The owner approved the overall row, icon family and photo return. The implementation followed:

1. Consolidate control geometry and styling in small owned UI components. Replace the
   relevant competing `ui.css` / `theme.css` rules instead of appending another override.
2. Keep Map and Journal at opposite ends of the row; keep activity geometry stable
   while it changes to Stop. Offer supported activities from settled arrival so the row
   does not rearrange halfway through exploration. Sun uses three equal cells.
3. Reuse world pictures in returns, titles and destination choices. Introduce an explicit
   picture identity rather than routing UI presentation through the old emoji fields.
4. Implement the information surface deliberately. Check whether a child expects Listen
   to leave the world fully visible; the study's reading/listening panel remains a design
   hypothesis. Preserve authored audio, written facts and a clear pictured return.
5. Refit camera framing to the reserved control area, then check gold-target clearance,
   Saturn's rings, resize and day-turn return. Keep the existing camera/lifecycle owners.
6. Retain photo compatibility-click guards, immediate X, focus handling and narration
   cancellation. Prototype transitions do not replace these tested game behaviors.
7. Run typecheck/unit tests and focused UI-flow/browser checks, inspect full-resolution
   before/after captures, then seek visual review before deployment.

No additional plugin or resource is needed to implement the selected direction.
Current design risks to observe: whether the map picture is understood without its
label, whether the picture-book symbol reads as the collection, whether Listen should
open a panel, and whether Day & night attracts attention without constant animation.
