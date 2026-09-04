# Narration recordings

Put authored MP3 narration here. The filename is the stable cue id used by the game, for
example `arrival-earth.mp3`, `discovery-earth-sahara.mp3`, or `spin-earth.mp3`.

Vite fingerprints imported recordings and the existing service-worker build precaches
them with the application shell, so every installed recording works offline. A missing
recording falls back to the device voice when the speaker button is pressed. Only cues
with a recording start automatically; an incomplete voice pack therefore never makes the
poor platform voice begin talking by itself.

`npm run narration:generate` creates the complete pack from `../narration-script.json`
locally with the Apache-2.0 Kokoro-82M model. It needs `ffmpeg`, but no account or API key.
It preserves existing files unless passed `--force`, and accepts `--voice=<name>` and
`--speed=<number>`. The first run downloads the q8 model to a task-specific temporary cache.
`npm run narration:generate:openai` remains an optional keyed alternative.

Generating is a one-time, local, human step, so its toolchain is **not** a committed
dependency — that would put `onnxruntime`, `sharp` and `@huggingface/transformers` (~98
packages, hundreds of MB of native binaries) into every CI deploy for something the deploy
never runs. Install it just before generating and it need not stay:

```bash
npm install --no-save kokoro-js   # then: npm run narration:generate
```

The OpenAI path needs no install at all (it is a plain `fetch`), only `OPENAI_API_KEY` in
the environment. Kokoro-82M has no Australian voice; American (`af_`/`am_`) and British
(`bf_`/`bm_`) are the English options — the shipped pack uses `af_heart`.

Both generators write `provenance.json` beside the MP3s to supply the adult-facing AI
disclosure. A human recording pack may replace it with its own plain-language origin note.
