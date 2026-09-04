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

Both generators write `provenance.json` beside the MP3s to supply the adult-facing AI
disclosure. A human recording pack may replace it with its own plain-language origin note.
