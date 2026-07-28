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
