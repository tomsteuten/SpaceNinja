# Review of Sol's Earth-to-Moon outing — 23 September 2026

## Verdict

Keep this implementation as the canonical prototype. It follows the selective reconstruction direction and makes a complete, small outing possible. Do not expand it or treat it as a release-ready foundation until the interaction-boundary defects below are fixed. No new engine or broad rewrite is warranted.

Compared the current files against `.preservation/2026-09-23-before-reconstruction/root.zip`, not merely Git HEAD. Sol modified the root route, flight-body capabilities, one flight test, test selection, README and ignore file; it added the outing, camera director, scoped Vitest config, browser outing and handover. Earlier dirty media/UI hardening was not Sol's change. The archive contains the earlier working files.

## Findings

1. **P2 — Opening Memory does not suspend flight.** `src/experience/outing.ts:124-133` clears pointer input but leaves autopilot and speed active. The frame loop continues `flight.update` while the photo is modal. On a later session, start Moon assistance and open Memory: the ship can travel and arrive behind the photograph. Cancel/pause movement before opening, including while loading; define explicit resume behavior after dismissal. This should be a transition owned by the outing, not inferred from the DOM.

2. **P2 — Escape from a discovery photo also flies home.** `src/experience/outing.ts:224-226` handles Escape at window level without checking `event.defaultPrevented`. The existing photo dialog handles Escape first, prevents default and hides itself, but allows the event to bubble. The window handler then sees a closed photo and executes `flyHome()`. One key closes two interaction levels and unexpectedly ends the visit. Respect the already-handled event, or stop its propagation at the owning dialog; add a check that the first Escape closes only the photo.

3. **P2 — Reduced-motion users still receive the full automatic flight.** The help handler (`src/experience/outing.ts:217`) always engages normal autopilot. `cameraDirector.ts` uses reduced motion to remove positional easing; it still follows the entire automated journey. The outing suppresses exhaust but never replaces the assisted camera move with a cut. Preserve direct user-controlled flight, and use an immediate safe arrival for the optional automatic journey when reduced motion is requested.

4. **P2 — An update can restart a paused outing.** `src/experience/outing.ts:254` considers any stopped flight a safe time to reload. This includes a child pressing Stop midway to the Moon, arriving at its hover point, or looking at a memory while stopped. On a later installed session with a service-worker controller, a worker takeover can therefore reset the outing to Earth. Gate reload on an explicit untouched entry state, or defer it for this entire route; speed zero is not a title-screen predicate.

## Validation gap

The normal Playwright command now selects only `outing.pw.ts`. That test covers the successful journey but does not exercise modal flight suspension, Escape ownership, the meaning of reduced motion, background/crash integration or active-play update protection. `PLAYWRIGHT_LEGACY=1` is not a working replacement: older tests still navigate to `/` and expect controls such as Start playing that the new default no longer has. Retain/adapt shared lifecycle and offline checks for the outing; route genuinely classic-specific tests to `?classic`. Do not rerun every old layout test merely to preserve historical markup.

## Product assessment

The saved tablet screenshots show a recognisable ship between Earth and Moon, generous button areas, a clear gold target and a real photographic reward. The narration text matches the bundled Tycho cue, and the same discovery ID is persisted. Camera pose writes are centralized, and the tested session lifecycle is used.

The prototype still switches from piloting into a static Moon view, hides the ship, and accepts only the single target tap there. Instructions before discovery are written hints with emoji rather than an animated demonstration or spoken guidance. That is an acceptable bounded experiment, but it does not yet establish an enjoyable, independent exploration loop for a pre-reader. The next product question is whether children understand and enjoy this outing, not whether more worlds can be added.

## Checks

Fresh typecheck and all **277 unit tests in 24 files passed**. Inspected Sol's saved tablet ready, Moon target, discovered and return screenshots. These are half-resolution software-WebGL captures, not measurements of the target tablet. Additional targeted browser evidence is recorded after its run completes. No gameplay source was modified during this review; diagnostic scripts and captures are under `test-results/review-20260923/`.

## Next handoff

Keep the current architecture and scope. Fix the four interaction-boundary defects above and add focused regression coverage. Adapt the shared lifecycle/offline browser checks to the new default without reintroducing the old product flow. Recheck phone/tablet/short-landscape screenshots, then conduct the five-minute tablet observation. Do not add worlds, rebuild the engine, expand progression or deploy as part of those corrections.
