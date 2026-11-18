/**
 * After a deploy, a tab opened before it still points at the old page files,
 * which no longer exist: moving to another page failed with "Failed to fetch
 * dynamically imported module" (seen 2026-11-16). Load that page fresh instead,
 * once — a second failure within a minute is shown as a normal error so a
 * real outage can't cause a reload loop (2026-11-17).
 */

const KEY = 'tsz_stale_chunk_reload_at';
const WINDOW_MS = 60_000;

export function isStaleChunkError(error: unknown): boolean {
  const e = error as any;
  const text = `${e?.name || ''} ${e?.message || e || ''}`;
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(text);
}

/** true = a fresh load of `url` was started (the caller stops there). */
export function reloadForStaleChunk(
  url: string,
  win: { sessionStorage?: Storage; location: { assign(u: string): void } } | undefined = typeof window !== 'undefined' ? window : undefined,
  now = Date.now(),
): boolean {
  if (!win) return false;
  try {
    const last = Number(win.sessionStorage?.getItem(KEY) || 0);
    if (Number.isFinite(last) && now - last < WINDOW_MS) return false;
    win.sessionStorage?.setItem(KEY, String(now));
  } catch {
    // no storage: still try once
  }
  win.location.assign(url || '/');
  return true;
}
