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

describe('BrandProfileViewComponent when the profile cannot load', () => {
  const load = (brandResult: any) => {
    const config = { trackBrandProfileImpression: jasmine.createSpy('trackBrandProfileImpression') };
    const route = {
      data: { subscribe: (fn: (d: any) => void) => fn({ brandResult }) },
      snapshot: { paramMap: { get: () => 'vaarahi-fashions' } },
      parent: null,
    };
    const component = new BrandProfileViewComponent(
      route as any,
      config as any,
      jasmine.createSpyObj<SocialClickTrackerService>('SocialClickTrackerService', ['track']),
      { getUser: () => null } as any,
      { detectChanges: () => {} } as any,
      { setTitle: () => {} } as any,
      { updateTag: () => {} } as any,
      { querySelector: () => null, createElement: () => ({ setAttribute: () => {} }), head: { appendChild: () => {} } } as any,
      'browser' as any,
    );
    component.ngOnInit();
    return { component, config };
  };

  it('not logged in (401): asks to log in instead of "Brand not found"', () => {
    const { component, config } = load({ brand: null, status: 401, message: 'Unauthorized' });
    expect(component.errorKind).toBe('login');
    expect(component.error).toBe("Log in to view this brand's profile.");
    expect(config.trackBrandProfileImpression).not.toHaveBeenCalled();
  });

  it('daily limit (403): shows the server message', () => {
    const { component } = load({ brand: null, status: 403, message: 'Daily limit reached. Upgrade your plan for higher limits.' });
    expect(component.errorKind).toBe('limit');
    expect(component.error).toBe('Daily limit reached. Upgrade your plan for higher limits.');
  });

  it('really missing: "Brand not found."', () => {
    const { component } = load({ brand: null, status: 404, message: '' });
    expect(component.errorKind).toBe('none');
    expect(component.error).toBe('Brand not found.');
  });
});
