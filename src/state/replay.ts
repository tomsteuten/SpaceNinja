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
 * The one gentle hint on the map: the first unvisited world in hint order (`available` is
 * given in that order: Earth, the Moon, Mars, the Sun, Saturn, from src/map/model.ts); then
 * help finish a collection instead of suggesting nothing. It is only ever a suggestion:
 * every world can be flown to at any time.
 *
 * The Sun is an observation visit with no places to find, so it is suggested only until it
 * has been visited; after that only worlds with places left can be the invitation.
 */
export function nextWorld(progress: Progress, available: readonly string[]): string | null {
  const unvisited = available.find(id => DESTINATIONS[id] && !progress.visited.includes(id));
  if (unvisited) return unvisited;
  const worlds = available.filter(id => DESTINATIONS[id]?.mission);
  const collections = worldCollections(progress.discoveries)
    .filter(world => worlds.includes(world.id) && world.found < world.total);
  // A nearly full page is an achievable invitation. Stable ties prevent the map flickering.
  collections.sort((a, b) => b.found / b.total - a.found / a.total);
  return collections[0]?.id ?? null;
}
