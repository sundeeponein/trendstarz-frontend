import { tierWithRange } from './tiers.constants';

describe('tierWithRange', () => {
  it('adds the follower range to a tier name', () => {
    expect(tierWithRange('Micro')).toBe('Micro (1,001–10,000 followers)');
    expect(tierWithRange('mid tier')).toBe('Mid-Tier (10,001–100,000 followers)');
    expect(tierWithRange('Mega / Celebrity')).toBe('Mega / Celebrity (1,000,001+ followers)');
  });
  it('an unknown tier stays as it is', () => {
    expect(tierWithRange('Gold')).toBe('Gold');
  });
});
