import { TestBed } from '@angular/core/testing';
import { RateReviewNoteComponent } from './rate-review-note.component';
import { markRatesConfirmed, rateReviewFor } from './rate-review.util';

describe('rate review after a tier change', () => {
  const changed = '2026-10-10T03:00:00.000Z';
  const saved = () => [
    {
      socialAccountId: 'a1',
      platform: 'YouTube',
      tier: 'Micro',
      tierChangedAt: changed,
      contentTypes: [
        { name: 'Shorts', enabled: true, price: 800, priceConfirmedAt: '2026-09-01T00:00:00.000Z' },
        { name: 'Video', enabled: true, price: 3000, priceConfirmedAt: null },
        { name: 'Live', enabled: true, price: 2000, priceConfirmedAt: '2026-10-11T00:00:00.000Z' },
      ],
    },
    { socialAccountId: 'a2', platform: 'Instagram', tier: 'Nano', contentTypes: [{ name: 'Reel', enabled: true, price: 500 }] },
  ];

  it('flags rates set before the tier changed (or never confirmed)', () => {
    expect(rateReviewFor({ name: 'YouTube' }, saved())).toEqual({
      socialAccountId: 'a1',
      platform: 'YouTube',
      tier: 'Micro',
      changedAt: changed,
      rates: ['Shorts', 'Video'],
    });
  });

  it('no prompt without a tier change, or once every rate is confirmed', () => {
    expect(rateReviewFor({ name: 'Instagram' }, saved())).toBeNull();
    const confirmed = markRatesConfirmed(saved(), 'a1', '2026-10-12T00:00:00.000Z');
    expect(rateReviewFor({ name: 'YouTube' }, confirmed)).toBeNull();
    // Other accounts are untouched.
    expect(confirmed[1]).toEqual(saved()[1]);
  });

  it('the note offers "These rates are still right" and emits the account', () => {
    TestBed.configureTestingModule({ imports: [RateReviewNoteComponent] });
    const fixture = TestBed.createComponent(RateReviewNoteComponent);
    fixture.componentInstance.review = rateReviewFor({ name: 'YouTube' }, saved());
    const emitted: string[] = [];
    fixture.componentInstance.confirm.subscribe((id: string) => emitted.push(id));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent!.replace(/\s+/g, ' ')).toContain(
      'Your YouTube tier changed to Micro on 10 Oct 2026 — review these rates: Shorts, Video.',
    );
    el.querySelector('button')!.click();
    expect(emitted).toEqual(['a1']);
  });
});
