# Space Ninja: product and engine review

Reviewed 23 September 2026. Recommendation: **selective reconstruction of the experience layer, retaining Three.js and proven subsystems.** Do not start a whole-game or engine rewrite on present evidence.

This is a decision review, not an implementation release. Existing project design choices were treated as revisable, as the owner explicitly requested. No gameplay source was changed. Recommendations below are proposals, not new permanent project constraints.

## What has gone wrong

The project has several competing answers to “what does the child do?” Guided travel and discovery, close-up globe exploration, manual space flight, and a unified hybrid all exist. Each contains useful work. They have different defaults, lifecycle implementations, UI assumptions and educational feedback. Switching assistants without a single accepted product contract and canonical working version makes local improvements accumulate across these competing products.

The immediate problem is broader than untidy code. A renderer can successfully display worlds while the child lacks a clear, rewarding reason to move between them. A cleaner engine alone will not solve that.

## Baselines inspected

`git worktree list` showed five registered checkouts. This review inspected the root and unified working copies most closely, sampled the Moon/space trial, and checked the status/history of the other two. HEADs do not include uncommitted changes.

| Location | Observed baseline | Significance |
| --- | --- | --- |
| Project root | `codex/session-lifecycle-audit`, `6015a93`, dirty | Guided adventure plus free-flight route; shared browser lifecycle; unfinished hardening and product changes |
| `.moon-trial` | `codex/moon-exploration-trial`, `f014d4a`, dirty | Explorer and space-playground work, including untracked source/assets; cannot recover this work from HEAD alone |
| `.unified-one-shot` | `codex/unified-solar-explorer-v2`, `2e27e72`, dirty | Shared solar-system scene plus embedded explorer; new `ExplorerVisit.ts` is untracked |
| Codex worktree `travel-hardening/SpaceNinja` | `749ab52`, clean when checked | Separate explorer travel fixes |
| Codex worktree `unified-solar-explorer/SpaceNinja` | `2e27e72`, clean when checked | Committed unified baseline, different from its dirty local continuation |

`.release-git` and release bundles also exist. Their history was not repaired or independently audited here. Live GitHub Pages revision could not be established: the web fetch failed and the shell could not connect to GitHub. Do not equate any local checkout with production without checking the deployed build ID.

**First implementation step:** preserve tracked AND untracked work in all variants, map production to a commit/build, and select one canonical checkout outside other checkouts' source/test trees. Archive comparison variants after preservation. Do not bulk-stage or delete nested directories. Make tests explicitly include the canonical `src` and `sw` trees. The earlier polish review already documented accidental nested-worktree test discovery.

## Findings that change the plan

### 1. Educational feedback disappears at the new route boundary

In `.unified-one-shot/src/main.ts`, `onArrive` creates `ExplorerVisit` and returns before classic arrival narration and mission setup. `ExplorerVisit.ts` offers movement, proximity and photographs but has no discovery-recording or narration integration. Its `moon/ui.ts` explicitly describes no automatic voices or changes to saved adventure progress. This is a concrete functional split, not just a visual preference.

Consequence: adding better facts, audio or rewards to the old route need not improve the new default. The next slice must connect action, observation, a short explanation and a remembered discovery through one shared content path. Reuse only narration whose words match the new activity.

### 2. “Flying” has incompatible meanings

The unified visit sets `ship.visible = false` and moves a camera through latitude/longitude state. The space-playground trial has explicit ship position, heading, banking, assistance and braking. Classic travel is scripted. These are different interaction designs, despite all being described as exploration or flight.

Decide and test the fantasy: **a child pilots a friendly ship, with optional help reaching interesting places.** This is the recommended hypothesis given the owner's concern and the earlier feedback recorded in `explorer-polish-plan.md`; it is not yet child-validated. Compare visible-ship steering with direct globe manipulation in the same outing. Keep the one children understand. Neither photorealism nor free-flight complexity is a success criterion.

### 3. A state-machine label does not yet control the runtime

`experience/ExperienceCoordinator.ts` checks state transitions, but `main.ts` still separately reads flight phases, home-return activity, day-turn activity, `cameraReturn` and explorer activity to decide who updates the camera. Changing the coordinator state does not itself acquire/release those controllers.

The unified route also unconditionally calls `stage.start()` when visibility returns and disposes on every `pagehide`. Root `session/lifecycle.ts` already handles terminal crashes and persisted history suspension. These older integration paths are visible in source; this review did not reproduce those failures in the browser.

