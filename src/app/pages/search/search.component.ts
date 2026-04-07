import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
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

  // Influencer filters
  infFilters = {
    keyword: '',
    category: '',
    location: '',
    minFollowers: null as number | null,
    maxFollowers: null as number | null,
    minEngagement: 0,
  };

  // Brand filters
  brandFilters = {
    keyword: '',
    category: '',
    location: '',
  };

  private isBrowser: boolean;

  get isProView(): boolean { return !!this.session.getUser()?.isPremium; }

  get currentUser(): any { return this.session.getUser(); }
  get isBrandUser(): boolean { return this.currentUser?.role === 'brand'; }

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
    // Lock tab based on role: brands discover influencers; influencers discover brands
    this.activeTab = this.isBrandUser ? 'influencers' : 'brands';
    this.fetchInfluencers();
    this.fetchBrands();
  }

  setTab(tab: 'influencers' | 'brands') {
    this.activeTab = tab;
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
    data.forEach(u => {
      (u.categories || []).forEach((c: string) => cats.add(c));
      const state = u.location?.state;
      if (state) locs.add(state);
    });
    this.categoryOptions = Array.from(cats).sort();
    this.locationOptions = Array.from(locs).sort();
  }

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
      const followers = u.socialMedia?.[0]?.followersCount ?? 0;
      if (f.minFollowers !== null && followers < f.minFollowers) return false;
      if (f.maxFollowers !== null && followers > f.maxFollowers) return false;
      return true;
    });
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
    this.infFilters = { keyword: '', category: '', location: '', minFollowers: null, maxFollowers: null, minEngagement: 0 };
    this.applyInfluencerFilters();
  }

  clearBrandFilters() {
    this.brandFilters = { keyword: '', category: '', location: '' };
    this.applyBrandFilters();
  }

  viewInfluencerProfile(influencer: any) {
    const username = influencer.username || influencer._id;
    this.router.navigate(['/influencer', username]);
  }

  viewBrandProfile(brand: any) {
    const name = brand.brandName || brand._id;
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
