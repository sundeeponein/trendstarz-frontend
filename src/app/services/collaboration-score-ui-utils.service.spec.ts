import { CollaborationScoreUiUtilsService } from './collaboration-score-ui-utils.service';

// Single source of truth for the score-tier label/badge shown across the
// whole app — must match the tier copy on the /trendstarz-score marketing
// page exactly (0-49/50-74/75-89/90-100), see that page's scoreLevels list.
describe('CollaborationScoreUiUtilsService — tier labels match the marketing page', () => {
  const service = new CollaborationScoreUiUtilsService();

  it('0-49 is "Needs Improvement" (red/danger)', () => {
    expect(service.scoreTierLabel(0)).toBe('Needs Improvement');
    expect(service.scoreTierLabel(49)).toBe('Needs Improvement');
    expect(service.scoreTierClass(49)).toBe('bg-danger-subtle text-danger-emphasis');
  });

  it('50-74 is "Growing" (orange/warning)', () => {
    expect(service.scoreTierLabel(50)).toBe('Growing');
    expect(service.scoreTierLabel(74)).toBe('Growing');
    expect(service.scoreTierClass(60)).toBe('bg-warning-subtle text-warning-emphasis');
  });

  it('75-89 is "Campaign Ready" (blue/primary)', () => {
    expect(service.scoreTierLabel(75)).toBe('Campaign Ready');
    expect(service.scoreTierLabel(89)).toBe('Campaign Ready');
    expect(service.scoreTierClass(80)).toBe('bg-primary-subtle text-primary-emphasis');
  });

  it('90-100 is "TrendStarZ Recommended ⭐" (green/success)', () => {
    expect(service.scoreTierLabel(90)).toBe('TrendStarZ Recommended ⭐');
    expect(service.scoreTierLabel(100)).toBe('TrendStarZ Recommended ⭐');
    expect(service.scoreTierClass(95)).toBe('bg-success-subtle text-success-emphasis');
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
  };

  it('returns [] when the audit has no sub-score breakdown', () => {
    expect(service.subScores(null)).toEqual([]);
    expect(service.subScores({ profileCompletenessScore: undefined } as any)).toEqual([]);
  });

  it('computes weight × score contribution per criterion, matching the known Sandeep Kumar example', () => {
    const rows = service.subScores(fakeAudit);
    expect(rows).toEqual([
      { label: 'Profile Completeness', value: 85, weight: '15%', contribution: 12.75 },
      { label: 'Content Quality', value: 80, weight: '25%', contribution: 20 },
      { label: 'Posting Consistency', value: 10, weight: '20%', contribution: 2 },
      { label: 'Professional Branding', value: 79, weight: '20%', contribution: 15.8 },
      { label: 'Campaign Readiness', value: 100, weight: '20%', contribution: 20 },
    ]);
    expect(service.subScoresTotal(rows)).toBe(70.55);
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
      { met: true, label: 'TrendStarZ Profile', absentLabel: 'TrendStarZ Profile' },
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
    expect(result?.basedOn.every((item) => item.label === 'TrendStarZ Profile' || !item.met)).toBe(true);
  });
});
