/**
 * Stage 3B-1 (T1) — where a campaign's target location is stored.
 *
 * The district the brand selects is saved to `targetDistrict` — the field
 * open-campaign eligibility, campaign alerts and location labels read.
 * Older saves put it only in `targetCities[0]`; `targetCities` is still written
 * with the same single district so existing readers keep working, and is read
 * back only as a legacy fallback. A district is never kept without a state.
 */
export interface CampaignTargetLocationPayload {
  targetState: string;
  targetDistrict: string;
  targetCities: string[];
}

export function campaignTargetLocationPayload(
  state: unknown,
  district: unknown,
): CampaignTargetLocationPayload {
  const s = typeof state === 'string' ? state.trim() : '';
  const d = s && typeof district === 'string' ? district.trim() : '';
  return { targetState: s, targetDistrict: d, targetCities: d ? [d] : [] };
}

/** District to show when editing: the proper field first, then the legacy targetCities[0]. */
export function campaignTargetDistrictOf(campaign: any): string {
  const proper = typeof campaign?.targetDistrict === 'string' ? campaign.targetDistrict.trim() : '';
  if (proper) return proper;
  const legacy = Array.isArray(campaign?.targetCities) ? campaign.targetCities[0] : '';
  return typeof legacy === 'string' ? legacy.trim() : '';
}
