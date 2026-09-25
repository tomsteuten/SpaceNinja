# Handover, 25 September 2026: one ElevenLabs voice, and the words the game was missing

Paste the block below as the opening prompt of a fresh session started **after** the
environment has `ELEVENLABS_API_KEY` set and `api.elevenlabs.io` in its allowed domains
(cloud environment menu in the session title bar, then Edit). A mid-weight model is enough:
the words are written and tested, the pipeline is a plain fetch, and the wiring is specified
moment by moment below. Suggested thinking level: medium.

---

You are continuing Space Ninja, a Vite + TypeScript + Three.js space explorer for children
aged 5 to 8 on an older Android tablet. Branch from `main`, which is green and deployed.

Read first, in this order: `AGENTS.md` (the testing rules are binding), the "Status and
direction" section at the top of `docs/current-implementation.md` (especially "The spoken
layer" and its table), and `src/audio/recordings/README.md`. Do not add planning documents;
update the status section in place.

**What exists.** `src/audio/narration-script.json` is the one narration manifest: a stable cue
id, its spoken text, and the filename is the id (`<cue>.mp3` in `src/audio/recordings/`).
The test `src/audio/narration-script.test.ts` pins the full set of 75 cues and the register;
keep it green. The recordings folder holds an older Kokoro pack for about 48 of the cues;
the rest are silent today, because the game only auto-plays a cue that has a recording
(`src/audio/narration.ts`; see AGENTS.md "Audio and persistence"). Recordings stay under
`src/audio/recordings/`, never `public/`: Vite fingerprints them and the service worker
precaches them, which is what makes the voice work offline. Do not build a second audio
system, a second manifest, or call ElevenLabs from the browser.

**The key.** Read it only from `process.env.ELEVENLABS_API_KEY`. Never print it, log it,
write it to a file, or put it in a commit, a prompt or a test. Check it is present with
`test -n "$ELEVENLABS_API_KEY"`. Add `.env` to `.gitignore`; on a laptop the owner runs the
generator with Node's `--env-file=.env`, so no dotenv dependency.

## Step 1: help the owner choose a voice, by ear, then stop

The owner has not chosen a voice or settings. You cannot judge audio; the owner listens on
the tablet speaker. So:

1. `GET https://api.elevenlabs.io/v1/voices` with the `xi-api-key` header. List the voices
   with their labels (accent, age, gender, use case, description). Prefer candidates whose
   labels say narration or storytelling, warm or friendly, and an Australian or British
   English accent (the child is Australian; the old pack used British as the nearest
   available). Pick four to six candidates, and say why each is on the list from its labels
   alone.
2. `GET https://api.elevenlabs.io/v1/models` and pick the highest-quality current model that
   supports the language (today that is the multilingual v2 family; say which you used).
3. For each candidate, generate the same two lines into a scratch folder that is **not**
   committed (`design/voice-samples-2026-09-25/`, add it to `.gitignore`):
   `find-moon` ("Now, can you find the three gold places? Tap each one you see.") and
   `discovery-moon-tycho`. Use `POST /v1/text-to-speech/<voice_id>?output_format=mp3_44100_64`
   with `voice_settings` `{ stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true }`
   and, if the model accepts it, `speed: 0.92`, since these are for a five-year-old. That is
   about 1,000 characters per candidate.
4. Send the owner the sample files and a short table (voice name, id, labels, the settings
   used). **Stop and wait for the owner's choice.** Never call a voice warm or good yourself.

## Step 2: the generator

Write `scripts/generate-narration-elevenlabs.mjs`, a sibling of the existing
`scripts/generate-narration.mjs` (the OpenAI path, plain `fetch`, keep it) and
`scripts/generate-narration-kokoro.mjs` (keep it too, rename its npm script to
`narration:generate:kokoro`). Point `npm run narration:generate` at the new one. It must:

- Read the manifest, and an `elevenlabs` block you add to it beside the `kokoro` block:
  `{ voiceId, voiceName, model, outputFormat, voiceSettings }`, filled with the owner's choice.
- Keep a text-hash cache at `src/audio/recordings/manifest.json`: for each cue, the SHA-256 of
  `voiceId + model + JSON(voiceSettings) + text`. Regenerate a cue only when its file is missing
  or its hash differs; `--force` regenerates everything; `--only=<cue>` one cue. Print
  `kept`/`wrote` per cue and a total of characters sent, so credits are visible.
