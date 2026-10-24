import { TestBed } from '@angular/core/testing';
import { InfluencerUserCardComponent } from './influencer-user-card.component';

describe('InfluencerUserCardComponent — TrendScore on cards', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [InfluencerUserCardComponent] }));

  function render(campaignReady: any, score: number | null = 40) {
    const fixture = TestBed.createComponent(InfluencerUserCardComponent);
    fixture.componentInstance.collaborationScore = score;
    fixture.componentInstance.campaignReady = campaignReady;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the Campaign Ready badge only for ready creators', () => {
    expect(render('Campaign Ready').querySelector('.card-ready-badge')?.textContent).toContain('Campaign Ready');
  });

  it('never shows a low score or "Not Ready" / "Partially Ready" on the card', () => {
    for (const state of ['Not Ready', 'Partially Ready', null]) {
      const el = render(state, 39);
      expect(el.querySelector('.card-ready-badge')).toBeNull();
      expect(el.textContent).not.toContain('Not Ready');
      expect(el.textContent).not.toContain('39');
    }
  });

  it('never shows a suggested price range', () => {
    expect(render('Campaign Ready').querySelector('.inf-card__suggested-price')).toBeNull();
  });
});
