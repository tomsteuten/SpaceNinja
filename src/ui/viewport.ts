/** Optical center for the clear playfield above the approved action row, in CSS pixels. */
export function adventureViewOffset(width: number, height: number, visiting: boolean, teaching: boolean): number {
  if (!visiting || width < 600) return 0;
  if (height <= 480) return teaching ? 16 : 42;
  return teaching ? 0 : 12;
}
