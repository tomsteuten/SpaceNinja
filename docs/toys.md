# Toys: one big idea per world

The Moon jump (`src/toys/moonJump.ts`) is the pattern. Each destination gets **one toy**: a
hands-on thing a 5–8-year-old does with a finger, which shows **one big idea** with **real
numbers**, compared against something they already know (their own body, Earth, a bath,
a birthday). Discovery places stay as they are; the toy is the reason to come back.

## What makes a good toy

- **One verb.** Jump, drop, drive, drill, flap, spin. One big button or one drag.
- **A comparison, not a fact.** Side by side with Earth, or with the child's own body. The
  child should see the answer before anyone says it.
- **Real numbers, honestly scaled.** Real gravity, real temperatures, real sizes. When a
  number is too big to show (light minutes, millions of km), turn it into something the
  child can feel: their birthday, a nap, a school day.
- **Repeatable and a bit silly.** Children press it again. Silly is fine; false is not.
- **No reading needed.** At most one short caption, plus one narrated line.
- **Cheap to build.** A self-contained overlay in `src/toys/` with pure, tested physics.
  Leave the 3D scene alone.
- **Keep or cut after a child plays it.** Ten minutes with a child decides, not a review.

## Worlds in the game now

### Sun: line up the Earths — *how big is the Sun?*
The Sun's edge fills the screen as a huge glowing curve. Each tap puts another Earth-sized
marble next to the last one across the Sun's face. After a few taps a "Fill it!" button races
the rest in: **109 Earths** to cross the Sun. A counter of little Earth pictures ticks up.
Optional second step: "How many fit *inside*?" pours Earths in like sweets into a jar, about
1.3 million, shown as the jar never filling.
*Reinforces never looking at the real Sun (the narration says so).* Effort: S.

### Earth: bedtime spin — *day and night are Earth turning* (built)
`src/toys/bedtimeSpin.ts`, opened by Earth's Turn Earth / Day & night; it replaced the 3D
side-on activity, where a sideways drag hid the house round the back. Real Blue Marble and
city-lights maps seen from above the North Pole, Sun on the left, so half is lit. A house
on the equator (12 hours of light, 12 of dark) rides into night (windows light, "z z") and
back into morning. Drag counter-clockwise (Earth never turns backwards) or press Turn Earth
(three hours a press). A clock shows the hours, a counter "1 turn = 1 day". The existing
day-night Kokoro cues speak night and morning; on the first visit morning points to the Moon.

