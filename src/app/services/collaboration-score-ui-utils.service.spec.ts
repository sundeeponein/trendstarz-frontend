import { CollaborationScoreUiUtilsService } from './collaboration-score-ui-utils.service';

// Tier bands follow the same thresholds the backend uses to award
// campaignReadiness / trendstarzRecommended (defaults 40 / 70 / 80).
describe('CollaborationScoreUiUtilsService — tier labels follow the badge thresholds', () => {
  const service = new CollaborationScoreUiUtilsService();

  it('below 40 is "Needs Improvement" (red/danger)', () => {
    expect(service.scoreTierLabel(0)).toBe('Needs Improvement');
    expect(service.scoreTierLabel(39)).toBe('Needs Improvement');
    expect(service.scoreTierClass(39)).toBe('bg-danger-subtle text-danger-emphasis');
  });

  it('40-69 is "Growing" (orange/warning) — the backend\'s Partially Ready band', () => {
    expect(service.scoreTierLabel(40)).toBe('Growing');
    expect(service.scoreTierLabel(69)).toBe('Growing');
    expect(service.scoreTierClass(60)).toBe('bg-warning-subtle text-warning-emphasis');
  });

  it('70-79 is "Campaign Ready" (blue/primary)', () => {
    expect(service.scoreTierLabel(70)).toBe('Campaign Ready');
    expect(service.scoreTierLabel(79)).toBe('Campaign Ready');
    expect(service.scoreTierClass(75)).toBe('bg-primary-subtle text-primary-emphasis');
  });

  it('80+ is "TrendStarz Recommended ⭐" (green/success)', () => {
    expect(service.scoreTierLabel(80)).toBe('TrendStarz Recommended ⭐');
    expect(service.scoreTierLabel(100)).toBe('TrendStarz Recommended ⭐');
    expect(service.scoreTierClass(95)).toBe('bg-success-subtle text-success-emphasis');
  });

  it('follows admin-changed thresholds and ignores invalid values', () => {
    const s = new CollaborationScoreUiUtilsService();
    s.setThresholds({ trendstarzRecommendedMinScore: 90, campaignReadyMinScore: 75, partiallyReadyMinScore: -5 });
    expect(s.scoreTierLabel(85)).toBe('Campaign Ready');
    expect(s.scoreTierLabel(90)).toBe('TrendStarz Recommended ⭐');
    expect(s.scoreTierLabel(39)).toBe('Needs Improvement'); // partiallyReady stayed at 40
  });
});

describe('CollaborationScoreUiUtilsService — breakdown follows live admin weights', () => {
  it('uses setWeights values for Weight and Contribution, ignoring invalid ones', () => {
    const s = new CollaborationScoreUiUtilsService();
    s.setWeights({ profileCompletion: 10, contentQuality: 30, postingConsistency: 20, professionalBranding: 20, campaignReadiness: 999 as any });
    const rows = s.subScores({
      profileCompletenessScore: 50, contentQualityScore: 100, postingConsistencyScore: 0,
      professionalBrandingScore: 0, campaignReadinessScore: 100, platformsCollected: ['YouTube'],
    } as any);
    expect(rows.map((r) => r.weight)).toEqual(['10%', '30%', '20%', '20%', '20%']);
    expect(rows[1].contribution).toBe(30);
  });
});

describe('CollaborationScoreUiUtilsService — subScores/subScoresTotal', () => {
  const service = new CollaborationScoreUiUtilsService();
  const fakeAudit: any = {
    profileCompletenessScore: 85,
    contentQualityScore: 80,
    postingConsistencyScore: 10,
    professionalBrandingScore: 79,
    campaignReadinessScore: 100,
    collaborationScore: 71,
    platformsCollected: [{ platform: 'YouTube' }],
  };

  it('returns [] when the audit has no sub-score breakdown', () => {
    expect(service.subScores(null)).toEqual([]);
    expect(service.subScores({ profileCompletenessScore: undefined } as any)).toEqual([]);
  });

  it('computes weight × score contribution per criterion, matching the known Sandeep Kumar example', () => {
    const rows = service.subScores(fakeAudit);
    expect(rows).toEqual([
      { label: 'Profile Completeness', value: 85, weight: '15%', contribution: 12.75, noData: false, group: 'Profile' },
      { label: 'Content Quality', value: 80, weight: '25%', contribution: 20, noData: false, group: 'Platform' },
      { label: 'Posting Consistency', value: 10, weight: '20%', contribution: 2, noData: false, group: 'Platform' },
      { label: 'Professional Branding', value: 79, weight: '20%', contribution: 15.8, noData: false, group: 'Profile' },
      { label: 'Campaign Readiness', value: 100, weight: '20%', contribution: 20, noData: false, group: 'Profile' },
    ]);
    expect(service.subScoresTotal(rows)).toBe(70.55);
  });

  // A creator with zero connected platforms genuinely gets 0 for these two
  // criteria (confidenceWeightedAverage([]) === 0) — noData distinguishes
  // "no data exists yet" from "your content/posting is actually bad" so the
  // breakdown UI can show "No platform connected" instead of a flat 0.
  it('flags Content Quality / Posting Consistency as noData when zero platforms are connected', () => {
    const rows = service.subScores({
      ...fakeAudit,
      contentQualityScore: 0,
      postingConsistencyScore: 0,
      platformsCollected: [],
    });
    expect(rows.find((r) => r.label === 'Content Quality')?.noData).toBe(true);
    expect(rows.find((r) => r.label === 'Posting Consistency')?.noData).toBe(true);
    expect(rows.find((r) => r.label === 'Profile Completeness')?.noData).toBe(false);
    expect(rows.find((r) => r.label === 'Campaign Readiness')?.noData).toBe(false);
  });

  it('subScoreGroupSummary splits earned/max points between Profile and Platform groups', () => {
    const rows = service.subScores(fakeAudit);
    // Profile = Profile Completeness(15) + Professional Branding(20) + Campaign Readiness(20) = 55 max
    expect(service.subScoreGroupSummary(rows, 'Profile')).toEqual({ earned: 48.55, max: 55 });
    // Platform = Content Quality(25) + Posting Consistency(20) = 45 max
    expect(service.subScoreGroupSummary(rows, 'Platform')).toEqual({ earned: 22, max: 45 });
  });
});

