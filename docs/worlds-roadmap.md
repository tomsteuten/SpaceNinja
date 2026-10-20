# Worlds roadmap

Current expansion checklist, reconciled with source on 4 October 2026. Read
[AGENTS.md](../AGENTS.md) and the [current checkpoint](current-implementation.md) first.
[`DECISIONS.md`](../DECISIONS.md) outranks this checklist, and
[`content/worlds.md`](../content/worlds.md) holds each new world's places, facts and sources.
The guided adventure at `/` is the only route.

## What is implemented

- `src/worlds/catalogue.ts` exports `WorldGeometry`, `WORLDS`, `ORBITING_WORLDS`,
  `worldGeometry()`, `viewRadius()` and `framingRadiusFor()`. Earth, Moon, Mars and Saturn
  are catalogue worlds. It owns geometry, compressed orbits, axial tilt, rings, surface
  maps and fallback palettes. It does not contain educational copy or reveal gates.
- `src/config.ts` owns `DESTINATIONS`: identity, facts, optional spin lessons, explicit
  reveal prerequisites and optional missions. The Sun is already a fifth, immediately
  available observation destination, without a mission or day/night activity. Its geometry
  and emissive presentation are handled separately from the catalogue.
- `src/scene/Bodies.ts` builds orbiting catalogue worlds with a shared builder. Earth uses
  paired color/roughness maps, night lights and atmosphere; Sun has a teaching-star builder.
  `BODY_IDS` remains a separate literal list for exhaustive types.
- Framing derives from the revealed set and visible silhouette, including rings. Catalogue
  order does not invent reveal prerequisites. Stickers and ship badges/mounts derive from
  the catalogue, with a generic badge fallback for new worlds.
- Narration plays available recordings individually. The default generator is ElevenLabs;
  Kokoro is a local fallback. An incomplete pack does not silence other recordings and
  device speech is manual. See [recording instructions](../src/audio/recordings/README.md).

The geometry/framing, shared orbiting-body builder and derived badges work are
complete. Do not repeat the catalogue refactor or the September arrival restyles as expansion
prerequisites. The approved October row is Space map, Listen/Words, supported Day & night,
Journal; Stop keeps its cell and Sun has three cells.

## Checklist for one pilot world

Jupiter was proposed as the first additional planet. Confirm the intended world and content
when expansion is requested; pilot one world before generalizing more systems.

1. **Capabilities and subjects.** Take the three real, attributable subjects from
   `content/worlds.md` (one authored set, `mission.singleSet`) and decide what each marker
   represents. Surface coordinates, cloud features, orbital views and transient
   events differ. A `Discovery.ring` marker is outside the sphere in its equatorial plane;
   it cannot represent Io's shadow on Jupiter. Do not invent solid landing ground for a
   giant. Model a required difference with a small explicit capability; rings do not
   express every orbital visit, so a giant without rings needs its own.
2. **Geometry and identity.** Add a `WorldGeometry` entry with the existing interface and
   actual `SurfaceFallback` union (`cratered`, `banded`, `rocky`). Add the stable id to
   `BODY_IDS` in `src/scene/Bodies.ts`. Check catalogue/body/config consistency tests.
   Preserve saved ids. There is no implemented `parent` field for moons of another planet.
3. **Copy and selection.** Add `DESTINATIONS` copy, explicit reveal prerequisites, supported
   activities and a mission only when appropriate. Use genuine coordinates and represent
   archive subjects honestly. Add the radius to the separate `RADII` table in
   `src/mission/selection.test.ts`. Check every authored place occurs in a playable set,
   arrivals compose with actual axial tilt, rings are readable and far-side places cannot
   be tapped through the body. The current selector expects one hidden surface place per
   set and has latitude/drag bounds; read source/tests rather than treating these design
   choices as universal planetary requirements.
4. **Maps and photographs.** Source and verify real assets, permissions and credit lines.
   Record map provenance in `public/assets/README.txt` and discovery-photo provenance in
   `public/assets/discoveries/README.txt`. Never generate documentary photographs. Follow
   the existing map format/resolution budget. Generate small discovery derivatives with
   `scripts/make-place-thumbnails.py`. Keep reference art in `design/`; everything in
   `public/` ships. Verify the intentional missing-photo state.
5. **Narration.** Derive required cues from `cuesByBody()` and `SCREEN_CUES` in
   `src/audio/narration-script.test.ts`, including map invitations/nudges and reveal/locked
   cues for gated worlds. There is no fixed eleven-cue requirement. Keep arrival/find
   recording pairs consistent and reject orphan MP3s. Generation is separately requested
   work; do not regenerate the paid pack to satisfy old prose. Written words and per-cue
   manual fallback remain available.
6. **Rewards and persistence.** Check derived discovery totals, completion, visits,
   stickers and generic ship badge placement. A no-mission destination must not gain an
   invented hunt/reward. Confirm old saves load and adult reset removes only progress.
7. **Map and controls.** Check reveal, launch eligibility and framing together. An outer
   orbit widens the map and shrinks inner worlds. Phone CSS currently places destination
   choices four and five explicitly; a sixth changes row count and footprint. Review
   controls, camera reservation and target clearance on phone, tablet and short landscape.
   Preserve the visible escape route and approved contextual row. Place the body in exactly
   one neighborhood in `src/map/model.ts` (a unit test fails otherwise). `childNeighborhoods()`
   is what a child may see; `neighborhoodBounds()` in `src/map/framing.ts` frames a page.
8. **Offline assets.** Small discovery thumbnails are precached; full photographs stay lazy
   and are cached after use. Check new maps/imported recordings reach the intended caches.
9. **Verification and owner review.** Run `npm run typecheck` and `npm test`. Run only
   affected Playwright files/viewports, such as relevant `e2e/visit.pw.ts` and
   `e2e/day-spot.pw.ts` projects; follow AGENTS.md for isolated reruns. Show the owner
   full-resolution before/after captures per screen. Tablet performance, listening and child
   comprehension need observation.
   CI runs the full suite on deployment.

## Order of work

New worlds wait for the toys plan ([`docs/toys.md`](toys.md)): a world is added together with
its toy, and only after a child has played the toys for the current five. The page and order
ideas in `content/worlds.md` and the old [expansion handover](handover-2026-10-15-expansion.md)
remain a reference, not a schedule.
