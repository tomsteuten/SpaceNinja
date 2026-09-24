/**
 * The world catalogue: every body a child can fly to, as data, in the order they are earned.
 *
 * This is the first slice of the shape described in docs/worlds-roadmap.md. It holds each
 * world's *geometry* (size, orbit, spin, rings) and derives the camera framing from it, so
 * that adding a fifth world is one entry here rather than a new named constant and a new
 * framing tier. The words (facts, places, hunt lines) still live in `DESTINATIONS` in
 * config.ts and the meshes are still built by name in Bodies.ts; those move in later slices.
 *
 * Distances are compressed hard for composition, not accuracy: a true-scale Moon would be
 * 30 Earth-diameters away and invisible. Earth radius is the unit for everything else.
 *
 * Body *radii* are the one thing kept true to life below about two Earth radii — the Moon
 * really is 0.27 Earths and Mars really is 0.53 — because relative size is a thing a child
 * can actually learn from a picture, whereas relative distance at this scale is unshowable.
 * Gas giants break the rule on purpose; see Saturn's note.
 */

export interface WorldOrbit {
  /** Distance from the scene centre, in Earth radii. Compressed, like every distance here. */
  radius: number;
  /** Radians; so the path is not a flat line, and so worlds keep clear of each other. */
  tilt: number;
  /** Radians; where on the orbit the world begins, chosen for the opening composition. */
  startAngle: number;
  /** Radians per second. */
  speed: number;
}

export interface WorldGeometry {
  /** Stable key. Written into saved progress, so renaming one forgets a child's visits. */
  id: string;
  /** Sphere radius in Earth radii. */
  radius: number;
  /** Absent for the home world, which sits at the scene centre. */
  orbit?: WorldOrbit;
  /** Radians per second of the body's own turn. 0 means tidally locked to its orbit. */
  spin: number;
  /** Radians; carried on a container above the sphere so it never disturbs marker placement. */
  axialTilt?: number;
  /**
   * A ring system, as multiples of the body's radius. When present, the world's *view*
   * radius is `radius * outer`, because framing on the sphere alone would put the very thing
   * that makes it Saturn off the edge of the shot.
   */
  rings?: { inner: number; outer: number };
}

/** Breathing room added to the outermost reach when the camera frames a set of worlds. */
export const FRAMING_MARGIN = 0.18;

const earth: WorldGeometry = {
  id: 'earth',
  radius: 1,
  /** Slow enough to feel calm rather than spinny. */
  spin: 0.045,
  /** Purely for looks. */
  axialTilt: 0.41,
};

const moon: WorldGeometry = {
  id: 'moon',
  radius: 0.27,
  orbit: { radius: 2.5, tilt: 0.11, startAngle: 0.62, speed: 0.055 },
  /*
   * There is deliberately no spin. The Moon is tidally locked here, as it is in life, and
   * locking means its surface simply rides the orbit — any rotation of its own would be the
   * thing that unlocks it. It had one, at 0.012, and that is exactly what stopped the near
   * side facing Earth.
   */
  spin: 0,
};

/**
 * Mars is given its own compressed path around the scene centre rather than a real
 * heliocentric orbit. At true scale it would be several thousand Earth-radii away and the
 * Sun is already at 105; this keeps every destination inside one composable frame. Tilt
 * and start angle are chosen to keep it well away from the Moon on screen. Its orbit is
 * slower than the Moon's: an outer body that raced round would read as wrong.
 */
const mars: WorldGeometry = {
  id: 'mars',
  radius: 0.53,
  orbit: { radius: 5.0, tilt: -0.19, startAngle: 3.4, speed: 0.03 },
  spin: 0.02,
};

/**
 * Saturn is the one body whose radius is *not* true to life, and that is deliberate.
 *
 * The rule everywhere else — Moon 0.27, Mars 0.53 — is that radii are real. A gas giant
 * breaks it: Saturn is really 9.1 Earth radii, which at these compressed distances would be
 * larger than the rendered Sun (7) and would dwarf every other body and its own orbit. So
 * its size is compressed the way the *distances* already are. 1.5 still reads clearly as
 * "much the biggest planet" without swallowing the scene. The composition it produces is a
 * thing to watch on the real tablet, not a number to trust from here.
 *
 * Its orbit sits just beyond Mars (5.0), kept as near in as composition allows: the wider
 * the orbit, the further the camera has to pull back to show Saturn for tapping, and the
 * smaller the inner worlds get in that shot. The start angle keeps it clear of Mars (3.4)
 * and the Moon at the opening. The spin is a calm turn like the others, not the real
 * ten-hour day, which would read as spinning.
 *
 * The axial tilt (~26.7° in life) is load-bearing rather than cosmetic: it is the plane the
 * rings lie in, and the equatorial plane the one ring discovery is placed in. The rings are
 * real proportions: the bright rings run from about 1.24 R (inner C/B) to 2.27 R (outer A),
 * with the Cassini Division drawn into the ring texture near 1.95 rather than modelled.
 */
const saturn: WorldGeometry = {
  id: 'saturn',
  radius: 1.5,
  orbit: { radius: 6.6, tilt: 0.15, startAngle: 5.5, speed: 0.018 },
  spin: 0.03,
  axialTilt: 0.47,
  rings: { inner: 1.28, outer: 2.3 },
};

/** In the order they are earned: the home world first, then each world as it is revealed. */
export const WORLDS: readonly WorldGeometry[] = [earth, moon, mars, saturn];

export const WORLD_IDS: readonly string[] = WORLDS.map((world) => world.id);

const BY_ID = new Map(WORLDS.map((world) => [world.id, world]));

export function worldGeometry(id: string): WorldGeometry {
  const world = BY_ID.get(id);
  if (!world) throw new Error(`Unknown world: ${id}`);
  return world;
}

/** How far from the body's centre the shot has to reach to show all of it. */
export function viewRadius(world: WorldGeometry): number {
  return world.rings ? world.radius * world.rings.outer : world.radius;
}

/** How far from the scene centre the world's furthest visible edge can get. */
export function reach(world: WorldGeometry): number {
  return (world.orbit?.radius ?? 0) + viewRadius(world);
}

/**
 * How much of the scene the opening shot tries to fit, given which worlds are drawn.
 *
 * The furthest reach among the revealed worlds, plus a margin. This replaces the three
 * hand-named tiers (Moon, Mars, Saturn) with the rule they were all instances of, so the
 * shot widens exactly when a new world is revealed and never for one that is hidden. The
 * cost is the same as it always was: fitting an outer world shrinks the inner ones, which is
 * why worlds are revealed one at a time rather than all at once. Ids the catalogue does not
 * know are ignored, so stale saved progress cannot break framing.
 */
export function framingRadiusFor(revealedIds: readonly string[]): number {
  let furthest = 0;
  for (const id of revealedIds) {
    const world = BY_ID.get(id);
    if (world) furthest = Math.max(furthest, reach(world));
  }
  return furthest + FRAMING_MARGIN;
}
