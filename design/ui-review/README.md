# Contextual controls review — 3 October 2026

These are unshipped screenshots from the real Three.js game, using the low quality tier
and reduced-motion preference. The native screenshots use a pixel ratio of 1. The baseline
phone screenshot uses a ratio of 0.5, with the same 390 × 844 CSS viewport.

| State | Phone, 390 × 844 | Tablet, 1024 × 768 |
| --- | --- | --- |
| Arrival | [Phone](after/phone-earth.png) | [Tablet](after/tablet-earth.png) |
| Day/night running | [Phone](after/phone-day-night.png) | [Tablet](after/tablet-day-night.png) |
| Words requested | [Phone](after/phone-words.png) | [Tablet](after/tablet-words.png) |

[Previous phone controls](before/phone-earth.png)

Additional arrival views: [844 × 390 landscape](layouts/landscape-earth.png) and
[319 × 561 narrow phone](layouts/narrow-earth.png). Short landscape uses a single
counter/caption band to keep the upper discovery marker clear.

The contextual row has readable Journal / Fly Home / Day & night labels and 64px-high
buttons. Both visible arrival markers clear the compact dock. The day turn replaces the
hunt prompt with a day/night legend, and the same activity button exposes Stop. Opening
words keeps the control row anchored; the expanded card temporarily covers the lower
globe and can be folded again through Hide words. The resting globe no longer animates.

Playwright additionally captures phone, tablet, short landscape, 319 × 561 and 640 × 360
layouts in its report, with control bounds and camera/surface restoration checks.

This review establishes rendered layout and interaction behavior. Still to observe on the
target tablet: touch comfort, sustained performance, narration on its speaker, and whether
a child independently discovers the day/night activity and understands the light change.
