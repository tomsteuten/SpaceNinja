# What "finished" means

Set by the owner on 10 November 2026. This is the whole scope. Anything not listed here waits
until this has shipped. The owner can change any line; record the change at the bottom.

## The game

A browser game where children explore the solar system and learn a thing or two. It is not
gamified: nothing is locked, nothing is scored, nothing has to be done in order.

1. **Fifteen destinations.** Sun · Mercury · Venus · Earth · Moon · Mars · Jupiter · Io ·
   Europa · Saturn · Titan · Uranus · Neptune · Pluto · Makemake.
2. **Three ideas a child can do with a finger.**
   - The Sun rises and sets because Earth turns.
   - The Moon is bright because it reflects sunlight.
   - The Sun is a star like the others in the sky, just much closer.
3. **Open exploring with gentle hints.** Every world can be visited from the first second.
   The game may suggest one next thing (a ring, an arrow); it never blocks.
4. **Android phones first.** It must also work on tablets and laptops, and stay usable with a
   keyboard or TV remote (arrow keys and Enter), to a standard that could be shared publicly.

## Standing choices

5. **Real photographs where they exist.** Where a world has never been photographed well
   enough (Makemake, for example), use an artist's impression or diagram and label it as one.
   Never present an invented image as a photograph, and keep provenance in
   `public/assets/discoveries/README.txt`.
6. **Gas and ice giants have no invented ground.** Clouds, rings, orbits and moons only.
7. **Storybook crayons style** (`src/ui/storybook.css`).
8. **A toy only where it earns its place.** A new world needs a real texture, three places and
   an arrival fact. It gets a hands-on toy only if the toy is cheap and teaches one idea.
9. **Narration: script now, recording later.** New lines are written into
   `src/audio/narration-script.json` and shown as words. No placeholder audio is generated.
   One ElevenLabs Emma recording pass happens at the end, when the owner approves the spend.
   Existing recordings keep playing.

## How work is done

- **Mock first.** For any new screen, toy or look, the assistant shows the owner pictures
  (two or three options) and the owner picks before code is written. The assistant does not
  approve its own appearance or usability.
- **Everything a child can do is visible on arrival**, in the same place on every world, as a
  big picture. Nothing appears later because of something the child did. Reduce clutter with
  layout (main things big, secondary things small), never by hiding.
- **Children are five and up and mostly cannot read.** With no narration yet, a control must
  make sense from its picture alone. Pictures are illustrations, not line glyphs.
- **One world right before more worlds.** Get the visit screen right on the Moon and Earth,
  have the owner's children play it, then roll it out and add worlds.
- **Play it like a first-time child before merging.** Passing tests is not enough.
- **Tests:** a small smoke suite only while the design is moving (boot, fly to a world, open
  a toy, return, offline). New specs run on all three viewport sizes locally before a push.
- The plan and its progress live at the top of `docs/current-implementation.md`.

## Changes

- 2026-11-10: replaced the toys-first decision list with this definition of finished. Locked
  worlds, toy-after-three-finds gating, the strict no-artist's-impression rule and Kokoro
  placeholder audio are retired. History before this date is in `docs/decision-history.md`.
- 2026-11-11: after the owner played Phases 1 to 2 live. Controls that appeared only after a
  find confused adults, the Moonlight diagram misled, and the line-glyph icons looked
  amateurish on a phone. "The assistant judges appearance itself" is replaced by mock first;
  adding worlds waits until the visit screen is right.
