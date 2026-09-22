# Explorer rollout and tablet trial

The default route opens on the solar system. A world is chosen by touching it or its button;
the ship flies there, the camera descends, and the child flies over the world. `?classic`
retains the earlier adventure (sharing saved progress); `?freeflight` retains the manual-flight
experiment. All four destinations and all 24 authored places remain reachable.

## Observable tablet questions

1. Does the solar system read as "out in space" rather than a menu? Does a child touch a world
   (or its button) without being told, and does the flight feel like going somewhere?
2. Does the descent read as arriving, and does the first hold immediately look like movement?
   Can a child steer toward something and stop by lifting their finger, without instructions?
3. Are the place pictures understood as places to fly to? Does a child aim for one, notice it
   is found (the tick, the card, the voice), and open its photograph?
4. Is the journal understood as "my places"? Does a child go back to a world to fill a page?
5. Can the child always get back to the solar system, and fly somewhere else?
6. Is Saturn's orbit understandable as clouds and rings rather than a landable surface?
7. Do a ten-minute session, rotation, sleep/wake, browser-back restoration and an offline
   relaunch work on the older Android tablet without heat, stutter or memory reloads? Note how
   soft Earth and Mars look when flying low — the maps are 2048 px (see AGENTS.md).

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

The annotated tag `pre-explorer-2026-09-21` and the branch `rollback/explorer-2026-09-21`
record `main` before the explorer. Each change since is an ordinary commit, so
`git revert <commit>` followed by a normal push undoes it without rewriting history. The
classic route is also available immediately without changing Git.
