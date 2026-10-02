# Child feedback iteration — 3 October 2026

These screenshots come from the real game through ordinary browser input at the supported
low graphics tier. CSS viewports are 390 × 844 (phone), 1024 × 768 (tablet), and
844 × 390 (short landscape), rasterized at half resolution for software WebGL.

| State | Phone | Tablet | Short landscape |
| --- | --- | --- | --- |
| Space map, including Sun | [View](phone/space-map.png) | [View](tablet/space-map.png) | [View](short-landscape/space-map.png) |
| Discovery with pictured exit | [View](phone/discovery-picture-exit.png) | [View](tablet/discovery-picture-exit.png) | [View](short-landscape/discovery-picture-exit.png) |
| Pictured return to map | [View](phone/moon-space-map-exit.png) | [View](tablet/moon-space-map-exit.png) | [View](short-landscape/moon-space-map-exit.png) |
| Sun arrival | [View](phone/sun-visit.png) | [View](tablet/sun-visit.png) | [View](short-landscape/sun-visit.png) |

Additional checks: [319 × 561 discovery postcard](phone/narrow-discovery-picture-exit.png)
and [Sun after rotating to 640 × 360](phone/sun-resized-landscape.png).

The discovery exit uses a large arrow with the visited world's picture; the same picture
also returns from a reopened photograph. The X is 68px. The primary pictured exit stays
84px high, including short landscape. Journal photographs use a book-return picture.
The contrasting map button shows an arrow with the Sun, Earth and Moon. It keeps its
position throughout each visit. Sun visits reuse flight, camera, audio and reset ownership;
their texture is illustrative and they do not invent collectible surface locations.

Automated checks cover exit and content bounds, focus, Android compatibility-click guard,
Sun travel and return, progress preservation, resizing and onward travel to Earth. The
existing browser suite covers every planet and day/night and manual-flight regressions.
Screenshot review establishes layout. Further child observation should check whether the
child recognizes both exits without reading or adult prompting. Physical tablet touch,
performance and the new narration on its speaker remain to be checked.
