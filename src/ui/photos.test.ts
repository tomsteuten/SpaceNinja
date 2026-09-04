import { describe, expect, it } from 'vitest';
import { canBeginPhotoDismiss, canFinishPhotoDismiss } from './photos';

describe('photo viewer opening guard', () => {
  it('rejects the tail of the tap that opened the viewer', () => {
    expect(canBeginPhotoDismiss(1000, 1120, 450)).toBe(false);
  });

  it('rejects the exact edge of the guard window', () => {
    expect(canBeginPhotoDismiss(1000, 1450, 450)).toBe(false);
  });

  it('accepts a later deliberate press', () => {
    expect(canBeginPhotoDismiss(1000, 1451, 450)).toBe(true);
  });
});

describe('photo viewer dismissal gesture', () => {
  it('requires the same pointer to release on the backdrop', () => {
    expect(canFinishPhotoDismiss(7, 7, true)).toBe(true);
    expect(canFinishPhotoDismiss(7, 8, true)).toBe(false);
    expect(canFinishPhotoDismiss(7, 7, false)).toBe(false);
  });

  it('cannot finish when no fresh press armed it', () => {
    expect(canFinishPhotoDismiss(null, 7, true)).toBe(false);
  });
});
