import { SearchComponent } from './search.component';
import { CollaborationScoreUiUtilsService } from '../../services/collaboration-score-ui-utils.service';

describe('SearchComponent profile view gating', () => {
  function createComponent(user: { role: 'brand' | 'influencer' | 'photographer' | 'admin'; isPremium?: boolean } | null) {
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
      new CollaborationScoreUiUtilsService(),
      { onDestroy: () => () => {} } as any,
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

describe('SearchComponent TrendScore view (brand TrendScore tab)', () => {
  function create(view: string | null = null) {
    const component = new SearchComponent(
      {} as any,
      { getUser: () => ({ role: 'brand', isPremium: false }) } as any,
      {} as any,
      {} as any,
      { detectChanges: () => {} } as any,
      { snapshot: { queryParamMap: { get: () => null } } } as any,
      { navigate: () => Promise.resolve(true) } as any,
      new CollaborationScoreUiUtilsService(),
      { onDestroy: () => () => {} } as any,
      'browser' as any,
    );
    component.activeTab = 'influencers';
    (component as any).applyTrendScoreViewParam(view);
    return component;
  }
  const creator = (name: string, collaborationScore: number | null | undefined) => ({ _id: name, name, collaborationScore });

  it('shows the TrendScore heading and sorts by TrendScore when view=trendscore', () => {
    const c = create('trendscore');
    expect(c.trendScoreView).toBeTrue();
    expect(c.pageTitle).toBe('Find creators by TrendScore');
    expect(c.heroSubtitle).toBe('Discover and compare creators using TrendScore and other creator signals.');
    expect(c.sortBy).toBe('trendscore_high');
  });

  it('keeps the normal heading and sort without the view param', () => {
    const c = create(null);
    expect(c.trendScoreView).toBeFalse();
    expect(c.pageTitle).toBe('Discover High-Impact Creators & Influencers');
    expect(c.sortBy).toBe('recommended');
  });

  it('leaving the view restores the default sort', () => {
    const c = create('trendscore');
    (c as any).applyTrendScoreViewParam(null);
    expect(c.trendScoreView).toBeFalse();
    expect(c.sortBy).toBe('recommended');
  });

  it('TrendScore: High to Low puts unscored creators last instead of treating them as 0', () => {
    const c = create('trendscore');
    c.allInfluencers = [creator('none', null), creator('low', 20), creator('missing', undefined), creator('high', 90), creator('zero', 0)];
    c.applyInfluencerFilters();
    expect(c.filteredInfluencers.map((u: any) => u.name).slice(0, 3)).toEqual(['high', 'low', 'zero']);
    expect(c.filteredInfluencers.map((u: any) => u.name).slice(3).sort()).toEqual(['missing', 'none']);
  });

  it('filters by TrendScore band using the live score thresholds', () => {
    const c = create();
    c.allInfluencers = [creator('a', null), creator('b', 30), creator('c', 45), creator('d', 75), creator('e', 85)];
    const names = (band: any) => {
      c.infFilters.trendScore = band;
      c.applyInfluencerFilters();
      return c.filteredInfluencers.map((u: any) => u.name).sort();
    };
    expect(names('')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(names('scored')).toEqual(['b', 'c', 'd', 'e']);
    expect(names('growing')).toEqual(['c', 'd', 'e']);
    expect(names('campaign_ready')).toEqual(['d', 'e']);
    expect(names('recommended')).toEqual(['e']);
    expect(c.trendScoreFilterOptions.map((o) => o.label)).toEqual([
      'Has a TrendScore',
      'Growing (40+)',
      'Campaign Ready (70+)',
      'TrendStarz Recommended (80+)',
    ]);
  });

  it('counts the TrendScore filter as active and clears it with the other filters', () => {
    const c = create();
    c.allInfluencers = [];
    c.infFilters.trendScore = 'campaign_ready';
    expect(c.activeFilterCount).toBe(1);
    c.clearInfluencerFilters();
    expect(c.infFilters.trendScore).toBe('');
  });
});
