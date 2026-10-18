import { resolveCampaignStatusTab } from './campaign-status.util';

describe('resolveCampaignStatusTab', () => {
  it('keeps a live campaign Active while some creators are still working (CMP-28: 1 done, 2 working)', () => {
    expect(resolveCampaignStatusTab('active', ['approved', 'working', 'payment_confirmed'], false)).toBe('active');
    expect(resolveCampaignStatusTab('active', ['completed', 'submitted'], true)).toBe('active');
  });

  it('keeps a live campaign Active before its end date even when all work is done', () => {
    expect(resolveCampaignStatusTab('active', ['completed'], false)).toBe('active');
  });

  it('moves a live campaign to Completed once all work is done and the end date has passed', () => {
    expect(resolveCampaignStatusTab('active', ['completed', 'approved', 'withdrawn'], true)).toBe('completed');
  });

  it('follows the campaign status when the backend completed or cancelled it', () => {
    expect(resolveCampaignStatusTab('completed', ['working'], false)).toBe('completed');
    expect(resolveCampaignStatusTab('cancelled', [], false)).toBe('completed');
  });

  it('keeps pending campaigns in pending when no work has started', () => {
    expect(resolveCampaignStatusTab('pending', ['pending'], false)).toBe('pending');
  });

  it('moves expired or rejected campaigns to completed', () => {
    expect(resolveCampaignStatusTab('rejected', [], true)).toBe('completed');
  });
});
