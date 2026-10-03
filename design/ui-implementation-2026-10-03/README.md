# Implemented UI review — 3 October 2026

The owner approved the prototype screenshots and authorized implementation and a push
to main. This directory compares the real game with `70b34e8`, captured from a detached
baseline worktree with its own `npm ci`. All PNGs use `deviceScaleFactor: 1`; none are
composited scene mockups. Open `index.html` through the development server for comparison.

Implemented: one equal-cell action row, stable Day & night/Stop geometry, supported
activities from arrival, three Sun controls, real world pictures, deliberate reading
panels, contained postcards, full journal data and thumbnails, and landscape/tablet
camera projection that reserves the row. CSS geometry has a single adventure owner.

Startup now offers retry for a failed or stalled module download, independent of the
game bundle. A late successful download can still complete startup. Offline navigation
only serves the game shell for real game routes, including its query experiments.

Checks cover typecheck, 344 unit tests, complete tablet/short-landscape journeys,
phone/tablet/landscape picture exits, day/night interruption and resize, keyboard focus,
failed/stalled startup recovery and installed offline adventure startup. Full deployment
checks run in GitHub Actions. Actual Android-tablet performance, speaker sound and child
comprehension remain unverified.

`capture.mjs` captures the current real game from `UI_REVIEW_URL` (default port 4186).
Use a `VITE_PLAYTEST=1` build; it reads snapshots but changes state only through input.
`capture-before-panels.mjs` captures the old expanded fact, postcard and journal from
`UI_BASELINE_URL` (default port 4185). Its other baseline screens are from the same
checkout's earlier capture. The isolated design study remains in the adjacent prototype
directory and is not the shipped game.
