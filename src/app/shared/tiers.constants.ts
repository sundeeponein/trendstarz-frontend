/** Canonical order of influencer tiers — used everywhere tiers are sorted/displayed. */
export const TIER_ORDER: readonly string[] = [
  'Starter',
  'Nano',
  'Micro',
  'Mid-Tier',
  'Macro',
  'Mega / Celebrity',
];

/** Follower-range description per canonical tier name (lowercase key). */
export const TIER_DESC_MAP: Record<string, string> = {
  'starter':          '1–100',
  'nano':             '101–1,000',
  'micro':            '1,001–10,000',
  'mid-tier':         '10,001–100,000',
  'mid tier':         '10,001–100,000',
  'macro':            '100,001–1,000,000',
  'mega / celebrity': '1,000,001+',
  'mega/celebrity':   '1,000,001+',
  'mega celebrity':   '1,000,001+',
};

/** Fallback tier rows used when the API returns nothing. */
export const TIER_DEFAULTS: { name: string; desc: string; icon: string }[] = TIER_ORDER.map(name => ({
  name,
  desc: TIER_DESC_MAP[name.toLowerCase()] ?? '',
  icon: '',
}));

/**
 * Normalizes any raw tier string (from DB / API) to a canonical `TIER_ORDER` name.
 * e.g. 'mid tier', 'midtier' → 'Mid-Tier'; 'mega celebrity' → 'Mega / Celebrity'
 */
export function normalizeTierLabel(tier: string): string {
  const t = String(tier || '').trim().replace(/\s*\([^)]*\)\s*$/, '').toLowerCase();
  if (!t) return '';
  if (t === 'starter') return 'Starter';
  if (t === 'nano') return 'Nano';
  if (t === 'micro') return 'Micro';
  if (t === 'mid-tier' || t === 'mid tier' || t === 'midtier') return 'Mid-Tier';
  if (t === 'macro') return 'Macro';
  if (t === 'mega / celebrity' || t === 'mega/celebrity' || t === 'mega celebrity' || t === 'mega') return 'Mega / Celebrity';
  return String(tier || '').trim();
}

/**
 * Extracts and normalizes the primary tier from an influencer object.
 * Checks socialMedia[0].tier first, then any socialMedia entry, then inf.tier.
 */
export function getInfluencerPrimaryTier(inf: any): string {
  const social = Array.isArray(inf?.socialMedia) ? inf.socialMedia : [];
  const raw = social[0]?.tier || social.find((s: any) => s?.tier)?.tier || inf?.tier || '';
  return normalizeTierLabel(raw);
}
