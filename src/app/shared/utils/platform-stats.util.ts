export interface PlatformStats {
  totalInfluencers: number;
  verifiedInfluencers: number;
  totalPhotographers: number;
  verifiedPhotographers: number;
  totalBrands: number;
  verifiedBrands: number;
  totalCampaigns: number;
  averageRating?: number;
  ratingCount?: number;
  creatorEscrowTotal?: number;
  totalCities?: number;
}

/** Below this many verified profiles, show a qualitative label instead of a (small-looking) real count. */
const VERIFIED_DISPLAY_THRESHOLD = 50;

export function formatBrandsStat(stats: PlatformStats): { label: string; value: string } {
  if ((stats.verifiedBrands || 0) >= VERIFIED_DISPLAY_THRESHOLD) {
    return { label: 'Verified Brands', value: `${stats.verifiedBrands} / ${stats.totalBrands}` };
  }
  return { label: 'Growing Network of', value: 'BRANDS' };
}

export function formatPhotographersStat(stats: PlatformStats): { label: string; value: string } {
  if ((stats.verifiedPhotographers || 0) >= VERIFIED_DISPLAY_THRESHOLD) {
    return { label: 'Verified Photographers', value: `${stats.verifiedPhotographers} / ${stats.totalPhotographers}` };
  }
  return { label: 'Photographers', value: 'Growing the count' };
}

/**
 * Rounds a raw count down to a presentable "milestone" so the badge doesn't need
 * to change every time the underlying count ticks up by one, then suffixes it
 * with "+" (e.g. 108 -> "100+", 537 -> "500+", 23 -> "20+", 4 -> "4").
 */
export function formatMilestoneCount(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n === 0) return '0';
  const step = n >= 1000 ? 500 : n >= 100 ? 50 : n >= 10 ? 10 : 0;
  if (!step) return String(n);
  const floored = Math.floor(n / step) * step;
  return `${floored.toLocaleString('en-IN')}+`;
}

/** Compact rupee amount for headline stats: 14.2 Cr+, 3.5 L+, else plain ₹ with Indian commas. */
export function formatRupeeCompact(amount: number): string {
  const n = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const trim = (v: number) => (Math.floor(v * 10) / 10).toString();
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr+`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L+`;
  return `₹${Math.floor(n).toLocaleString('en-IN')}`;
}
