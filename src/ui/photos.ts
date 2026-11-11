/**
 * The real photographs of the worlds' places (the Places card). Named after the place id
 * rather than listed in config.ts: a correctly named file in `public/assets/discoveries/`
 * appears with no code change. Full photos are fetched only when shown, then cached for
 * offline reuse by the service worker; provenance is in `public/assets/discoveries/README.txt`.
 */
export function photoUrl(placeId: string): string {
  return `assets/discoveries/${placeId}.jpg`;
}
