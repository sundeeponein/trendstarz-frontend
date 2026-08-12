import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MonetizationApiService } from './monetization-api.service';
import { SocialClickTrackerService } from './social-click-tracker.service';

describe('SocialClickTrackerService', () => {
  let service: SocialClickTrackerService;
  let monetizationSpy: jasmine.SpyObj<MonetizationApiService>;

  beforeEach(() => {
    monetizationSpy = jasmine.createSpyObj<MonetizationApiService>('MonetizationApiService', ['trackSocialClick']);
    monetizationSpy.trackSocialClick.and.returnValue(of({ success: true, clickId: 'c1' }));

    TestBed.configureTestingModule({
      providers: [
        SocialClickTrackerService,
        { provide: MonetizationApiService, useValue: monetizationSpy },
      ],
    });

    service = TestBed.inject(SocialClickTrackerService);
  });

  it('tracks a valid social click', () => {
    spyOn(Date, 'now').and.returnValue(1000);

    service.track({
      targetUserId: 'u1',
      targetRole: 'influencer',
      platform: 'instagram',
      url: 'https://instagram.com/user',
      source: 'influencer_profile_follow',
    });

    expect(monetizationSpy.trackSocialClick).toHaveBeenCalledTimes(1);
    expect(monetizationSpy.trackSocialClick).toHaveBeenCalledWith({
      targetUserId: 'u1',
      targetRole: 'influencer',
      platform: 'instagram',
      url: 'https://instagram.com/user',
      source: 'influencer_profile_follow',
    });
  });

  it('dedupes rapid repeated clicks on the same key', () => {
    spyOn(Date, 'now').and.returnValues(2000, 2100);

    service.track({
      targetUserId: 'u2',
      targetRole: 'brand',
      platform: 'youtube',
      url: 'https://youtube.com/@brand',
      source: 'brand_profile_platform',
    });

    service.track({
      targetUserId: 'u2',
      targetRole: 'brand',
      platform: 'youtube',
      url: 'https://youtube.com/@brand',
      source: 'brand_profile_platform',
    });

    expect(monetizationSpy.trackSocialClick).toHaveBeenCalledTimes(1);
  });

  it('allows tracking after cooldown and skips invalid urls', () => {
    spyOn(Date, 'now').and.returnValues(3000, 5001, 7000);

    service.track({
      targetUserId: 'u3',
      targetRole: 'photographer',
      platform: '',
      url: 'https://x.com/photo',
      source: 'photographer_profile_follow',
    });

    service.track({
      targetUserId: 'u3',
      targetRole: 'photographer',
      platform: '',
      url: 'https://x.com/photo',
      source: 'photographer_profile_follow',
    });

    service.track({
      targetUserId: 'u3',
      targetRole: 'photographer',
      platform: 'x',
      url: '#',
      source: 'photographer_profile_follow',
    });

    expect(monetizationSpy.trackSocialClick).toHaveBeenCalledTimes(2);
    expect(monetizationSpy.trackSocialClick.calls.argsFor(0)[0].platform).toBe('website');
    expect(monetizationSpy.trackSocialClick.calls.argsFor(1)[0].platform).toBe('website');
  });
});
