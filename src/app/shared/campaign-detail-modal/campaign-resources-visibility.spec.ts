import { CampaignDetailModalComponent } from './campaign-detail-modal.component';

/**
 * Campaign resources (caption, hashtags, promotion link, brand images) are
 * shown to: the accepted creator on their own invite, the host's read-only
 * view, and admin review — never on public previews.
 */
describe('CampaignDetailModal — campaign resources visibility', () => {
  const campaign = {
    _id: 'camp-1',
    hashtags: '#india #trendstarz',
    suggestedCaption: 'Caption',
    promotionUrl: 'www.trendstarz.in',
    promotionUrlType: 'website',
    resourceImages: [],
  };

  function modal(opts: { role?: string; invite?: any; hostView?: boolean; adminReview?: boolean }) {
    const m: any = Object.create(CampaignDetailModalComponent.prototype);
    m.session = { getUser: () => (opts.role ? { role: opts.role } : null) };
    m.invite = opts.invite;
    m.hostView = !!opts.hostView;
    m.adminReview = !!opts.adminReview;
    return m;
  }
  const realInvite = (status: string) => ({ _id: 'inv-1', status, influencerId: 'inf-1', campaign });
  const standIn = { _id: 'camp-1', status: 'accepted', campaign }; // brand profile / campaign list / host view

  it('host view shows everything with the raw link and never creates a tracked link', () => {
    const m = modal({ role: 'brand', invite: standIn, hostView: true });
    expect(m.showCampaignResources).toBeTrue();
    expect(m.showRawPromotionLink).toBeTrue();
    expect(m.showTrackedPromotionLink).toBeFalse();
  });

  it('admin review shows everything with the raw link', () => {
    const m = modal({ role: 'admin', invite: realInvite('pending'), adminReview: true });
    expect(m.showCampaignResources).toBeTrue();
    expect(m.showRawPromotionLink).toBeTrue();
    expect(m.showTrackedPromotionLink).toBeFalse();
  });

  it('an accepted creator on their own invite sees them, with their tracked link', () => {
    for (const status of ['accepted', 'payment_confirmed', 'working', 'submitted', 'approved']) {
      const m = modal({ role: 'influencer', invite: realInvite(status) });
      expect(m.showCampaignResources).withContext(status).toBeTrue();
      expect(m.showTrackedPromotionLink).withContext(status).toBeTrue();
      expect(m.showRawPromotionLink).withContext(status).toBeFalse();
    }
  });

  it('a creator who has not accepted yet does not see them', () => {
    expect(modal({ role: 'influencer', invite: realInvite('pending') }).showCampaignResources).toBeFalse();
  });

  it('public previews (brand profile / campaign list stand-ins) never show them, even to a logged-in creator', () => {
    expect(modal({ role: 'influencer', invite: standIn }).showCampaignResources).toBeFalse();
    expect(modal({ role: 'brand', invite: standIn }).showCampaignResources).toBeFalse();
    expect(modal({ invite: standIn }).showCampaignResources).toBeFalse();
  });

  it('nothing to show → hidden even for the host', () => {
    const empty = { _id: 'c', status: 'accepted', campaign: { _id: 'c' } };
    expect(modal({ role: 'brand', invite: empty, hostView: true }).showCampaignResources).toBeFalse();
  });
});
