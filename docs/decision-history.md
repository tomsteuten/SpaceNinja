# Space Ninja decision history

This records consequential product and engineering reversals without turning every previous
solution into a permanent instruction. Current operating guidance lives in `AGENTS.md`.

## 2026-09-26 — Show the source of daylight during the child's day turn

The side-on teaching view showed the terminator, but left the Sun outside the frame. The
owner approved a visible Sun pass while retaining the child-triggered activity. The real
Sun sits 105 Earth radii away, almost 90 degrees from this view: fitting it directly would
sacrifice either the readable globe or its visible night hemisphere.

The activity now uses a small, deliberately scale-compressed Sun visual along the same
`SUN_DIRECTION` as the lighting and night-light shader. It shares the world's existing
textures, adds two draw calls while active, and temporarily replaces the distant Sun's
visuals without moving its light. Surface coordinates, held rotation and one full day
remain unchanged. Camera framing accounts for the world's tilted axis and ring silhouette;
portrait puts the Sun above the globe, short landscape uses the horizontal space, and tablet
uses a diagonal composition. Reduced motion cuts the camera move and keeps the nine-second
surface turn. Completion and skip restore the prior view and enter the existing guided hunt.

The owner authorized implementation and a push once verified. Full-resolution before/after
captures are in `design/day-sun-2026-09-26/`; geometry and lifecycle unit tests and the focused
Earth browser checks cover framing and return behavior. Appearance, narration and performance
on the actual Android tablet still require owner observation.

## 2026-09-12 — Rule hierarchy audit

### Why the rules changed

`AGENTS.md` had grown to about 980 lines. It mixed verified correctness constraints, current UI
choices, old environment limitations, completed work, suggested work and several superseded
rules. The file itself noted the failure mode: individually defensible prohibitions had
optimized the project for avoiding old mistakes rather than for being good to play.

New user feedback supplied direct counter-evidence: the menus felt visually incoherent and the
day/night activity, despite several carefully protected affordances, was still difficult to
notice and understand. Some operational notes were also demonstrably stale—for example, they
said twelve photographs still needed sourcing after all discovery photographs were installed.

### What remains strict

- Child safety, forgiving interaction, immediate touch feedback and a dependable way home.
- Privacy, offline behavior and narrow progress reset.
- Real, credited discovery photography; no generated documentary substitutes.
- Tested coordinate, occlusion, input, camera-ownership, audio-lifecycle, texture-pairing,
  service-worker and Android photo-dismissal behavior.
- Responsive browser playthroughs and screenshot review for gameplay/UI changes.

### What was relaxed or reclassified

- `main.ts` no longer has to be the literal reset caller. One lifecycle coordinator is still
  required, but it may become a `GameSession` or state machine.
- “Destinations are data” is a preference for common behavior, not a ban on explicit body
  capabilities where Saturn or a future world genuinely differs.
- The destination bar, fact card, journal, spin and Fly Home positions are revisable. Their
  outcomes—legibility, playfield clearance, navigation and escape—remain required.
- Day/night need not remain an unlabeled optional icon forever, and a carefully bounded,
  interruptible first-Earth invitation is allowed. The rejected design was a repeated long,
  automatic sequence, not all forms of guidance.
- A hidden discovery on every visit is now a testable progression hypothesis rather than a
  universal requirement. Real coordinates and far-side occlusion remain strict.
- “Show the gesture” no longer bans short reinforcing labels. Children may use image, motion,
  narration and words together; the action must not rely on reading alone.
- Manual flight remains an experiment but is allowed in the deployed build through a deliberate
  grown-up entry and keyboard shortcut. It must also provide a clear return route.
- Real images may be sourced by an assistant when authoritative archives are reachable and
  provenance is verified. The old person-only restriction described one blocked environment,
  not an ethical or architectural requirement.
- Historical bug narratives move here or into focused code/test comments instead of expanding
  the active rulebook indefinitely.

