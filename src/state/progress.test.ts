/**
 * The journal is the one thing that survives between sessions, so it is the one thing
 * whose failure a child would actually notice. These cover the paths that are awkward to
 * reach by hand: a corrupted entry, and storage that refuses to work at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { awardSticker, loadProgress } from './progress';

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
    expect(() => awardSticker('moon-explorer')).not.toThrow();
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
