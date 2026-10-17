import { resolveCampaignStatusTab } from './campaign-status.util';

describe('resolveCampaignStatusTab', () => {
  it('returns completed when the campaign has completed invite work even if campaign status is still active', () => {
    expect(resolveCampaignStatusTab('active', ['completed'], false)).toBe('completed');
  });

  it('keeps pending campaigns in pending when no work has started', () => {
    expect(resolveCampaignStatusTab('pending', ['pending'], false)).toBe('pending');
  });

  it('moves expired or rejected campaigns to completed', () => {
    expect(resolveCampaignStatusTab('rejected', [], true)).toBe('completed');
  });
});