### Moon: jump — *less gravity* (built)
The same child jumps on Earth and on the Moon. On the Moon they go about six times higher
and stay up about six times longer. The footprints stay. Order on a visit: gold places
first, then Jump is the next step (ring, caption and the `toy-moon` line, "Now you can jump
on the Moon!"); the hunt does not start itself while the toy is open. Every toy follows this
order. Next steps: a narrated line inside the toy, and maybe a "bounce walk" (hold the button
to keep hopping, the Apollo way).
**Second Moon toy, for older children: phases torch.** The Sun is a torch on one side; the
child drags the Moon round Earth, and a window shows how it looks from Earth (full,
half, crescent). Effort: M.

### Mars: drive the rover — *Mars is so far away that messages take minutes* (built)
`src/toys/marsRover.ts`, opened by Mars's Rover button (lime crayon). Earth and a little clock
on one side, Jezero crater (with its old river fan) on the other. One verb, after playtest 2:
the child taps a glowing, wobbling rock; a dot flies from Earth for 2 s while the clock's
minute hand sweeps the real 12 minutes (`roverDelay.ts`: light time 3.0 to 22.3 minutes, a
typical day, not today's); only then does the rover drive itself there and drill a sample
tube. Taps while busy get a shimmer and are not queued; three tubes bring new rocks. Places
first, then the rover is the next step (`toy-mars`, "Now you can drive the rover on Mars!").
Next: sounds, maybe a narrated line inside ("Tap a rock. Your message takes a long time to
reach Mars!"), and maybe NASA's free 3D model of Perseverance. Effort: M.

### Saturn: bath time — *Saturn is so light for its size it would float* (built)
`src/toys/saturnBath.ts`, opened by Saturn's Bath button (bubble crayon). A giant claw-foot
bath in space, four worlds on a shelf. The child drags them in, or presses Plop! (it shows
the next world): Earth, Mars and the Moon splash and sink; Saturn bobs and settles about
seven tenths under, because a floating ball displaces its own weight (`bathPhysics.ts`, real
mean densities: Saturn 0.69 g/cm³, water 1.0, Earth 5.51, Mars 3.93, Moon 3.34). Sizes are
not to scale. Places first, then the bath is the next step (`toy-saturn`, "Now you can put
Saturn in the bath!"). Saturn's arrival fact already admits no bath is big enough. Next: a
plop sound, and a narrated line when Saturn floats.
**Second Saturn toy: ring maker.** Throw ice chunks at Saturn; they spread into a thin flat
ring. Effort: S (the bath) / M (the rings).

## Planned worlds (from `content/worlds.md`)

### Mercury: planet race — *closer planets go round faster*
Mercury, Venus, Earth and Mars race round the Sun on one button. When Earth finishes one lap
(one of your birthdays), Mercury has done about four. Show "Your age on Mercury": a 6-year-old
is 25 Mercury years old. The age calculation is the hook; the race shows why.
Effort: S. Could also live on the Space map as a toy for every planet.

### Venus: the blanket — *thick clouds trap heat, so Venus is hotter than Mercury*
Two thermometers: Mercury (closer to the Sun) and Venus. The child drags a fluffy cloud
blanket over Venus, and its thermometer climbs past Mercury's to about **465 °C**, hot enough
to melt lead. Bonus: on Venus the Sun rises in the west, because it spins backwards.
Effort: S.

### Jupiter: the weigh-in — *bigger planets pull harder*
The child stands on bathroom scales, on a balloon platform at the cloud tops: there is no
ground, so nothing is invented. Their weight (pictured as stacked backpacks or teddies) is
about **2.5×** Earth's. Their arms flop down; a jump barely leaves the scales. Pairs with
the Moon jump.
**Second Jupiter toy: storm stirrer.** Swirl a finger to spin the Great Red Spot, then drop an
Earth into it: it is about 1.3 Earths wide. Effort: S.

### Io: volcano popper — *Io is the most volcanic place we know*
Tap volcanoes; plumes shoot up to about 300–400 km and fall in perfect umbrella shapes,
because there is no air (the same dust physics as the Moon jump). Tap lots of them at once
for fireworks. Effort: S (reuses Moon dust).

### Europa: ice drill — *an ocean hidden under the ice*
Hold to drill down through the ice shell, roughly 15–25 km thick, past layer marks compared
to Everests stacked up, until water splashes into a dark hidden ocean with more water than
all of Earth's oceans. End on an honest question mark: "Could anything live here? Scientists
are going to look." No invented creatures. Effort: S.

### Ganymede: size line-up — *a moon bigger than a planet*
Drag worlds into a line from small to big: the Moon, Mercury, Ganymede, Earth. The surprise
is that Ganymede beats Mercury. Effort: S. A shared size-sorting toy could serve the
Moon, Ganymede, Titan and Ceres.

### Callisto: crater catcher — *without weather, craters last forever*
Two panels: Earth and Callisto. Flick rocks down; both get craters. Then press "a million
years": on Earth, rain, plants and wind wipe the craters away; on Callisto every single one
stays, which is why it is the most cratered world. Effort: S.

### Titan: flap to fly — *thick air plus low gravity*
Side by side with Earth again: strap on cardboard wings and flap (tap fast). On Earth the
child hops and falls. On Titan, where gravity is about a seventh of Earth's and the air is
about four times as dense, they lift off and glide. Show methane rain falling slowly into a
lake. Effort: M (reuses the jump layout).

### Uranus: the rolling planet — *Uranus spins on its side*
Orbit Uranus round the Sun with a drag. Because it is tipped over (about 98°), each pole gets
about **42 years** of sunshine and then 42 years of dark. A child on the pole sees "the Sun
stays up until you are a grandparent". Effort: M.

### Neptune: wind sock — *the fastest winds in the solar system*
A wind sock and a kite. A slider goes from breeze, to an Earth hurricane, to Neptune's
winds of about **2,000 km/h**, faster than a jet plane. The kite string snaps and a cow
blows past (a gentle joke). Also: the Sun is a small bright star from out here. Effort: S.

### Pluto: birthday trip — *space is huge*
"If you set off for Pluto today…" The child picks their age; the ship leaves and birthday
cakes pass by the window. New Horizons took about **9½ years**, so a 6-year-old arrives at
15 or 16. Then: send a "hello" home; it takes about **4½ hours** to reach Earth, so you would
be asleep before it got there. Show the heart-shaped plain on arrival. Effort: S.

### Ceres: belt flyer — *the asteroid belt is mostly empty*
Children expect a film-style rock storm. Fly through the belt at full speed: the counter
says rocks passed: 0… still 0… The rocks are usually far too far apart to see from one to
the next. Then visit Ceres and its bright salty spots. Effort: S.

## Ideas that span worlds

- **My space card.** Each toy writes one personal result into the journal: "On the Moon I
  jumped 2 m", "On Mercury I am 25", "On Jupiter I weigh 2.5 teddies". The journal becomes a
  set of facts about *me in space*, which children want to show grown-ups.
- **One shared toy shell.** Two-panel comparison, one big action button, pictured back
  button, one caption, one narrated cue. The Moon jump already has this shape; pull it out
  into a common helper on the second toy, not before.
- **Narration.** One ElevenLabs Emma cue per toy (DECISIONS.md #5).

## Suggested order

1. **Earth bedtime spin.** The first thing every child meets, and it is currently confusing.
2. **Saturn bath.** Small, very funny, and a big surprise.
3. **Mars rover.** The most game-like; it gives repeat play.
4. **Sun line-up.** Small, and it completes the current five worlds.

Then test with a child before building any toy for a new world. If toys keep children
coming back, the new worlds are worth adding *with* their toy; a world without its toy is
not worth adding.
