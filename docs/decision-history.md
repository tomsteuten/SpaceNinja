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

## 2026-10-03 — Contextual controls and optional day/night invitation

The September feedback identified incoherent menus and a day/night activity that was still
hard to notice. Inspecting the current phone view confirmed the activity was an unlabelled
globe beside controls with different shapes, and its invitation required a completed hunt.
The visit now groups Journal, Fly Home and Day & night in one consistently styled row.
Facts remain above it on phones and share the bottom band when compact on landscape screens.
The day/night globe has a turn arrow and visible words, and becomes an explicit Stop control
during the activity. Fly Home stays available and silences continuous sound immediately.
The hunt caption gives way to a small day/night legend during a turn, and opening the
written fact keeps the controls anchored in the same place.

Earth can offer a quiet invitation after a find while another visible target remains;
it does not compete with the hidden-target drag lesson, photos, narration or open words.
Only one coach/activity invitation is shown at a time, and trying the activity suppresses
further invitations for that visit. Resting globes no longer animate continuously.
The activity remains opt-in: no automatic arrival sequence or extra modal was introduced.

Browser verification covers responsive control bounds, keyboard start/stop, restored surface
orientation, canvas skip and home interruption. These establish behavior and layout, not
child comprehension or older Android performance. The earlier invitation is an experiment
to retain or revise after observing a child and the target tablet.

## 2026-10-03 — Child feedback: pictured exits and a Sun journey

A child could not see how to leave a discovered location's box, and children who could not
read did not understand the route back to the map. They also asked to travel to the Sun.
This is fresh child observation and revises the previous choice of a worded postcard exit
and a rocket-only return icon.

The postcard now has a large arrow with the visited world's picture on its primary exit,
and a larger X. Journal photographs offer a book-return picture. Both explicit buttons
remain immediate; guarded fresh backdrop pointer dismissal still protects against Android
compatibility clicks. Keyboard focus stays inside the photograph until it closes.
The stable return button is labelled Space map and pictures the Sun, Earth and Moon beside
an arrow. It uses a contrasting colour so it remains recognizable without reading.

The Sun is a fifth destination, available immediately, using the ordinary flight and reset
coordinator. An explicit emissive-body approach capability brings the ship to its near side;
camera distance scales to its radius. The visit offers looking around and a narrated fact,
without invented surface discoveries, collection slots, stickers or a day/night activity.
The existing four collections and saved discovery IDs are unchanged. The new welcome uses
the same locally generated Kokoro voice and offline asset pipeline. Educational copy is
grounded in https://science.nasa.gov/sun/facts/; its surface texture remains an illustration.

Browser checks cover pictorial exits, keyboard focus, compatibility clicks, control bounds,
Sun travel and return, persistence and onward planet travel. A sampled flight geometry test
checks the camera and ship remain outside the Sun. Screenshots establish rendering and
responsive layout; a further child check should establish whether the pictured exits are
understood without an adult prompt.
