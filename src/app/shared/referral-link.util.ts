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
