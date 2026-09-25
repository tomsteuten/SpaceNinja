# Narration recordings

Put authored MP3 narration here. The filename is the stable cue id used by the game, for
example `arrival-earth.mp3`, `discovery-earth-sahara.mp3`, or `spin-earth.mp3`.

**Decision, 25 September 2026:** the pack is regenerated in one consistent ElevenLabs voice,
chosen by the owner by ear, from `../narration-script.json`, which is the one manifest (stable
id, spoken text; the filename is the id). The committed pack uses the Australian voice **Emma**
(`eleven_multilingual_v2`), recorded in this batch. The API key is read only from the
`ELEVENLABS_API_KEY` environment variable and is never printed, logged or committed.

Vite fingerprints imported recordings and the existing service-worker build precaches them
with the application shell, so every installed recording works offline. A missing recording
falls back to the device voice when the speaker button is pressed. Only cues with a recording
start automatically; an incomplete voice pack therefore never makes the poor platform voice
begin talking by itself.

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
`--speed=<number>`. Kokoro-82M has no Australian voice; its English options are American
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
