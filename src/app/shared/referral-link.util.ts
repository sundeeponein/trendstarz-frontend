export type ReferralLinkRole = 'influencer' | 'brand' | 'photographer';

export const REFERRAL_LINK_SITE_URL = 'https://trendstarz.in';

export const REFERRAL_LINK_ROUTES: Record<ReferralLinkRole, { path: string; campaign: string }> = {
  influencer: { path: 'register-influencer', campaign: 'influencer_reg' },
  brand: { path: 'register-brand', campaign: 'brand_reg' },
  photographer: { path: 'register-photographer', campaign: 'photographer_reg' },
};

export function slugifyReferralUsername(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Builds a trackable trendstarz.in registration link for the given role/username/platform. */
export function buildReferralLink(role: ReferralLinkRole, username: string, platform?: string): string {
  const slug = slugifyReferralUsername(username);
  if (!slug) return '';
  const route = REFERRAL_LINK_ROUTES[role];
  let link = `${REFERRAL_LINK_SITE_URL}/${route.path}?utm_source=${encodeURIComponent(slug)}&utm_medium=social&utm_campaign=${route.campaign}`;
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  if (normalizedPlatform) {
    link += `&utm_content=${encodeURIComponent(normalizedPlatform)}`;
  }
  return link;
}

export const PROMOTION_URL_TYPE_LABELS: Record<string, string> = {
  website: 'Website',
  app_store: 'App Store',
  play_store: 'Play Store',
  instagram: 'Instagram Profile',
  facebook: 'Facebook Page',
  youtube: 'YouTube Channel',
  whatsapp: 'WhatsApp Link',
  other: 'Link',
};

export function promotionUrlTypeLabel(type: unknown): string {
  return PROMOTION_URL_TYPE_LABELS[String(type || '').trim().toLowerCase()] || 'Link';
}

/** Short campaign id shown to users, e.g. "CMP-000042" or "CMP-A1B2C3" as a fallback. */
export function campaignIdLabel(campaign: { campaignNumber?: number; _id?: string } | null | undefined): string {
  const num = Number(campaign?.campaignNumber);
  if (num > 0) return `CMP-${num}`;
  const id = String(campaign?._id || '');
  return id ? `CMP-${id.slice(-6).toUpperCase()}` : '';
}

/** Copies text to the clipboard, falling back to a hidden textarea when the Clipboard API is unavailable. */
export function copyTextToClipboard(text: string): void {
  if (!text) return;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document === 'undefined') return;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
