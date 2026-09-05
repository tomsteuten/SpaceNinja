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

/**
 * Saturn is the one body whose radius is *not* true to life, and that is deliberate.
 *
 * The rule everywhere else — Moon 0.27, Mars 0.53 — is that radii are real, because
 * relative size is a thing a child can learn from a picture. A gas giant breaks it: Saturn
 * is really 9.1 Earth radii, which at these compressed distances would be larger than the
 * rendered Sun (7) and would dwarf every other body and its own orbit. So its size is
 * compressed the way the *distances* already are. 1.5 still reads clearly as "much the
 * biggest planet" without swallowing the scene. It is a constant precisely so the one place
 * the invariant is broken can be found and tuned; the composition it produces is a thing to
 * watch on the real tablet, not a number to trust from here.
 */
export const SATURN_RADIUS = 1.5;
/**
 * Just beyond Mars (5.0). Kept as near in as composition allows because a fourth, farther
 * body is what forced MAX_ORBIT_DISTANCE up: the wider the orbit, the further the camera
 * has to pull back to show Saturn for tapping, and the smaller the inner worlds get in that
 * shot. See FRAMING_RADIUS_WIDER.
 */
export const SATURN_ORBIT_RADIUS = 6.6;
export const SATURN_ORBIT_TILT = 0.15;
/** Chosen to keep Saturn clear of Mars (3.4) and the Moon on screen at the opening. */
export const SATURN_START_ANGLE = 5.5;
/** A calm turn, like the others — not the real 10-hour day, which would read as spinning. */
export const SATURN_SPIN = 0.03;
/** Slower than Mars: an outer body that raced round would read as wrong. */
export const SATURN_ORBIT_SPEED = 0.018;
/**
 * Axial tilt, ~26.7° in life, and load-bearing here rather than cosmetic: it is the plane
 * the rings lie in, and the equatorial plane the one ring discovery is placed in. Carried
 * on a container above the sphere, like Earth's, so it never sits inside the surface's own
 * y-rotation and quietly moves markers off their coordinates.
 */
export const SATURN_AXIAL_TILT = 0.47;
/**
 * The ring system, as multiples of Saturn's radius. Real proportions: the bright rings run
 * from about 1.24 R (inner C/B) to 2.27 R (outer A). The gap near 1.95 is the Cassini
 * Division, drawn into the ring texture rather than modelled.
 */
export const SATURN_RING_INNER_RATIO = 1.28;
export const SATURN_RING_OUTER_RATIO = 2.3;

export const SUN_RADIUS = 7;
export const SUN_DISTANCE = 105;
/** Slightly off-axis so Earth shows a pleasing crescent terminator from the default view. */
export const SUN_DIRECTION = new THREE.Vector3(0.05, 0.55, 0.83).normalize();
export const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(SUN_DISTANCE);

export const STAR_SHELL_RADIUS = 420;

/** Radians per second. Slow enough to feel calm rather than spinny. */
export const EARTH_SPIN = 0.045;
/*
 * There is deliberately no MOON_SPIN. The Moon is tidally locked here, as it is in life,
 * and locking means its surface simply rides the orbit — any rotation of its own would be
 * the thing that unlocks it. It had one, at 0.012, and that is exactly what stopped the
 * near side facing Earth.
 */
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
/**
 * The widest shot, used once Saturn is worth pointing at. It has to reach past the *outer
 * ring*, not just the planet, or the thing that makes Saturn Saturn sits off the edge. This
 * is the tier that costs the most: a fourth, far body can only be framed for tapping on a
 * narrow portrait phone by pulling right back, which shrinks Earth, the Moon and Mars to
 * specks in this one shot. That trade was made on purpose (there is no other way to keep the
 * tap-the-world-you-see model with an outer planet) and it is the composition to watch on
 * the real tablet.
 */
export const FRAMING_RADIUS_WIDER =
  SATURN_ORBIT_RADIUS + SATURN_RADIUS * SATURN_RING_OUTER_RATIO + 0.18;
export const MIN_ORBIT_DISTANCE = 0.6;
/**
 * Raised from 20 so FRAMING_RADIUS_WIDER fits on the narrowest phone in portrait, where the
 * horizontal field of view is only about 34 degrees — the previous 20 was set for
 * FRAMING_RADIUS_WIDE (Mars) and cannot reach Saturn's orbit. The cost is that a child can
 * now pinch any scene out this far too; the inner scenes already allowed zooming a body down
 * to a speck, so this extends an existing property rather than introducing a new one.
 */
export const MAX_ORBIT_DISTANCE = 36;

/**
 * Raised from 5.5. That was five and a half seconds with nothing to look at, which felt
 * longer than seven seconds with a trail, a widening view and a camera that closes in.
 * Length was never the problem; emptiness was.
 */
