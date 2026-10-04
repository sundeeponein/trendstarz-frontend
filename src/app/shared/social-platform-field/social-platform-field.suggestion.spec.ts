import { TestBed } from '@angular/core/testing';
import { SocialPlatformFieldComponent } from './social-platform-field.component';

describe('SocialPlatformFieldComponent — TrendScore price hints', () => {
  let component: SocialPlatformFieldComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SocialPlatformFieldComponent] });
    component = TestBed.createComponent(SocialPlatformFieldComponent).componentInstance;
    component.priceSuggestion = { reelPrice: 900, storyPrice: 200, videoPrice: 2500 };
  });

  it('maps content types to the matching suggestion', () => {
    expect(component.suggestedPriceFor('Instagram Story')).toBe(200);
    expect(component.suggestedPriceFor('Reel')).toBe(900);
    expect(component.suggestedPriceFor('Shorts / Vertical Reel (30-60s)')).toBe(900);
    expect(component.suggestedPriceFor('YouTube Dedicated Video')).toBe(2500);
    expect(component.suggestedPriceFor('Carousel Post')).toBeNull();
  });

  it('shows nothing without a TrendScore suggestion', () => {
    component.priceSuggestion = null;
    expect(component.suggestedPriceFor('Reel')).toBeNull();
  });

  it('"Use" fills the price and never runs when read-only', () => {
    component.form = { contentTypes: { Reel: { selected: true, price: null } } } as any;
    component.useSuggestedPrice('Reel');
    expect(component.form.contentTypes['Reel'].price).toBe(900);

    component.form.contentTypes['Reel'].price = 100;
    component.readonly = true;
    component.useSuggestedPrice('Reel');
    expect(component.form.contentTypes['Reel'].price).toBe(100);
  });
});
