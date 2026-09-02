/**
 * Scene constants.
 *
 * Distances are compressed hard for composition, not accuracy: a true-scale Moon would
 * be 30 Earth-diameters away and invisible. Earth radius is the unit for everything else.
 *
 * Body *radii* are the one thing kept true to life — the Moon really is 0.27 Earths and
 * Mars really is 0.53 — because relative size is a thing a child can actually learn from
 * a picture, whereas relative distance at this scale is unshowable.
 */

import * as THREE from 'three';

export const EARTH_RADIUS = 1;

export const MOON_RADIUS = 0.27;
export const MOON_ORBIT_RADIUS = 2.5;
export const MOON_ORBIT_TILT = 0.11; // radians, so the Moon does not track a flat line
export const MOON_START_ANGLE = 0.62;

/**
 * Mars is given its own compressed path around the scene centre rather than a real
 * heliocentric orbit. At true scale it would be several thousand Earth-radii away and
 * the Sun is already at 105; this keeps every destination inside one composable frame.
 * Tilt and start angle are chosen to keep it well away from the Moon on screen.
 */
export const MARS_RADIUS = 0.53;
export const MARS_ORBIT_RADIUS = 5.0;
export const MARS_ORBIT_TILT = -0.19;
export const MARS_START_ANGLE = 3.4;

export const SUN_RADIUS = 7;
export const SUN_DISTANCE = 105;
/** Slightly off-axis so Earth shows a pleasing crescent terminator from the default view. */
export const SUN_DIRECTION = new THREE.Vector3(0.05, 0.55, 0.83).normalize();
export const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(SUN_DISTANCE);

export const STAR_SHELL_RADIUS = 420;

/** Radians per second. Slow enough to feel calm rather than spinny. */
export const EARTH_SPIN = 0.045;
export const MOON_SPIN = 0.012;
export const MOON_ORBIT_SPEED = 0.055;
export const MARS_SPIN = 0.02;
/** Slower than the Moon: an outer body that raced round would read as wrong. */
export const MARS_ORBIT_SPEED = 0.03;

export const CAMERA_FOV_LANDSCAPE = 52;
export const CAMERA_FOV_PORTRAIT = 68;

/**
 * The resting field of view for a viewport shape. Portrait phones are narrow, so they get
 * a wider vertical angle to keep the scene in frame.
 *
 * Shared rather than inlined in Stage, because the flight widens the FOV briefly to sell
 * acceleration and has to know what to widen *from*. Deriving it here means rotating the
 * device mid-flight still lands on the right resting angle instead of one captured before
 * the rotation.
 */
export function fovForAspect(aspect: number): number {
  return aspect < 1 ? CAMERA_FOV_PORTRAIT : CAMERA_FOV_LANDSCAPE;
}

/**
 * How much wider the view gets at full burn, in degrees. A brief widening reads as
 * acceleration — it is the cheapest speed cue there is, and the only one that works when
 * the camera is travelling with the thing it is filming.
 */
export const FLIGHT_FOV_PUNCH = 9;
export const CAMERA_NEAR = 0.05;
export const CAMERA_FAR = 800;

/**
 * How much of the scene the opening shot tries to fit, and the distance clamp around it.
 * This has to cover the Moon at the far side of its orbit, or a portrait phone — whose
 * horizontal field of view is tiny — loses the destination off the edge of the screen.
 */
export const FRAMING_RADIUS = MOON_ORBIT_RADIUS + MOON_RADIUS + 0.18;
/**
 * The wider shot, used once Mars is worth pointing at. Deliberately not the opening
 * framing: fitting Mars shrinks Earth and the Moon to a third of the size, which is a
 * bad first impression for a five-year-old who has not been given a reason to care yet.
 */
export const FRAMING_RADIUS_WIDE = MARS_ORBIT_RADIUS + MARS_RADIUS + 0.18;
export const MIN_ORBIT_DISTANCE = 0.6;
/**
 * Raised from 16 so FRAMING_RADIUS_WIDE actually fits on the narrowest phone in
 * portrait, where the horizontal field of view is only about 34 degrees.
 */
export const MAX_ORBIT_DISTANCE = 20;

/**
 * Raised from 5.5. That was five and a half seconds with nothing to look at, which felt
 * longer than seven seconds with a trail, a widening view and a camera that closes in.
 * Length was never the problem; emptiness was.
 */
export const FLIGHT_DURATION = 7; // seconds
export const FLIGHT_DURATION_REDUCED = 1.4;

/**
 * Reaching this is what widens the opening shot to take in Mars.
 *
 * Tied to *visiting* the Moon, not to finishing its collection. Collecting is optional —
 * a child who flies out, looks at the Moon and comes home has done the thing this game is
 * about, and gating the rest of the solar system behind a tapping game would have told
 * them otherwise.
 */
