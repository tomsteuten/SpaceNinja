# Handover: lock the decisions, then expand the solar system (15 October 2026)

This handover replaces open-ended planning. The owner (Tom) has **approved every decision
below**. Do not re-open them, do not write new proposals, studies or design reviews, and
do not ask for approval of anything in this file. Ask only when something here is impossible
or contradicts a correctness invariant backed by a test.

Read `AGENTS.md` and `docs/current-implementation.md` first for commands and verification,
then work through the waves below **in order, one wave per session**. Stop at the end of each
wave for owner review.

## Why this exists

97 commits and four weeks in, the game has Earth, Moon, Mars, Saturn and the Sun. Most recent
effort went into experiments, design studies and handovers. That happened because key decisions
were left as "proposals," and each session re-argued them using adult or AI judgement instead
of child evidence. The fix is to lock the decisions, cut the cost of adding a world, and
ship in waves.

---

## Wave 0: Housekeeping (small, do first)

### 0.1 Create `DECISIONS.md` at the repo root, verbatim

```markdown
# Locked decisions

Each line is LOCKED. A locked line changes only when the owner reports child evidence
against it (what the child did, not an opinion). AI or adult judgement alone never reopens
a locked line. Record a change here with the date and the evidence.

1. LOCKED: The guided adventure at `/` is the only product route. `?explorer`, `?freeflight`,
   `?outing` and `?mapstudy` are frozen and removed (recoverable from tag `pre-freeze`).
2. LOCKED: The Space map uses paged neighbourhoods. Earth & Moon is the start page.
   Page order: Inner planets (Mercury, Venus, Mars) · Earth & Moon (with the Sun) ·
   Jupiter & moons · Saturn & Titan · Ice giants (Uranus, Neptune) · Small worlds (Pluto, Ceres).
3. LOCKED: Moons belong to their parent planet's page and orbit their parent in the scene.
4. LOCKED: The first session is a short rail: land on Earth → the child turns day/night
   themselves → the Space map opens. After that, the game is open. Grown-ups and Stop are
   always available.
5. LOCKED: Gas and ice giants show orbital/cloud features only. No landing, no invented ground.
6. LOCKED: New worlds carry 3 discovery places (one visit set). Existing worlds keep 6.
7. LOCKED: During building, narration uses Kokoro (local, free). One paid ElevenLabs pass
   covers all new cues at the end, as a separate owner-approved step.
8. LOCKED: Visual approval happens once per wave, from one screenshot set, not per change.
9. LOCKED: World content (places, coordinates, facts, photo sources) is written in
   `content/worlds.md` before code. Building a world means filling the template from it.
```

### 0.2 Update `AGENTS.md`

- Point to `DECISIONS.md` near the top: "Read `DECISIONS.md` first. Its lines outrank
  everything else in this file except tested correctness invariants."
- Soften "Fresh observation outranks an old design decision" to apply only to **child**
  observation reported by the owner.
- Replace the per-change visual approval rule with: "Collect full-resolution
  (`deviceScaleFactor: 1`) captures on phone, tablet and short landscape for every screen the
  wave changed, in one folder `design/wave-N/`, and send them once at the end of the wave."
  Keep "never self-approve appearance."
- Add: "Do not create new docs, studies, prototypes or experiment routes. At the end of a
  wave, update the checkpoint at the top of `docs/current-implementation.md` in at most
  15 lines."

### 0.3 Freeze the experiments

1. `git tag pre-freeze` on current `main` and push the tag.
2. Remove the `?explorer`, `?freeflight`, `?outing` and `?mapstudy` branches from `src/main.ts`,
   along with their now-unused modules and their e2e files (`explorer.pw.ts`, `freeFlight.pw.ts`,
   `outing.pw.ts`, `outingBoundaries.pw.ts`, `map-study.pw.ts`).
3. **Check before deleting.** The grown-ups panel's "Try manual flight" (`onTryFreeFlight`) and
   Shift+F reach free flight. Remove that button and shortcut too. Do **not** delete anything
   the adventure itself still imports (for example the `src/map/` model and framing, which
   Wave 1 promotes). Let `npm run typecheck` tell you what is still referenced.
4. Remove the explicit explorer textures from `vite.config.ts` if the explorer is gone.
5. Archive old handovers and studies: move `docs/handover-*.md` (except this one), dated
   reviews and `docs/*-proposal-*.md` into `docs/archive/`. Leave `design/` folders alone.

### 0.4 Allow 3-place worlds

`PLACES_PER_VISIT` is 3 and existing worlds author a pool of 6. Make a pool of exactly 3 legal
(one authored set) for new worlds. `selection.test.ts` currently expects
`pool.length > PLACES_PER_VISIT`, so update the test to allow `>=` for worlds that opt in.
Check the journal (`count of places.length`), completion and stickers derive totals per
world rather than assuming 6.

