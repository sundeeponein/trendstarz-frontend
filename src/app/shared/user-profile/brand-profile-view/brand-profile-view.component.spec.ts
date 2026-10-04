import { BrandProfileViewComponent } from './brand-profile-view.component';
import { SocialClickTrackerService } from '../../../services/social-click-tracker.service';

describe('BrandProfileViewComponent social tracking guard', () => {
  function createComponent(options?: {
    isLoggedIn?: boolean;
    socialMediaRestricted?: boolean;
  }) {
    const trackerSpy = jasmine.createSpyObj<SocialClickTrackerService>('SocialClickTrackerService', ['track']);
    const sessionStub = {
      getUser: () => (options?.isLoggedIn ?? true ? { role: 'influencer', isPremium: false } : null),
    };

    const component = new BrandProfileViewComponent(
      {} as any,
      {} as any,
      trackerSpy,
      sessionStub as any,
      { detectChanges: () => {} } as any,
      { setTitle: () => {} } as any,
      { updateTag: () => {} } as any,
      { querySelector: () => null, createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} } } as any,
      'browser' as any,
    );

    component.brand = {
      _id: 'b1',
      socialMediaRestricted: options?.socialMediaRestricted ?? false,
      socialMedia: [{ platform: 'youtube', handle: 'brand_1' }],
    };

    return { component, trackerSpy };
  }

  it('does not track when social profiles are restricted', () => {
    const { component, trackerSpy } = createComponent({ socialMediaRestricted: true, isLoggedIn: true });

    component.onFollowClick();
    component.onPlatformClick({ platform: 'youtube', handle: 'brand_1' });

    expect(trackerSpy.track).not.toHaveBeenCalled();
  });

  it('does not track when viewer is not logged in', () => {
    const { component, trackerSpy } = createComponent({ socialMediaRestricted: false, isLoggedIn: false });

    component.onFollowClick();

    expect(trackerSpy.track).not.toHaveBeenCalled();
  });

  it('tracks when viewer can open social profiles', () => {
    const { component, trackerSpy } = createComponent({ socialMediaRestricted: false, isLoggedIn: true });

    component.onFollowClick();

    expect(trackerSpy.track).toHaveBeenCalledTimes(1);
    expect(trackerSpy.track).toHaveBeenCalledWith(
      jasmine.objectContaining({
        targetUserId: 'b1',
        targetRole: 'brand',
        source: 'brand_profile_follow',
      }),
    );
  });
});