export const WIDE_FRAMING_VISIT = 'moon';

/**
 * A real place on a real body, at its real coordinates.
 *
 * These are not decorations scattered over the surface: `lat`/`lon` are the actual
 * selenographic or areographic coordinates of the feature, and the marker is placed from
 * them, so what a child taps really is sitting on Tycho's ray system or on the volcano.
 * That is the whole point of the change from collectibles — a rock could be anywhere and
 * therefore taught nothing about where you were.
 *
 * Order matters. Every entry but the last is expected to be facing the camera on arrival;
 * the last is the one deliberately left over the horizon, so reaching it needs a drag.
 * See `placementAngles`, which turns these into view angles, and its test.
 */
export interface Discovery {
  /** Stable key. Written into the journal, so renaming one forgets a child's find. */
  id: string;
  /** Child-facing name. Plain English beats the catalogue name at this age. */
  name: string;
  /** Shown in the journal grid. */
  emoji: string;
  /** Degrees north, and degrees east, on the body itself. */
  lat: number;
  lon: number;
  /** Told on discovery, and kept in the journal. */
  fact: string;
}

/**
 * Everything a destination needs that is words rather than geometry. The bodies
 * themselves are built in Bodies.ts and matched up by id in main.ts; the mission is
 * generic and takes the body at runtime, so only the copy lives here.
 */
export interface DestinationConfig {
  /** Text on the button that launches the flight. */
  flyLabel: string;
  /** Read aloud on arrival. */
  fact: string;
  mission: {
    instruction: string;
    huntLine: string;
    successLine: string;
    stickerId: string;
    /** How many there are to find is simply how many there are. */
    discoveries: Discovery[];
  };
}

