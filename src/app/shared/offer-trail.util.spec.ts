import { buildAdminOfferTrailText } from './offer-trail.util';

describe('buildAdminOfferTrailText', () => {
  it('shows the receiver counter amount when the host accepts it', () => {
    const text = buildAdminOfferTrailText({
      status: 'accepted',
      agreedAmount: 6000,
      agreedAmountPaise: 600000,
      campaignAmountPaise: 500000,
      counterOffer: {
        status: 'accepted',
        offeredAmount: 5000,
        offeredAmountPaise: 500000,
        requestedAmount: 6000,
        requestedAmountPaise: 600000,
      },
    });

    expect(text).toContain('Receiver countered');
    expect(text).toContain('₹6,000');
    expect(text).toContain('Host accepted');
  });

  it('uses the accepted counter amount even when final amount is missing', () => {
    const text = buildAdminOfferTrailText({
      status: 'accepted',
      campaignAmountPaise: 500000,
      counterOffer: {
        status: 'accepted',
        offeredAmount: 5000,
        offeredAmountPaise: 500000,
        requestedAmount: 6000,
        requestedAmountPaise: 600000,
      },
    });

    expect(text).toContain('Receiver countered');
    expect(text).toContain('₹6,000');
    expect(text).toContain('Host accepted');
  });
});
