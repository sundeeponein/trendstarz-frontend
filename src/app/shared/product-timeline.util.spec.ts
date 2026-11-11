import { hasProductTimeline, previewProductTimeline, productTimelineNumbers, releaseAvailableAt, ymd } from './product-timeline.util';

describe('product timeline (frontend preview, same rules as the server)', () => {
  it('start 11 Nov: accept by 13, ship by 15, posts from 18, needs 8 days', () => {
    const p = previewProductTimeline('2026-11-11', productTimelineNumbers(null));
    expect(ymd(p.acceptBy)).toBe('2026-11-13');
    expect(ymd(p.shipBy)).toBe('2026-11-15');
    expect(ymd(p.earliestPost)).toBe('2026-11-18');
    expect(p.minDays).toBe(8);
  });

  it('uses the admin numbers', () => {
    const n = productTimelineNumbers({ productAcceptanceDays: 3, productShipByDays: 1, productShippingDays: 4 });
    const p = previewProductTimeline('2026-11-11', n);
    expect(ymd(p.acceptBy)).toBe('2026-11-14');
    expect(ymd(p.shipBy)).toBe('2026-11-15');
    expect(ymd(p.earliestPost)).toBe('2026-11-18');
  });

  it('leave-without-penalty opens at 00:00 IST, 3 days after the ship-by day', () => {
    // Ship-by 15 Nov 23:59:59.999 IST
    const shipBy = new Date('2026-11-15T18:29:59.999Z');
    expect(releaseAvailableAt(shipBy).toISOString()).toBe('2026-11-17T18:30:00.000Z');
  });

  it('only campaigns stamped with the timeline use it', () => {
    expect(hasProductTimeline({ productTimeline: true, shipByDate: '2026-11-15T18:29:59.999Z' })).toBeTrue();
    expect(hasProductTimeline({ campaignType: 'product', productShippingRequired: true })).toBeFalse();
  });
});
