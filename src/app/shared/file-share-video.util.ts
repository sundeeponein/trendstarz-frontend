/**
 * "Video (File Share)": the creator sends the video file to the host (Google
 * Drive / Dropbox / … link) instead of posting it on their own social account.
 * Admin only shows/hides the platform; its formats and aspect ratios live here.
 * Keep in sync with the backend copy (src/utils/file-share-video.util.ts).
 */

export const FILE_SHARE_PLATFORM_NAME = 'Video (File Share)';
export const FILE_SHARE_RAW = 'Raw video';
export const FILE_SHARE_EDITED = 'Edited video';
/** Offered to the creator when the host enables both formats: priced as the sum, one folder link. */
export const FILE_SHARE_RAW_AND_EDITED = 'Raw + Edited video';

export const FILE_SHARE_FORMATS: { name: string; hint: string }[] = [
  { name: FILE_SHARE_RAW, hint: 'Original, unedited footage.' },
  { name: FILE_SHARE_EDITED, hint: 'Finished video with cuts, transitions, text or music as agreed in the brief.' },
];

export const FILE_SHARE_ASPECT_RATIOS: { value: string; label: string }[] = [
  { value: '9:16', label: 'Vertical (9:16) — Reels, Shorts and Stories' },
  { value: '16:9', label: 'Horizontal (16:9) — YouTube and website videos' },
  { value: 'both', label: 'Both (9:16 and 16:9)' },
];

const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();

export function isFileSharePlatform(platform: unknown): boolean {
  const p = norm(platform);
  return p === norm(FILE_SHARE_PLATFORM_NAME) || p === 'file_share_video' || p === 'file_share';
}

export function aspectRatioLabel(value: unknown): string {
  const v = String(value ?? '');
  if (v === 'both') return '9:16 + 16:9';
  return v;
}

/**
 * Creator-facing choices for a campaign's File Share row: each enabled format,
 * plus "Raw + Edited video" (sum of both) when the host enabled both.
 */
export function fileShareChoices(row: any): { contentType: string; price: number; aspectRatio: string }[] {
  const enabled = (Array.isArray(row?.contentTypes) ? row.contentTypes : []).filter((ct: any) => ct?.enabled);
  const out = enabled.map((ct: any) => ({
    contentType: String(ct.name || ''),
    price: Number(ct.price) || 0,
    aspectRatio: aspectRatioLabel(ct.aspectRatio),
  }));
  const raw = out.find((o: any) => norm(o.contentType) === norm(FILE_SHARE_RAW));
  const edited = out.find((o: any) => norm(o.contentType) === norm(FILE_SHARE_EDITED));
  if (raw && edited) {
    out.push({
      contentType: FILE_SHARE_RAW_AND_EDITED,
      price: raw.price && edited.price ? raw.price + edited.price : 0,
      aspectRatio: raw.aspectRatio === edited.aspectRatio ? raw.aspectRatio : `${raw.aspectRatio} / ${edited.aspectRatio}`,
    });
  }
  return out;
}

const FILE_SHARE_HOSTS = [
  'drive.google.com', 'docs.google.com', 'dropbox.com', 'onedrive.live.com', '1drv.ms',
  'sharepoint.com', 'wetransfer.com', 'we.tl', 'icloud.com', 'box.com',
];

export function isFileShareLink(url: unknown): boolean {
  let host = '';
  try {
    const text = String(url ?? '').trim();
    // The server adds https:// to a bare link ("drive.google.com/…"), so accept that too.
    host = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  return FILE_SHARE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
