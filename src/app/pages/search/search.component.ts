import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { TIER_ORDER, normalizeTierLabel, getInfluencerPrimaryTier } from '../../shared/tiers.constants';
import { InfluencerUserCardComponent } from '../../shared/user-card/influencer-user-profile/influencer-user-card.component';
import { BrandUserCardComponent } from '../../shared/user-card/brand-user-card/brand-user-card.component';
import { PhotographerUserCardComponent } from '../../shared/user-card/photographer-user-card/photographer-user-card.component';
import { CampaignInfluencer } from '../../shared/campaigns/campaign.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, InfluencerUserCardComponent, BrandUserCardComponent, PhotographerUserCardComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  private readonly tierOrder = TIER_ORDER;
  private influencerRoleCategoryOptions: string[] = [];
  private brandRoleCategoryOptions: string[] = [];

  activeTab: 'influencers' | 'brands' | 'photographers' = 'influencers';

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
  get isBrandUser(): boolean { return this.currentUser?.role === 'brand'; }
  get isInfluencerUser(): boolean { return this.currentUser?.role === 'influencer'; }
  get isPhotographerUser(): boolean { return this.currentUser?.role === 'photographer'; }
  get isGuestUser(): boolean { return !this.currentUser; }

  /** Which tabs are available per role */
  get showInfluencerTab(): boolean { return this.isBrandUser || this.isPhotographerUser || this.isGuestUser; }
  get showPhotographersTab(): boolean { return this.isBrandUser || this.isInfluencerUser; }
  get showBrandsTab(): boolean { return false; /* brands hidden from public discovery */ }

  get defaultTab(): 'influencers' | 'photographers' {
    if (this.isInfluencerUser) return 'photographers';
    return 'influencers';
  }

  get isInfluencerMode(): boolean { return this.activeTab === 'influencers'; }
  get isBrandMode(): boolean { return this.activeTab === 'brands'; }
  get isPhotographerMode(): boolean { return this.activeTab === 'photographers'; }

  get pageTitle(): string {
    if (this.isInfluencerMode) return 'Discover Influencers';
    if (this.isPhotographerMode) return 'Discover Photographers & Videographers';
    return 'Discover Brands';
  }

  get pageSubtitle(): string {
    if (this.isInfluencerMode) {
      const count = this.filteredInfluencers.length;
      const suffix = this.selectedCount > 0 ? ` · ${this.selectedCount} selected` : '';
      if (this.isInfluencerSmartDiscoveryActive) {
        return `Recommended creators near ${this.viewerLocationLabel} · ${count} results${suffix}`;
      }
      return `Showing ${count} creators matching your criteria${suffix}`;
    }
    if (this.isPhotographerMode) {
      if (this.isPhotographerSmartDiscoveryActive) {
        return `Recommended photographers near ${this.viewerLocationLabel} · ${this.filteredPhotographers.length} results`;
      }
      return `Showing ${this.filteredPhotographers.length} photographers matching your criteria`;
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
    this.loadRoleCategoryOptions();
    this.activeTab = this.defaultTab;
    if (this.activeTab === 'influencers') {
      this.fetchInfluencers();
    } else if (this.activeTab === 'photographers') {
      this.fetchPhotographers();
    } else {
      this.fetchBrands();
    }
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
      this.fetchInfluencers();
    } else if (tab === 'photographers' && this.allPhotographers.length === 0 && !this.photographersLoading) {
      this.fetchPhotographers();
    } else if (tab === 'brands' && this.allBrands.length === 0 && !this.brandsLoading) {
      this.fetchBrands();
    }
    setTimeout(() => this.cd.detectChanges(), 0);
  }

  onKeywordChange(value: string) {
    if (this.isPhotographerMode) {
      this.photographerFilters.keyword = value;
      this.applyPhotographerFilters();
      return;
    }
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
    if (this.isPhotographerMode) {
      this.photographerFilters.location = value;
      this.applyPhotographerFilters();
      return;
    }
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
    if (this.isPhotographerMode) { this.clearPhotographerFilters(); return; }
    if (this.isInfluencerMode) {
      this.clearInfluencerFilters();
      return;
    }
    this.clearBrandFilters();
  }

  fetchInfluencers() {
    this.influencersLoading = true;
    this.influencersError = '';
    this.config
      .getInfluencers({
        lite: true,
        limit: 120,
        viewerState: this.currentUser?.location?.state || '',
        viewerDistrict: this.currentUser?.location?.district || '',
        smartLocationPriority: !this.infFilters.location,
      })
      .subscribe({
      next: (data: any) => {
        const arr = Array.isArray(data) ? data : (data?.data ?? []);
        this.allInfluencers = arr;
        this.buildInfluencerOptions(arr);
        this.applyInfluencerFilters();
        this.influencersLoading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: () => {
        this.influencersError = 'Failed to load influencers.';
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
    const id = photographer?._id;
    if (id) {
      this.router.navigate(['/photographer', id]);
    }
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

  clearInfluencerFilters() {
    this.infFilters = { keyword: '', category: '', location: '', tier: '', ageRange: '', minEngagement: 0 };
    this.applyInfluencerFilters();
  }

  clearBrandFilters() {
    this.brandFilters = { keyword: '', category: '', location: '' };
    this.applyBrandFilters();
  }

  fetchPhotographers() {
    this.photographersLoading = true;
    this.photographersError = '';
    this.config
      .getPhotographers({
        limit: 120,
        viewerState: this.currentUser?.location?.state || '',
        viewerDistrict: this.currentUser?.location?.district || '',
        smartLocationPriority: !this.photographerFilters.location,
      })
      .subscribe({
      next: (data: any[]) => {
        this.allPhotographers = Array.isArray(data) ? data : [];
        this.buildPhotographerOptions(this.allPhotographers);
        this.applyPhotographerFilters();
        this.photographersLoading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: () => {
        this.photographersError = 'Failed to load photographers.';
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

  clearPhotographerFilters() {
    this.photographerFilters = { keyword: '', skill: '', location: '' };
    this.applyPhotographerFilters();
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
    const rawName = brand.brandName || brand._id;
    const brandSlug = brand.brandName ? this.slugify(brand.brandName) : rawName;
    if (brandSlug) {
      this.config.trackBrandProfileClick(brandSlug).subscribe({
        next: () => {},
        error: () => {}
      });
    }
    this.router.navigate(['/brand', brandSlug]);
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
