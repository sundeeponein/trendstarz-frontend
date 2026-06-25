export interface PlatformStats {
  totalInfluencers: number;
  verifiedInfluencers: number;
  totalPhotographers: number;
  verifiedPhotographers: number;
  totalBrands: number;
  verifiedBrands: number;
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
