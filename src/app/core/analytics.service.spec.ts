import { AnalyticsService } from './analytics.service';

describe('AnalyticsService landing utm', () => {
  it('keeps only utm_* from the landing URL', () => {
    expect(
      AnalyticsService.readLandingUtm('?open=abc&utm_source=whatsapp&utm_medium=community&utm_campaign=CMP-30&token=secret'),
    ).toBe('?utm_source=whatsapp&utm_medium=community&utm_campaign=CMP-30');
  });

  it('finds utm_* inside the login returnUrl when signed out', () => {
    const returnUrl = encodeURIComponent('/campaigns?open=abc&utm_source=whatsapp&utm_medium=community&utm_campaign=CMP-30');
    expect(AnalyticsService.readLandingUtm(`?returnUrl=${returnUrl}`)).toBe(
      '?utm_source=whatsapp&utm_medium=community&utm_campaign=CMP-30',
    );
  });

  it('is empty without utm', () => {
    expect(AnalyticsService.readLandingUtm('?returnUrl=%2Fcampaigns%3Fopen%3Dabc')).toBe('');
    expect(AnalyticsService.readLandingUtm('')).toBe('');
  });
});
