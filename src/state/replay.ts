import { DESTINATIONS } from '../config';
import type { Progress } from './progress';

export function worldCollections(found: readonly string[]) {
  const ids = new Set(found);
  return Object.entries(DESTINATIONS).flatMap(([id, world]) => world.mission ? [{
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    emoji: world.emoji,
    found: world.mission.discoveries.filter(d => ids.has(d.id)).length,
    total: world.mission.discoveries.length,
  }] : []);
}

/**
 * Unvisited worlds first; then help finish a collection instead of suggesting nothing.
 *
 * Only worlds with places to find are suggested. The Sun is an observation visit with no
 * task, and it is not drawn on the home map (it sits behind the camera), so a "Tap Sun"
 * hint and a ship nose aimed at it pointed at nothing on screen. Its button stays available.
 */
export function nextWorld(progress: Progress, available: readonly string[]): string | null {
  const worlds = available.filter(id => DESTINATIONS[id]?.mission);
  const unvisited = [...worlds].reverse().find(id => id !== 'earth' && !progress.visited.includes(id))
    ?? worlds.find(id => !progress.visited.includes(id));
  if (unvisited) return unvisited;
  const collections = worldCollections(progress.discoveries)
    .filter(world => worlds.includes(world.id) && world.found < world.total);
  // A nearly full page is an achievable invitation. Stable ties prevent the map flickering.
  collections.sort((a, b) => b.found / b.total - a.found / a.total);
  return collections[0]?.id ?? null;
}
