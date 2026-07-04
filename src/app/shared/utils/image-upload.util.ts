import imageCompression from 'browser-image-compression';

export type ImageUploadPreset = 'profile' | 'gallery' | 'screenshot' | 'cover';

interface PresetConfig {
  /** Target size passed to browser-image-compression. */
  maxSizeMB: number;
  /** Longer-edge cap in px passed to browser-image-compression. */
  maxWidthOrHeight: number;
  /** JPEG/WebP quality (0-1). Ignored for PNG (lossless — canvas.toBlob has no quality knob for it). */
  quality: number;
}

// Profile photos are already run through the crop modal (ngx-image-cropper,
// resizeToWidth 400) before reaching this step, so a smaller target here is
// pure upside — no visible quality loss, smaller stored file.
//
// Screenshots get a bigger dimension ceiling + higher quality than photos:
// they usually contain text, and text gets noticeably blurry/artifacted
// under the same treatment that's invisible on a photo.
const PRESETS: Record<ImageUploadPreset, PresetConfig> = {
  profile: { maxSizeMB: 0.2, maxWidthOrHeight: 400, quality: 0.85 },
  gallery: { maxSizeMB: 0.8, maxWidthOrHeight: 1600, quality: 0.82 },
  screenshot: { maxSizeMB: 1, maxWidthOrHeight: 2000, quality: 0.92 },
  cover: { maxSizeMB: 1, maxWidthOrHeight: 1920, quality: 0.85 },
};

// browser-image-compression's own fallback loop will keep shrinking
// resolution + quality (up to 10 passes by default) until it's under
// maxSizeMB. Left uncapped, a handful of extreme source files (huge
// uncompressed PNGs) would get hammered down repeatedly and come out visibly
// degraded. Capping iterations means: resize once, compress once, at most
// one more adjustment — if that's not enough, we accept the larger result
// and let isOversizedAfterCompression() below decide whether to warn instead
// of silently degrading quality further.
const MAX_COMPRESSION_ITERATIONS = 2;

// Backend multer limit is 10MB (see auth.controller.ts / campaign-invites.controller.ts).
// Anything still above this after our best-effort compression would fail
// server-side anyway — better to tell the user up front than let that 400
// surface as a generic upload failure.
const HARD_CEILING_MB = 8;

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const OVERSIZE_MESSAGE = 'This image is unusually large. Please choose a smaller image.';

/**
 * Type-only validation — never rejects on size. Oversized files are handled
 * by compressing them down (see compressImageFile), not by blocking the user.
 */
export function validateImageFile(file: File): string | null {
  if (!file.type || !ALLOWED_TYPES.includes(file.type)) {
    return 'Please select a JPG, PNG, or WebP image.';
  }
  return null;
}

/**
 * Compresses/resizes an image client-side before upload. Falls back to the
 * original file if compression fails so an upload never gets blocked by it.
 */
export async function compressImageFile(file: File, preset: ImageUploadPreset): Promise<File> {
  const cfg = PRESETS[preset];
  try {
    return await imageCompression(file, {
      maxSizeMB: cfg.maxSizeMB,
      maxWidthOrHeight: cfg.maxWidthOrHeight,
      initialQuality: cfg.quality,
      maxIteration: MAX_COMPRESSION_ITERATIONS,
      useWebWorker: true,
    });
  } catch {
    return file;
  }
}

/** Last-resort check after compression — true only for genuinely extreme sources. */
export function isOversizedAfterCompression(file: File): boolean {
  return file.size > HARD_CEILING_MB * 1024 * 1024;
}