### 0.5 Draft `content/worlds.md`

Write one table per new body: id, page, places (3, with name, what it is and whether it is
a surface coordinate or an orbital/cloud feature), one short child fact per place, surface
map source, discovery photo sources (prefer NASA/JPL/ESA public domain, with credit lines),
and the narration cue list from `cuesByBody()`/`SCREEN_CUES`. Bodies: Mercury, Venus,
Jupiter, Io, Europa, Ganymede, Callisto, Titan, Uranus, Neptune, Pluto, Ceres.
Verify every coordinate and claim against a real source and cite it in the table. Never
invent or generate a documentary photograph. If a body cannot be honestly represented,
mark it and move on instead of stalling.

**End of Wave 0:** typecheck + unit tests pass, deploy goes green. Send the owner
`content/worlds.md` to skim. There are no screenshots for this wave.

---

## Wave 1: The core loop and paged map

Settle the loop before any new world, so later fixes are not multiplied.

### 1.1 First-session rail (Decision 4)

On a fresh save: arrive at Earth, and the day/night turn is the first activity. The child
drags it themselves; existing tap/Turn Earth assists stay. Completing one turn plays a clear
"you did it" beat and **then** reveals and highlights the Space map control, suggesting the
Moon. Until then, the Space map control is not shown. Grown-ups and Stop stay visible.
Later sessions keep today's open behaviour. Existing saves that already have Earth progress
skip the rail. Cover it with an e2e check on phone and tablet.

### 1.2 Make paging the default map (Decision 2)

Promote `src/map/` (model, framing, ui) into the default Space map. Restructure `NEIGHBORHOODS`
in `src/map/model.ts` to the locked page order. Children only ever see `childNeighborhoods()`,
so unbuilt pages stay invisible. Use `neighborhoodBounds()` framing per page. Add picture
peeks of the neighbouring pages and an animated page move (replace the current camera cut).
Keep swipe plus visible native buttons, and keep pinch-zoom working. Remove the phone CSS
that places destination choices four and five explicitly, if paging makes it obsolete.

**End of Wave 1:** typecheck, unit tests, and affected e2e on phone/tablet/short landscape.
Captures in `design/wave-1/`: the fresh-save rail, Earth & Moon page, Saturn page, and a
page move mid-swipe. Send once and wait.

---

## Wave 2: Jupiter, the pilot world, plus moon parents

1. Add an optional `parent` (a world id) to `WorldGeometry`. A moon's orbit is relative to
   its parent's position. The existing Moon keeps Earth as its implicit centre, so don't
   change its behaviour or saved id. Add catalogue tests for parent resolution and framing.
2. Build Jupiter from `content/worlds.md`, following `docs/worlds-roadmap.md` steps 1–9 but with
   3 places and Kokoro narration. As a giant without rings, it needs its own orbital-visit
   capability; the explorer used `Boolean(world.rings)` for this, so don't reuse it.
3. Jupiter appears on its own page with no moons yet. Write down whatever was painful, as
   at most 5 bullets in the checkpoint, so Wave 3 can follow it as a recipe.

**End of Wave 2:** checks and captures as before (Jupiter page, arrival, one discovery).

---

## Wave 3: The remaining planets

Mercury, Venus, Uranus and Neptune follow the Jupiter recipe as near-clones. Decide each
world's reveal prerequisite simply: a page's worlds reveal once the child has visited any
world on the previous page. No new UI patterns in this wave. Run one capture set for all four.

## Wave 4: Moons and small worlds

Io, Europa, Ganymede and Callisto go on Jupiter's page; Titan goes on Saturn's. Use the existing
`companionPages`/`moreMoons` model if more than two companions need showing. Pluto and Ceres
go on Small worlds. Use real maps where they exist (New Horizons, Dawn, Galileo, Cassini),
and banded/cratered fallbacks only where honest. One capture set.

## Wave 5: Narration and the owner's pass

Generate all new cues with ElevenLabs (owner approves the spend first, using the same voice
as the existing pack). Follow `src/audio/recordings/README.md` and reject orphan MP3s. Then
the owner does one full-game review on the real Android tablet and a child playtest.

---

## Playtest script (owner, after Waves 1, 3 and 5)

Hand the tablet over with no instructions. Watch, don't help, and note answers to these questions only:

1. Did they turn day/night on Earth without being shown? (Wave 1)
2. After the map opened, did they find and fly to another page on their own?
3. Did they stop to look at a discovery photo or listen, or tap straight past it?

Report what the child did. That is the only input that can change a locked decision.

## Rules of thumb for every session

- Typecheck + unit tests every commit; only affected Playwright files and viewports locally.
  CI runs the full suite on deploy.
- Don't reopen locked decisions, build alternatives "for comparison," or add routes.
- If a wave grows beyond its list, finish the list, write the extra item as one line
  in the checkpoint, and stop.
