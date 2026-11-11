/**
 * After an admin or the automatic YouTube correction changed an account's tier,
 * the rates the creator set before that moment may no longer fit: flag them.
 * Uses tierChangedAt (account) and priceConfirmedAt (each rate, 3D-1d).
 */
export interface RateReview {
  socialAccountId: string;
  platform: string;
  tier: string;
  changedAt: string;
  /** Rates set before the tier changed (or never confirmed since tracking began). */
  rates: string[];
}

function time(value: unknown): number | null {
  if (!value) return null;
  const t = new Date(value as string).getTime();
  return Number.isFinite(t) ? t : null;
}

export function rateReviewFor(platform: any, savedSocialMedia: any[]): RateReview | null {
  const name = String(platform?.name || '');
  const entry = (savedSocialMedia || []).find((sm: any) => sm?.platform === name);
  const changed = time(entry?.tierChangedAt);
  if (!entry || changed === null) return null;
  const rates = (Array.isArray(entry.contentTypes) ? entry.contentTypes : [])
    .filter((ct: any) => ct?.enabled !== false && Number(ct?.price) > 0)
    .filter((ct: any) => {
      const confirmed = time(ct?.priceConfirmedAt);
      return confirmed === null || confirmed < changed;
    })
    .map((ct: any) => String(ct?.name || ''))
    .filter(Boolean);
  return rates.length
    ? {
        socialAccountId: String(entry.socialAccountId || ''),
        platform: name,
        tier: String(entry.tier || ''),
        changedAt: String(entry.tierChangedAt),
        rates,
      }
    : null;
}

/** After "these rates are still right": mark that account's rates confirmed locally. */
export function markRatesConfirmed(savedSocialMedia: any[], socialAccountId: string, at: string): any[] {
  return (savedSocialMedia || []).map((sm: any) =>
    sm?.socialAccountId === socialAccountId
      ? { ...sm, contentTypes: (sm.contentTypes || []).map((ct: any) => ({ ...ct, priceConfirmedAt: at })) }
      : sm,
  );
}
