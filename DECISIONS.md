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
4. LOCKED: The first session is a short rail: land on Earth → the child takes a marked spot
   into night and back into morning themselves → a brief acknowledgement suggests the Moon.
   No full rotation is required and nothing is counted. Space map stays visible and in place
   throughout. After that, the game is open. Grown-ups, Done and Space map are always
   available.
5. LOCKED: Gas and ice giants show orbital/cloud features only. No landing, no invented ground.
6. LOCKED: New worlds carry 3 discovery places (one visit set). Existing worlds keep 6.
7. LOCKED: During building, narration uses Kokoro (local, free). One paid ElevenLabs pass
   covers all new cues at the end, as a separate owner-approved step.
8. LOCKED: Visual approval happens once per wave, from one screenshot set, not per change.
9. LOCKED: World content (places, coordinates, facts, photo sources) is written in
   `content/worlds.md` before code. Building a world means filling the template from it.

## Changes

- 2026-10-16, line 4: the rail's trigger changed from "completes one turn, then Space map is
  revealed" to "a marked spot goes into night and back into morning", with Space map always
  visible. Owner decision after a browser review found the day/night activity gave no
  feedback on what changed or what to do next. No child evidence yet; playtest question 1
  tests it.
- 2026-10-18, line 1 (branch only): the owner reports that a child playtest of the guided
  adventure felt confusing and not much fun. What the child actually did is not yet written
  down; add it here. Line 1 stays as it is on `main`. This authorizes one isolated branch,
  `prototype/toybox-pilot`, where hold-to-fly free flight (restored from `73b294d~1`; the
  `pre-freeze` tag was never created) is the default at `/`, to compare in a child's hands.
