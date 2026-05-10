import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { TIER_ORDER, normalizeTierLabel, getInfluencerPrimaryTier } from '../../shared/tiers.constants';
import { InfluencerUserCardComponent } from '../../shared/user-card/influencer-user-profile/influencer-user-card.component';
import { BrandUserCardComponent } from '../../shared/user-card/brand-user-card/brand-user-card.component';
import { CampaignInfluencer } from '../../shared/campaigns/campaign.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, InfluencerUserCardComponent, BrandUserCardComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  private readonly tierOrder = TIER_ORDER;

  activeTab: 'influencers' | 'brands' = 'influencers';

  // Raw data
  allInfluencers: any[] = [];
  allBrands: any[] = [];

  // Filtered data
  filteredInfluencers: any[] = [];
  filteredBrands: any[] = [];

  // Loading/error states
  influencersLoading = false;
  brandsLoading = false;
  influencersError = '';
  brandsError = '';

  // Selection state (brand users: pick influencers for a campaign)
  private selectedSet = new Set<string>();

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
  get isBrandUser(): boolean { return this.currentUser?.role === 'brand'; }
  get isInfluencerUser(): boolean { return this.currentUser?.role === 'influencer'; }
  get isGuestUser(): boolean { return !this.currentUser; }

  /**
   * Search mode by viewer role:
   * - Brand users search influencers
   * - Influencer users search brands
   * - Guests search influencers
   */
  get searchMode(): 'influencers' | 'brands' {
    if (this.isBrandUser) return 'influencers';
    if (this.isInfluencerUser) return 'brands';
    return 'influencers';
  }

  get isInfluencerMode(): boolean { return this.searchMode === 'influencers'; }
  get isBrandMode(): boolean { return this.searchMode === 'brands'; }

  get pageTitle(): string {
    return this.isInfluencerMode ? 'Discover Influencers' : 'Discover Brands';
  }

  get pageSubtitle(): string {
    if (this.isInfluencerMode) {
      const count = this.filteredInfluencers.length;
      const suffix = this.selectedCount > 0 ? ` · ${this.selectedCount} selected` : '';
      return `Showing ${count} creators matching your criteria${suffix}`;
    }
    return `Showing ${this.filteredBrands.length} brands matching your criteria`;
  }

  get activeKeyword(): string {
    return this.isInfluencerMode ? this.infFilters.keyword : this.brandFilters.keyword;
  }

  get activeCategory(): string {
    return this.isInfluencerMode ? this.infFilters.category : this.brandFilters.category;
  }

  get activeLocation(): string {
    return this.isInfluencerMode ? this.infFilters.location : this.brandFilters.location;
  }

  get activeAgeRange(): string {
    return this.isInfluencerMode ? this.infFilters.ageRange : '';
  }

  get activeCategoryOptions(): string[] {
    return this.isInfluencerMode ? this.categoryOptions : this.brandCategoryOptions;
  }

  get activeLocationOptions(): string[] {
    return this.isInfluencerMode ? this.locationOptions : this.brandLocationOptions;
  }

  get searchPlaceholder(): string {
    return this.isInfluencerMode
      ? 'Search creators, keywords, or niches...'
      : 'Search brands, keywords, or industries...';
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
    private cd: ChangeDetectorRef,
    public router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.activeTab = this.searchMode;
    if (this.isInfluencerMode) {
      this.fetchInfluencers();
    } else {
      this.fetchBrands();
    }
  }

  setTab(tab: 'influencers' | 'brands') {
    if (tab !== this.searchMode) return;
    this.activeTab = tab;
    this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  onKeywordChange(value: string) {
    if (this.isInfluencerMode) {
      this.infFilters.keyword = value;
      this.applyInfluencerFilters();
      return;
    }
    this.brandFilters.keyword = value;
    this.applyBrandFilters();
  }

  onCategoryChange(value: string) {
    if (this.isInfluencerMode) {
      this.infFilters.category = value;
      this.applyInfluencerFilters();
      return;
    }
    this.brandFilters.category = value;
    this.applyBrandFilters();
  }

  onLocationChange(value: string) {
    if (this.isInfluencerMode) {
      this.infFilters.location = value;
      this.applyInfluencerFilters();
      return;
    }
    this.brandFilters.location = value;
    this.applyBrandFilters();
  }

  onAgeRangeChange(value: string) {
    if (!this.isInfluencerMode) return;
    this.infFilters.ageRange = value;
    this.applyInfluencerFilters();
  }

  clearActiveFilters() {
    if (this.isInfluencerMode) {
      this.clearInfluencerFilters();
      return;
    }
    this.clearBrandFilters();
  }

  fetchInfluencers() {
    this.influencersLoading = true;
    this.influencersError = '';
    this.config.getInfluencers().subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : (data?.data ?? []);
        this.allInfluencers = arr;
        this.buildInfluencerOptions(arr);
        this.applyInfluencerFilters();
        this.influencersLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.influencersError = 'Failed to load influencers.';
        this.influencersLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  fetchBrands() {
    this.brandsLoading = true;
    this.brandsError = '';
    this.config.getBrands().subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : (data?.data ?? []);
        this.allBrands = arr;
        this.buildBrandOptions(arr);
        this.applyBrandFilters();
        this.brandsLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.brandsError = 'Failed to load brands.';
        this.brandsLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  buildInfluencerOptions(data: any[]) {
    const cats = new Set<string>();
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
    const cats = new Set<string>();
    const locs = new Set<string>();
    data.forEach(u => {
      (u.categories || []).forEach((c: string) => cats.add(c));
      const state = u.location?.state;
      if (state) locs.add(state);
    });
    this.brandCategoryOptions = Array.from(cats).sort();
    this.brandLocationOptions = Array.from(locs).sort();
  }

  applyInfluencerFilters() {
    const f = this.infFilters;
    this.filteredInfluencers = this.allInfluencers.filter(u => {
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

  clearInfluencerFilters() {
    this.infFilters = { keyword: '', category: '', location: '', tier: '', ageRange: '', minEngagement: 0 };
    this.applyInfluencerFilters();
  }

  clearBrandFilters() {
    this.brandFilters = { keyword: '', category: '', location: '' };
    this.applyBrandFilters();
  }

  viewInfluencerProfile(influencer: any) {
    const username = influencer.username || influencer._id;
    if (username) {
      this.config.trackInfluencerProfileClick(username).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    this.router.navigate(['/influencer', username]);
  }

  viewBrandProfile(brand: any) {
    const name = brand.brandName || brand._id;
    if (name) {
      this.config.trackBrandProfileClick(name).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    this.router.navigate(['/brand', name]);
  }

  getBrandLogoUrl(brand: any): string {
    if (Array.isArray(brand.brandLogo) && brand.brandLogo.length > 0) {
      if (typeof brand.brandLogo[0] === 'string') return brand.brandLogo[0];
      if (brand.brandLogo[0]?.url) return brand.brandLogo[0].url;
    }
    return '';
  }

  // ── Influencer selection (brand flow) ─────────────────────────

  toggleInfluencerSelection(influencer: any) {
    const id = influencer._id;
    if (this.selectedSet.has(id)) {
      this.selectedSet.delete(id);
    } else {
      this.selectedSet.add(id);
    }
  }

  isInfluencerSelected(influencer: any): boolean {
    return this.selectedSet.has(influencer._id);
  }

  get selectedInfluencersList(): CampaignInfluencer[] {
    return this.allInfluencers
      .filter(i => this.selectedSet.has(i._id))
      .map(i => ({ id: i._id, name: i.name || i.fullname || '', username: i.username }));
  }

  get selectedCount(): number { return this.selectedSet.size; }

  clearSelection() { this.selectedSet.clear(); }

  /** Called when brand selects a single card's "+ Campaign" button — navigates to campaigns page */
  createCampaignForOne(influencer: any) {
    this.selectedSet.clear();
    this.selectedSet.add(influencer._id);
    this.router.navigate(['/campaigns']);
  }

  getEngagementRate(influencer: any): string {
    const sm = influencer.socialMedia?.[0];
    if (sm?.engagementRate) return (+sm.engagementRate).toFixed(1);
    return '';
  }
}
