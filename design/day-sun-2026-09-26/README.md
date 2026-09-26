# Day and night: visible Sun

`before-*.png` show GitHub main `b78112e` before the visual change. They were captured from
the isolated worktree's untouched baseline build before building the implementation.
`after-*.png` show the new composition. All captures use deviceScaleFactor 1, touch, reduced
motion, seeded discovery selection, medium-quality hardware hints, and roughly 20% of the
surface turn. The browser pauses rendering before capture; JSON records the read-only scene
snapshot. The Moon's position can vary with real loading/render time.

Viewports: phone 390×844, tablet 1024×768, short landscape 844×390. No image is a cropped or
rescaled substitute for a device screenshot. Software WebGL captures cannot establish Android
tablet performance or whether a child understands the lesson.

To reproduce, set `VITE_PLAYTEST=1`, run `npm run build:playtest`, then
`npm run preview:playtest` in another terminal. Run `node scripts/capture-day-turn.mjs after`.
Use `SPACE_NINJA_CAPTURE_URL` to override port 4180 or `SPACE_NINJA_CHROMIUM` for an installed
browser executable. The normal production build has no scene snapshot.