Consequence: consolidate ownership, not just filenames. One accepted transition must stop the old controller, clear its input, transfer the pose and enable exactly one new controller. Browser suspension, dialogs and gameplay phases should be separate concerns with one policy for their interaction.

### 4. Existing tests protect valuable work, but do not select the product

The root includes tested input sampling/inertia, arrival geometry, surface attachment, occlusion, persistence, media and lifecycle behavior. These are assets to preserve. The unified coordinator's two tests cover transitions, not actual camera/lifecycle enforcement. Its default browser journey checks travel, Places, photos and return, but does not establish whether an unprompted child understands steering or learns from the visit.

Some tests encode design choices: exactly three targets and a final hidden target are assumptions of the guided hunt. Preserve geometry correctness while allowing those product assumptions to change. Do not make a new explorer imitate a checklist merely to satisfy old tests.

### 5. Documentation is no longer a reliable description of every version

The root README describes reveal gates, while the current root `main.ts` exposes every world and marks choices unlocked. The September 14 architecture review correctly describes its own baseline, but its lifecycle fixes are absent from the newer unified route. Historical success is not current integration evidence.

Use one short current product contract, one architecture map and one ordered implementation plan. Label historical reviews by baseline; stop appending competing “current” directions. A session handover should identify checkout, commit, dirty files, completed acceptance checks and the next bounded task.

## Proposed product contract

“I can take my spaceship somewhere interesting, make something happen, discover something real, and choose what to do next.”

Core outing: **choose or steer → travel with a visible response → notice an interesting feature → explore it → hear/see one real idea → keep an optional memory → wander or leave.**

Children aged 5+ should not need to read, complete a quota or master steering before getting something rewarding. Assistance is an action within the same game. All worlds can be available; the first invitation can still be focused. Discovery collection records curiosity rather than purchasing permission to continue.

Learning must sometimes come from an action: turning Earth changes daylight; comparing Earth and Moon shows a size difference in an explicit comparison view; flying around the Moon reveals the far side. A photograph and fact are useful, but should not carry the entire educational promise.

Distinguish scientific content from navigation staging. Compressed travel scale is acceptable. Do not imply that the playground's body sizes/distances are scientific measurements. Daylight demonstrations need coherent sunlight, regardless of any readability lighting used elsewhere. Saturn needs orbital/archive activities rather than a fictional solid surface. Retain real image provenance.

## Smallest architecture that supports it

Keep Vite, TypeScript, Three.js and accessible DOM overlays. There is no demonstrated renderer blocker that justifies paying for a migration. Do not introduce React, an ECS, a generic event bus, or a physics engine merely to tidy the project. Revisit physics only if actual gameplay exceeds the simple safety/assistance model.

| Owner | Responsibility and boundary |
| --- | --- |
| Session lifetime | Boot, pause, resume, crash, disposal; adapt the tested root lifecycle |
| Experience controller | Current world/visit/activity and accepted actions; transitions produce explicit effects |
| Movement model | Serializable ship/visit state and time-based movement; no DOM or mesh-owned game rules |
| Camera director | Sole writer of the camera; consumes poses from travel, steering, orbit and activity controllers |
| World renderer | Existing Stage, bodies, materials, ship and effects; displays model state, owns GPU resources |
| Content and discovery | Stable IDs, real coordinates, explicit ring/archive capabilities, media/narration keys and provenance |
| UI and media | One contextual HUD, photo/journal/settings components, input intents, cancelable media work |
| Persistence | Separate adventure memories and settings; deliberate ID migration, especially lunar IDs |

Keep mathematical scene transforms in rendering; moving every vector calculation out of Three.js would add work without improving ownership. Start with narrow functions/interfaces. Extract components only as the first slice needs them.

Gameplay phases can be `SYSTEM → TRAVEL → EXPLORE → RETURN`, with an activity inside exploration. Session status (`running/paused/crashed/disposed`) and overlay status are orthogonal. A modal or background event must release held input and deliberately pause/cancel navigation. A crash cannot restart through a visibility event. Reduced motion replaces automated sweeping travel with a cut; direct input still needs responsive behavior.

## Repair versus rebuild decision

| Option | Assessment |
| --- | --- |
| Continue small patches across current variants | Lowest immediate effort, highest likelihood of repeating the current drift; reject |
| Consolidate and reconstruct the experience layer | Reuses proven geometry/assets and fixes the main ownership/product split; recommended |
| Rewrite everything or change engines | Recreates solved bugs and still leaves the play concept unanswered; unsupported now |

