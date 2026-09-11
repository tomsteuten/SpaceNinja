import { DESTINATIONS } from '../config';
import type { Progress } from './progress';

export function worldCollections(found: readonly string[]) {
  const ids = new Set(found);
  return Object.entries(DESTINATIONS).map(([id, world]) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    emoji: world.emoji,
    found: world.mission.discoveries.filter(d => ids.has(d.id)).length,
    total: world.mission.discoveries.length,
  }));
}

/** Unvisited worlds first; then help finish a collection instead of suggesting nothing. */
export function nextWorld(progress: Progress, available: readonly string[]): string | null {
  const unvisited = [...available].reverse().find(id => id !== 'earth' && !progress.visited.includes(id))
    ?? available.find(id => !progress.visited.includes(id));
  if (unvisited) return unvisited;
  const collections = worldCollections(progress.discoveries)
    .filter(world => available.includes(world.id) && world.found < world.total);
  // A nearly full page is an achievable invitation. Stable ties prevent the map flickering.
  collections.sort((a, b) => b.found / b.total - a.found / a.total);
  return collections[0]?.id ?? null;
}
