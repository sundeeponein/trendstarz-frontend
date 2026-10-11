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
 * Open-campaign tier rule (matches the backend's meetsMinimumTier): the
 * creator's tier is AT LEAST the campaign minimum, by TIER_ORDER. No minimum,
 * or an unrecognised minimum, means no restriction; an unrecognised creator
 * tier never qualifies.
 */
export function meetsMinimumTier(creatorTier: string | null | undefined, minimumTier: string | null | undefined): boolean {
  const minIdx = TIER_ORDER.indexOf(normalizeTierLabel(minimumTier || ''));
  if (minIdx === -1) return true;
  const idx = TIER_ORDER.indexOf(normalizeTierLabel(creatorTier || ''));
  return idx !== -1 && idx >= minIdx;
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

/**
 * Tier dropdown options that always include the creator's CURRENT tier, even
 * when that tier is hidden for new selections (Starter/Nano have
 * showInFrontend=false but existing creators still hold them). Without this
 * the <select> renders blank for them. The stored value is used verbatim as
 * the option value, so saving never converts it.
 */
export function tierOptionsWithCurrent(tiers: any[] | null | undefined, current: unknown): any[] {
  const list = Array.isArray(tiers) ? tiers : [];
  const value = String(current ?? '').trim();
  if (!value || list.some((t: any) => String(t?.name ?? '') === value)) return list;
  const canonical = normalizeTierLabel(value);
  return [...list, { name: value, desc: TIER_DESC_MAP[canonical.toLowerCase()] ?? '', hiddenCurrent: true }];
}

/** "Micro (1,001–10,000 followers)" — the tier with its follower range, for notices. */
export function tierWithRange(tier: string): string {
  const name = normalizeTierLabel(tier) || String(tier || '').trim();
  const range = TIER_DESC_MAP[name.toLowerCase()];
  return range ? `${name} (${range} followers)` : name;
}
