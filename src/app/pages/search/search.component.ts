import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { AnalyticsService } from '../../core/analytics.service';
import { MonetizationApiService, UsageSummary } from '../../services/monetization-api.service';
import { TIER_ORDER, TIER_DESC_MAP, normalizeTierLabel, getInfluencerPrimaryTier } from '../../shared/tiers.constants';
import { InfluencerUserCardComponent } from '../../shared/user-card/influencer-user-card/influencer-user-card.component';
import { BrandUserCardComponent } from '../../shared/user-card/brand-user-card/brand-user-card.component';
import { PhotographerUserCardComponent } from '../../shared/user-card/photographer-user-card/photographer-user-card.component';
import { UsageSummaryComponent } from '../../shared/components/usage-summary/usage-summary.component';
import { PlatformStats, formatMilestoneCount } from '../../shared/utils/platform-stats.util';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, InfluencerUserCardComponent, BrandUserCardComponent, PhotographerUserCardComponent, UsageSummaryComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  private readonly tierOrder = TIER_ORDER;
  readonly searchPageSize = 12;
  private influencerRoleCategoryOptions: string[] = [];
  private brandRoleCategoryOptions: string[] = [];
  private lastSmartDiscoverySignature: Partial<Record<'influencer' | 'photographer', string>> = {};
  private keywordSearchDebounce: any = null;
  showInfluencerTab = true;
  showPhotographersTab = true;

  activeTab: 'influencers' | 'brands' | 'photographers' = 'influencers';

  // Filters are collapsed by default on mobile to avoid pushing results below the fold.
  showMobileFilters = false;

  toggleMobileFilters(): void {
    this.showMobileFilters = !this.showMobileFilters;
  }

  // Raw data
  allInfluencers: any[] = [];
  /** Server-side total for the current query; results arrive in batches of SEARCH_BATCH. */
  influencersServerTotal = 0;
  private influencersLoadedBatches = 0;
  influencersLoadingMore = false;
  loadMoreError = '';
  private static readonly SEARCH_BATCH = 120;
  allBrands: any[] = [];
  allPhotographers: any[] = [];

  // Filtered data
  filteredInfluencers: any[] = [];
  filteredBrands: any[] = [];
  filteredPhotographers: any[] = [];
  influencersPage = 1;
  brandsPage = 1;
  photographersPage = 1;

  // Loading/error states
  influencersLoading = false;
  brandsLoading = false;
  photographersLoading = false;
  influencersError = '';
  brandsError = '';
  photographersError = '';
  showGuestInvitePrompt = false;
  usageSummary: UsageSummary | null = null;

  // Filter options (populated from data)
  categoryOptions: string[] = [];
  brandCategoryOptions: string[] = [];
  locationOptions: string[] = [];
  brandLocationOptions: string[] = [];
  tierOptions: string[] = [];
  ageRangeOptions: string[] = ['18-24', '25-34', '35-44', '45+'];

  readonly sortOptions: { value: string; label: string }[] = [
    { value: 'recommended', label: 'Recommended' },
    { value: 'recently_active', label: 'Recently Active' },
    { value: 'new_members', label: 'New Members' },
    { value: 'verified_first', label: 'Verified First' },
    { value: 'trendstarz_recommended', label: 'TrendStarz Recommended' },
    { value: 'premium_first', label: 'Premium First' },
    { value: 'lowest_price', label: 'Lowest Price' },
    { value: 'highest_followers', label: 'Highest Followers' },
  ];
  sortBy = 'recommended';

  onSortChange(): void {
    if (this.isPhotographerMode) {
      this.photographersPage = 1;
      this.applyPhotographerFilters();
      return;
    }
    if (this.isInfluencerMode) {
      this.influencersPage = 1;
      this.applyInfluencerFilters();
      return;
    }
    this.brandsPage = 1;
    this.applyBrandFilters();
  }

  // Influencer filters
  infFilters = {
    keyword: '',
    category: '',
    location: '',
    tier: '',
    ageRange: '',
    minEngagement: 0,
  };

  // Brand filters
  brandFilters = {
    keyword: '',
    category: '',
    location: '',
  };

  // Photographer filters
  photographerFilters = {
    keyword: '',
    skill: '',
    location: '',
  };

  photographerLocationOptions: string[] = [];
  photographerSkillOptions: string[] = [];

  private isBrowser: boolean;

  /**
   * Returns true if the logged-in user is premium. If not logged in, always false (treat as free user).
   */
  get isProView(): boolean {
    const user = this.session.getUser();
    return !!(user && user.isPremium);
  }

  /**
   * Returns true if the user is logged in and is a free (not premium) user.
   */
  get isFreeUser(): boolean {
    const user = this.session.getUser();
    return !!user && !user.isPremium;
  }

  get currentUser(): any { return this.session.getUser(); }
  get isAdminUser(): boolean { return String(this.currentUser?.role || '').toLowerCase() === 'admin'; }
  get isBrandUser(): boolean { return this.currentUser?.role === 'brand'; }
  get isInfluencerUser(): boolean { return this.currentUser?.role === 'influencer'; }
  get isPhotographerUser(): boolean { return this.currentUser?.role === 'photographer'; }
  get isGuestUser(): boolean { return !this.currentUser; }

  /** Which tabs are available per role */
  get canShowInfluencerTab(): boolean { return this.showInfluencerTab; }
  get canShowPhotographersTab(): boolean { return this.showPhotographersTab; }
  get showBrandsTab(): boolean { return false; /* brands hidden from public discovery */ }

  get defaultTab(): 'influencers' | 'photographers' {
    if (this.isInfluencerUser) return 'photographers';
    return 'influencers';
  }

  get isInfluencerMode(): boolean { return this.activeTab === 'influencers'; }
  get isBrandMode(): boolean { return this.activeTab === 'brands'; }
  get isPhotographerMode(): boolean { return this.activeTab === 'photographers'; }

  get showUsageSummary(): boolean {
    return !this.isAdminUser && !this.isGuestUser && !!this.usageSummary;
  }

  get pageTitle(): string {
    if (this.isInfluencerMode) return 'Discover High-Impact Creators & Influencers';
    if (this.isPhotographerMode) return 'Discover Professional Photo/Videographers';
    return 'Discover Brands';
  }

  get heroSubtitle(): string {
    if (this.isInfluencerMode) {
      return 'Filter by niche, location, follower tier and age range, compare TrendScores and starting rates, and invite verified creators directly.';
    }
    if (this.isPhotographerMode) {
      return 'Filter by skill and location, compare portfolios and starting rates, and invite verified photo/videographers to your campaigns.';
    }
    return 'Find verified brands by industry and location, and see who is running campaigns.';
  }

  // ── Live counts for the hero kicker + niche chips (from /users/platform-stats) ──
  private platformStats: PlatformStats | null = null;

  get heroCountLabel(): string {
    const s = this.platformStats;
    if (!s) return '';
    if (this.isInfluencerMode && s.verifiedInfluencers > 0) return `${formatMilestoneCount(s.verifiedInfluencers)} verified creators`;
    if (this.isPhotographerMode && s.verifiedPhotographers > 0) return `${formatMilestoneCount(s.verifiedPhotographers)} verified photo/videographers`;
    if (this.isBrandMode && s.verifiedBrands > 0) return `${formatMilestoneCount(s.verifiedBrands)} verified brands`;
    return '';
  }

  /** "Fashion (119)" — live creator count for influencer niches; plain name elsewhere or when unknown. */
  nicheOptionLabel(category: string): string {
    const count = this.isInfluencerMode ? this.platformStats?.influencerCategoryCounts?.[category] || 0 : 0;
    return count > 0 ? `${category} (${this.compactCount(count)})` : category;
  }

  get nicheTotalLabel(): string {
    const total = this.platformStats?.totalInfluencers || 0;
    return total ? this.compactCount(total) : '';
  }

  private compactCount(n: number): string {
    return n >= 1000 ? `${(Math.floor(n / 100) / 10).toString()}k` : String(n);
  }

  get activeSortLabel(): string {
    return this.sortOptions.find((o) => o.value === this.sortBy)?.label || '';
  }

  get activeLoading(): boolean {
    if (this.isInfluencerMode) return this.influencersLoading;
    if (this.isPhotographerMode) return this.photographersLoading;
    return this.brandsLoading;
  }

  /** "Apply Search" — run the keyword search now instead of waiting for the typing debounce. */
  applySearchNow(): void {
    if (this.isBrandMode) {
      this.applyBrandFilters();
      return;
    }
    this.triggerSearchFetch('query');
  }

  private loadPlatformStats(): void {
    this.config.getPlatformStats().subscribe((stats) => {
      this.platformStats = stats as PlatformStats;
      setTimeout(() => this.cd.detectChanges(), 0);
    });
  }

  get pageSubtitle(): string {
    if (this.isInfluencerMode) {
      const count = this.filteredInfluencers.length;
      const more = this.hasMoreInfluencers ? ` (${this.allInfluencers.length} of ${this.influencersServerTotal} loaded)` : '';
      if (this.isInfluencerSmartDiscoveryActive) {
        return `Recommended creators near ${this.viewerLocationLabel} · ${count} results${more}`;
      }
      return `Showing ${count} creators matching your criteria${more}`;
    }
    if (this.isPhotographerMode) {
      if (this.isPhotographerSmartDiscoveryActive) {
        return `Recommended photo/videographers near ${this.viewerLocationLabel} · ${this.filteredPhotographers.length} results`;
      }
      return `Showing ${this.filteredPhotographers.length} photo/videographers matching your criteria`;
    }
    return `Showing ${this.filteredBrands.length} brands matching your criteria`;
  }

  get isInfluencerSmartDiscoveryActive(): boolean {
    return this.isInfluencerMode && !this.infFilters.location && !!this.viewerStateNormalized;
  }

  get isPhotographerSmartDiscoveryActive(): boolean {
    return this.isPhotographerMode && !this.photographerFilters.location && !!this.viewerStateNormalized;
  }

  get viewerLocationLabel(): string {
    if (this.viewerDistrictNormalized && this.viewerStateNormalized) {
      return `${this.currentUser?.location?.district || 'your district'}, ${this.currentUser?.location?.state || 'your state'}`;
    }
    return this.currentUser?.location?.state || 'your area';
  }

  private get viewerStateNormalized(): string {
    return this.normalizeLocationValue(this.currentUser?.location?.state);
  }

  private get viewerDistrictNormalized(): string {
    return this.normalizeLocationValue(this.currentUser?.location?.district);
  }

  get activeKeyword(): string {
    if (this.isPhotographerMode) return this.photographerFilters.keyword;
    return this.isInfluencerMode ? this.infFilters.keyword : this.brandFilters.keyword;
  }

  get activeCategory(): string {
    return this.isInfluencerMode ? this.infFilters.category : this.brandFilters.category;
  }

  get activeLocation(): string {
    if (this.isPhotographerMode) return this.photographerFilters.location;
    return this.isInfluencerMode ? this.infFilters.location : this.brandFilters.location;
  }

  get activeAgeRange(): string {
    return this.isInfluencerMode ? this.infFilters.ageRange : '';
  }

  get activeCategoryOptions(): string[] {
    return this.isInfluencerMode ? this.categoryOptions : this.brandCategoryOptions;
  }

  get activeLocationOptions(): string[] {
    if (this.isPhotographerMode) return this.photographerLocationOptions;
    return this.isInfluencerMode ? this.locationOptions : this.brandLocationOptions;
  }

  get searchPlaceholder(): string {
    if (this.isPhotographerMode) return 'Search photographers, skills, or locations...';
    return this.isInfluencerMode
      ? 'Search creators, keywords, or niches...'
      : 'Search brands, keywords, or industries...';
  }

  get activeFilterCount(): number {
    const values = [this.activeKeyword, this.activeCategory, this.activeLocation, this.activeAgeRange];
    if (this.isInfluencerMode) values.push(this.infFilters.tier);
    if (this.isPhotographerMode) values.push(this.photographerFilters.skill);
    return values.filter((v) => !!v).length;
  }

  get categoryLabel(): string {
    return this.isInfluencerMode ? 'Niche' : 'Industry';
  }

  get categoryDefaultLabel(): string {
    return this.isInfluencerMode ? 'All Niches' : 'All Industries';
  }

  constructor(
    private config: ConfigService,
    private session: SessionService,
    private analytics: AnalyticsService,
    private monetizationApi: MonetizationApiService,
    private cd: ChangeDetectorRef,
    private route: ActivatedRoute,
    public router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadSearchTabVisibility();
    if (!this.isAdminUser && !this.isGuestUser) {
      this.loadUsageSummary();
    }
    this.loadRoleCategoryOptions();
    this.loadPlatformStats();
    const urlTab = this.route.snapshot.queryParamMap.get('tab') as 'influencers' | 'brands' | 'photographers' | null;
    this.activeTab = this.isValidTab(urlTab) ? urlTab : this.defaultTab;
    // Deep link from the home niche cards, e.g. /search?tab=influencers&category=Fashion
    const urlCategory = (this.route.snapshot.queryParamMap.get('category') || '').trim();
    if (urlCategory && this.activeTab === 'influencers') {
      this.infFilters.category = urlCategory;
    }
    if (this.activeTab === 'influencers') {
      this.fetchInfluencers({ countSearch: false });
    } else if (this.activeTab === 'photographers') {
      this.fetchPhotographers({ countSearch: false });
    } else {
      this.fetchBrands();
    }
  }

  private loadSearchTabVisibility(): void {
    this.config.getAppSettings().subscribe({
      next: (settings) => {
        this.showInfluencerTab = (this.isAdminUser || this.isBrandUser || this.isPhotographerUser || this.isGuestUser) && settings.showInfluencerSearchTab;
        this.showPhotographersTab = (this.isAdminUser || this.isBrandUser || this.isInfluencerUser || this.isGuestUser) && settings.showPhotographerSearchTab;

        if (this.activeTab === 'influencers' && !this.showInfluencerTab && this.showPhotographersTab) {
          this.setTab('photographers');
          return;
        }
        if (this.activeTab === 'photographers' && !this.showPhotographersTab && this.showInfluencerTab) {
          this.setTab('influencers');
          return;
        }

        if (!this.showInfluencerTab && !this.showPhotographersTab && this.activeTab !== 'brands') {
          this.setTab('brands');
        }
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: () => {
        this.showInfluencerTab = this.isAdminUser || this.isBrandUser || this.isPhotographerUser || this.isGuestUser;
        this.showPhotographersTab = this.isAdminUser || this.isBrandUser || this.isInfluencerUser || this.isGuestUser;
      },
    });
  }

  private loadUsageSummary(): void {
    this.monetizationApi.getMyUsage().subscribe({
      next: (res) => {
        this.usageSummary = res?.usage || null;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: () => {
        this.usageSummary = null;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
    });
  }

  private mergeSearchUsage(usage: any): void {
    if (!usage || this.isGuestUser) return;
    const searchUsage = usage?.search || usage;
    if (!searchUsage) return;
    const previous = this.usageSummary;
    this.usageSummary = {
      day: String(previous?.day || searchUsage?.day || ''),
      search: {
        used: Number(searchUsage?.used || 0),
        limit: Number(searchUsage?.limit || 0),
        remaining: Number(searchUsage?.remaining || 0),
      },
      profileViews: {
        used: Number(previous?.profileViews?.used || 0),
        limit: Number(previous?.profileViews?.limit || 0),
        remaining: Number(previous?.profileViews?.remaining || 0),
      },
    };
  }

  private incrementProfileViewUsage(): void {
    if (!this.usageSummary || this.isGuestUser) return;
    const current = this.usageSummary.profileViews;
    const used = Number(current?.used || 0);
    const limit = Number(current?.limit || 0);
    const nextUsed = limit > 0 ? Math.min(used + 1, limit) : used + 1;
    const nextRemaining = limit > 0 ? Math.max(limit - nextUsed, 0) : Math.max(Number(current?.remaining || 0) - 1, 0);

    this.usageSummary = {
      ...this.usageSummary,
      profileViews: {
        used: nextUsed,
        limit,
        remaining: nextRemaining,
      },
    };
  }

  private loadRoleCategoryOptions(): void {
    this.config.getCategories('influencer').subscribe({
      next: (rows: any[]) => {
        const names = (Array.isArray(rows) ? rows : [])
          .map((c: any) => String(c?.name || '').trim())
          .filter((name: string) => !!name);
        this.influencerRoleCategoryOptions = Array.from(new Set(names)).sort();
        if (this.influencerRoleCategoryOptions.length) {
          this.categoryOptions = this.influencerRoleCategoryOptions;
          setTimeout(() => this.cd.detectChanges(), 0);
        }
      },
      error: () => {},
    });

    this.config.getCategories('brand').subscribe({
      next: (rows: any[]) => {
        const names = (Array.isArray(rows) ? rows : [])
          .map((c: any) => String(c?.name || '').trim())
          .filter((name: string) => !!name);
        this.brandRoleCategoryOptions = Array.from(new Set(names)).sort();
        if (this.brandRoleCategoryOptions.length) {
          this.brandCategoryOptions = this.brandRoleCategoryOptions;
          setTimeout(() => this.cd.detectChanges(), 0);
        }
      },
      error: () => {},
    });
  }

  setTab(tab: 'influencers' | 'brands' | 'photographers') {
    this.activeTab = tab;
    this.resetPageForMode(tab);
    this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
    if (tab === 'influencers' && this.allInfluencers.length === 0 && !this.influencersLoading) {
      this.fetchInfluencers({ countSearch: false });
    } else if (tab === 'photographers' && this.allPhotographers.length === 0 && !this.photographersLoading) {
      this.fetchPhotographers({ countSearch: false });
    } else if (tab === 'brands' && this.allBrands.length === 0 && !this.brandsLoading) {
      this.fetchBrands();
    }
    setTimeout(() => this.cd.detectChanges(), 0);
  }

  private isValidTab(tab: string | null): tab is 'influencers' | 'brands' | 'photographers' {
    return tab === 'influencers' || tab === 'brands' || tab === 'photographers';
  }

  onKeywordChange(value: string) {
    if (this.isPhotographerMode) {
      this.photographerFilters.keyword = value;
      this.photographersPage = 1;
      this.applyPhotographerFilters();
      this.triggerSearchFetch('query', 450);
      return;
    }
    if (this.isInfluencerMode) {
      this.infFilters.keyword = value;
      this.influencersPage = 1;
      this.applyInfluencerFilters();
      this.triggerSearchFetch('query', 450);
      return;
    }
    this.brandFilters.keyword = value;
    this.brandsPage = 1;
    this.applyBrandFilters();
  }

  onCategoryChange(value: string) {
    if (this.isInfluencerMode) {
      this.infFilters.category = value;
      this.syncCategoryParam(value);
      this.influencersPage = 1;
      this.applyInfluencerFilters();
      this.triggerSearchFetch('filter');
      return;
    }
    this.brandFilters.category = value;
    this.brandsPage = 1;
    this.applyBrandFilters();
  }

  onLocationChange(value: string) {
    if (this.isPhotographerMode) {
      this.photographerFilters.location = value;
      if (value) {
        this.analytics.trackManualLocationFilterApplied({
          mode: 'photographer',
          selectedLocation: value,
        });
      }
      this.photographersPage = 1;
      this.applyPhotographerFilters();
      this.triggerSearchFetch('filter');
      return;
    }
    if (this.isInfluencerMode) {
      this.infFilters.location = value;
      if (value) {
        this.analytics.trackManualLocationFilterApplied({
          mode: 'influencer',
          selectedLocation: value,
        });
      }
      this.influencersPage = 1;
      this.applyInfluencerFilters();
      this.triggerSearchFetch('filter');
      return;
    }
    this.brandFilters.location = value;
    this.brandsPage = 1;
    this.applyBrandFilters();
  }

  onAgeRangeChange(value: string) {
    if (!this.isInfluencerMode) return;
    this.infFilters.ageRange = value;
    this.influencersPage = 1;
    this.applyInfluencerFilters();
    this.triggerSearchFetch('filter');
  }

  clearActiveFilters() {
    if (this.isPhotographerMode) { this.clearPhotographerFilters(true); return; }
    if (this.isInfluencerMode) {
      this.clearInfluencerFilters(true);
      return;
    }
    this.clearBrandFilters();
  }

  private triggerSearchFetch(reason: 'query' | 'filter' | 'pagination', debounceMs = 0): void {
    const run = () => {
      const countSearch = !this.isAdminUser && !this.isGuestUser;
      if (this.isInfluencerMode) {
        this.fetchInfluencers({ countSearch, countReason: reason });
      } else if (this.isPhotographerMode) {
        this.fetchPhotographers({ countSearch, countReason: reason });
      }
    };

    if (this.keywordSearchDebounce) {
      clearTimeout(this.keywordSearchDebounce);
      this.keywordSearchDebounce = null;
    }

    if (debounceMs > 0) {
      this.keywordSearchDebounce = setTimeout(() => {
        run();
      }, debounceMs);
      return;
    }

    run();
  }

  fetchInfluencers(options?: {
    countSearch?: boolean;
    countReason?: 'query' | 'filter' | 'pagination';
    page?: number;
    limit?: number;
  }) {
    this.influencersLoading = true;
    this.influencersError = '';
    this.config
      .getInfluencersSearchResponse({
        lite: true,
        page: typeof options?.page === 'number' ? options.page : 1,
        limit: typeof options?.limit === 'number' ? options.limit : SearchComponent.SEARCH_BATCH,
        viewerState: this.currentUser?.location?.state || '',
        viewerDistrict: this.currentUser?.location?.district || '',
        viewerCountry: this.currentUser?.location?.country || '',
        smartLocationPriority: !this.infFilters.location,
        // Filter server-side so a niche isn't limited to whichever creators land in the first page.
        category: this.infFilters.category || undefined,
        countSearch: !!options?.countSearch,
        countReason: options?.countReason,
      })
      .subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : (data?.data ?? []);
        this.mergeSearchUsage(data?.usage);
        this.allInfluencers = arr;
        this.influencersServerTotal = Number(data?.total) || arr.length;
        this.influencersLoadedBatches = 1;
        this.loadMoreError = '';
        this.buildInfluencerOptions(arr);
        this.applyInfluencerFilters();
        this.trackSmartDiscoveryIfApplicable('influencer', this.filteredInfluencers.length);
        this.influencersLoading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: (err: any) => {
        this.influencersError = err?.error?.message || 'Failed to load influencers.';
        this.influencersLoading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      }
      });
  }

  get hasMoreInfluencers(): boolean {
    return this.allInfluencers.length < this.influencersServerTotal;
  }

  get remainingInfluencers(): number {
    return Math.max(0, this.influencersServerTotal - this.allInfluencers.length);
  }

  /** Browsing past the first batch counts as one search for logged-in users (backend rule). */
  get loadMoreUsesSearch(): boolean {
    return !this.isAdminUser && !this.isGuestUser;
  }

  /**
   * Fetches the next server batch and appends it, keeping the current filters.
   * Only runs when the visitor asks (Load more / next page past the loaded set),
   * so nobody's daily search quota is spent in the background.
   */
  loadMoreInfluencers(thenGoToNextPage = false): void {
    if (!this.hasMoreInfluencers || this.influencersLoadingMore) return;
    this.influencersLoadingMore = true;
    this.loadMoreError = '';
    const nextBatch = this.influencersLoadedBatches + 1;
    this.config
      .getInfluencersSearchResponse({
        lite: true,
        page: nextBatch,
        limit: SearchComponent.SEARCH_BATCH,
        viewerState: this.currentUser?.location?.state || '',
        viewerDistrict: this.currentUser?.location?.district || '',
        viewerCountry: this.currentUser?.location?.country || '',
        smartLocationPriority: !this.infFilters.location,
        category: this.infFilters.category || undefined,
        countSearch: this.loadMoreUsesSearch,
        countReason: 'pagination',
      })
      .subscribe({
        next: (data: any) => {
          const arr = Array.isArray(data) ? data : (data?.data ?? []);
          this.mergeSearchUsage(data?.usage);
          const seen = new Set(this.allInfluencers.map((u) => String(u?._id || u?.id || '')));
          const fresh = arr.filter((u: any) => !seen.has(String(u?._id || u?.id || '')));
          this.allInfluencers = [...this.allInfluencers, ...fresh];
          this.influencersServerTotal = Number(data?.total) || this.influencersServerTotal;
          // Nothing new came back — stop offering more rather than looping.
          if (!fresh.length) this.influencersServerTotal = this.allInfluencers.length;
          this.influencersLoadedBatches = nextBatch;
          const keepPage = this.influencersPage;
          this.buildInfluencerOptions(this.allInfluencers);
          this.applyInfluencerFilters();
          this.influencersPage = keepPage;
          this.influencersLoadingMore = false;
          if (thenGoToNextPage && this.hasNextPage()) this.goToPage(this.influencersPage + 1);
          setTimeout(() => this.cd.detectChanges(), 0);
        },
        error: (err: any) => {
          this.influencersLoadingMore = false;
          this.loadMoreError = err?.error?.message || 'Could not load more creators. Please try again.';
          setTimeout(() => this.cd.detectChanges(), 0);
        },
      });
  }

  fetchBrands() {
    this.brandsLoading = true;
    this.brandsError = '';
    this.config.getBrands({ lite: true, limit: 60 }).subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : (data?.data ?? []);
        this.allBrands = arr;
        this.buildBrandOptions(arr);
        this.applyBrandFilters();
        this.brandsLoading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: () => {
        this.brandsError = 'Failed to load brands.';
        this.brandsLoading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      }
    });
  }

  buildInfluencerOptions(data: any[]) {
    const cats = new Set<string>(this.influencerRoleCategoryOptions);
    const locs = new Set<string>();
    const tiers = new Set<string>();
    data.forEach(u => {
      (u.categories || []).forEach((c: string) => cats.add(c));
      const state = u.location?.state;
      if (state) locs.add(state);
      const tier = this.normalizeTierLabel(this.getInfluencerPrimaryTier(u));
      if (tier) tiers.add(tier);
    });
    this.categoryOptions = Array.from(cats).sort();
    this.locationOptions = Array.from(locs).sort();
    const known = this.tierOrder.filter(t => tiers.has(t));
    const unknown = Array.from(tiers)
      .filter(t => !this.tierOrder.includes(t))
      .sort((a, b) => a.localeCompare(b));
    this.tierOptions = [...known, ...unknown];
  }

  private normalizeTierLabel(tier: string): string { return normalizeTierLabel(tier); }

  private getInfluencerPrimaryTier(u: any): string { return getInfluencerPrimaryTier(u); }

  // Same reuse as the campaign invite Step 3 tier filter
  // (campaign-form.component.ts -> getTierOptionLabel) — one follower-range
  // source of truth (tiers.constants.ts) so a tier name reads the same
  // "Nano (101–1,000)" everywhere it's offered as a filter.
  getTierOptionLabel(tier: string): string {
    const normalized = normalizeTierLabel(tier);
    const desc = TIER_DESC_MAP[normalized.toLowerCase()] || '';
    return desc ? `${normalized} (${desc})` : normalized || String(tier || '');
  }

  buildBrandOptions(data: any[]) {
    const cats = new Set<string>(this.brandRoleCategoryOptions);
    const locs = new Set<string>();
    data.forEach(u => {
      (u.categories || []).forEach((c: string) => cats.add(c));
      const state = u.location?.state;
      if (state) locs.add(state);
    });
    this.brandCategoryOptions = Array.from(cats).sort();
    this.brandLocationOptions = Array.from(locs).sort();
  }

  viewPhotographerProfile(photographer: any) {
    if (this.isPhotographerProfileViewDisabled(photographer)) {
      if (this.isGuestUser) {
        this.showGuestInvitePrompt = true;
      }
      this.analytics.trackSearchProfileCardClick({
        targetRole: 'photographer',
        outcome: 'blocked',
        targetId: String(photographer?._id || ''),
        targetUsername: String(photographer?.username || ''),
      });
      return;
    }
    this.analytics.trackSearchProfileCardClick({
      targetRole: 'photographer',
      outcome: 'allowed',
      targetId: String(photographer?._id || ''),
      targetUsername: String(photographer?.username || ''),
    });
    const username = String(photographer?.username || '').trim();
    const id = photographer?._id;
    if (username) {
      this.incrementProfileViewUsage();
      this.router.navigate(['/photographer', username]);
      return;
    }
    if (id) {
      this.incrementProfileViewUsage();
      this.router.navigate(['/photographer', id]);
    }
  }

  isPhotographerProfileViewDisabled(photographer: any): boolean {
    return this.isGuestUser || ((this.isBrandUser || this.isAdminUser) && this.isFreeUser);
  }

  applyInfluencerFilters() {
    const f = this.infFilters;
    const filtered = this.allInfluencers.filter(u => {
      const kw = f.keyword.trim().toLowerCase();
      if (kw) {
        const name = (u.name || u.fullname || '').toLowerCase();
        const cats = (u.categories || []).join(' ').toLowerCase();
        if (!name.includes(kw) && !cats.includes(kw)) return false;
      }
      if (f.category && !(u.categories || []).includes(f.category)) return false;
      if (f.location && u.location?.state !== f.location) return false;
      if (f.tier) {
        const tier = this.normalizeTierLabel(this.getInfluencerPrimaryTier(u));
        if (!tier || tier !== this.normalizeTierLabel(f.tier)) return false;
      }
      if (f.ageRange) {
        const ageRange = this.getInfluencerAgeRange(u);
        if (!ageRange || ageRange !== f.ageRange) return false;
      }
      return true;
    });
    this.filteredInfluencers = this.sortResults(filtered, !!f.location);
    this.clampPageForMode('influencers');
  }

  private getInfluencerAgeRange(influencer: any): string {
    const precomputed = String(influencer?.ageRange || '').trim();
    if (precomputed) return precomputed;

    const dobRaw = influencer?.dateOfBirth;
    if (!dobRaw) return '';

    const dob = new Date(dobRaw);
    if (Number.isNaN(dob.getTime())) return '';

    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age--;
    }

    if (age <= 24) return '18-24';
    if (age <= 34) return '25-34';
    if (age <= 44) return '35-44';
    return '45+';
  }

  applyBrandFilters() {
    const f = this.brandFilters;
    this.filteredBrands = this.allBrands.filter(u => {
      const kw = f.keyword.trim().toLowerCase();
      if (kw) {
        const name = (u.brandName || '').toLowerCase();
        const cats = (u.categories || []).join(' ').toLowerCase();
        if (!name.includes(kw) && !cats.includes(kw)) return false;
      }
      if (f.category && !(u.categories || []).includes(f.category)) return false;
      if (f.location && u.location?.state !== f.location) return false;
      return true;
    });
    this.clampPageForMode('brands');
  }

  clearInfluencerFilters(countSearch = false) {
    const hadCategory = !!this.infFilters.category;
    this.infFilters = { keyword: '', category: '', location: '', tier: '', ageRange: '', minEngagement: 0 };
    this.influencersPage = 1;
    this.applyInfluencerFilters();
    if (hadCategory) this.syncCategoryParam('');
    if (countSearch) {
      this.fetchInfluencers({ countSearch: !this.isAdminUser && !this.isGuestUser, countReason: 'filter' });
    } else if (hadCategory) {
      // Category is filtered server-side, so the loaded list must be refetched without it.
      this.fetchInfluencers({ countSearch: false });
    }
  }

  /** Keeps ?category= in step with the dropdown so a refresh or shared link shows the same niche. */
  private syncCategoryParam(category: string): void {
    this.router.navigate([], { queryParams: { category: category || null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  clearBrandFilters() {
    this.brandFilters = { keyword: '', category: '', location: '' };
    this.brandsPage = 1;
    this.applyBrandFilters();
  }

  fetchPhotographers(options?: {
    countSearch?: boolean;
    countReason?: 'query' | 'filter' | 'pagination';
    page?: number;
    limit?: number;
  }) {
    this.photographersLoading = true;
    this.photographersError = '';
    this.config
      .getPhotographersSearchResponse({
        page: typeof options?.page === 'number' ? options.page : 1,
        limit: typeof options?.limit === 'number' ? options.limit : 120,
        viewerState: this.currentUser?.location?.state || '',
        viewerDistrict: this.currentUser?.location?.district || '',
        viewerCountry: this.currentUser?.location?.country || '',
        smartLocationPriority: !this.photographerFilters.location,
        countSearch: !!options?.countSearch,
        countReason: options?.countReason,
      })
      .subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : (data?.data ?? []);
        this.mergeSearchUsage(data?.usage);
        this.allPhotographers = arr;
        this.buildPhotographerOptions(this.allPhotographers);
        this.applyPhotographerFilters();
        this.trackSmartDiscoveryIfApplicable('photographer', this.filteredPhotographers.length);
        this.photographersLoading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: (err: any) => {
        this.photographersError = err?.error?.message || 'Failed to load photographers.';
        this.photographersLoading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      }
      });
  }

  buildPhotographerOptions(data: any[]) {
    const skills = new Set<string>();
    const locs = new Set<string>();
    data.forEach(p => {
      (p.skills || []).forEach((s: string) => skills.add(s));
      if (p.location?.state) locs.add(p.location.state);
    });
    this.photographerSkillOptions = Array.from(skills).sort();
    this.photographerLocationOptions = Array.from(locs).sort();
  }

  applyPhotographerFilters() {
    const f = this.photographerFilters;
    const filtered = this.allPhotographers.filter(p => {
      const kw = f.keyword.trim().toLowerCase();
      if (kw) {
        const name = (p.name || '').toLowerCase();
        const skills = (p.skills || []).join(' ').toLowerCase();
        if (!name.includes(kw) && !skills.includes(kw)) return false;
      }
      if (f.skill && !(p.skills || []).includes(f.skill)) return false;
      if (f.location && p.location?.state !== f.location) return false;
      return true;
    });
    this.filteredPhotographers = this.sortResults(filtered, !!f.location);
    this.clampPageForMode('photographers');
  }

  private normalizeLocationValue(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private getLocationPriorityScore(entity: any): number {
    const viewerState = this.viewerStateNormalized;
    const viewerDistrict = this.viewerDistrictNormalized;
    if (!viewerState) return 0;

    const entityState = this.normalizeLocationValue(entity?.location?.state);
    const entityDistrict = this.normalizeLocationValue(entity?.location?.district);

    if (viewerDistrict && entityDistrict && viewerDistrict === entityDistrict) return 100;
    if (entityState && entityState === viewerState) return 70;
    return 30;
  }

  private getTopFollowersCount(entity: any): number {
    const socials = Array.isArray(entity?.socialMedia) ? entity.socialMedia : [];
    return socials.reduce((max: number, sm: any) => {
      const followers = Number(sm?.followersCount || 0);
      return followers > max ? followers : max;
    }, 0);
  }

  private sortBySmartLocationPriority<T extends any>(rows: T[]): T[] {
    return [...rows].sort((a: any, b: any) => {
      const locationDiff = this.getLocationPriorityScore(b) - this.getLocationPriorityScore(a);
      if (locationDiff !== 0) return locationDiff;
      return this.getTopFollowersCount(b) - this.getTopFollowersCount(a);
    });
  }

  private sortResults<T extends any>(rows: T[], hasLocationFilter: boolean): T[] {
    if (this.sortBy === 'recommended') {
      return rows;
    }

    const sorted = [...rows];
    switch (this.sortBy) {
      case 'recently_active':
        sorted.sort((a: any, b: any) => this.getActivityTimestamp(b) - this.getActivityTimestamp(a));
        break;
      case 'new_members':
        sorted.sort((a: any, b: any) => this.getRegisteredTimestamp(b) - this.getRegisteredTimestamp(a));
        break;
      case 'verified_first':
        sorted.sort((a: any, b: any) =>
          Number(this.isVerifiedEntity(b)) - Number(this.isVerifiedEntity(a)) ||
          this.getTopFollowersCount(b) - this.getTopFollowersCount(a)
        );
        break;
      case 'premium_first':
        sorted.sort((a: any, b: any) =>
          Number(!!b.isPremium) - Number(!!a.isPremium) ||
          this.getTopFollowersCount(b) - this.getTopFollowersCount(a)
        );
        break;
      case 'trendstarz_recommended':
        sorted.sort((a: any, b: any) =>
          Number(!!b.trendstarzRecommended) - Number(!!a.trendstarzRecommended) ||
          (Number(b.collaborationScore) || 0) - (Number(a.collaborationScore) || 0)
        );
        break;
      case 'lowest_price':
        sorted.sort((a: any, b: any) => this.getPriceValue(a) - this.getPriceValue(b));
        break;
      case 'highest_followers':
        sorted.sort((a: any, b: any) => this.getTopFollowersCount(b) - this.getTopFollowersCount(a));
        break;
    }
    return sorted;
  }

  private getActivityTimestamp(entity: any): number {
    const value = entity?.lastLoginAt || entity?.firstRegisteredAt || entity?.createdAt;
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? time : 0;
  }

  private getRegisteredTimestamp(entity: any): number {
    const value = entity?.firstRegisteredAt || entity?.createdAt;
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? time : 0;
  }

  private isVerifiedEntity(entity: any): boolean {
    return !!entity?.verifiedByTrendStarz || entity?.verificationStatus === 'approved';
  }

  private getPriceValue(entity: any): number {
    const direct = Number(entity?.promotionalPrice ?? entity?.price);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const pricingArr = Array.isArray(entity?.pricing) ? entity.pricing : [];
    const prices = pricingArr
      .map((p: any) => Number(p?.price))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
  }

  private trackSmartDiscoveryIfApplicable(
    mode: 'influencer' | 'photographer',
    resultCount: number,
  ): void {
    const hasManualLocation =
      mode === 'influencer'
        ? !!this.infFilters.location
        : !!this.photographerFilters.location;
    if (hasManualLocation || !this.viewerStateNormalized) return;

    const signature = `${this.viewerStateNormalized}|${this.viewerDistrictNormalized}|${resultCount}`;
    if (this.lastSmartDiscoverySignature[mode] === signature) return;

    this.analytics.trackSmartDiscoveryApplied({
      mode,
      viewerState: this.currentUser?.location?.state || undefined,
      viewerDistrict: this.currentUser?.location?.district || undefined,
      resultCount,
    });
    this.lastSmartDiscoverySignature[mode] = signature;
  }

  clearPhotographerFilters(countSearch = false) {
    this.photographerFilters = { keyword: '', skill: '', location: '' };
    this.photographersPage = 1;
    this.applyPhotographerFilters();
    if (countSearch) {
      this.fetchPhotographers({ countSearch: !this.isAdminUser && !this.isGuestUser, countReason: 'filter' });
    }
  }

  getPagedInfluencers(): any[] {
    const start = (this.influencersPage - 1) * this.searchPageSize;
    return this.filteredInfluencers.slice(start, start + this.searchPageSize);
  }

  getPagedBrands(): any[] {
    const start = (this.brandsPage - 1) * this.searchPageSize;
    return this.filteredBrands.slice(start, start + this.searchPageSize);
  }

  getPagedPhotographers(): any[] {
    const start = (this.photographersPage - 1) * this.searchPageSize;
    return this.filteredPhotographers.slice(start, start + this.searchPageSize);
  }

  getTotalActiveResults(): number {
    if (this.isInfluencerMode) return this.filteredInfluencers.length;
    if (this.isPhotographerMode) return this.filteredPhotographers.length;
    return this.filteredBrands.length;
  }

  getVisibleRangeStart(): number {
    const total = this.getTotalActiveResults();
    if (!total) return 0;
    return (this.getCurrentPage() - 1) * this.searchPageSize + 1;
  }

  getVisibleRangeEnd(): number {
    return Math.min(this.getCurrentPage() * this.searchPageSize, this.getTotalActiveResults());
  }

  hasPreviousPage(): boolean {
    return this.getCurrentPage() > 1;
  }

  hasNextPage(): boolean {
    return this.getCurrentPage() * this.searchPageSize < this.getTotalActiveResults();
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage()) return;
    this.goToPage(this.getCurrentPage() - 1);
  }

  goToNextPage(): void {
    if (!this.hasNextPage()) {
      // Last loaded page, but the server has more: fetch the next batch, then move on.
      if (this.isInfluencerMode && this.hasMoreInfluencers) this.loadMoreInfluencers(true);
      return;
    }
    this.goToPage(this.getCurrentPage() + 1);
  }

  get canGoNext(): boolean {
    return this.hasNextPage() || (this.isInfluencerMode && this.hasMoreInfluencers);
  }

  get currentPage(): number {
    return this.getCurrentPage();
  }

  getTotalPages(): number {
    return Math.max(1, Math.ceil(this.getTotalActiveResults() / this.searchPageSize));
  }

  /** Page buttons with gaps, e.g. [1, 2, 3, '…', 10] or [1, '…', 4, 5, 6, '…', 10]. */
  getPageNumbers(): Array<number | '…'> {
    const total = this.getTotalPages();
    const current = this.getCurrentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    // Phones get a tighter window so the row fits on one line.
    const compact = this.isBrowser && window.innerWidth < 576;
    const pages = new Set<number>([1, total, current]);
    if (!compact) [current - 1, current + 1].forEach((p) => pages.add(p));
    if (!compact && current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
    if (!compact && current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
    if (compact && current <= 2) pages.add(2);
    if (compact && current >= total - 1) pages.add(total - 1);
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out: Array<number | '…'> = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
      out.push(p);
    });
    return out;
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.getTotalPages());
    if (target === this.getCurrentPage()) return;
    this.setCurrentPage(target);
    if (this.isBrowser) {
      document.querySelector('.search-tabs-row, .filter-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  get resultsNoun(): string {
    return this.isBrandMode ? 'matching brands' : 'matching creators';
  }

  // ── Shortlist (brands) ────────────────────────────────────────────────────
  // Kept per role: a campaign invites either influencers or photo/videographers.
  private static readonly SHORTLIST_MAX = 20;
  private readonly shortlists: Record<'influencer' | 'photographer', Map<string, any>> = {
    influencer: new Map(),
    photographer: new Map(),
  };
  shortlistNotice = '';

  get shortlistRole(): 'influencer' | 'photographer' | null {
    if (this.isInfluencerMode) return 'influencer';
    if (this.isPhotographerMode) return 'photographer';
    return null;
  }

  get canShortlist(): boolean {
    return this.isBrandUser && !!this.shortlistRole;
  }

  get activeShortlist(): any[] {
    const role = this.shortlistRole;
    return role ? [...this.shortlists[role].values()] : [];
  }

  private entityId(entity: any): string {
    return String(entity?._id || entity?.id || '').trim();
  }

  isShortlisted(entity: any): boolean {
    const role = this.shortlistRole;
    return !!role && this.shortlists[role].has(this.entityId(entity));
  }

  toggleShortlist(entity: any): void {
    const role = this.shortlistRole;
    const id = this.entityId(entity);
    if (!role || !id) return;
    const list = this.shortlists[role];
    this.shortlistNotice = '';
    if (list.has(id)) {
      list.delete(id);
      return;
    }
    if (list.size >= SearchComponent.SHORTLIST_MAX) {
      this.shortlistNotice = `You can shortlist up to ${SearchComponent.SHORTLIST_MAX} creators at a time.`;
      return;
    }
    list.set(id, entity);
  }

  clearShortlist(): void {
    const role = this.shortlistRole;
    if (role) this.shortlists[role].clear();
    this.shortlistNotice = '';
  }

  shortlistAvatar(entity: any): string {
    const images = Array.isArray(entity?.profileImages) ? entity.profileImages : [];
    const first = images[0];
    return String(entity?.profileImage || (typeof first === 'string' ? first : first?.url) || '');
  }

  shortlistName(entity: any): string {
    return String(entity?.name || entity?.fullname || entity?.username || 'Creator');
  }

  /** Sum of each creator's largest audience — shown as an estimate, never as guaranteed reach. */
  get shortlistReachLabel(): string {
    const total = this.activeShortlist.reduce((sum, e) => sum + this.getTopFollowersCount(e), 0);
    if (!total) return '';
    if (total >= 1e6) return `~${(Math.floor(total / 1e5) / 10).toString()}M`;
    if (total >= 1e3) return `~${Math.floor(total / 1e3)}K`;
    return `~${total}`;
  }

  /** Combined listed starting prices; hidden unless every shortlisted creator lists one. */
  get shortlistStartingTotal(): number | null {
    const prices = this.activeShortlist.map((e) => this.startingPrice(e));
    if (!prices.length || prices.some((p) => p === null)) return null;
    return (prices as number[]).reduce((a, b) => a + b, 0);
  }

  private startingPrice(entity: any): number | null {
    if (this.shortlistRole === 'photographer') {
      const rows = (Array.isArray(entity?.pricing) ? entity.pricing : [])
        .filter((p: any) => p?.enabled !== false && Number(p?.price) > 0)
        .map((p: any) => Number(p.price));
      return rows.length ? Math.min(...rows) : null;
    }
    const price = Number(entity?.promotionalPrice);
    return price > 0 ? price : null;
  }

  pitchShortlist(): void {
    const role = this.shortlistRole;
    const picked = this.activeShortlist;
    if (!role || !picked.length) return;
    this.router.navigate(['/campaigns/new'], {
      state: {
        preSelectedRecipientRole: role,
        preSelectedInfluencers: picked.map((e) => ({
          id: this.entityId(e),
          name: this.shortlistName(e),
          username: e?.username || '',
        })),
      },
    });
  }

  /** "Post an open campaign" in the help banner — logged-out visitors register as a brand first. */
  get openCampaignRoute(): string {
    return this.isBrandUser ? '/campaigns/new' : '/register-brand';
  }

  shouldShowPagination(): boolean {
    if (this.isInfluencerMode) {
      return !this.influencersLoading && !this.influencersError && this.filteredInfluencers.length > 0;
    }
    if (this.isPhotographerMode) {
      return !this.photographersLoading && !this.photographersError && this.filteredPhotographers.length > 0;
    }
    return !this.brandsLoading && !this.brandsError && this.filteredBrands.length > 0;
  }

  private getCurrentPage(): number {
    if (this.isInfluencerMode) return this.influencersPage;
    if (this.isPhotographerMode) return this.photographersPage;
    return this.brandsPage;
  }

  private setCurrentPage(page: number): void {
    if (this.isInfluencerMode) {
      this.influencersPage = page;
      return;
    }
    if (this.isPhotographerMode) {
      this.photographersPage = page;
      return;
    }
    this.brandsPage = page;
  }

  private resetPageForMode(mode: 'influencers' | 'brands' | 'photographers'): void {
    if (mode === 'influencers') {
      this.influencersPage = 1;
      return;
    }
    if (mode === 'photographers') {
      this.photographersPage = 1;
      return;
    }
    this.brandsPage = 1;
  }

  private clampPageForMode(mode: 'influencers' | 'brands' | 'photographers'): void {
    const total = mode === 'influencers'
      ? this.filteredInfluencers.length
      : mode === 'photographers'
      ? this.filteredPhotographers.length
      : this.filteredBrands.length;
    const totalPages = Math.max(1, Math.ceil(total / this.searchPageSize));
    if (mode === 'influencers') {
      this.influencersPage = Math.min(this.influencersPage, totalPages);
      return;
    }
    if (mode === 'photographers') {
      this.photographersPage = Math.min(this.photographersPage, totalPages);
      return;
    }
    this.brandsPage = Math.min(this.brandsPage, totalPages);
  }

  viewInfluencerProfile(influencer: any) {
    if (this.isInfluencerProfileViewDisabled(influencer)) {
      if (this.isGuestUser) {
        this.showGuestInvitePrompt = true;
      }
      this.analytics.trackSearchProfileCardClick({
        targetRole: 'influencer',
        outcome: 'blocked',
        targetId: String(influencer?._id || ''),
        targetUsername: String(influencer?.username || ''),
      });
      return;
    }
    this.analytics.trackSearchProfileCardClick({
      targetRole: 'influencer',
      outcome: 'allowed',
      targetId: String(influencer?._id || ''),
      targetUsername: String(influencer?.username || ''),
    });
    const username = String(influencer?.username || '').trim();
    const id = String(influencer?._id || '').trim();
    const profileKey = username || id;

    if (profileKey) {
      this.config.trackInfluencerProfileClick(profileKey).subscribe({
        next: () => {},
        error: () => {}
      });
      this.incrementProfileViewUsage();
      this.router.navigate(['/influencer', profileKey]);
      return;
    }
  }

  isInfluencerProfileViewDisabled(influencer: any): boolean {
    return this.isGuestUser || ((this.isBrandUser || this.isAdminUser) && this.isFreeUser);
  }

  private slugify(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  viewBrandProfile(brand: any) {
    this.analytics.trackSearchProfileCardClick({
      targetRole: 'brand',
      outcome: 'allowed',
      targetId: String(brand?._id || ''),
      targetUsername: String(brand?.brandUsername || brand?.brandName || ''),
    });
    const rawName = brand.brandName || brand._id;
    const brandSlug = brand.brandName ? this.slugify(brand.brandName) : rawName;
    if (brandSlug) {
      this.config.trackBrandProfileClick(brandSlug).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    this.incrementProfileViewUsage();
    this.router.navigate(['/brand', brandSlug]);
  }

  getBrandLogoUrl(brand: any): string {
    if (Array.isArray(brand.brandLogo) && brand.brandLogo.length > 0) {
      if (typeof brand.brandLogo[0] === 'string') return brand.brandLogo[0];
      if (brand.brandLogo[0]?.url) return brand.brandLogo[0].url;
    }
    return '';
  }

  getEngagementRate(influencer: any): string {
    const sm = influencer.socialMedia?.[0];
    if (sm?.engagementRate) return (+sm.engagementRate).toFixed(1);
    return '';
  }
}
