/**
 * The journal's contents, derived from saved progress rather than kept alongside it: one page
 * per world, every place in authored order, found or still to find. Counts come from the
 * configured places, never from a second handwritten total.
 */
import { WORLDS, type ExplorerWorld, type WorldPlace } from './worlds';

export interface JournalPage {
  world: ExplorerWorld;
  places: Array<{ place: WorldPlace; found: boolean }>;
  found: number;
  total: number;
}

export function journalPages(found: ReadonlySet<string>): JournalPage[] {
  return WORLDS.map((world) => {
    const places = world.places.map((place) => ({ place, found: found.has(place.id) }));
    return { world, places, found: places.filter((entry) => entry.found).length, total: places.length };
  });
}

export function journalTotals(found: ReadonlySet<string>) {
  const pages = journalPages(found);
  return {
    found: pages.reduce((sum, page) => sum + page.found, 0),
    total: pages.reduce((sum, page) => sum + page.total, 0),
  };
}
