# Current decisions

The owner's current product decisions. The owner can revise any of them at any time; record a
revision as a dated entry in `docs/decision-history.md`. Assistants propose; they don't
reopen these on their own.

1. **Toys first.** No new worlds sideways. Each destination gets one hands-on toy that teaches
   one big idea with real numbers ([`docs/toys.md`](docs/toys.md)). A new world is added only
   with its toy.
2. **Storybook crayons style.** Paper, ink outlines, flat offset shadows and one fixed crayon
   colour per control, in `src/ui/storybook.css` (see AGENTS.md, "Visual style").
3. **Real imagery.** Planet textures and discovery photographs are real, with recorded
   provenance. Nothing documentary is invented.
4. **Gas and ice giants have no invented ground.** Their places and toys use clouds, rings,
   orbits and moons; no landing.
5. **One voice: ElevenLabs Emma.** Every narrated cue, new ones included, uses the ElevenLabs
   Emma voice, recorded with a plain generator run (`src/audio/recordings/README.md`;
   `npm run narration:status` checks it). Kokoro is only a keyless local fallback, not shipped.