- Write the MP3s as they come (the API returns MP3 directly at that output format; no ffmpeg).
- Write `src/audio/recordings/provenance.json` with `kind: "ai"`, `provider: "ElevenLabs"`, the
  voice name and id, the model, and a `disclosure` sentence such as "The included narration
  uses the ElevenLabs AI voice <name>." That sentence is shown in the grown-ups panel
  (`src/ui/grownups.ts` reads `narrator.recordingDisclosure`), so it must be true.
- Fail loudly on a non-2xx response with the cue id and status, and never leave a half-written
  file (write to a temp name and rename).
- Never write the key anywhere. Never fetch from the browser bundle.

Then regenerate the **whole** pack with `--force` in the chosen voice, delete any Kokoro MP3
that no longer matches a cue (the test catches strays), update `src/audio/recordings/README.md`
(Kokoro is no longer the shipped path; document the new script, the cache, `--force`,
`--only`, and `--env-file`), and update the "Commands" list in `AGENTS.md` if the script
names changed. Commit the MP3s: they are the product.

## Step 3: wire the cues that have no moment yet

The table "The spoken layer" in `docs/current-implementation.md` says where every cue plays.
Speak through `ui.speakGuide(text, cueId)` (`src/ui/ui.ts`), which waits behind whatever is
being read and only auto-plays a recorded cue. Texts come from the manifest: add a tiny
loader (`src/audio/script.ts`) that imports the JSON and exports `cueText(id)`, so the words
live once. Specifics:

- **Map arrival** (`showOpeningHints` in `src/main.ts`): brand-new save (`visited` empty) →
  `home-first`; a newly revealed world → `revealed-<id>`; landing from Fly Home otherwise →
  `fly-home`; any other map → `home-<suggested>` or `home-any`. Once per map visit. On mobile
  the audio context needs a gesture: make sure `narrator.resume()` runs on the grown-ups
  "Start playing" press and on the first pointerdown, and if a cue is attempted before any
  gesture, let it fail silently; the nudge will repeat it.
- **Map nudges**: a map idle timer in the frame loop while `flight.phase === 'idle'` and no
  return is running, reset by `onAnyPress` and by `applySuggestion`; 8 s →
  `home-nudge-<suggested>`, 16 s → `home-nudge-short-<suggested>`, then nothing more.
- **Locked press**: in `launch()`'s locked branch, `locked-<id>`.
- **Arrival nudges**: from `idleFor` in the frame loop (it already runs from arrival): with a
  target in view and the guided hunt active, 8 s → `find-nudge`, 16 s → `find-nudge-short`;
  with `hiddenSide` set, 8 s → `hunt-nudge`, 16 s → `hunt-nudge-short`; 8 s after
  `spin-invite-<world>` while still inviting → `spin-nudge`. Each level once per visit;
  any press resets the clock but not the "given" flags, so a child is never nagged twice
  with the same words.
- **After success**: extend `ui.completeMission` with an optional follow-up
  `{ text, cueId }` that becomes `pendingGuide` when the success line is actually shown
  (both the immediate and the `pendingFact` path); `main.ts` passes `success-next` when the
  hint names a next world.
- **Finale**: `speakGuide('finale')` in `showFinale`.
- **Fly Home**: nothing at the press; the landing line is `fly-home` (above).

Put the nudge schedule in a pure function with unit tests (`src/ui/nudge.ts`: given idle
seconds and which levels were given, which cue, if any). Expose `narrator.speaking` is
already in the playtest snapshot; do not add audio assertions to browser tests beyond that.

## Working rules

Typecheck and unit tests before every commit; only the Playwright files covering the
screens you touched (`home.pw.ts` for the map, `visit.pw.ts` and `earth-day.pw.ts` for the
arrival), on the affected viewports; never the full suite locally. The container's Chromium
may be older than Playwright's: run with `SPACE_NINJA_CHROMIUM=/opt/pw-browsers/chromium`.
Push to the session branch; stop for the owner after Step 1 (the voice) and again after
Step 3 with the list of what plays where; push to `main` fast-forward only when told. Report
honestly what passed, what failed and what you did not run; how the voice sounds on the
tablet stays unverified until the owner listens.
