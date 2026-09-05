# Child UX review — 5 September 2026

## Coverage

Tested the real Vite app in Chromium at 1280 × 720 and 360 × 780. The pass flew to
Earth, the Moon, Mars and Saturn; found all twelve places, including each hidden drag
target and Saturn's ring-plane target; opened discovery photos; ran Earth's full-day
spin; completed the finale; opened the full journal; and used Fly Home after every world.
The narrow pass used the widest unlocked framing and selected both Saturn and Earth.
No browser errors were recorded.

## Findings

### High — the genuine Saturn map's missing observations looked broken (superseded)

The NASA PDS equirectangular Cassini map contains broad black latitude bands where the
rings blocked the camera. On the 3D body they read as two enormous black belts, not as
scientific no-data regions. Filling them would turn a genuine image into an unlabelled
fabrication. The first fix removed `saturn.jpg` and restored the generated body fallback.
A later, explicit imagery decision superseded that state: the installed Solar System Scope
texture uses observation-grounded bands and fills unmapped areas with fictional terrain.
That compromise looks coherent in play, is better than the visibly broken black archive
bands, and is disclosed as a visual reconstruction in both `README.md` and
`public/assets/README.txt`. The genuine Cassini ring strip and all three genuine discovery
photos remain.

### High — Saturn could steal taps through empty space (fixed)

Saturn's old invisible hit sphere was as wide as its outer rings. In one wide-view orbit
position it covered Earth even though the visible rings did not, and a tap on Earth opened
Saturn. The target is now a generous planet sphere plus a flat ring annulus. A regression
test checks both the empty-space miss and a ring-plane hit. Saturn remained selectable at
360 × 780 after the change.

### Medium — discovery copy is absent visually during automatic narration (fixed below)

With sound on, the card intentionally hides its paragraph while the recording plays and
folds shortly after it ends. The photo, title and voice work well for a pre-reader, but a
reading child, a child with hearing loss, or a noisy-room player never gets a passive view
of the fact. A larger design pass should test either keeping the paragraph visible under
the audio or revealing it for several seconds when narration ends. This was not changed
because it affects card height, planet occlusion and the project's deliberate audio-first
choice.

### Medium — free orbiting can let other bodies and the ship occlude a hunt (fixed below)

Long drags can put the ship or another large body across a destination. The target arrows,
large hit regions and continued dragging always provided a route out, so the game did not
become stuck, but the overlap can momentarily look like the child did something wrong.
A future camera pass could fade non-destination bodies while a hunt is active or constrain
the visit orbit to a clearer arc. This is a composition decision, not a safe one-line fix.

### Low — the canvas description omitted Saturn (fixed)

The accessible scene label still named only Earth, the Moon and Mars. It now includes
Saturn.

## Follow-up usability pass

The recommendations from the later adult UX review are now implemented:

- Earned worlds have stable, 64px picture-and-word destination buttons. The moving bodies
  remain tappable, but tiny inner worlds in the widest map no longer carry navigation alone.
- Flights remain guaranteed journeys but accept bounded drag steering through their middle,
  giving immediate agency without making 3D piloting a prerequisite for reaching a world.
- Fly Home uses an animated pull-back. The old mission targets and instruction now leave as
  soon as the return begins instead of hovering over the receding map.
- Mars and Saturn fade and scale into the settled map when first unlocked. Their large hit
  regions remain disabled until the reveal is visually complete, and reduced motion skips
  the animation.
- The grown-ups panel has a two-press **Start a new adventure** action. It removes only the
  journal, visits and stickers; sound, first-run guidance and offline assets are preserved.
- Destination reframing after device rotation now uses the same breathing room as arrival.
  The previous multiplier shrank Saturn to a thumbnail in phone landscape.

The production build was then played sequentially through Moon, Mars and Saturn at phone
portrait and landscape sizes. Steering visibly moved the ship, both unlock reveals landed,
Fly Home returned cleanly, Saturn remained prominent after rotation, and a real Saturn
target was collected. The reset confirmation state was exercised in the panel and the
storage mutation is pinned by unit tests. No browser errors were recorded.

## What held up well

Every arrival put two obvious targets in reach; the final arrow and drag instruction led
to the hidden third. The ring-plane target behaved like the surface targets. Photos loaded
only after discovery and expanded cleanly. Earth lights read clearly during the day turn.
Fly Home stayed in one place throughout. The twelve-place finale and journal both fit at
desktop size, and Saturn remained a practical tap target in narrow portrait framing.

## Accessibility and focus pass — 5 September 2026

### Coverage

Tested a new production build, not the development server. The 390 × 844 portrait run flew
to Earth, the Moon, Mars and Saturn; deliberately steered the Moon flight; found all twelve
places, including every hidden swipe target and Saturn's ring-plane target; ran Earth's full
day turn; verified Moon → Mars and Mars → Saturn reveals; and completed the finale. Saturn
was then rotated to 844 × 390 landscape, and the same visit was reframed at 1024 × 768 as a
tablet check. Browser errors and warnings remained empty.

The grown-ups reset was exercised end to end after the run. It returned progress to no
visits or discoveries and narrowed the destination bar back to Earth and Moon, while the
separate sound setting remained off.

### Narration transcript — fixed

An audio-first card now keeps a visible **Show words** button beside the photograph and
speaker. It is available while narration is playing and after the card folds. Pressing it
shows the paragraph at full width, changes the label to **Hide words**, exposes the same
state through `aria-expanded`, and starts a fresh 6.5-second reading floor. Turning sound off
mid-reading also reveals the paragraph rather than leaving the audio-first state behind.

At 390 × 844, the arrival card measured 88px high while compact and 192px with Earth's
paragraph open. The expanded card overlapped approximately the lower 20% of the rendered
Earth disc; the compact card did not overlap it. At 844 × 390 the open completion line was
114px high. That explicit reading state crosses the lower part of Saturn, but one press puts
it back into the compact bottom row; keeping the default compact was the useful trade rather
than returning every narrated fact to a persistent full-width card.

### Destination focus — fixed

Only the visited destination stays solid. Other earned worlds remain visible at 18% of
their resting opacity, and the parked ship at 28%, until Fly Home begins. In the Mars arrival
check Earth actually crossed behind Mars's lower-left limb: it remained recognisable as
context but the Mars surface and both gold targets stayed dominant. At the Moon the parked
ship remained visible off the right edge without becoming a foreground obstacle. This was
clearer than either hiding the system entirely or constraining the orbit needed to reach the
genuine hidden coordinates.

### Flight steering — clearer

A hand now sweeps briefly between left and right arrows at the start of every outbound
flight. It captures no input and disappeared immediately when the Moon flight was dragged;
the static text hint stayed available for readers. Pure tests pin the pointer response to
the same result at 30, 60 and 120Hz, and pin flight influence to exactly zero at departure
and arrival. Reduced motion leaves the hand and arrows still instead of shortening or
speeding the demonstration.

### Flow and wording

Mission captions now say **Tap the 3 gold targets!**, matching the three visible slots and
the authored arrival narration. Hidden-target lines consistently say **Swipe sideways to
look around**; they no longer describe the camera orbit as spinning the planet. The opening
Moon hint uses the same verb. The page title, description and install manifest now include
Saturn rather than stopping at Mars.

### Still needs a child and the target tablet

The pass establishes that every control is reachable, the responsive compositions hold and
the new focus treatment prevents opaque occlusion in Chromium. It cannot establish whether
the hand cue is noticed without prompting, whether 18%/28% feels too ghostly on the older
tablet's display, or whether the included narration lands well on that speaker. Those remain
real child/device tests; no claim about narration quality is made here.
