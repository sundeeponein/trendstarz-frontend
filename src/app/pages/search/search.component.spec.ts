import { SearchComponent } from './search.component';

describe('SearchComponent profile view gating', () => {
  function createComponent(user: { role: 'brand' | 'influencer' | 'photographer'; isPremium?: boolean } | null) {
    const sessionStub = {
      getUser: () => user,
    };

    const component = new SearchComponent(
      {} as any,
      sessionStub as any,
      {} as any,
      {} as any,
      { detectChanges: () => {} } as any,
      { snapshot: { queryParamMap: { get: () => null } } } as any,
      { navigate: () => Promise.resolve(true) } as any,
      'browser' as any,
    );

    return component;
  }

  describe('isInfluencerProfileViewDisabled', () => {
    it('disables for Starter brand users', () => {
      const component = createComponent({ role: 'brand', isPremium: false });

      expect(component.isInfluencerProfileViewDisabled({ socialMediaRestricted: false })).toBeTrue();
      expect(component.isInfluencerProfileViewDisabled({ socialMediaRestricted: true })).toBeTrue();
    });

    it('does not disable for Premium brand users', () => {
      const component = createComponent({ role: 'brand', isPremium: true });

      expect(component.isInfluencerProfileViewDisabled({ socialMediaRestricted: false })).toBeFalse();
      expect(component.isInfluencerProfileViewDisabled({ socialMediaRestricted: true })).toBeFalse();
    });

    it('does not disable for influencer users', () => {
      const component = createComponent({ role: 'influencer', isPremium: false });

      expect(component.isInfluencerProfileViewDisabled({ socialMediaRestricted: true })).toBeFalse();
    });

    it('does not disable for photographer users', () => {
      const component = createComponent({ role: 'photographer', isPremium: false });

      expect(component.isInfluencerProfileViewDisabled({ socialMediaRestricted: true })).toBeFalse();
    });

    it('disables for guests', () => {
      const component = createComponent(null);

      expect(component.isInfluencerProfileViewDisabled({ socialMediaRestricted: true })).toBeTrue();
    });
  });

  describe('isPhotographerProfileViewDisabled', () => {
    it('disables for Starter brand users', () => {
      const component = createComponent({ role: 'brand', isPremium: false });

      expect(component.isPhotographerProfileViewDisabled({ socialMediaRestricted: false })).toBeTrue();
      expect(component.isPhotographerProfileViewDisabled({ socialMediaRestricted: true })).toBeTrue();
    });

    it('does not disable for Premium brand users', () => {
      const component = createComponent({ role: 'brand', isPremium: true });

      expect(component.isPhotographerProfileViewDisabled({ socialMediaRestricted: false })).toBeFalse();
      expect(component.isPhotographerProfileViewDisabled({ socialMediaRestricted: true })).toBeFalse();
    });

    it('does not disable for influencer users', () => {
      const component = createComponent({ role: 'influencer', isPremium: false });

      expect(component.isPhotographerProfileViewDisabled({ socialMediaRestricted: true })).toBeFalse();
    });

    it('does not disable for photographer users', () => {
      const component = createComponent({ role: 'photographer', isPremium: false });

      expect(component.isPhotographerProfileViewDisabled({ socialMediaRestricted: true })).toBeFalse();
    });

    it('disables for guests', () => {
      const component = createComponent(null);

      expect(component.isPhotographerProfileViewDisabled({ socialMediaRestricted: true })).toBeTrue();
    });
  });
});
