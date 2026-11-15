import { TestBed } from '@angular/core/testing';
import { SocialPlatformFieldComponent } from './social-platform-field.component';

describe('SocialPlatformFieldComponent — usual rate range hint (2026-11-15)', () => {
  let component: SocialPlatformFieldComponent;
  const table = {
    Starter: { reel: { min: 50, max: 150 }, video: { min: 90, max: 270 }, story: { min: 50, max: 60 } },
    Macro: { reel: { min: 10000, max: 40000 }, video: { min: 18000, max: 72000 }, story: { min: 4000, max: 16000 } },
    'Mega / Celebrity': { reel: { min: 40000, max: null }, video: { min: 72000, max: null }, story: { min: 16000, max: null } },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SocialPlatformFieldComponent] });
    component = TestBed.createComponent(SocialPlatformFieldComponent).componentInstance;
    component.rateRanges = table as any;
    component.form = { tier: 'Starter', contentTypes: { Reel: { selected: true, price: 50 } } } as any;
  });

  it('maps content types to the range of the selected tier', () => {
    expect(component.rateRangeFor('Instagram Story')).toEqual({ min: 50, max: 60 });
    expect(component.rateRangeFor('Reel')).toEqual({ min: 50, max: 150 });
    expect(component.rateRangeFor('Shorts')).toEqual({ min: 50, max: 150 });
    expect(component.rateRangeFor('YouTube Dedicated Video')).toEqual({ min: 90, max: 270 });
    expect(component.rateRangeFor('Carousel Post')).toBeNull();
  });

  it('follows the dropdown straight away (before saving), whatever the label suffix', () => {
    component.form.tier = 'Macro (100,001-1,000,000)';
    expect(component.rateRangeFor('Reel')).toEqual({ min: 10000, max: 40000 });
    expect(component.rangeText(component.rateRangeFor('Reel')!)).toBe('₹10,000–₹40,000');
    component.form.tier = 'Mega / Celebrity';
    expect(component.rangeText(component.rateRangeFor('Reel')!)).toBe('₹40,000+');
  });

  it('a checked YouTube channel uses the checked tier, not the one typed', () => {
    component.form.tier = 'Macro';
    component.youtubeCheck = { tier: 'Starter', subscribers: 27, status: 'please_update' } as any;
    expect(component.rateRangeFor('Video')).toEqual({ min: 90, max: 270 });
    expect(component.rangeFromCheckedTier).toBeTrue();
    // A channel we couldn't match to them doesn't decide anything.
    component.youtubeCheck = { tier: 'Starter', subscribers: 27, status: 'check_handle' } as any;
    expect(component.rateRangeFor('Video')).toEqual({ min: 18000, max: 72000 });
  });

  it('notes a price above the range; no note within it; nothing without a table', () => {
    expect(component.isAboveRange('Reel')).toBeFalse();
    component.form.contentTypes['Reel'].price = 200;
    expect(component.isAboveRange('Reel')).toBeTrue();
    component.rateRanges = null;
    expect(component.rateRangeFor('Reel')).toBeNull();
  });
});
