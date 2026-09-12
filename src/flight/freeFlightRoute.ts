/** Keep GitHub Pages' repository pathname while switching between the two game experiences. */
export function freeFlightHref(currentHref: string): string {
  const url = new URL(currentHref);
  url.search = '?freeflight';
  url.hash = '';
  return url.href;
}

export function adventureHref(currentHref: string): string {
  const url = new URL(currentHref);
  url.search = '';
  url.hash = '';
  return url.href;
}

/** A deliberate desktop shortcut that does not collide with typing or browser modifiers. */
export function isFreeFlightShortcut(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey' | 'repeat'>): boolean {
  return event.key.toLowerCase() === 'f' && event.shiftKey && !event.altKey &&
    !event.ctrlKey && !event.metaKey && !event.repeat;
}
