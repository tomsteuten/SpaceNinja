# Space Ninja decision history

This records consequential product and engineering reversals without turning every previous
solution into a permanent instruction. Current operating guidance lives in `AGENTS.md`.

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

## 2026-09-20 — Explorer-first trial

Feedback from the deployed page consistently described the destination markers, crowded
controls and unlabeled day/night action as noisy and difficult for young children to decode.
The product hypothesis changed from “complete a collection loop” to “choose a world and wander
over real imagery”. The new route is a calm globe explorer with direct touch steering, a small
contextual dock, real NASA/USGS/JPL imagery and optional place postcards. It is the default
route for this trial; the previous adventure remains available at `?classic` so playtests can
compare both loops without deleting the existing implementation.

This is an experiment, not evidence that a free-flight loop is already validated on tablets.
Physical Android touch feel, sustained frame rate and whether children understand the world
chooser still need observation before the classic route can be retired.

The implementation keeps all six authored places on each world. Surface markers and
progress gates are absent from the explorer. Each world uses the same touch model, with
Saturn explicitly framed as an orbital subject rather than a solid surface. Illustrative
lighting follows the view to keep places readable; historical Saturn storms open as archive
images rather than being claimed as permanent surface features. The Moon's incomplete NAC
regional tile was removed after screenshots exposed visible gaps and mismatched seams.
Detailed close views use the credited image viewer instead of invented terrain.

The classic implementation and progress remain intact at `?classic`. A pre-explorer Git
tag provides a complete source rollback; reverting the explorer commit restores the default
route and prior assets without rewriting shared Git history.
