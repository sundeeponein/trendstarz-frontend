import { InfluencerProfileViewComponent } from './influencer-profile-view.component';
import { SocialClickTrackerService } from '../../../services/social-click-tracker.service';

describe('InfluencerProfileViewComponent social tracking guard', () => {
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

    const component = new InfluencerProfileViewComponent(
      {} as any,
      {} as any,
      { detectChanges: () => {} } as any,
      { getUser: () => ({ role: 'brand' }) } as any,
      visibilityStub as any,
      trackerSpy,
      { setTitle: () => {} } as any,
      { updateTag: () => {} } as any,
      { querySelector: () => null, createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} } } as any,
      'browser' as any,
    );

    component.influencer = {
      _id: 'i1',
      socialMediaRestricted: options?.socialMediaRestricted ?? false,
      socialMedia: [{ platform: 'instagram', handle: 'influencer_1' }],
    };

    return { component, trackerSpy };
  }

  it('does not track when social profiles are restricted', () => {
    const { component, trackerSpy } = createComponent({ socialMediaRestricted: true, isLoggedIn: true });

    component.onFollowClick();
    component.onPlatformClick({ platform: 'instagram', handle: 'influencer_1' });

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
        targetUserId: 'i1',
        targetRole: 'influencer',
        source: 'influencer_profile_follow',
      }),
    );
  });
});
