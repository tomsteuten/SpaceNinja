import { describe, expect, it } from 'vitest';
import { DISCOVERIES } from '../config';
import { journalPages, journalTotals } from './journal';

describe('explorer journal', () => {
  it('has a page per world holding every configured place, found or not', () => {
    const pages = journalPages(new Set());
    expect(pages.map((page) => page.world.id)).toEqual(['earth', 'moon', 'mars', 'saturn']);
    expect(journalTotals(new Set())).toEqual({ found: 0, total: Object.keys(DISCOVERIES).length });
    for (const page of pages) expect(page.places.every((entry) => !entry.found)).toBe(true);
  });

  it('reads the same discovery ids the classic adventure saved, and ignores unknown ones', () => {
    const found = new Set(['moon-tycho', 'mars-olympus', 'not-a-place']);
    const pages = journalPages(found);
    expect(pages.find((page) => page.world.id === 'moon')!.found).toBe(1);
    expect(pages.find((page) => page.world.id === 'mars')!.found).toBe(1);
    expect(journalTotals(found).found).toBe(2);
  });
});
