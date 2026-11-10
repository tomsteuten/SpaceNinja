/**
 * The Space map's pages: neighbourhoods ordered outward from the Sun, left to right.
 *
 * This list is the one place a world joins the map. It names every destination in the
 * finished game (DECISIONS.md), built or not; a child only ever sees the built ones, and a
 * page with nothing built on it does not exist for them. Adding a world later is adding its
 * id here, once it has a body in the scene.
 */
export const MAP_PAGES: readonly (readonly string[])[] = [
  ['sun', 'mercury', 'venus'],
  ['earth', 'moon', 'mars'],
  ['jupiter', 'io', 'europa'],
  ['saturn', 'titan'],
  ['uranus', 'neptune'],
  ['pluto', 'makemake'],
];

/** Home: a new save opens on this world's page, and the gentle hint starts from it. */
export const HOME_WORLD = 'earth';

/** The pages a child sees: unbuilt worlds removed, and any page left empty dropped. */
export function childPages<T extends string>(
  built: readonly T[],
  pages: readonly (readonly string[])[] = MAP_PAGES,
): T[][] {
  const known = new Set<string>(built);
  return pages
    .map((page) => page.filter((id): id is T => known.has(id)))
    .filter((page) => page.length > 0);
}

/** The page a world is on, or -1 when it is not on any. */
export function pageOf(pages: readonly (readonly string[])[], id: string): number {
  return pages.findIndex((page) => page.includes(id));
}

/** Where a new save opens: home's page (or the first page if home were ever missing). */
export function homePage(pages: readonly (readonly string[])[]): number {
  return Math.max(0, pageOf(pages, HOME_WORLD));
}

/** One step left or right. The map does not wrap: the Sun's side and the far side are ends. */
export function stepPage(current: number, step: number, count: number): number {
  return Math.min(count - 1, Math.max(0, current + step));
}

/**
 * The order the hint suggests worlds in: the home neighbourhood first (Earth, the Moon,
 * Mars), then every other page outward from the Sun. Derived from the page list, so a new
 * world is suggested in its place without a second list to keep in step.
 */
export function suggestionOrder<T extends string>(pages: readonly (readonly T[])[]): T[] {
  const home = homePage(pages);
  return [...(pages[home] ?? []), ...pages.flatMap((page, index) => (index === home ? [] : page))];
}

/**
 * Where the suggested world is from the page being shown: 0 when it is on this page (its
 * card and ring carry the hint), -1 or 1 when the previous or next arrow should carry it,
 * null when nothing is suggested or the world is on no page.
 */
export function hintDirection(
  pages: readonly (readonly string[])[],
  current: number,
  suggested: string | null,
): -1 | 0 | 1 | null {
  if (!suggested) return null;
  const page = pageOf(pages, suggested);
  if (page < 0) return null;
  return page === current ? 0 : page < current ? -1 : 1;
}