export const DESTINATIONS: Record<string, DestinationConfig> = {
  /*
   * Earth is a destination like any other, which is the point: a five-year-old's first
   * instinct is to tap their own planet, and until this entry existed the game answered
   * by not offering a Fly button at all.
   *
   * "Flying" to the planet you are already at is not a contradiction here — the opening
   * shot is a wide view of the whole neighbourhood, and this drops you into low orbit
   * over it. The flight code needs nothing special for it: home and destination being the
   * same body leaves the departure axis at zero, which contributes nothing to an arrival
   * direction the Sun already dominates.
   */
  earth: {
    flyLabel: 'Fly to Earth',
    fact:
      'This is your planet, seen from space. It is the only place anyone has ever found ' +
      'with water you can swim in, air you can breathe, and anybody at all to talk to.',
    mission: {
      instruction: 'Three places to find down there!',
      huntLine: 'One more! Drag to spin around Earth.',
      successLine: 'You found all three! You know your own planet from space now.',
      stickerId: 'earth-explorer',
      discoveries: [
        {
          // These two average out to a longitude in the middle of the Atlantic, so the
          // arrival is the classic view: Africa on one side, South America on the other.
          id: 'earth-sahara',
          name: 'The Biggest Desert',
          emoji: '🏜️',
          lat: 23,
          lon: 13,
          fact:
            'That huge patch of sand is the Sahara. It is the biggest hot desert in the ' +
            'world — almost as wide as the whole of America — and it is one of the ' +
            'easiest things to spot on Earth from up here.',
        },
        {
          id: 'earth-amazon',
          name: 'The Biggest Forest',
          emoji: '🌳',
          lat: -3,
          lon: -60,
          fact:
            'All that green is the Amazon rainforest. More kinds of animal live there ' +
            'than anywhere else on Earth, and its trees help make the air you are ' +
            'breathing right now.',
        },
        {
          /*
           * Last, so it is the one over the horizon — and placed over Bangkok, which is
           * not arbitrary: it is the point that is both properly in darkness and still
           * only one drag away.
           *
           * The obvious guess, that anything ~100 degrees round from a sunlit arrival is
           * in night, is wrong. The camera does not arrive at the sub-solar point; the
           * Sun sits about 23 degrees off it, and in the direction that costs longitude
           * here. India at 79E measured out at a sun-dot of +0.154 — broad daylight, with
           * the night-lights map fading in only below +0.12, so the one discovery whose
           * whole point is the city lights had none at all. This measures -0.22: fully
           * lit, and 120 degrees from the camera, which is the same drag the Moon and
           * Mars ask for. Move it east for brighter cities and the drag grows past what a
           * child will sit through; there is no more room than this.
           */
          id: 'earth-nightside',
          name: 'The Night Side',
          emoji: '🌃',
          lat: 13.75,
          lon: 100.5,
          fact:
            'Half of Earth is always in the dark. Over here it is night, and all those ' +
            'little glows are the lights of towns and cities — every one of them full ' +
            'of people, most of them fast asleep.',
        },
      ],
    },
  },
  moon: {
    flyLabel: 'Fly to the Moon',
    // The footprints used to be this line. They belong to a *place*, so they moved down
    // into it — an arrival fact is about the whole world, and this one now is.
    fact:
      'The Moon has no air and no weather at all. Nothing moves here, and there is ' +
      'nothing to carry a sound, so it is the quietest place there is.',
    mission: {
      instruction: 'Three places to find down there!',
      huntLine: 'One more! Drag to spin around the Moon.',
      successLine: 'You found all three! What a brilliant explorer you are.',
      stickerId: 'moon-explorer',
      discoveries: [
        {
          id: 'moon-tranquility',
          name: 'The First Footprints',
          emoji: '👣',
          // Apollo 11, in Mare Tranquillitatis.
          lat: 0.67,
          lon: 23.47,
          fact:
            'Two astronauts landed right here, the first people ever to stand on the ' +
            'Moon. With no wind and no rain to wash them away, their footprints are ' +
            'still exactly where they stepped.',
        },
        {
          id: 'moon-tycho',
          name: 'The Bright Crater',
          emoji: '✨',
          lat: -43.3,
          lon: -11.4,
          fact:
            'A rock crashed into the Moon here and splashed pale dust right across it. ' +
            'The bright streaks reaching away from this crater are that splash, and it ' +
            'is called Tycho.',
        },
        {
          // Last, so it is the one over the horizon. Tsiolkovskiy crater, which is
          // genuinely round the back — the near side runs out at about 90 degrees — but
          // at 129 rather than at the far side's centre, which would be 180 and a
          // half-turn of dragging away. Reaching it needs about 50 degrees, the same as
          // the collectible it replaced.
          id: 'moon-farside',
          name: 'The Hidden Side',
          emoji: '🌑',
          lat: -20.4,
          lon: 129.1,
          fact:
            'You had to go round the back to find this. The Moon always keeps the same ' +
            'face turned towards Earth, so nobody had ever seen this side at all until a ' +
            'spacecraft flew around and took a photograph.',
        },
      ],
    },
  },
  mars: {
    flyLabel: 'Fly to Mars',
    fact:
      'Mars is red because its dust is full of rust — the same rust that grows on an old ' +
      'bike left out in the rain. The whole planet is a bit rusty!',
    mission: {
      instruction: 'Three places to find down there!',
      huntLine: 'One more! Drag to spin around Mars.',
      successLine: 'You found all three! You are a real space explorer now.',
      stickerId: 'mars-explorer',
      discoveries: [
        {
          id: 'mars-olympus',
          name: 'The Giant Volcano',
          emoji: '🌋',
          lat: 18.65,
          lon: -133.8,
          fact:
            'The biggest volcano in the whole solar system is right here. Olympus Mons ' +
            'is so wide that if you stood on top of it, its edges would be further away ' +
            'than the horizon in every direction.',
        },
        {
          id: 'mars-marineris',
          name: 'The Great Canyon',
          emoji: '🏞️',
          lat: -14,
          lon: -59,
          fact:
            'This enormous crack across Mars is called Valles Marineris. It is longer ' +
            'than Australia is wide, and deep enough to lose a mountain in.',
        },
        {
          // Last, so it is the one over the horizon. Both of the others are in Mars's
          // western half, so this sits about 117 degrees round from them — far enough to
          // need the drag, near enough to find it with one. Hellas, the obvious
          // alternative, is 167 degrees away and most of a turn of dragging.
          // Not the volcano emoji: Olympus already has it, and two identical tiles in the
          // journal are two the child cannot tell apart.
          id: 'mars-elysium',
          name: 'The Other Volcano',
          emoji: '🗻',
          lat: 25,
          lon: 147,
          fact:
            'Round the far side of Mars is a second giant volcano, called Elysium Mons. ' +
            'It is not quite as big as Olympus Mons, but it would still be the tallest ' +
            'mountain on Earth twice over.',
        },
      ],
    },
  },
};

/**
 * Every discovery in the game, by id.
 *
 * The journal shows what has been found without knowing which destination it came from,
 * and progress.ts stores bare ids, so both need one flat lookup. Derived rather than
 * written out, so a new destination cannot be added to the game and forgotten here.
 */
export const DISCOVERIES: Record<string, Discovery> = Object.fromEntries(
  Object.values(DESTINATIONS).flatMap((destination) =>
    destination.mission.discoveries.map((discovery) => [discovery.id, discovery]),
  ),
);

/**
 * Slots in the discovery journal: exactly as many as there are places to find.
 *
 * Counted rather than written down. It was a hand-set 6 against a journal that held the
 * two stickers, so a child who had done everything in the game saw a grid that was
 * two-thirds question marks. Deriving it means the journal fills on completion for every
 * future destination too, instead of quietly going wrong again the next time one is added.
 */
export const JOURNAL_SLOTS = Object.keys(DISCOVERIES).length;
