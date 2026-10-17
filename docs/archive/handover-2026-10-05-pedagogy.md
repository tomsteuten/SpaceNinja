# Handover — child-test feedback and a pedagogy review (5 October 2026)

Recommended session: **Opus 4.8**, start in **Plan mode**, extended thinking on. The core
task is a product-direction decision plus early-childhood pedagogy judgment, not a mechanical
fix. The two mechanical jobs below (Sun voice, button restyle) are fine on Sonnet 5.5 if
credits are tight; keep Opus for the structure and day/night decisions.

## Read first

- `AGENTS.md` — product north star, the rule-strength hierarchy (product constraints vs
  correctness invariants vs design choices vs experiments), and the verification norms.
  Visual quality is the owner's call: send full-resolution before/after screenshots on
  phone, tablet and short landscape and wait for approval. Never self-approve appearance.
- `docs/current-implementation.md` and `docs/decision-history.md` — current state and why
  past choices were made, including the three most recent small passes (finale/journal/Sun
  hint/splash; then emphasis-follows-task, smaller parked ship, shorter hunt line).
- The target device is an older Android tablet; the audience is roughly ages 5 to 8.

## The child test (one session, one child, with the owner present)

1. **The child rushed.** He tapped through fast rather than engaging with content. The owner
   is reconsidering the "free and open" style and whether the game should be more linear.
   This is an open question to investigate, NOT a decided direction.
2. **Narration is good**, except the Sun arrival, which reverts to the older voice model.
3. **Layout is mostly good**, but the Space map button needs to be clearer, and all the
   buttons look poor aesthetically.
4. **Day and night was not discovered without adult intervention.** This has been an ongoing
   problem. The Earth day/night cycle was one of the original primary educational aims, so
   this is the most important failure to solve.

## How to think about it (the brief the owner asked for)

Consider the feedback and the current state through child psychology and best practice for
educational-yet-enjoyable children's games. Some anchors, not conclusions:

- **Guided play beats both free play and direct instruction** for early-learning outcomes
  (Weisberg, Hirsh-Pasek & Golinkoff; Zosh et al. meta-analyses). The implication is not
  "go linear" but "guide more, especially early, while preserving child agency."
- **Rushing is normal novelty-seeking**, not failure. The remedy is to make the valuable
  moments reward a beat of attention with satisfying contingent feedback, and to channel
  exploratory energy with a light goal gradient, rather than to punish speed.
- **Pre-readers map actions to objects, not to abstract dock icons** ("show, don't tell").
  A labelled half-circle button is a weak affordance for "turn the Earth."
- **Self-determination theory**: keep autonomy (choose which world), add competence signals
  (clear progress, earned "you did it" beats) and gentle structure so the child feels pulled
  forward rather than lost.
- Good children's apps (Sago Mini, Toca Boca) tend to use a loose onboarding structure early,
  then open up: progressive disclosure, not a rail.

Deliverable for the structure question: a **plan** weighing a guided spine versus the current
free-roam, with a concrete recommendation, before writing code. A likely shape worth
evaluating: a sequenced first flight (land on Earth, day/night as the hero moment, then the
map opens), with later sessions more open. Do not lock this in without owner approval.

## Concrete tasks

### 1. Day and night discoverability (highest priority, educational core)
Current behaviour: it is an opt-in dock control ("Day & night", abstract half-circle icon).
The first Earth visit auto-plays one turn (`earthDayNightPrompt`, set in `src/main.ts` around
lines 358-389 from `firstVisit && config.spin.intro && config.spin.invite`), but a rushing
child taps straight through it, and afterward it is only reachable via the ignored button.
The coach can invite it on idle (`shouldInviteSpin`, `SPIN_INVITE_DELAY` in `src/ui/coach.ts`).

Directions to evaluate (plan first):
- Make the **globe itself the control**: tap or drag the planet and the terminator visibly
  sweeps. The interactive object becomes the planet, not a dock button.
- **Fold day/night into a goal.** The "Night Side / city lights" Earth discovery already
  requires night (`earth-nightside` in `src/config.ts`); route the child into turning the
  Earth to reach it, putting the mechanic on the critical path.
- Keep it forgiving and interruptible per the AGENTS invariant (no long uninterruptible
  intro, Space map always available, reduced-motion handling intact).
Relevant code: `src/scene/DayTurn.ts`, `src/scene/TeachingSun.ts`, day-turn wiring and
`earthDayNightPrompt` in `src/main.ts`, the spin button in `src/ui/ui.ts`, captions/cues in
`src/config.ts` and `src/audio/narration-script.json`.

### 2. Structure vs free-roam (plan, then owner decision)
Investigate the rushing problem as a design question. Produce the plan described above.
Preserve the correctness invariants in AGENTS.md whatever the structure. Reversible,
measurable experiments are preferred over a one-way rewrite.

### 3. Sun narration voice (small, needs the ElevenLabs key)
The Sun arrival cue is a deliberate Kokoro `bf_emma` placeholder; the rest is ElevenLabs
Emma. Fix:
```
node --env-file=.env scripts/generate-narration-elevenlabs.mjs --only=arrival-sun --force
```
(needs `ELEVENLABS_API_KEY`). Then remove the `arrival-sun` entry from
`src/audio/recordings/provenance.json` `exceptions`, and update the `disclosure` string to
drop the "except the Sun arrival" clause. The generator only spends credits on real changes.
This needs the owner's API key, so it belongs to the owner or a session given the key.

### 4. Button and Space map aesthetics (taste work, owner approval required)
Buttons live in `src/ui/adventure.css` (`.visit-actions > .btn`, `.destination-choice`,
`.home-btn`) with icons in `src/ui/icons.ts`. Direction:
- One cohesive system: single corner radius, one filled-icon family, consistent weight,
  enough soft depth that controls read as pressable.
- **Space map is the child's escape route**, so make it the most recognisable, most distinct
  control. Its current icon (back arrow plus tiny planets) is abstract; a clearer single
  metaphor plus the word as reinforcement would help a pre-reader.
- Send full-resolution before/after screenshots on phone, tablet and short landscape and
  wait for owner approval before anything ships. Do not self-assess appearance.

## Verification norms (from AGENTS.md)
- Every change: `npm run typecheck && npm test` (seconds).
- UI/gameplay/layout change: run only the affected Playwright file(s) and viewport(s), e.g.
  `npx playwright test e2e/earth-day.pw.ts --project=phone`. Do not run the full suite
  locally. In this environment set `SPACE_NINJA_CHROMIUM=/opt/pw-browsers/chromium`.
- The deploy workflow runs the full unit and browser suites and gates the GitHub Pages
  deploy from `main`, so the live site is safe.
- Branch and push per the repo's workflow; do not push to `main` without explicit owner
  approval.

## Environment notes for this cloud container
- `vite preview` was unreliable when backgrounded here (exited immediately). A plain static
  server over `dist-playtest` worked for captures: build with `VITE_PLAYTEST=1 npm run
  build:playtest`, then `python3 -m http.server 4180 --bind 127.0.0.1` from `dist-playtest`.
- `npx playwright test` manages its own server fine; free port 4180 first.
- Capture scripts: Playwright's bundled Chromium is absent; launch with
  `executablePath: '/opt/pw-browsers/chromium'` and the swiftshader GL args used in
  `playwright.config.ts`. Full-res captures use `deviceScaleFactor: 1`.