### Decisions not made by this audit

The audit does not automatically put manual steering into the main child loop, remove the
scripted flight, eliminate hidden discoveries or impose a new day/night tutorial. Those are
product experiments to implement and evaluate on the target tablet. The audit permits better
alternatives; it does not pretend they have already been validated.

## 2026-09-12 — First-find photo postcard

A first-time discovery now opens its verified photograph as a large postcard once the lazy
image has decoded. The previous thumbnail-only treatment made a successful tap feel like an
abstract yellow ring and narration, especially on phones; expecting a pre-reader to notice and
operate a small magnifier was too much. Repeated finds remain compact so familiar places do not
turn replay into a chain of interruptions. The postcard retains a plainly labelled exit and
does not bypass lazy loading, missing-photo handling, or the Android dismissal guard.


## 2026-09-14 — Shared browser lifetime for both routes

Code review found three inconsistent lifetime paths: adventure resumed its stage on visibility
without remembering a crash; free flight never suspended its loop on visibility and used only a
hint for crashes; both disposed GPU resources on every `pagehide`, including cached history
navigation. The latter can restore an already-disposed scene when navigating back.

`src/session/lifecycle.ts` now owns browser pause/resume, terminal crash and final disposal for
both routes. Persisted history navigation suspends and retains resources, while ordinary exit
disposes once. Interrupted input is released without resetting the camera or changing its owner.
Adventure restart delegates to the existing ordered reset callback; it does not write progress.
Free flight uses the reusable crash screen and registers offline support after its first frame,
with automatic update reload disabled during the experiment.

This extracts a tested ownership boundary without replacing the adventure's mission/camera
orchestration with an unproven state-machine rewrite. Unit tests exercise crash permanence,
history retention, hidden startup and idempotent disposal. Browser checks exercise the actual
route integrations, interrupted steering and an adventure trip after exiting free flight.
Manual flight remains an explicitly entered experiment.


## 2026-09-14 — Postcard clearance in short landscape

The screenshot review at 844 by 390 exposed discovery text behind the fixed Keep exploring
button, although the button remained clickable and the prior browser suite passed. Short
viewports now reserve an exit row and cap photo height against the remaining vertical space.
A browser assertion checks the full text ends above the exit in every tested viewport. Photo
loading, first-find behavior and the Android backdrop dismissal guard are unchanged.


## 2026-09-24 — Restore the guided home map's staged opening

The pre-home-review branch revealed all four worlds immediately and always framed the outer
orbit. Full-resolution captures from untouched commit `6f86ca5` show Saturn's suggestion halo
overlapping the much smaller Earth, on both phone and tablet. The live `?classic` route still
shows a more readable Earth/Moon opening (the live root URL currently opens the explorer).

Restore the existing visit gates for scene visibility, launch eligibility and camera framing
together: visiting Moon reveals Mars; visiting Mars reveals Saturn. Collection is not a gate.
The four world thumbnails remain in the home tray, and pressing a future world answers with a
lock icon, a visible refusal and the prerequisite. Remove the broad suggestion halo at home:
it dominates Saturn and clips at the phone edge around Moon. The light destination pill and
ship direction now carry that suggestion; actual discovery markers remain gold to match audio.

The home restyle stays in `theme.css`, with home-only positioning for the journal and hint.
The owner must judge the phone/tablet comparisons before another screen is redesigned.
This restores a composition that fits the current guided game, rather than ruling out a freely
accessible solar-system map if a future design and device observation support one.

## 2026-09-24 — Integrate the newer explorer without changing the chosen game

Remote `main` developed a close-flight explorer after this branch split and made it the root
route. The owner's later direction selected the guided adventure as the game, with UI polish
screen by screen. The merge retains the explorer and its assets at `?explorer`, while the
guided adventure remains the default. This preserves the newer work for comparison without
reversing the owner's current product choice. Real-device evaluation is still pending.
