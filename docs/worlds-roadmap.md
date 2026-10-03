# Worlds roadmap

Current expansion checklist, reconciled with source on 4 October 2026. Read
[AGENTS.md](../AGENTS.md) and the [current checkpoint](current-implementation.md) first.
Adding a world is future work; this document does not authorize implementation or UI redesign.
The guided adventure at `/` is the product; experiments remain explicit routes.

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
  order does not invent reveal prerequisites. Stickers, ship badges/mounts and the explorer
  list derive from the catalogue, with a generic badge fallback for new worlds.
- Narration plays available recordings individually. The default generator is ElevenLabs;
  Kokoro is a local fallback. An incomplete pack does not silence other recordings and
  device speech is manual. See [recording instructions](../src/audio/recordings/README.md).

The geometry/framing, shared orbiting-body builder and derived badges/explorer work are
complete. Do not repeat the catalogue refactor or the September arrival restyles as expansion
prerequisites. The approved October row is Space map, Listen/Words, supported Day & night,
Journal; Stop keeps its cell and Sun has three cells.

## Checklist for one pilot world

Jupiter was proposed as the first additional planet. Confirm the intended world and content
when expansion is requested; pilot one world before generalizing more systems.

1. **Capabilities and subjects.** Choose six real, attributable subjects and decide what
   each marker represents. Surface coordinates, cloud features, orbital views and transient
   events differ. A `Discovery.ring` marker is outside the sphere in its equatorial plane;
   it cannot represent Io's shadow on Jupiter. Do not invent solid landing ground for a
   giant. Model a required difference with a small explicit capability. The explorer
   currently uses `Boolean(world.rings)` to choose orbital visits; review that for a giant
   without rings rather than assuming rings express every orbital visit.
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
   Preserve the visible escape route and approved contextual row.
8. **Explorer and offline assets.** Check `src/explorer/worlds.ts`, photograph provenance
   and orbital behavior if the world joins that experiment. `vite.config.ts` still names
   four explorer world pictures explicitly; include a new one deliberately. Small
   discovery thumbnails are precached; full photographs stay lazy and are cached after use.
   Check new maps/imported recordings reach the intended offline caches.
9. **Verification and owner review.** Run `npm run typecheck` and `npm test`. Run only
   affected Playwright files/viewports, such as relevant `e2e/visit.pw.ts` and
   `e2e/layout.pw.ts` projects; follow AGENTS.md for isolated reruns. For a visual change,
   send full-resolution (`deviceScaleFactor: 1`) before/after images on phone, tablet and
   short landscape, one screen at a time, and wait for owner approval. Use a temporary
   previous-commit worktree with its own `npm ci` for before images; never link
   `node_modules`. Tablet performance, listening and child comprehension need observation.
   CI runs the full suite on deployment.

## Proposals, not implemented APIs or approved layouts

Parented moons such as Titan or Europa need orbital inheritance, reveal and framing design;
`WorldGeometry` has no parent relation. Compressed shell spacing or neighborhood maps may
help as destinations accumulate, but neither is an implemented expansion contract. Evaluate
composition as each world lands instead of constructing a general engine first. The Sun
observation visit is complete, not the last future item.

Later candidates recorded in September were Mercury, Venus, Uranus, Neptune, Pluto, Ceres,
Titan and Europa. Their order, subjects and layout remain proposals, not ready-to-run prompts.
Completed work and the reason for retiring old prompts are in [decision history](decision-history.md).
