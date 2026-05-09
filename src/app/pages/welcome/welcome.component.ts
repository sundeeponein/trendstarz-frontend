import { Component, OnInit, OnDestroy, ChangeDetectorRef, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ConfigService } from '../../shared/config.service';
import { Router, NavigationEnd } from '@angular/router';
import { HeroBannerComponent } from '../../shared/hero-banner/hero-banner.component';
import { BuiltForAudiencesComponent } from '../../shared/components/built-for-audiences/built-for-audiences.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, HeroBannerComponent],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  readonly builtForAudiencesComponent = BuiltForAudiencesComponent;
  readonly builtForAudiencesInputs = {
    heading: 'Built For Every Industry',
    subheading: 'Tailored influencer marketing solutions for your niche.',
    items: [
      { icon: 'bi-person', title: 'Fashion Brands', subtitle: 'Apparel & Accessories' },
      { icon: 'bi-geo-alt', title: 'Restaurants', subtitle: 'Food & Dining' },
      { icon: 'bi-heart', title: 'Beauty Brands', subtitle: 'Skincare & Makeup' },
      { icon: 'bi-display', title: 'Tech & Gadgets', subtitle: 'Electronics & Apps' },
      { icon: 'bi-rocket', title: 'Startups', subtitle: 'Growth & Awareness' },
      { icon: 'bi-people-fill', title: 'Lifestyle Creators', subtitle: 'Daily Life & Trends' },
      { icon: 'bi-building', title: 'Local Businesses', subtitle: 'City & Hyperlocal Reach' },
      { icon: 'bi-chat-left-quote', title: 'Food Bloggers', subtitle: 'Taste & Review Content' },
    ],
  };

  readonly minPublicInfluencers = environment.marketplacePublicMinInfluencers;
  readonly minPublicBrands = environment.marketplacePublicMinBrands;

  readonly placeholderCategories: string[] = [
    'Fashion',
    'Beauty',
    'Tech',
    'Travel',
    'Food',
    'Fitness'
  ];

  readonly successMetrics = [
    { label: 'Campaign match time', value: '48 hrs' },
    { label: 'Verified creator quality checks', value: '100%' },
    { label: 'Avg. campaign completion target', value: '95%' }
  ];

  readonly featuredCampaignExamples = [
    {
      title: 'Beauty Product Launch',
      summary: 'A D2C beauty brand partnered with micro-creators for authentic unboxing reels and saw rapid social buzz in week one.',
      focus: 'Reels + Story bundles'
    },
    {
      title: 'Festive Fashion Edit',
      summary: 'Regional creators produced local-language festive content, helping a fashion label increase conversion quality before sale week.',
      focus: 'Regional content strategy'
    },
    {
      title: 'App Awareness Sprint',
      summary: 'A startup ran a 14-day creator burst campaign with clear CTA tracking and scaled installs in key metro cities.',
      focus: 'Performance-focused UGC'
    }
  ];

  private routerSubscription: any;
  influencers: any[] = [];
  allInfluencers: any[] = [];
  brands: any[] = [];
  influencersLoading = false;
  brandsLoading = false;
  influencersError: string = '';
  brandsError: string = '';
  selectedCategory: string = '';
  creatorCategories: string[] = [];

  private isBrowser: boolean;

  get isMarketplaceReadyForPublic(): boolean {
    return this.brands.length >= this.minPublicBrands && this.allInfluencers.length >= this.minPublicInfluencers;
  }

  get homepageCategories(): string[] {
    return this.creatorCategories.length > 0 ? this.creatorCategories : this.placeholderCategories;
  }

  constructor(
    private meta: Meta,
    private title: Title,
    private config: ConfigService,
    public router: Router,
    private cd: ChangeDetectorRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
  isLoggedIn(): boolean {
    // Check for token or user in session/localStorage (adjust as per your auth/session logic)
    return !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
  }

  getUserType(): string | null {
    // Adjust as per your session/user storage logic
    const user = localStorage.getItem('user');
    if (!user) return null;
    try {
      return JSON.parse(user).userType || null;
    } catch {
      return null;
    }
  }

  handleStartCampaign(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    // Redirect all logged-in users to the Campaigns page
    this.router.navigate(['/campaigns']);
  }

  handleFindCreators(): void {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    // Redirect all logged-in users to the search page
    this.router.navigate(['/search']);
  }
  

  ngOnInit(): void {
    this.title.setTitle('Welcome to TrendStarz Marketplace | Connect Influencers & Brands');
    this.meta.addTags([
      { name: 'description', content: 'TrendStarz Marketplace connects influencers and brands. Discover, collaborate, and grow together!' },
      { name: 'keywords', content: 'influencer, brand, marketplace, collaboration, social media, discover, grow' },
      { property: 'og:title', content: 'Welcome to TrendStarz Marketplace' },
      { property: 'og:description', content: 'Connect influencers and brands. Discover, collaborate, and grow together!' },
      { property: 'og:image', content: 'logo-trendstarz-logo-text.png' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Welcome to TrendStarz Marketplace' },
      { name: 'twitter:description', content: 'Connect influencers and brands. Discover, collaborate, and grow together!' },
      { name: 'twitter:image', content: 'logo-trendstarz-logo-text.png' }
    ]);
    if (!this.isBrowser) return;
    this.ngZone.run(() => {
      this.fetchBrands();
      this.fetchInfluencers();
    });
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects || event.url;
        if (url === '/welcome' || url === '/' || url.startsWith('/welcome?')) {
          this.fetchInfluencers();
          this.fetchBrands();
        }
      }
    });
  }
  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  fetchInfluencers() {
    this.influencersLoading = true;
    this.influencersError = '';
    this.influencers = [];
    this.config.getInfluencers().subscribe({
      next: (data) => {
        console.debug('WelcomeComponent.fetchInfluencers data', data);
        const influencerArray = Array.isArray(data)
          ? data
          : (data && Array.isArray((data as any).data) ? (data as any).data : []);
        this.allInfluencers = influencerArray;

        // Extract top 5 categories by registered user count (descending)
        const catCounts = new Map<string, number>();
        this.allInfluencers.forEach((u: any) => (u.categories || []).forEach((c: string) => {
          catCounts.set(c, (catCounts.get(c) || 0) + 1);
        }));
        this.creatorCategories = Array.from(catCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([cat]) => cat);
        this.filterByCategory(this.selectedCategory);
        this.influencersLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        this.influencersError = 'Could not load influencers.';
        this.influencersLoading = false;
        console.error('Influencer fetch error:', err);
        this.cd.detectChanges();
      }
    });
  }

  // Utility to slugify brand names for URLs
  slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^a-z0-9\-]/g, '')    // Remove all non-alphanumeric except -
      .replace(/-+/g, '-')             // Replace multiple - with single -
      .replace(/^-+/, '')              // Trim - from start
      .replace(/-+$/, '');             // Trim - from end
  }

  viewInfluencerProfile(influencer: any) {
    if (influencer) {
      let username = influencer.username;
      if (!username || username.trim() === '') {
        username = influencer.name || '';
      }
      // Always slugify for URL safety
      const urlUsername = this.slugify(username);
      if (urlUsername) {
        this.config.trackInfluencerProfileClick(urlUsername).subscribe({
          next: () => {},
          error: () => {}
        });
      }
      this.router.navigate(['/influencer', urlUsername]);
    }
  }

  fetchBrands() {
    this.brandsLoading = true;
    this.brandsError = '';
    this.brands = [];
    this.config.getBrands().subscribe({
      next: (data) => {
        console.debug('WelcomeComponent.fetchBrands data', data);
        const brandArray = Array.isArray(data)
          ? data
          : (data && Array.isArray((data as any).data) ? (data as any).data : []);
        this.brands = brandArray;
        this.brandsLoading = false;        this.cd.detectChanges();
      },
      error: (err) => {
        this.brandsError = 'Could not load brands.';
        this.brandsLoading = false;
        console.error('Brand fetch error:', err);
        this.cd.detectChanges();
      }
    });
  }

  viewBrandProfile(brand: any) {
    if (brand && brand.brandName) {
      const slug = this.slugify(brand.brandName);
      this.config.trackBrandProfileClick(slug).subscribe({
        next: () => {},
        error: () => {}
      });
      this.router.navigate(['/brand', slug]);
    }
  }

  filterByCategory(category: string) {
    this.selectedCategory = category;
    if (!category) {
      this.influencers = [...this.allInfluencers];
    } else {
      this.influencers = this.allInfluencers.filter(
        (u: any) => (u.categories || []).some((c: string) => c.toLowerCase() === category.toLowerCase())
      );
    }
    this.cd.detectChanges();
  }

  getTotalFollowers(influencer: any): number {
    return (influencer.socialMedia || []).reduce((sum: number, sm: any) => sum + (Number(sm.followersCount) || 0), 0);
  }

  formatFollowers(count: number): string {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  }
}
