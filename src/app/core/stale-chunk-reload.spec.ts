import { isStaleChunkError, reloadForStaleChunk } from './stale-chunk-reload';

describe('stale page files after a deploy (2026-11-17)', () => {
  const fakeWin = () => {
    const store = new Map<string, string>();
    return {
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } as any,
      location: { assign: jasmine.createSpy('assign') },
    };
  };

  it('recognises the browsers\' messages for a missing page file', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://trendstarz.in/chunk-X.js'))).toBeTrue();
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBeTrue();
    expect(isStaleChunkError({ name: 'ChunkLoadError', message: 'x' })).toBeTrue();
    expect(isStaleChunkError(new Error('Cannot read properties of null'))).toBeFalse();
  });

  it('loads the page fresh once, and not again within a minute', () => {
    const win = fakeWin();
    expect(reloadForStaleChunk('/campaigns', win, 1_000_000)).toBeTrue();
    expect(win.location.assign).toHaveBeenCalledWith('/campaigns');
    expect(reloadForStaleChunk('/campaigns', win, 1_030_000)).toBeFalse();
    expect(reloadForStaleChunk('/search', win, 1_070_000)).toBeTrue();
  });
});
