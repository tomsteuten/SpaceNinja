# Default map framing study — 12 October 2026

Question: should the default map adopt the neighborhood study's framing
(`neighborhoodBounds()` in `src/map/framing.ts`, fitted between the measured top hint and
destination bar) instead of today's fixed, Earth-centred `framingRadiusFor()` shot?

Each image is a side-by-side pair captured at device scale 1 with software WebGL:
**left = current framing, right = study framing**. "Fresh" is a new save (Earth and Moon);
"progressed" has the Moon and Mars visited, so every world is drawn. The study framing was a
temporary, uncommitted `?mapframing` patch to `src/main.ts`; it excluded the Sun, which is a
destination but not a drawn map body. `tablet-progressed-after-20s.png` shows the right-hand
shot after the worlds had orbited for 20 seconds.

| Viewport | Fresh save | Progressed |
| --- | --- | --- |
| Phone 390 × 844 | Earth about 1.4× larger; Moon nearly touches the right edge | About 1.2× larger, sits higher |
| Tablet 1024 × 768 | Earth about 1.25× larger | About 1.15× larger; Saturn's rings read as rings |
| Short landscape 844 × 390 | Same size, higher | Smaller: the measured band is very short |

## Recommendation (not adopted)

Keep the current default framing for now. The study framing does not fix the real scaling
problem (Saturn still overlaps Earth whenever every world shares one scene). It is worse in
short landscape, and it would change behavior: the camera follows orbiting worlds instead of
staying fixed on Earth, and re-framing every frame overrides a child's map pinch-zoom.

Adopt it with paging, when a second neighborhood (Jupiter) gives each page only its own
worlds to frame. A smaller optional change could enlarge the first-run Earth & Moon shot on
phone and tablet while keeping the fixed camera; that needs its own screenshots and approval.
