import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { AnalyticsService } from '../../core/analytics.service';
import { MonetizationApiService, UsageSummary } from '../../services/monetization-api.service';
import { TIER_ORDER, normalizeTierLabel, getInfluencerPrimaryTier } from '../../shared/tiers.constants';
import { InfluencerUserCardComponent } from '../../shared/user-card/influencer-user-card/influencer-user-card.component';
import { BrandUserCardComponent } from '../../shared/user-card/brand-user-card/brand-user-card.component';
import { PhotographerUserCardComponent } from '../../shared/user-card/photographer-user-card/photographer-user-card.component';
import { UsageSummaryComponent } from '../../shared/components/usage-summary/usage-summary.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, InfluencerUserCardComponent, BrandUserCardComponent, PhotographerUserCardComponent, UsageSummaryComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  private readonly tierOrder = TIER_ORDER;
  private influencerRoleCategoryOptions: string[] = [];
  private brandRoleCategoryOptions: string[] = [];
  private lastSmartDiscoverySignature: Partial<Record<'influencer' | 'photographer', string>> = {};
  private keywordSearchDebounce: any = null;

  activeTab: 'influencers' | 'brands' | 'photographers' = 'influencers';

  // Filters are collapsed by default on mobile to avoid pushing results below the fold.
  showMobileFilters = false;

  toggleMobileFilters(): void {
    this.showMobileFilters = !this.showMobileFilters;
  }

  // Raw data
  allInfluencers: any[] = [];
  allBrands: any[] = [];
  allPhotographers: any[] = [];

  // Filtered data
  filteredInfluencers: any[] = [];
  filteredBrands: any[] = [];
  filteredPhotographers: any[] = [];

  // Loading/error states
  influencersLoading = false;
  brandsLoading = false;
  photographersLoading = false;
  influencersError = '';
  brandsError = '';
  photographersError = '';
  usageSummary: UsageSummary | null = null;
  adminPreviewTier: 'starter' | 'pro' = 'starter';

  // Filter options (populated from data)
  categoryOptions: string[] = [];
  brandCategoryOptions: string[] = [];
  locationOptions: string[] = [];
  brandLocationOptions: string[] = [];
  tierOptions: string[] = [];
  ageRangeOptions: string[] = ['18-24', '25-34', '35-44', '45+'];

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
    if (this.isAdminUser) return this.adminPreviewTier === 'pro';
    const user = this.session.getUser();
    return !!(user && user.isPremium);
  }

  /**
   * Returns true if the user is logged in and is a free (not premium) user.
   */
  get isFreeUser(): boolean {
    if (this.isAdminUser) return this.adminPreviewTier === 'starter';
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
  get showInfluencerTab(): boolean { return this.isAdminUser || this.isBrandUser || this.isPhotographerUser || this.isGuestUser; }
  get showPhotographersTab(): boolean { return this.isAdminUser || this.isBrandUser || this.isInfluencerUser || this.isGuestUser; }
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
    if (this.isInfluencerMode) return 'Discover Influencers';
    if (this.isPhotographerMode) return 'Discover Photo/Videographers';
    return 'Discover Brands';
  }

  get pageSubtitle(): string {
    if (this.isInfluencerMode) {
      const count = this.filteredInfluencers.length;
      if (this.isInfluencerSmartDiscoveryActive) {
        return `Recommended creators near ${this.viewerLocationLabel} · ${count} results`;
      }
      return `Showing ${count} creators matching your criteria`;
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
    const previewTier = this.route.snapshot.queryParamMap.get('viewAs');
    if (this.isAdminUser && previewTier === 'pro') {
      this.adminPreviewTier = 'pro';
    }
    if (!this.isAdminUser && !this.isGuestUser) {
      this.loadUsageSummary();
    }
    this.loadRoleCategoryOptions();
    const urlTab = this.route.snapshot.queryParamMap.get('tab') as 'influencers' | 'brands' | 'photographers' | null;
    this.activeTab = this.isValidTab(urlTab) ? urlTab : this.defaultTab;
    if (this.activeTab === 'influencers') {
      this.fetchInfluencers({ countSearch: false });
    } else if (this.activeTab === 'photographers') {
      this.fetchPhotographers({ countSearch: false });
    } else {
      this.fetchBrands();
    }
  }

  setAdminPreviewTier(tier: 'starter' | 'pro'): void {
    if (!this.isAdminUser || this.adminPreviewTier === tier) return;
    this.adminPreviewTier = tier;
    this.router.navigate([], {
      queryParams: { viewAs: tier },
      queryParamsHandling: 'merge',
      replaceUrl: true,
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
      this.applyPhotographerFilters();
      this.triggerSearchFetch('query', 450);
      return;
    }
    if (this.isInfluencerMode) {
      this.infFilters.keyword = value;
      this.applyInfluencerFilters();
      this.triggerSearchFetch('query', 450);
      return;
    }
    this.brandFilters.keyword = value;
    this.applyBrandFilters();
  }

  onCategoryChange(value: string) {
    if (this.isInfluencerMode) {
      this.infFilters.category = value;
      this.applyInfluencerFilters();
      this.triggerSearchFetch('filter');
      return;
    }
    this.brandFilters.category = value;
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
      this.applyInfluencerFilters();
      this.triggerSearchFetch('filter');
      return;
    }
    this.brandFilters.location = value;
    this.applyBrandFilters();
  }

  onAgeRangeChange(value: string) {
    if (!this.isInfluencerMode) return;
    this.infFilters.ageRange = value;
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
        limit: typeof options?.limit === 'number' ? options.limit : 120,
        viewerState: this.currentUser?.location?.state || '',
        viewerDistrict: this.currentUser?.location?.district || '',
        smartLocationPriority: !this.infFilters.location,
        countSearch: !!options?.countSearch,
        countReason: options?.countReason,
      })
      .subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : (data?.data ?? []);
        this.mergeSearchUsage(data?.usage);
        this.allInfluencers = arr;
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
    this.filteredInfluencers = f.location
      ? filtered
      : this.sortBySmartLocationPriority(filtered);
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
  }

  clearInfluencerFilters(countSearch = false) {
    this.infFilters = { keyword: '', category: '', location: '', tier: '', ageRange: '', minEngagement: 0 };
    this.applyInfluencerFilters();
    if (countSearch) {
      this.fetchInfluencers({ countSearch: !this.isAdminUser && !this.isGuestUser, countReason: 'filter' });
    }
  }

  clearBrandFilters() {
    this.brandFilters = { keyword: '', category: '', location: '' };
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
    this.filteredPhotographers = f.location
      ? filtered
      : this.sortBySmartLocationPriority(filtered);
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
    this.applyPhotographerFilters();
    if (countSearch) {
      this.fetchPhotographers({ countSearch: !this.isAdminUser && !this.isGuestUser, countReason: 'filter' });
    }
  }

  viewInfluencerProfile(influencer: any) {
    if (this.isInfluencerProfileViewDisabled(influencer)) {
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
