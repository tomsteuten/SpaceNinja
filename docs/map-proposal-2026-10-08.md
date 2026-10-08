# Expandable space map: bounded proposal

Status: proposal for review, not an approved layout or implemented navigation system.
Baseline: GitHub main `849547bbf7749e4ed9b08602be9920c26f5f8fd8` (6 October).

## Recommendation

Prototype a **paged map of planet neighborhoods**. Keep a large planet and its nearby
moons in the world, with stable pictured travel buttons in one compact edge tray. Paging
changes the neighborhood; tapping an available destination launches the existing journey
immediately. Do not add a select-then-confirm step to travel.

Start at Earth and the Moon, with the Sun also directly reachable. Remember the last
neighborhood during the session so Space map returns somewhere familiar. Keep the current
Earth-first invitation and visit-based unlocks. Browsing another neighborhood must never
record a visit or unlock a destination.

The child-facing loop is: see a world -> tap its picture -> travel -> explore -> Space map.
Large previous/next controls and a partly visible neighboring planet show that there is more
to browse. Swipe is an additional way to page, never the only way. The controls acknowledge
the first touch; the camera then settles with a short, cancelable transition. Reduced
motion uses a cut.

## Why this slice

The current `framingRadiusFor()` includes the furthest revealed orbit. More outer worlds
therefore shrink the inner worlds. `adventure.css` also places destination buttons four
and five explicitly on phones. Expanding that tray to all planets, moons and dwarf planets
would spend increasing screen space on navigation.

The existing world catalogue, shared body builder and derived rewards are already done.
The missing boundary is between **what the map presents together** and **where a body
exists in the simulation**. Add a small presentation model, not another engine.

| Option | Benefit | Main cost | Decision |
| --- | --- | --- | --- |
| One ever-wider system map | Everything occupies one scene | Tiny inner worlds and growing control tray | Keep as baseline comparison |
| Scrollable picture catalogue | Stable targets, straightforward keyboard access | Feels like a list rather than space | Fallback if paging proves confusing |
| Planet neighborhoods | Large worlds, space for moons, bounded controls | Needs clear paging and return behavior | Prototype first |

## Proposed screen and behavior

- **World area:** one focused planet, nearby moons and restrained orbital context. Preserve
  the approved rounded controls, existing pictures and readable labels. Keep the center clear.
- **Primary tray:** previous neighborhood, available destination pictures, next neighborhood.
  All interactive areas are at least 56 CSS pixels. Reserve its measured footprint in framing;
  do not keep adding rows as content grows.
- **Secondary control:** the existing journal in its corner. No new permanent information panel.
- **Many moons:** show a small local page of moon pictures with explicit paging. Parent stays
  visible; a moon's visit returns to that same neighborhood. Prototype this only with enough
  fixtures to prove capacity, not a full moon catalogue.
- **Phone:** focused world above the compact tray; neighboring picture peeks are cues, not
  essential controls. **Tablet:** more world space, same interaction. **Short landscape:**
  shorter tray and off-center framing, with no top/bottom controls covering travel targets.
- **Availability:** distinguish playable, progression-locked and unbuilt destinations.
  Locked choices retain the prerequisite response. Unbuilt fixtures show a tool/construction
  symbol and an unavailable label, never a Fly action, completion badge or fake travel.
  Fixtures belong only in the isolated study until an intentional release decision.
- **Keyboard and muted audio:** native buttons with visible focus and descriptive names;
  Enter/Space activates. Optional arrow navigation must not steal keys from dialogs.
  Every action has visible feedback without narration. No new voice generation is required.

Proposed transitions:

```text
Map: Earth + Moon + Sun  <->  other planet neighborhoods
          | available pictured destination
          v
Existing scripted journey -> existing visit -> Space map
                                              |
                                   return to last neighborhood
```

## Implementation boundary

| Owner | Proposed responsibility |
| --- | --- |
| `src/map/model.ts` (new) | Neighborhood membership, paging and focus; stable destination IDs; no meshes or persistence writes |
| `src/map/ui.ts` (new) | Pictured controls, keyboard/pointer input and availability feedback |
| Existing camera/framing owners | Frame current neighborhood against tray bounds; arbitrate map transition vs launch/return |
| `DESTINATIONS` and existing progress | Source of launch eligibility, visits, discoveries and rewards |
| Existing catalogue/body builder | Actual body geometry and lifecycle; unchanged by prototype fixtures |

Keep UI `neighborhoodId` separate from any future physical moon-parent relation. The current
catalogue has no parent field, and naming a neighborhood must not silently change the Moon's
tidal lock or create Jupiter/Europa geometry. A launch cancels map motion before handing the
camera to flight. Suspension, dialogs and return cancel held gestures through the existing
lifecycle. No scene construction or full-photo loading when merely paging.

## Bounded delivery and acceptance

1. Build an isolated, data-driven navigation study with the existing five destinations plus
   unavailable fixtures for eight-planet scale, several moons and a dwarf-planet group.
   Compare the neighborhood approach with the current map using fresh full-resolution images.
2. Exercise concrete tasks: first Earth trip; choose Moon; discover and return; unlock Mars;
   browse to Saturn; inspect a future Jupiter/Europa neighborhood; return to Earth. Repeat
   using pointer, keyboard, muted sound and reduced motion. An unavailable choice must have
   immediate visible feedback and must never launch or mutate progress.
3. Capture phone (390 x 844), tablet (1024 x 768) and short landscape (844 x 390) at scale 1.
   Check 56px targets, no overlap, stable exits, focus after paging, resize and interruption.
   Compare fresh and progressed saves. Owner reviews one map screen at a time before rollout.
4. After selecting the design, integrate only map navigation with existing flight and visits.
   Unit checks cover paging/eligibility and camera handoff; run only affected browser files.
   Keep the previous map available during the prototype; integration stays independently
   revertible. Do not fork progress storage or ship placeholder destination IDs into saves.

Success means these tasks work without reading-only instructions or lost focus, with bounded
control space as fixture counts grow. AI/adult checks can establish behavior and layout;
child comprehension and physical-tablet comfort remain unverified, not implementation blockers.
If users miss paging or cannot find the previous world, revise the navigation cue or compare
the picture-catalogue fallback before integrating.

## Out of scope

New planet content, documentary assets, paid narration, mandatory linear progression,
manual-flight promotion, wholesale UI restyling, engine migration and generic orbital physics.
Once map navigation is accepted, pilot Jupiter; add a moon such as Europa after explicitly
designing parented geometry and gas-giant discovery capabilities.
