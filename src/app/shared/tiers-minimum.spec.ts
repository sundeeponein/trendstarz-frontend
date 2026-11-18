import { meetsMinimumTier } from './tiers.constants';

describe('meetsMinimumTier (open campaigns: this tier or above)', () => {
  it('at or above the minimum qualifies', () => {
    for (const tier of ['Micro', 'Mid-Tier', 'Macro', 'Mega / Celebrity', 'mid tier']) {
      expect(meetsMinimumTier(tier, 'Micro')).withContext(tier).toBeTrue();
    }
  });
  it('below the minimum or unreadable does not', () => {
    for (const tier of ['Nano', 'Starter', '', 'Gold']) {
      expect(meetsMinimumTier(tier, 'Micro')).withContext(tier).toBeFalse();
    }
  });
  it('no or unrecognised minimum means no restriction', () => {
    expect(meetsMinimumTier('Nano', '')).toBeTrue();
    expect(meetsMinimumTier('Nano', null)).toBeTrue();
    expect(meetsMinimumTier('Nano', 'Gold')).toBeTrue();
  });
});
