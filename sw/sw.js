/*
 * The service worker: what makes the game work with no signal.
 *
 * This file is a template. `sw/build.ts` fills in the two placeholders below from the
 * built bundle — Vite hashes its output names, so the list cannot be written down here —
 * and the finished `sw.js` lands at the root of `dist/`. Nothing registers it in
 * development; see the registration in `main.ts`.
 *
 * Three caches, with three different lives:
 *
 * - The *shell* — index.html, the bundle, the manifest, the icons — is precached at
 *   install and served cache-first forever after. Its cache is named after the build, and
 *   a new build's worker deletes the old one on activation. An update therefore arrives
 *   whole, on the launch after the one that fetched it, and never as a new index.html
 *   pointing at scripts that are not there. There is deliberately no network-first here:
 *   a car with one bar of signal is exactly the case this exists for, and network-first
 *   would hang the boot screen on it.
 *
 * - The globe *textures* are precached too, but into the media cache, which is not
 *   named after the build: they do not change when the code does, and re-downloading
 *   three megabytes on every deploy is not a price worth paying. They are added one at a
 *   time and a failure is tolerated, because they are drop-in files that may not exist.
 *   Replace one under the same name and a device that has it cached keeps the old one
 *   until MEDIA_CACHE below is bumped.
 *
 * - The discovery *photographs* are never precached. That is the rule they were built
 *   under: nothing is downloaded until a place is found, and a child who finds three
 *   places fetches three files. A photograph that has been fetched once is kept, so a
 *   place found at home is still there in the car.
 *
 * HEAD requests are the game's own probes for optional files. Online they pass straight
 * through; offline, a probe for something the cache holds is answered from it, or the
 * game would fall back to a generated texture while the real one sat on the device.
 */

const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const TEXTURES = __TEXTURES__;

const SHELL_CACHE = 'spaceninja-shell-' + VERSION;
const MEDIA_CACHE = 'spaceninja-media-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL);
      const media = await caches.open(MEDIA_CACHE);
      await Promise.allSettled(
        TEXTURES.map(async (url) => {
          if (await media.match(url)) return;
          const response = await fetch(url);
          if (response.ok) await media.put(url, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('spaceninja-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.method === 'HEAD') {
    event.respondWith(probe(request));
  } else if (request.method !== 'GET') {
    return;
  } else if (request.mode === 'navigate') {
    event.respondWith(shell(request));
  } else {
    event.respondWith(resource(request));
  }
});

/** Any page load inside the scope is the one page. `?grownups` and friends included. */
async function shell(request) {
  const cached = await caches.match(new URL('index.html', self.registration.scope).href, {
    cacheName: SHELL_CACHE,
  });
  return cached ?? fetch(request);
}

async function resource(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  // Only images are kept: that is the textures and the photographs, and nothing else
  // the page asks for at runtime is worth the space. Sourcemaps in particular are not.
  if (response.ok && (response.headers.get('content-type') ?? '').startsWith('image/')) {
    const media = await caches.open(MEDIA_CACHE);
    await media.put(request, response.clone());
  }
  return response;
}

async function probe(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request.url, { ignoreSearch: true });
    if (cached) return new Response(null, { status: 200, headers: cached.headers });
    throw error;
  }
}
