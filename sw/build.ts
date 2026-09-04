/**
 * Turns the service worker template into the file that ships.
 *
 * Pure, so it can be pinned in a test: the Vite plugin in `vite.config.ts` gathers the
 * file names and contents and everything that decides what the worker will do happens
 * here. The two things that matter and are easy to get subtly wrong are both about the
 * version string, and both have a test — see `sw/build.test.ts`.
 */

import { createHash } from 'node:crypto';

export interface ServiceWorkerInput {
  /** The template, `sw/sw.js`. */
  template: string;
  /** Files that make up the shell, relative to the worker: the bundle, the manifest, the icons. */
  shell: string[];
  /** Globe textures to fetch into the media cache at install. Relative to the worker too. */
  textures: string[];
  /**
   * The contents of anything whose name does not change when it does — index.html above
   * all, whose name is always index.html. A worker that only hashed *names* would be
   * byte-identical after a change to the page, and a byte-identical worker is one the
   * browser never installs: the old index.html would be served from cache forever.
   */
  fingerprints: Record<string, Uint8Array | string>;
}

/** Sorted, deduplicated, and made explicitly relative so `addAll` resolves them against the worker. */
function relativeList(files: string[]): string[] {
  const seen = new Set<string>();
  for (const file of files) seen.add('./' + file.replace(/^\.?\//, ''));
  return [...seen].sort();
}

/**
 * Names the build. Every shell file name is in it (they carry Vite's content hashes), and
 * so are the contents of the fingerprinted files, so any change to what the worker would
 * serve produces a different worker.
 */
export function buildVersion(input: Omit<ServiceWorkerInput, 'template'>): string {
  const hash = createHash('sha1');
  for (const file of relativeList(input.shell)) hash.update(file + '\n');
  for (const file of relativeList(input.textures)) hash.update(file + '\n');
  for (const name of Object.keys(input.fingerprints).sort()) {
    hash.update(name + '\n');
    hash.update(input.fingerprints[name] ?? '');
    hash.update('\n');
  }
  return hash.digest('hex').slice(0, 12);
}

export function buildServiceWorker(input: ServiceWorkerInput): string {
  const version = buildVersion(input);
  for (const placeholder of ['__VERSION__', '__SHELL__', '__TEXTURES__']) {
    if (!input.template.includes(placeholder)) {
      throw new Error(`service worker template is missing ${placeholder}`);
    }
  }
  return input.template
    .replace('__VERSION__', version)
    .replace('__SHELL__', JSON.stringify(relativeList(input.shell)))
    .replace('__TEXTURES__', JSON.stringify(relativeList(input.textures)));
}
