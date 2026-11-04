import { creatorPayoutBreakdown, formatRupeesFromPaise } from './creator-payout.util';

describe('creatorPayoutBreakdown (same rule as the server)', () => {
  it('agreed launch rates on ₹1,000', () => {
    expect(creatorPayoutBreakdown(100000, 2, 18)).toEqual({ fee: 2000, gst: 360, payout: 97640 });
    expect(creatorPayoutBreakdown(100000, 2.5, 18)).toEqual({ fee: 2500, gst: 450, payout: 97050 });
    expect(creatorPayoutBreakdown(100000, 2, 0)).toEqual({ fee: 2000, gst: 0, payout: 98000 });
  });

  it('shows paise only when there are any', () => {
    expect(formatRupeesFromPaise(97640)).toBe('₹976.40');
    expect(formatRupeesFromPaise(98000)).toBe('₹980');
  });
});
