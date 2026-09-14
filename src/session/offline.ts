/**
 * Offline, from the second launch on. Only in a build: there is no bundle to cache in
 * development, and a worker there would serve stale modules over the live ones. A browser
 * without the API, or a registration that fails, simply leaves the game as it was.
 *
 * `canReloadNow` gates the one-launch auto-update below: it is asked at the moment a new
 * worker takes over, and answers false once a child is playing so the update waits.
 */
export function registerOffline(canReloadNow: () => boolean) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  /*
   * Land a new build on the launch that fetched it, not the one after.
   *
   * A new build's worker calls skipWaiting()/clients.claim() (see sw/sw.js), so it takes
   * control of this already-open page the instant it activates — that hand-over is
   * `controllerchange`. But the page in front of the child is still the *old* shell it was
   * served at load, so without this it only refreshes to the new build on the next launch:
   * the "open the installed app twice" tax a cache-first PWA otherwise charges, and the
   * thing that makes on-device testing feel like it is caching forever.
   */
  let reloading = false;
  // A brand-new install claims a page that never had a controller; there is no older
  // version to escape, so a reload there would be a pointless flash of the boot screen.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    // Never pull the world out from under a child mid-flight. At the title the swap is
    // invisible; once they have gone somewhere the new build simply waits for next launch,
    // which is exactly the behaviour that was there before this.
    if (!canReloadNow()) return;
    reloading = true;
    window.location.reload();
  });

  // The shell itself stays cache-first and atomic, but the update check for the tiny
  // worker script must reach Pages rather than an HTTP cache holding yesterday's build.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((error: unknown) => {
    console.warn('[offline] not available', error);
  });
}
