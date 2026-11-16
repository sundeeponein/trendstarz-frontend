/**
 * Tagged links for outreach (growth plan move 5, 2026-11-16). Every link we
 * share carries utm_source / utm_medium / utm_campaign, so a signup or a
 * shortlist request records where it came from (the site remembers the first
 * tagged visit for 60 days).
 */

export const OUTREACH_PAGES = [
  { path: '/creator-shortlist', label: 'Brand: get a creator shortlist' },
  { path: '/register-brand', label: 'Brand sign-up' },
  { path: '/how-it-works/brands', label: 'Brand: how it works' },
  { path: '/register-influencer', label: 'Creator sign-up' },
  { path: '/register-photographer', label: 'Photographer sign-up' },
  { path: '/', label: 'Home page' },
];

export const OUTREACH_SOURCES = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'email', label: 'Email' },
  { key: 'qr', label: 'Poster / QR code' },
  { key: 'event', label: 'Event / in person' },
];

/** lower-case, words joined by "-", only a–z 0–9 - _ (safe in a URL and readable in reports). */
export function slug(value: unknown, max = 60): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

export function buildOutreachLink(
  site: string,
  opts: { page: string; source: string; medium?: string; campaign?: string },
): string {
  const base = String(site || '').replace(/\/$/, '');
  const params = new URLSearchParams();
  const source = slug(opts.source);
  if (source) params.set('utm_source', source);
  const medium = slug(opts.medium);
  if (medium) params.set('utm_medium', medium);
  const campaign = slug(opts.campaign);
  if (campaign) params.set('utm_campaign', campaign);
  const qs = params.toString();
  const path = opts.page && opts.page.startsWith('/') ? opts.page : '/';
  return `${base}${path === '/' ? '/' : path}${qs ? `?${qs}` : ''}`;
}
