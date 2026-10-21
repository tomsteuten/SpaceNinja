# Narration recordings

Put authored MP3 narration here. The filename is the stable cue id used by the game, for
example `arrival-earth.mp3`, `discovery-earth-sahara.mp3`, or `spin-earth.mp3`.

**One voice, two engines (as of 22 October 2026).** The pack is meant to be one voice: the
ElevenLabs voice **Emma** (`eleven_multilingual_v2`), chosen by the owner by ear. While toys
are being built, new lines are generated locally with Kokoro `bf_emma` (free, no key), a
*different-sounding* British voice, so a child currently hears two voices. Each Kokoro line is
recorded as an exception in `provenance.json`. Some cues have words but no recording yet and
are silent until recorded. `../narration-script.json` is the one list of every cue (id and
spoken text; the filename is the id).

See the current split at any time, with no key and nothing spent:

```bash
npm run narration:status
```

On 22 October: 85 cues, 75 ElevenLabs, 7 Kokoro (`arrival-sun`, `toy-moon`, `toy-saturn` and
the four `day-night-*` lines), 3 never recorded (`home-sun`, `home-nudge-sun`,
`home-nudge-short-sun`; the map never suggests the Sun, so they don't play today). Each new
toy adds a `toy-<world>` Kokoro line until the pass below.

### The ElevenLabs pass (replaces every Kokoro line)

Needs `ELEVENLABS_API_KEY` (owner-approved spend; DECISIONS.md, line 5). Run it after any toy
branches in progress have merged, so their new lines are included:

```bash
npm run narration:status                                         # what will be recorded
node --env-file=.env scripts/generate-narration-elevenlabs.mjs   # plain run: no --only, no --force
npm run narration:status                                         # expect: all ElevenLabs
```

A plain run records exactly the cues that aren't already current ElevenLabs (Kokoro lines
have no entry in `manifest.json`), and keeps the rest; on 22 October that was 10 cues and
437 characters. It then rewrites `provenance.json` as all-ElevenLabs, which is only true
once every cue is ElevenLabs. **Don't use `--only` for this pass:** it would also drop the
remaining Kokoro exceptions from `provenance.json` and make the grown-ups disclosure wrong.
`--force` would re-record all 85 and spend credits for nothing. Afterwards, run `npm test`,
listen to the new lines (ideally on the tablet), commit the MP3s with `manifest.json` and
`provenance.json`, and update this section.

Physical-tablet listening remains pending. The API key is read only from the
`ELEVENLABS_API_KEY` environment variable and is never printed, logged or committed.

Vite fingerprints imported recordings and the existing service-worker build precaches them
with the application shell, so every installed recording works offline. A missing recording
falls back to the device voice when the speaker button is pressed. Only cues with a recording
start automatically; an incomplete voice pack therefore never makes the poor platform voice
begin talking by itself.

Derive the required cues from the script and `narration-script.test.ts` when adding content.
Missing clips do not silence other recordings.

## Regenerating the pack

```bash
node --env-file=.env scripts/generate-narration-elevenlabs.mjs   # or: npm run narration:generate
```

`npm run narration:generate` runs the ElevenLabs generator (`scripts/generate-narration-elevenlabs.mjs`),
the shipped path. It is a plain `fetch`, so it needs no dependency — only `ELEVENLABS_API_KEY`
in the environment. On a laptop the key lives in a git-ignored `.env` and Node reads it with
`--env-file=.env`; there is no dotenv dependency. The voice, model, output format and
`voice_settings` come from the `elevenlabs` block in `../narration-script.json`.

It keeps a text-hash cache at `manifest.json` beside the MP3s: for each cue, the SHA-256 of
`voiceId + model + JSON(voiceSettings) + text`. A cue is regenerated only when its MP3 is
missing or its hash differs, so re-running is cheap and credits are spent only on real changes.
It prints `kept`/`wrote` per cue and the total characters sent, so credits are visible.

- `--force` regenerates every cue regardless of the cache.
- `--only=<cue>` regenerates a single cue (for example `--only=finale`).

It writes each MP3 to a temp name and renames it, so an interrupted run never leaves a
half-written file, and it fails loudly (cue id and HTTP status) on any non-2xx response.
`provenance.json` (written beside the MP3s) supplies the adult-facing AI disclosure shown in
the grown-ups panel; the sentence names the actual voice.

## Other generators (not the shipped path)

`npm run narration:generate:kokoro` creates the pack locally with the Apache-2.0 Kokoro-82M
model. It needs `ffmpeg` but no account or API key, and accepts `--voice=<name>` and
`--speed=<number>`. Use `--only=cue-a,cue-b` (or repeated `--only` flags) to generate a subset;
`--force` replaces only that subset when supplied. Subset generation preserves the existing
pack's provenance and records Kokoro exceptions for the generated cues. MP3s are written
through temporary files. Kokoro-82M has no Australian voice; its English options are American
(`af_`/`am_`) and British (`bf_`/`bm_`), so its earlier pack used British `bf_emma` as the
closest fallback. Its toolchain is **not** a committed dependency — that would put
`onnxruntime`, `sharp` and `@huggingface/transformers` (~98 packages, hundreds of MB of native
binaries) into every CI deploy for something the deploy never runs. Install it just before
generating and it need not stay:

```bash
npm install --no-save kokoro-js   # then: npm run narration:generate:kokoro
```

`npm run narration:generate:openai` is a keyed alternative that needs no install (a plain
`fetch`), only `OPENAI_API_KEY` in the environment.

All three generators write `provenance.json` beside the MP3s to supply the adult-facing AI
disclosure. A human recording pack may replace it with its own plain-language origin note.

