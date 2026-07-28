import { TestBed } from '@angular/core/testing';
import { InfluencerUserCardComponent } from './influencer-user-card.component';

describe('InfluencerUserCardComponent — brand-facing suggested pricing', () => {
  function createComponent() {
    TestBed.configureTestingModule({ imports: [InfluencerUserCardComponent] });
    const fixture = TestBed.createComponent(InfluencerUserCardComponent);
    return { fixture, component: fixture.componentInstance };
  }

  it('renders a range across reel/story/video prices', () => {
    const { component } = createComponent();
    component.suggestedPriceRange = { reelPrice: 3000, storyPrice: 5000, videoPrice: 4000 };

    expect(component.suggestedPriceRangeLabel).toBe('₹3,000–₹5,000');
  });

  it('skips null prices when computing the range', () => {
    const { component } = createComponent();
    component.suggestedPriceRange = { reelPrice: 3000, storyPrice: null, videoPrice: null };

    expect(component.suggestedPriceRangeLabel).toBe('₹3,000');
  });

  it('returns null when there is no pricing data at all', () => {
    const { component } = createComponent();
    component.suggestedPriceRange = { reelPrice: null, storyPrice: null, videoPrice: null };

    expect(component.suggestedPriceRangeLabel).toBeNull();
  });

  it('returns null when suggestedPriceRange itself is null', () => {
    const { component } = createComponent();
    component.suggestedPriceRange = null;

    expect(component.suggestedPriceRangeLabel).toBeNull();
  });

  it('renders the price label in the template', () => {
    const { fixture, component } = createComponent();
    component.collaborationScore = 82;
    component.suggestedPriceRange = { reelPrice: 3000, storyPrice: 5000, videoPrice: null };
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement.querySelector('.inf-card__suggested-price');
    expect(el.textContent?.trim()).toBe('₹3,000–₹5,000');
  });
});