describe('CollaborationScoreUiUtilsService — confidenceLabel', () => {
  const service = new CollaborationScoreUiUtilsService();

  it('labels 90+ Verified, >0 Beta, 0 Not available', () => {
    expect(service.confidenceLabel(95)).toBe('Verified');
    expect(service.confidenceLabel(35)).toBe('Beta');
    expect(service.confidenceLabel(0)).toBe('Not available');
  });
});

describe('CollaborationScoreUiUtilsService — scoreConfidence', () => {
  const service = new CollaborationScoreUiUtilsService();

  function fakeAudit(overrides: any = {}) {
    return {
      collaborationScore: 0,
      campaignReadiness: 'Not Ready',
      trendstarzRecommended: false,
      portfolioScore: null,
      pricingSuggestion: { reelPrice: null, storyPrice: null, videoPrice: null, currency: 'INR', basis: '' },
      categoryMatch: [],
      createdAt: '2026-01-01',
      ...overrides,
    };
  }

  it('is null when there is no audit', () => {
    expect(service.scoreConfidence(null)).toBeNull();
  });

  it('is High when a platform has rich, verified API data', () => {
    const audit: any = fakeAudit({
      collaborationScore: 90,
      platformsCollected: [{ platform: 'YouTube', method: 'API', confidence: 95, confidenceReason: '' }],
    });

    const result = service.scoreConfidence(audit);

    expect(result?.level).toBe('High');
    expect(result?.basedOn).toEqual([
      { met: true, label: 'TrendStarz Profile', absentLabel: 'TrendStarz Profile' },
      { met: true, label: 'YouTube', absentLabel: 'YouTube not added' },
      { met: false, label: 'Instagram', absentLabel: 'Instagram not connected' },
      { met: false, label: 'Facebook', absentLabel: 'Facebook not connected' },
      { met: false, label: 'LinkedIn', absentLabel: 'LinkedIn (Coming Soon)' },
    ]);
  });

  it('does not mark a 0%-confidence platform as met, even though it is present in platformsCollected', () => {
    const audit: any = fakeAudit({
      collaborationScore: 71,
      platformsCollected: [
        { platform: 'YouTube', method: 'API', confidence: 95, confidenceReason: '' },
        { platform: 'Instagram', method: 'SELF_REPORTED', confidence: 0, confidenceReason: 'not available' },
      ],
    });

    const result = service.scoreConfidence(audit);

    const instagram = result?.basedOn.find((item) => item.label === 'Instagram');
    expect(instagram).toEqual({ met: false, label: 'Instagram', absentLabel: 'Instagram not connected' });
  });

  it('always lists LinkedIn as Coming Soon, never as a real connected/absent state', () => {
    const audit: any = fakeAudit({
      collaborationScore: 20,
      platformsCollected: [{ platform: 'LinkedIn', method: 'SELF_REPORTED', confidence: 0, confidenceReason: '' }],
    });

    const linkedIn = service.scoreConfidence(audit)?.basedOn.find((item) => item.label === 'LinkedIn');

    expect(linkedIn).toEqual({ met: false, label: 'LinkedIn', absentLabel: 'LinkedIn (Coming Soon)' });
  });

  it('is Medium for a connected platform with sparse data', () => {
    const audit: any = fakeAudit({
      collaborationScore: 60,
      platformsCollected: [{ platform: 'Instagram', method: 'API', confidence: 55, confidenceReason: '' }],
    });

    expect(service.scoreConfidence(audit)?.level).toBe('Medium');
  });

  it('is Low when there are no collected platforms at all', () => {
    const audit: any = fakeAudit({ collaborationScore: 20, platformsCollected: [] });

    const result = service.scoreConfidence(audit);

    expect(result?.level).toBe('Low');
    expect(result?.basedOn.every((item) => item.label === 'TrendStarz Profile' || !item.met)).toBe(true);
  });
});
