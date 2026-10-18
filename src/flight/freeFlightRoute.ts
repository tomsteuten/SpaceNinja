/**
 * On prototype/toybox-pilot free flight is the default at `/` and the guided adventure lives at
 * `?adventure`. Both keep GitHub Pages' repository pathname when switching.
 */
export function isAdventureRoute(search: string): boolean {
  return /[?&]adventure\b/.test(search);
}

export function adventureHref(currentHref: string): string {
  const url = new URL(currentHref);
  url.search = '?adventure';
  url.hash = '';
  return url.href;
}
