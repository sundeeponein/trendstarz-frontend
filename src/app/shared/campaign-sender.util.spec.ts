import { campaignSenderLabel, campaignSenderNote, campaignSenderRole, NOT_INSTAGRAM_COLLAB_NOTE } from './campaign-sender.util';

describe('campaign sender wording', () => {
  it('names every invite a Campaign and says who it is from', () => {
    expect(campaignSenderLabel('brand')).toBe('Campaign · from a Brand');
    expect(campaignSenderLabel('photographer')).toBe('Campaign · from a Photographer');
    expect(campaignSenderLabel('influencer')).toBe('Campaign · from an Influencer');
  });

  it('gives each sender its own note', () => {
    expect(campaignSenderNote('brand')).toContain('agreed description and script');
    expect(campaignSenderNote('photographer')).toContain('Shoot, content creation and delivery');
    expect(campaignSenderNote('influencer')).toContain('Photography, videography and content delivery');
    expect(NOT_INSTAGRAM_COLLAB_NOTE).toContain('not an Instagram native Collab post invitation');
  });

  it('falls back when the role is missing or unknown', () => {
    expect(campaignSenderRole('Influencer')).toBe('influencer');
    expect(campaignSenderRole(undefined)).toBe('brand');
    expect(campaignSenderRole('agency', 'photographer')).toBe('photographer');
  });
});