**Confidence:** high that changing the rendering engine is currently unjustified; moderate that the proposed visible-ship outing is the best product direction until children try it. The strongest counterargument is that carrying both old and new orchestration forward could cost more than a clean application shell. Address that by writing a small new experience owner around retained modules, not by merging every historical route into it.

A full rebuild becomes reasonable only if a bounded prototype demonstrates a blocking platform/performance problem, or implementing the agreed outing requires replacing most retained systems even after explicit ownership boundaries. Compare that evidence and migration cost before committing. File length or assistant disagreement is not sufficient evidence.

## Delivery gates, in order

1. **Establish the baseline.** Preserve variants, identify production, choose one checkout, isolate test discovery, record versions and known failures. Exit: another assistant can build the intended game without guessing.
2. **Prove one outing.** Earth and Moon only for development scope; one visible ship, one movement scheme, optional destination help, stop/recovery, one real discovery with matching narration/photo, optional memory and a clear return. Reuse existing assets. Build camera/lifecycle ownership as part of this slice. Exit: the outing works end to end; no expansion yet.
3. **Observe on the actual tablet.** Watch a five-minute session without teaching controls. Record first purposeful action, successful stop, reaching something interesting, photo exit, changing destination, adult interventions, spontaneous return and what the child can point out/explain afterward. Try the alternative movement scheme only if needed. Observe more than one session/child where possible; one success is weak evidence.
4. **Consolidate proven behavior.** Complete content IDs/media/persistence, remove duplicate runtime ownership, port lifecycle regression tests, and add Mars/Saturn through capabilities. Restore day/night as an interruptible educational activity after the core outing works.
5. **Harden and ship.** Typecheck/unit tests plus real-pointer browser flows at phone/tablet/short landscape, inspected screenshots, offline/update behavior, missing media, repeated visits, sleep/wake and context loss. Measure native tablet frame times, loading and resource growth separately from software-WebGL tests.

Provisional engineering targets for the tablet slice: visible action feedback by the next rendered frame; sustained approximately 30 fps or better after warm-up; no continuing movement after release beyond the intended short braking; no monotonic retained-resource growth across ten round trips. Measure uncapped wall-clock frame timing, including slow frames. These are initial budgets to validate on the actual device, not measurements from this review.

## Efficient model workflow

Use **Astra / High** for a bounded architecture decision like this and a later milestone review. Use **Sol / Medium** for well-scoped implementation; use **Sol / High** for camera/state integration or difficult failures. These settings are my task-specific recommendation, not a guarantee or an OpenAI-mandated configuration. Avoid defaulting to maximum effort or several simultaneous model audits.

Official documentation describes Astra as the most capable model and Sol as the balance of intelligence and cost. API list prices differ by 5× for their standard input/output tokens, but that is **not** a promise of 5× Codex subscription allowance: effort, context, output and account metering also matter. Sources checked 23 September 2026: [model comparison](https://developers.openai.com/api/docs/models/compare), [model selection](https://developers.openai.com/api/docs/guides/model-selection).

For a second opinion, give another model the handover prompt and evidence, and ask it to challenge the three highest-risk decisions. Do not pay it to invent a second full plan. No comparative Claude/Gemini superiority claim was established in this review. A model with repository, terminal and screenshot access is more useful here than a text-only opinion on the README.

## Verification scope

- Root scoped unit suite: **24 files, 276 tests passed**; nested worktrees explicitly excluded.
- Unified working-copy unit suite: **27 files, 284 tests passed**.
- Both typecheck commands completed without diagnostics before their respective initial unit runs. Unit startup initially hit a sandbox process restriction; permitted reruns succeeded.
- Fresh unified tablet browser journey: **1 passed** (Mars visit, Places, photograph, return, Saturn visit, return and portrait resize). The isolated playtest build succeeded. Inspected its system, Mars, photo and Saturn screenshots. The worlds and archive photo are visually substantial; close exploration has no visible ship, and the sparse HUD relies on small icons and words. Images were rasterised at half resolution, so they support composition findings rather than native-device sharpness claims. Screenshots: `.unified-one-shot/test-results-review-20260923/explorer.pw.ts-default-rou-6a492--explorer-controls-and-back-tablet/`. This test selects named controls; it does not exercise or validate the steering feel.
- No physical Android performance, speaker listening, child comprehension, enjoyment, production deployment identity or exhaustive cross-variant diff was verified. This is sufficient to recommend the next investment, not to certify a release.

