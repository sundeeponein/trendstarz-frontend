import { buildOutreachLink, slug } from './outreach-link.util';

describe('outreach links (2026-11-16)', () => {
  it('tags the page with source, kind and campaign', () => {
    expect(
      buildOutreachLink('https://trendstarz.in/', { page: '/creator-shortlist', source: 'whatsapp', medium: 'Community', campaign: 'Warangal Boutiques Nov' }),
    ).toBe('https://trendstarz.in/creator-shortlist?utm_source=whatsapp&utm_medium=community&utm_campaign=warangal-boutiques-nov');
    expect(buildOutreachLink('https://trendstarz.in', { page: '/', source: 'qr' })).toBe('https://trendstarz.in/?utm_source=qr');
  });

  it('keeps names URL-safe', () => {
    expect(slug('  Diwali — Offer!! ')).toBe('diwali-offer');
  });
});
