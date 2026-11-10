import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../config';
import { BODY_IDS } from '../scene/Bodies';
import { childPages, hintDirection, homePage, MAP_PAGES, pageOf, stepPage, suggestionOrder } from './model';

const pages = childPages(BODY_IDS);

describe('the Space map pages', () => {
  it('puts every built destination on exactly one page', () => {
    const built = new Set<string>([...BODY_IDS, ...Object.keys(DESTINATIONS)]);
    for (const id of built) {
      expect(MAP_PAGES.filter((page) => page.includes(id)), id).toHaveLength(1);
      expect(pages.flat().filter((shown) => shown === id), id).toHaveLength(1);
    }
  });

  it('lists the finished game outward from the Sun, with no world twice', () => {
    const all = MAP_PAGES.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(15);
    expect(MAP_PAGES[0]![0]).toBe('sun');
  });

  it('never shows a child an unbuilt world or an empty page', () => {
    expect(pages).toEqual([['sun'], ['earth', 'moon', 'mars'], ['saturn']]);
    for (const page of pages) for (const id of page) expect(BODY_IDS).toContain(id);
  });

  it('keeps a page once any of its worlds is built, and only that world', () => {
    expect(childPages(['titan', 'earth'])).toEqual([['earth'], ['titan']]);
    expect(childPages([])).toEqual([]);
  });

  it('opens on home and pages without wrapping', () => {
    expect(pages[homePage(pages)]).toContain('earth');
    expect(stepPage(0, -1, 3)).toBe(0);
    expect(stepPage(2, 1, 3)).toBe(2);
    expect(stepPage(1, 1, 3)).toBe(2);
    expect(stepPage(1, -1, 3)).toBe(0);
    expect(pageOf(pages, 'saturn')).toBe(2);
    expect(pageOf(pages, 'jupiter')).toBe(-1);
  });
});

describe('the gentle hint across pages', () => {
  it('suggests home\'s neighbourhood first, then outward from the Sun', () => {
    expect(suggestionOrder(pages)).toEqual(['earth', 'moon', 'mars', 'sun', 'saturn']);
    expect(suggestionOrder(childPages([...BODY_IDS, 'jupiter', 'mercury']))).toEqual(
      ['earth', 'moon', 'mars', 'sun', 'mercury', 'jupiter', 'saturn']);
  });

  it('points at the card on this page, or the arrow towards another page', () => {
    const home = homePage(pages);
    expect(hintDirection(pages, home, 'moon')).toBe(0);
    expect(hintDirection(pages, home, 'sun')).toBe(-1);
    expect(hintDirection(pages, home, 'saturn')).toBe(1);
    expect(hintDirection(pages, 0, 'saturn')).toBe(1);
    expect(hintDirection(pages, 2, 'earth')).toBe(-1);
    expect(hintDirection(pages, home, null)).toBeNull();
    expect(hintDirection(pages, home, 'jupiter')).toBeNull();
  });
});
