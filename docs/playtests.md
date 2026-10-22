# Playtests

Fresh child observation, reported by the owner, carries the most weight (AGENTS.md). One entry
per playtest: the build, what the child did, and what changed because of it. The player is the
owner's son, in the 5–8 target range.

## Playtest 1 — 21–22 October 2026

**Build:** main before the quiet arrival (toys: Moon jump, Earth bedtime spin, Saturn bath).

- On arriving at a world he went straight for the gold rings. Finding places works.
- He was confused by how much was going on at once on arrival.

**Led to:** the quiet arrival. The toy and Journal stay hidden until the third find, then the
toy pops in as the next step (`setVisitStage` in `src/ui/ui.ts`, `e2e/quiet-arrival.pw.ts`).

## Playtest 2 — 22 October 2026

**Build:** tag `playtest-2` (main `36e99f7`): quiet arrival plus the Mars rover.

- **Mars rover confused him.** Commands floating down to Mars with a delay is a clever way to
  show signal delay, but probably too complex for this age.
- **After a world is complete, it is not clear what to do next.** He found the button back to
  the Space map, but then did not understand what to do, even though the narration said
  "X is ready". Spoken guidance alone was not enough.

**Owner's conclusion:** every change of state needs reviewing for whether a child can tell what
just happened and what they can do next, shown on screen rather than only said.

**Led to:** a state-change audit (`design/state-audit/`) and a ranked fix list before any new
toy. The Sun line-up waits until after playtest 3.