/*
 * One duration, for everybody. There used to be a FLIGHT_DURATION_REDUCED of 1.4 under
 * prefers-reduced-motion, and it was the wrong idea done confidently: the flight is a
 * sweeping camera move, and compressing it to a fifth of its length does not reduce the
 * motion, it quintuples the angular rate. Reported from the tablet it is played on — the
 * short version reads as faster and more awkward, which is the opposite of the accommodation.
 *
 * What reduced motion still does is drop the motion that is *decoration*: the FOV punch,
 * the exhaust trail, the camera inertia, the UI animation. Those genuinely lower how much
 * is moving per second. If a stronger accommodation is ever wanted, the right shape for it
 * is a cut — fade out, arrive, fade in — not the same sweep played fast.
 */
export const FLIGHT_DURATION = 7; // seconds

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
 * And visiting Mars is what widens the shot again to take in Saturn. Same reasoning as
 * WIDE_FRAMING_VISIT: tied to *going*, not to finishing a collection, so the next world
 * appears for a child who flew to Mars and looked around, whether or not they found its
 * three places.
 */
export const WIDER_FRAMING_VISIT = 'mars';

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
  /**
   * Optional: this place is on the ring plane, not the sphere.
   *
   * Saturn's whole reason to exist is a feature that is not a surface coordinate. When set,
   * the marker sits in the body's equatorial plane at this many body-radii from the centre
   * (so a value between the inner and outer ring ratios lands it *on* the rings), along the
   * direction `lon` gives, and `lat` is ignored. The one deviation from "a discovery is a
   * lat/lon on the surface", contained to placement — everything else (the journal, the
   * hidden-one drag rule, the sticker) treats it like any other. Only ever a non-hidden
   * one: the last discovery, the one reached by dragging, stays a real surface feature.
   */
  ring?: number;
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
  /** Shown on arrival. */
  fact: string;
  /**
   * Optional: this destination can be turned through one whole day where it stands.
   *
   * Data rather than a special case for Earth, so nothing branches on an id — but only
   * Earth has it, because "why does the Sun come up?" is a question about *here*. It is
   * also the question children playing this actually asked, which is better evidence than
   * anything else in this file.
   */
  spin?: { label: string; name: string; fact: string };
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
    spin: {
      label: 'Spin the Earth',
      name: 'Day and Night',
      fact:
        'The Sun does not move. Earth turns! When your part of it turns towards the Sun ' +
        'that is morning, and when it turns away the sky goes dark and the lights come on.',
    },
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
  saturn: {
    flyLabel: 'Fly to Saturn',
    fact:
      'Saturn is the planet with the beautiful rings. It is so big that a thousand Earths ' +
      'could fit inside it — and it is so light for its size that it would float in a ' +
      'bath, if anyone could find a bath big enough.',
    mission: {
      instruction: 'Three things to find out here!',
      huntLine: 'One more! Drag to spin around Saturn.',
      successLine: 'You found all three! You have been all the way out to Saturn.',
      stickerId: 'saturn-explorer',
      discoveries: [
        {
          /*
           * The rings, and the one discovery that is not a point on the surface. `ring` puts
           * it out in the equatorial plane at 1.9 body-radii — on the bright rings, between
           * the inner edge (1.28) and the outer (2.3). `lat` is ignored; `lon` only decides
           * which way round the plane it sits, and it is an in-view one, so it is brought to
           * the near side on arrival like the others. See Discovery.ring and CollectMission.
           */
          id: 'saturn-rings',
          name: 'The Rings',
          emoji: '💍',
          lat: 0,
          lon: 25,
          ring: 1.9,
          fact:
            'The rings are made of billions of pieces of ice and rock, going round and ' +
            'round Saturn. Some are as small as a crumb and some are as big as a house, ' +
            'and together they are wider than Saturn itself.',
        },
        {
          // The hexagon is Saturn's best fact for a child, and it can be an in-view one but
          // never the hidden one: it sits high on Saturn, and a near-pole feature does not
          // swing out of sight behind the limb the way a longitude does. Placed well up but
          // short of the pole itself — a hit sphere right at the pole foreshortens to nothing
          // and cannot be tapped (there is a test for that), and the child reads 50°N as "up
          // near the top" just the same.
          id: 'saturn-hexagon',
          name: 'The Six-Sided Storm',
          emoji: '🔷',
          lat: 50,
          lon: -12,
          fact:
            'Right at the top of Saturn is a giant cloud shaped like a hexagon — six ' +
            'straight sides, like a stop sign with one fewer. It is a storm so wide that ' +
            'several Earths would fit inside it.',
        },
        {
          // Last, so it is the one over the horizon — a real surface feature about 125
          // degrees round in longitude from the two in-view ones, which is the same drag the
          // other worlds ask for and within the ~130-degree bound past which a child gives up.
          id: 'saturn-storm',
          name: 'The Great Storm',
          emoji: '🌀',
          lat: -14,
          lon: 132,
          fact:
            'You had to go round to find this. Saturn has storms far bigger than any on ' +
            'Earth, with winds much faster than the fastest ones here — and they can rumble ' +
            'on for months.',
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
