# Explorer rollout and tablet trial

The default route opens the four-world chooser. `?moontrial` starts with the Moon selected;
`?classic` retains the earlier adventure and its saved progress; `?freeflight` retains the
solar-system manual-flight experiment. All four existing destinations and all 24 authored
places remain reachable. The new explorer does not modify adventure storage or start voice.

## Observable tablet questions

The local space playground adds **Fly into space** to the chooser and **Space** to world
exploration. Hold near the centre to fly ahead, slide to turn, and lift to brake. Tap a world
picture for assisted travel, then Explore when nearby. Touch the scene to cancel assistance;
Stop here and Worlds also remain available. Arrow keys steer with a keyboard.

Start the next child test here: can the child wander, stop, recognise the rocket's nose,
ask for help reaching a world and return to space? Watch for repeated accidental circles,
failure to notice the Explore invitation, or treating the world pictures as mandatory tasks.
The four-world arrangement compresses distances and sizes for play. Rocks are harmless scenery.
Reduced motion cuts assisted trips and removes banking; direct steering remains available.

1. Does the first hold immediately look like movement? Can a child steer toward something
   interesting and stop by lifting their finger, without adult instructions?
2. Does the little craft clarify movement, or would direct globe dragging be easier? Compare
   the two controls in grown-up settings with the same child and world.
3. Can the child choose another world, open Places, open a mission image, and get back?
4. Is Saturn's orbit understandable as clouds and rings rather than a landable surface?
5. Do a ten-minute session, rotation, sleep/wake, browser-back restoration and an offline
   relaunch work on the older Android tablet without heat, stutter or memory reloads?

Use the same Wi-Fi as the development machine and Vite's printed Network URL. `localhost`
on the tablet refers to the tablet, not the development computer. For offline installation,
use the HTTPS Pages version after the authorized main push, or another secure local setup.

## Known limits

### Local space-playground verification — 21 September

Typecheck, 282 unit tests and the production build pass. The explorer, Moon trial and new
space suites pass 21 browser cases across phone, tablet and short landscape. Coverage includes
real touch steering/braking, assistance and interruption, reduced-motion cuts, arrival into
world exploration, photos, modal pause, resize, history suspension and world-load failures.
Space, Moon arrival and rocket screenshots were inspected; representative images are saved
in `design/space-playground-2026-09-21/`. The suite renders at half resolution and is not a
tablet performance benchmark. The classic adventure suite and production offline script
were not rerun for this change; no service-worker logic or classic code was changed.

Browser touch emulation checks pointer handling and responsive layout, but cannot establish
finger comfort, child comprehension, physical tablet frame rate, battery use or browser
gesture conflicts. These remain unverified until observed on the target device.

The globe has finite map resolution and illustrative lighting. The ship and camera are play
tools, not a physical flight simulator. The Moon has real relief shading but no detailed 3D
surface traversal. Close-up detail comes from lazy mission images. Saturn's body map is a
reconstruction, as credited; its Cassini archive views include composites, infrared and
false-colour products with descriptive captions.

## Undo

The annotated tag `pre-explorer-2026-09-21` records the GitHub main commit before this change.
The rollout is one commit, so `git revert <explorer-commit>` followed by `git push origin main`
undoes it without force-pushing. See the delivery message for the exact commit hash.
The classic route is also available immediately without changing Git.
