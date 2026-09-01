/**
 * Discovery-journal persistence.
 *
 * localStorage throws outright in some private-browsing modes, so every access is
 * guarded: losing progress must never break the game.
 */

const STORAGE_KEY = 'spaceninja.progress.v1';

export interface StickerDefinition {
  id: string;
  emoji: string;
  label: string;
}

export const STICKERS: Record<string, StickerDefinition> = {
  'moon-explorer': { id: 'moon-explorer', emoji: '🌙', label: 'Moon Explorer' },
};

/** Empty slots shown alongside earned stickers, so the journal looks like a collection. */
export const JOURNAL_SLOTS = 6;

export interface Progress {
  stickers: string[];
}

function read(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stickers: [] };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { stickers: [] };
    const stickers = (parsed as Progress).stickers;
    if (!Array.isArray(stickers)) return { stickers: [] };
    return { stickers: stickers.filter((id): id is string => typeof id === 'string') };
  } catch {
    return { stickers: [] };
  }
}

function write(progress: Progress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable or full. The session still works, it just will not be remembered.
  }
}

export function loadProgress(): Progress {
  return read();
}

/** Returns true only the first time a sticker is earned, so the celebration fires once. */
export function awardSticker(id: string): boolean {
  const progress = read();
  if (progress.stickers.includes(id)) return false;
  progress.stickers.push(id);
  write(progress);
  return true;
}
