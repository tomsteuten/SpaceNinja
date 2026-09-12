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
