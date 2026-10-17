# Handover: first Earth experience and discovery loop

The owner requested these changes and authorized pushing them to `main` on 6 October 2026.
Check the current main revision and GitHub Actions result before treating this handover as
proof of deployment. The two implementation passes were developed together from `0cb420e`.

## Read first

- `README.md` — product, routes and controls.
- `AGENTS.md` — current operating guidance and correctness properties.
- `docs/current-implementation.md` and `docs/decision-history.md` — current changes and rationale.
- `docs/worlds-roadmap.md` — the actual expansion interfaces and remaining dependencies.
- `docs/handover-2026-10-05-pedagogy.md` — prior review context; its descriptions precede these changes.

## Owner preferences

The game should become more intuitive for children aged roughly 5–8 and have better-looking
controls. Eventually it should include all eight planets plus more moons and dwarf planets.
The owner currently cannot test with children and explicitly wants continued improvement
using best judgement and AI/adult testing. Do not block implementation on child observation.
Distinguish browser evidence from comprehension or physical-tablet performance.

The owner permits justified deviations from project constraints and handover instructions.
Current design choices may change when a better interaction preserves the useful correctness
properties. Do the authorized work and make it reviewable; avoid repeated confirmation requests.

## Implemented

- Earth is suggested first, using the already-recorded `home-earth` cue.
- First Earth arrival offers Space map, Turn Earth, and Find places. Gold markers wait until
  the child finishes or explicitly skips the lesson. Exploration remains optional.
- Earth's day/night activity responds directly to horizontal dragging. A canvas tap or the
  accessible Turn Earth control requests a quarter turn. It otherwise stays still. Done
  restores the original surface orientation and returns to the hunt; Space map always exits.
  Other worlds retain timed day turns. No new narration pack or progress schema was needed.
- Rounded tactile buttons, larger pictures, finite invitation/gesture animations, and
  reduced-motion alternatives replace the thin toolbar presentation. Listen replays directly;
  Words opens the transcript. Muted playback entries also open Words.
- The hunt arrow moves the camera around the tilted world axis rather than rotating its
  surface. Earth's Night Side stays dark when the arrow brings it into view.
- First-find photos show Saved to your journal and the count for this visit. The third
  photograph offers See discoveries as well as Keep exploring.
- Completion highlights Journal and retains All three found! See your journal, including
  after day/night replay. Space map keeps its position.
- The journal opens to the current world's authored six-place page. Pictured world buttons
  select pages. Unknown places retain neutral target pictures, without revealing their
  names or photographs. Found places open a separate story with All places, real photo,
  audio when enabled, and a pictured world return. Short-landscape words scroll independently
  so the return remains visible. Nested photo and journal exits restore keyboard focus.

## Relevant implementation

- `src/main.ts`: first-Earth choice, camera ownership, hunt arrow, collection/completion wiring.
- `src/scene/DayTurn.ts` and `dayTurnInput.ts`: direct turning, assisted tap, exact restoration,
  pointer cancellation and activity ownership. Pointerup uses capture phase because the
  orbit handler otherwise releases capture before a tap can be recognized.
- `src/controls/OrbitInput.ts`: camera orbit around a supplied world axis.
- `src/state/replay.ts`: first-Earth suggestion and collection counts.
- `src/ui/ui.ts`, `photos.ts`, `icons.ts`, `adventure.css`: contextual controls, journal,
  photographs and responsive presentation.
- `e2e/earth-loop.pw.ts`: the new complete-loop regression; existing Earth/day/night/map,
  photo and multi-world tests were adjusted for the changed interaction.

## Verification before publication

Production build/typecheck and all 347 unit tests passed. Targeted Earth/day/night/map
browser checks passed across phone, tablet and short landscape. Real canvas checks covered
tap assistance, vertical drag, pointer cancellation and stopping motion. The complete Earth
loop passed on all three viewports, with an additional 319 × 561 reward-button check.
The tablet photo/return/Sun and multi-world journal/audio flows also passed. The deploy
workflow runs the full browser suite before publishing Pages; check its actual result.

Browser runs use Playwright and software WebGL. In the previous cloud workspace the working
commands used `SPACE_NINJA_CHROMIUM=/usr/bin/chromium PLAYTEST_PORT=4181` because an earlier
preview occupied port 4180. Discover installed browsers and occupied ports in the new
workspace rather than assuming these exact settings remain necessary. Node 24 and npm 11
worked; no backend or application secrets are required. Narration is bundled.

Full-resolution before/after captures and reports existed under
`/workspace/scratch/spaceninja-implementation/` and `/workspace/scratch/earth-loop-polish/`.
They are session-local artifacts, not repository files, and may be absent in a new environment.
Capture fresh evidence rather than relying on those paths. No physical-device or child
comprehension claim is made.

## Recommended next task

Design and implement an expandable solar-system map before adding more destinations. The
current map/destination bar shrinks as worlds unlock and will not accommodate all planets
plus moons and dwarf planets well. Prototype a navigable system view with a focused planet
and nearby moons, generous stable touch targets and clear pictured travel/return controls.
Use data-driven placeholder destinations to exercise the future scale before authoring
new world content. Keep unfinished worlds unmistakably unavailable and keep the existing
five destinations playable; do not fabricate completion or working travel for placeholders.

Choose the navigation design by testing concrete tasks with pointer, keyboard, muted audio,
and phone/tablet/short-landscape screenshots. Preserve saved discoveries, offline behavior,
exclusive camera ownership, lazy full photos, actual surface locations and child-controlled
interaction. Avoid an engine rewrite. After the map works, Jupiter and one moon, probably
Europa, are the recommended first content expansion.

Suggested model: GPT-6.1 with high reasoning for implementation; GPT-6 Astra with high
reasoning for a focused map/architecture review if available. Use the game UI and playtest
skills and existing browser tooling. Figma/Penpot may help compare navigation studies but
are optional; NASA/JPL sources are useful for future factual content and real imagery.
