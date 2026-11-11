/**
 * Every invite is a "Campaign"; the sender's role tells the recipient what is
 * expected. Creators read "collaboration" as Instagram's native Collab-post
 * request, so the wording says plainly that this is a TrendStarZ campaign.
 */
export type CampaignSenderRole = 'brand' | 'photographer' | 'influencer';

export function campaignSenderRole(role: unknown, fallback: CampaignSenderRole = 'brand'): CampaignSenderRole {
  const r = String(role || '').trim().toLowerCase();
  return r === 'brand' || r === 'photographer' || r === 'influencer' ? r : fallback;
}

/** "Campaign · from a Brand" / "· from a Photographer" / "· from an Influencer". */
export function campaignSenderLabel(role: CampaignSenderRole): string {
  if (role === 'photographer') return 'Campaign · from a Photographer';
  if (role === 'influencer') return 'Campaign · from an Influencer';
  return 'Campaign · from a Brand';
}

export function campaignSenderIcon(role: CampaignSenderRole): string {
  if (role === 'photographer') return 'bi-camera-reels';
  if (role === 'influencer') return 'bi-person-video3';
  return 'bi-megaphone';
}

/** What the recipient is agreeing to, by who sent the campaign. */
export function campaignSenderNote(role: CampaignSenderRole): string {
  if (role === 'photographer') return 'Shoot, content creation and delivery requirements must follow the agreed brief.';
  if (role === 'influencer') return 'Photography, videography and content delivery requirements must follow the agreed brief.';
  return 'Content must follow the agreed description and script. Social posting requirements depend on the campaign.';
}

export const NOT_INSTAGRAM_COLLAB_NOTE =
  'This is a TrendStarZ campaign invitation, not an Instagram native Collab post invitation.';
