import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearImageProbe, imageExists, probeImage } from './textures';

afterEach(() => {
  clearImageProbe();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('optional image probes', () => {
  it('accepts only image responses', async () => {
    const request = vi.fn().mockResolvedValue(new Response('', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }));
    expect(await probeImage('assets/no-photo.jpg', request)).toBe(false);
  });

  it('times out a slow optional probe and aborts it', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const request = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const result = probeImage('assets/slow.jpg', request, 20);
    await vi.advanceTimersByTimeAsync(20);
    expect(await result).toBe(false);
    expect(signal?.aborted).toBe(true);
  });

  it('retries an unavailable photo instead of caching its failure for the page lifetime', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 200, headers: { 'content-type': 'image/jpeg' } }));
    vi.stubGlobal('fetch', request);
    expect(await imageExists('assets/discoveries/retry.jpg')).toBe(false);
    expect(await imageExists('assets/discoveries/retry.jpg')).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('shares a successful in-flight and completed probe', async () => {
    const request = vi.fn().mockResolvedValue(new Response('', {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));
    vi.stubGlobal('fetch', request);
    await Promise.all([imageExists('assets/one.jpg'), imageExists('assets/one.jpg')]);
    expect(await imageExists('assets/one.jpg')).toBe(true);
    expect(request).toHaveBeenCalledOnce();
  });
});
