# Explorer rollout and tablet trial

The default route opens the four-world chooser. `?moontrial` starts with the Moon selected;
`?classic` retains the earlier adventure and its saved progress; `?freeflight` retains the
solar-system manual-flight experiment. All four existing destinations and all 24 authored
places remain reachable. The new explorer does not modify adventure storage or start voice.

## Observable tablet questions

1. Does the first hold immediately look like movement? Can a child steer toward something
   interesting and stop by lifting their finger, without adult instructions?
2. Does the little craft clarify movement, or would direct globe dragging be easier? Compare
   the two controls in grown-up settings with the same child and world.
3. Can the child choose another world, open Places, open a mission image, and get back?
   When they pick a world, does flying there — the body shrinking away, the stars streaking,
   the next world growing in — read as travelling through space rather than a menu swap, and
   is the ~1.7s hop the right length (not so long it drags, not so quick it is missed)?
4. Is Saturn's orbit understandable as clouds and rings rather than a landable surface?
5. Do a ten-minute session, rotation, sleep/wake, browser-back restoration and an offline
   relaunch work on the older Android tablet without heat, stutter or memory reloads?

Use the same Wi-Fi as the development machine and Vite's printed Network URL. `localhost`
on the tablet refers to the tablet, not the development computer. For offline installation,
use the HTTPS Pages version after the authorized main push, or another secure local setup.

## Known limits

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
