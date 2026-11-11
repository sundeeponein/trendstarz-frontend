import { PhotographerProfileViewComponent } from './photographer-profile-view.component';
import { SocialClickTrackerService } from '../../../services/social-click-tracker.service';

describe('PhotographerProfileViewComponent social tracking guard', () => {
  function createComponent(options?: {
    isLoggedIn?: boolean;
    socialMediaRestricted?: boolean;
  }) {
    const trackerSpy = jasmine.createSpyObj<SocialClickTrackerService>('SocialClickTrackerService', ['track']);
    const visibilityStub = {
      isLoggedIn: () => options?.isLoggedIn ?? true,
      isPro: () => false,
      isFree: () => true,
      isGuest: () => false,
    };

    const component = new PhotographerProfileViewComponent(
      {} as any,
      {} as any,
      {} as any,
      trackerSpy,
      { getUser: () => ({ role: 'brand' }) } as any,
      visibilityStub as any,
      { detectChanges: () => {} } as any,
      { setTitle: () => {} } as any,
      { updateTag: () => {} } as any,
      { querySelector: () => null, createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} } } as any,
      'browser' as any,
    );

    component.photographer = {
      _id: 'p1',
      socialMediaRestricted: options?.socialMediaRestricted ?? false,
      socialMedia: [{ platform: 'instagram', handle: 'creator_1' }],
    };

    return { component, trackerSpy };
  }

  it('does not track when social profiles are restricted', () => {
    const { component, trackerSpy } = createComponent({ socialMediaRestricted: true, isLoggedIn: true });

    component.onFollowClick();
    component.onPlatformClick({ platform: 'instagram', handle: 'creator_1' });

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
        targetUserId: 'p1',
        targetRole: 'photographer',
        source: 'photographer_profile_follow',
      }),
    );
  });
});
