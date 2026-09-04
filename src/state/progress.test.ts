/**
 * The journal is the one thing that survives between sessions, so it is the one thing
 * whose failure a child would actually notice. These cover the paths that are awkward to
 * reach by hand: a corrupted entry, and storage that refuses to work at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FINALE_STICKER,
  STICKERS,
  awardSticker,
  foundEverything,
  loadProgress,
  markVisited,
} from './progress';

const KEY = 'spaceninja.progress.v1';

/** Minimal in-memory stand-in. jsdom would work too, but this needs no extra dependency. */
function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

function useStorage(storage: Storage) {
  vi.stubGlobal('window', { localStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadProgress', () => {
  it('starts empty when nothing has been saved', () => {
    useStorage(fakeStorage());
    expect(loadProgress().stickers).toEqual([]);
    expect(loadProgress().visited).toEqual([]);
  });

  it('treats a save written before visits existed as having been nowhere', () => {
    // Anyone who played the earlier build has one of these in localStorage. It has to
    // load rather than throw, and it has to leave them un-widened rather than crash.
    useStorage(fakeStorage({ [KEY]: JSON.stringify({ stickers: ['moon-explorer'] }) }));
    const progress = loadProgress();
    expect(progress.stickers).toEqual(['moon-explorer']);
    expect(progress.visited).toEqual([]);
  });

  it('reads back what was awarded', () => {
    useStorage(fakeStorage({ [KEY]: JSON.stringify({ stickers: ['moon-explorer'] }) }));
    expect(loadProgress().stickers).toEqual(['moon-explorer']);
  });

  it('survives a corrupted entry rather than throwing', () => {
    useStorage(fakeStorage({ [KEY]: '{not json' }));
    expect(loadProgress().stickers).toEqual([]);
  });

  it('ignores a stored shape it does not recognise', () => {
    useStorage(fakeStorage({ [KEY]: JSON.stringify({ stickers: 'moon-explorer' }) }));
    expect(loadProgress().stickers).toEqual([]);
  });

  it('drops non-string entries but keeps the rest', () => {
    useStorage(fakeStorage({ [KEY]: JSON.stringify({ stickers: ['moon-explorer', 7, null] }) }));
    expect(loadProgress().stickers).toEqual(['moon-explorer']);
  });

  it('survives storage that throws, the way private browsing does', () => {
    useStorage({
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('SecurityError');
      },
    } as unknown as Storage);
    expect(loadProgress().stickers).toEqual([]);
    expect(loadProgress().visited).toEqual([]);
    expect(() => awardSticker('moon-explorer')).not.toThrow();
    expect(() => markVisited('moon')).not.toThrow();
  });
});

describe('awardSticker', () => {
  beforeEach(() => {
    useStorage(fakeStorage());
  });

  it('returns true the first time and false after, so the celebration fires once', () => {
    expect(awardSticker('moon-explorer')).toBe(true);
    expect(awardSticker('moon-explorer')).toBe(false);
    expect(loadProgress().stickers).toEqual(['moon-explorer']);
  });

  it('keeps stickers from different destinations side by side', () => {
    awardSticker('moon-explorer');
    awardSticker('mars-explorer');
    expect(loadProgress().stickers).toEqual(['moon-explorer', 'mars-explorer']);
  });
});

describe('foundEverything', () => {
  const all = ['moon-a', 'moon-b', 'mars-a'];

  it('is false until the last place is found, whatever order they came in', () => {
    expect(foundEverything([], all)).toBe(false);
    expect(foundEverything(['moon-a', 'mars-a'], all)).toBe(false);
    expect(foundEverything(['mars-a', 'moon-b', 'moon-a'], all)).toBe(true);
  });

  it('ignores places that no longer exist in the game', () => {
    // A retired id in an old save must neither count towards the total nor break it.
    expect(foundEverything(['moon-a', 'retired'], all)).toBe(false);
    expect(foundEverything(['moon-a', 'moon-b', 'mars-a', 'retired'], all)).toBe(true);
  });

  it('is never true of a game with nothing to find', () => {
    expect(foundEverything([], [])).toBe(false);
  });

  it('has a sticker to award for it', () => {
    expect(STICKERS[FINALE_STICKER]).toBeDefined();
  });
});

describe('markVisited', () => {
  beforeEach(() => {
    useStorage(fakeStorage());
  });

  it('returns true the first time a body is reached and false after', () => {
    expect(markVisited('moon')).toBe(true);
    expect(markVisited('moon')).toBe(false);
    expect(loadProgress().visited).toEqual(['moon']);
  });

  it('records a visit without awarding a sticker', () => {
    // The whole point of the split: flying somewhere and looking at it widens the world,
    // and collecting is what fills the journal. One must not imply the other.
    markVisited('moon');
    expect(loadProgress().visited).toEqual(['moon']);
    expect(loadProgress().stickers).toEqual([]);
  });

  it('keeps visits and stickers from overwriting each other', () => {
    markVisited('moon');
    awardSticker('moon-explorer');
    markVisited('mars');
    const progress = loadProgress();
    expect(progress.visited).toEqual(['moon', 'mars']);
    expect(progress.stickers).toEqual(['moon-explorer']);
  });
});
