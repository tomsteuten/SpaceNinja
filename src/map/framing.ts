/** A body as the map shot sees it: where it is and how much room its silhouette needs. */
export interface FramedBody { x: number; y: number; z: number; radius: number }

/**
 * The smallest sphere grown body by body to enclose every silhouette in a neighborhood
 * (Saturn's rings included through its view radius), plus a tenth for breathing room.
 * Pure so it can be tested and shared: the study frames each page with it, and the default
 * map can adopt it once its composition change has been reviewed.
 */
export function neighborhoodBounds(bodies: readonly FramedBody[]): { x: number; y: number; z: number; radius: number } {
  if (!bodies.length) return { x: 0, y: 0, z: 0, radius: 2 };
  let { x, y, z, radius } = bodies[0]!;
  for (const body of bodies.slice(1)) {
    const dx = body.x - x, dy = body.y - y, dz = body.z - z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance + body.radius <= radius) continue;
    if (distance + radius <= body.radius) { ({ x, y, z, radius } = body); continue; }
    const next = (radius + distance + body.radius) / 2;
    if (distance > 0) {
      const shift = (next - radius) / distance;
      x += dx * shift; y += dy * shift; z += dz * shift;
    }
    radius = next;
  }
  return { x, y, z, radius: radius * 1.1 };
}
