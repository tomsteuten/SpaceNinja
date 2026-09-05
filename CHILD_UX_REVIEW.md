# Child UX review — 5 September 2026

## Coverage

Tested the real Vite app in Chromium at 1280 × 720 and 360 × 780. The pass flew to
Earth, the Moon, Mars and Saturn; found all twelve places, including each hidden drag
target and Saturn's ring-plane target; opened discovery photos; ran Earth's full-day
spin; completed the finale; opened the full journal; and used Fly Home after every world.
The narrow pass used the widest unlocked framing and selected both Saturn and Earth.
No browser errors were recorded.

## Findings

### High — the genuine Saturn map's missing observations looked broken (fixed)

The NASA PDS equirectangular Cassini map contains broad black latitude bands where the
rings blocked the camera. On the 3D body they read as two enormous black belts, not as
scientific no-data regions. Filling them would turn a genuine image into an unlabelled
fabrication. `saturn.jpg` was removed and the existing generated body fallback restored;
the genuine ring strip and all three genuine discovery photos remain.

### High — Saturn could steal taps through empty space (fixed)

Saturn's old invisible hit sphere was as wide as its outer rings. In one wide-view orbit
position it covered Earth even though the visible rings did not, and a tap on Earth opened
Saturn. The target is now a generous planet sphere plus a flat ring annulus. A regression
test checks both the empty-space miss and a ring-plane hit. Saturn remained selectable at
360 × 780 after the change.

### Medium — discovery copy is absent visually during automatic narration (proposed)

With sound on, the card intentionally hides its paragraph while the recording plays and
folds shortly after it ends. The photo, title and voice work well for a pre-reader, but a
reading child, a child with hearing loss, or a noisy-room player never gets a passive view
of the fact. A larger design pass should test either keeping the paragraph visible under
the audio or revealing it for several seconds when narration ends. This was not changed
because it affects card height, planet occlusion and the project's deliberate audio-first
choice.

### Medium — free orbiting can let other bodies and the ship occlude a hunt (proposed)

Long drags can put the ship or another large body across a destination. The target arrows,
large hit regions and continued dragging always provided a route out, so the game did not
become stuck, but the overlap can momentarily look like the child did something wrong.
A future camera pass could fade non-destination bodies while a hunt is active or constrain
the visit orbit to a clearer arc. This is a composition decision, not a safe one-line fix.

### Low — the canvas description omitted Saturn (fixed)

The accessible scene label still named only Earth, the Moon and Mars. It now includes
Saturn.

## What held up well

Every arrival put two obvious targets in reach; the final arrow and drag instruction led
to the hidden third. The ring-plane target behaved like the surface targets. Photos loaded
only after discovery and expanded cleanly. Earth lights read clearly during the day turn.
Fly Home stayed in one place throughout. The twelve-place finale and journal both fit at
desktop size, and Saturn remained a practical tap target in narrow portrait framing.
