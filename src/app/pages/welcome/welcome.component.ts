import { Component, OnInit, OnDestroy, ChangeDetectorRef, Inject, PLATFORM_ID, NgZone, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ConfigService } from '../../shared/config.service';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { BuiltForAudiencesComponent } from '../../shared/components/built-for-audiences/built-for-audiences.component';
import { BrandUserCardComponent } from '../../shared/user-card/brand-user-card/brand-user-card.component';
import { InfluencerUserCardComponent } from '../../shared/user-card/influencer-user-card/influencer-user-card.component';
import { FaqAccordionComponent, FaqAccordionItem, FaqCtaButton } from '../../shared/components/faq-accordion/faq-accordion.component';
import { TRENDSTARZ_FAQ_ITEMS } from '../../shared/components/faq-accordion/faq-content.constants';
import { environment } from '../../../environments/environment';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { HeroBannerComponent } from '../../shared/hero-banner/hero-banner.component';
import { RegistrationConfirmModalComponent } from '../../shared/components/registration-confirm-modal/registration-confirm-modal.component';
import { RegistrationConfirmModalService } from '../../shared/components/registration-confirm-modal/registration-confirm-modal.service';
import { ActionCtaComponent } from '../../shared/components/action-cta/action-cta.component';
import { WhyTrendstarzGlanceComponent, TrendstarzGlanceCounter } from '../../shared/components/why-trendstarz-glance/why-trendstarz-glance.component';
import { formatBrandsStat, formatPhotographersStat } from '../../shared/utils/platform-stats.util';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule, HeroBannerComponent, BrandUserCardComponent, InfluencerUserCardComponent, RegistrationConfirmModalComponent, ActionCtaComponent, WhyTrendstarzGlanceComponent],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  readonly regConfirm = inject(RegistrationConfirmModalService);

  readonly showBrandCampaignMetaOnWelcome = false;

  readonly builtForAudiencesComponent = BuiltForAudiencesComponent;
  readonly faqAccordionComponent = FaqAccordionComponent;
  readonly builtForAudiencesInputs = {
    heading: 'Platform Features',
    subheading: 'Tools and collaboration solutions built for creators and brands.',
    items: [
      { icon: 'bi-person', title: 'Fashion Brands', subtitle: 'Apparel & Accessories tailored management.', tint: 'purple' },
      { icon: 'bi-fork-knife', title: 'Restaurants', subtitle: 'Food & Dining visual storytelling.', tint: 'orange' },
      { icon: 'bi-heart', title: 'Beauty Brands', subtitle: 'Skincare & Makeup brand scaling.', tint: 'blue' },
      { icon: 'bi-display', title: 'Tech & Gadgets', subtitle: 'Electronics & Apps launch precision.', tint: 'gray' },
      { icon: 'bi-rocket', title: 'Startups', subtitle: 'Growth & Awareness for new entities.', tint: 'red' },
      { icon: 'bi-people-fill', title: 'Lifestyle Creators', subtitle: 'Daily Life & Trends connectivity.', tint: 'purple' },
      { icon: 'bi-building', title: 'Local Businesses', subtitle: 'City & Hyperlocal Reach campaigns.', tint: 'gray' },
      { icon: 'bi-chat-left-quote', title: 'Food Bloggers', subtitle: 'Taste & Review content excellence.', tint: 'orange' },
    ],
  };

  readonly minPublicInfluencers = environment.marketplacePublicMinInfluencers;
  readonly minPublicBrands = environment.marketplacePublicMinBrands;

  glanceCounters: TrendstarzGlanceCounter[] = [
    { label: 'Verified Influencers', value: '108+', emphasis: true },
    { label: 'Creator Profiles', value: '200+', emphasis: true },
    { label: 'Growing Network of', value: 'BRANDS', emphasis: true },
    { label: 'Photographers', value: 'Growing the count', emphasis: false },
  ];

  readonly placeholderCategories: string[] = [
    'Fashion',
    'Beauty',
    'Tech',
    'Travel',
    'Food',
    'Fitness'
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

  readonly homepageFaqs: FaqAccordionItem[] = TRENDSTARZ_FAQ_ITEMS.slice(0, 5);

  readonly faqCtaButtons: FaqCtaButton[] = [
    // { label: 'More FAQs', route: '/faqs', className: 'btn btn-outline-dark' },
  ];

  get faqAccordionInputs() {
    return {
      heading: 'Frequently Asked Questions',
      items: this.homepageFaqs,
      showSchema: true,
      schemaId: 'trendstarz-home-faq-schema',
      ctaHeading: '',
      ctaButtons: this.faqCtaButtons,
    };
  }

  private routerSubscription: any;
  private marketplaceBootstrapScheduled = false;
  private marketplaceBootstrapStarted = false;

  influencers: any[] = [];
  allInfluencers: any[] = [];
  brands: any[] = [];
  brandCampaignStatusMap: Record<string, string> = {};
  influencersLoading = false;
  brandsLoading = false;
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
    this.loadPlatformStats();
    this.scheduleMarketplaceBootstrap();
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects || event.url;
        if (url === '/welcome' || url === '/' || url.startsWith('/welcome?')) {
          this.scheduleMarketplaceBootstrap();
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
    this.influencers = [];
    this.config.getInfluencers().subscribe({
      next: (data) => {
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
        this.influencersLoading = false;
        console.error('Influencer fetch error:', err);
        this.cd.detectChanges();
      }
    });
  }

  private loadPlatformStats(): void {
    this.config.getPlatformStats().subscribe((stats) => {
      const hasData = (stats?.totalInfluencers || 0) > 0 || (stats?.totalPhotographers || 0) > 0;
      if (!hasData) return;
      const formatCount = (count: number) => (Number.isFinite(count) ? String(count) : '0');
      const brandsStat = formatBrandsStat(stats);
      const photographersStat = formatPhotographersStat(stats);
      this.glanceCounters = [
        { label: 'Verified Influencers', value: formatCount(stats.verifiedInfluencers), emphasis: true },
        { label: 'Creator Profiles', value: formatCount(stats.totalInfluencers), emphasis: true },
        { label: brandsStat.label, value: brandsStat.value, emphasis: true },
        { label: photographersStat.label, value: photographersStat.value, emphasis: false },
      ];
      this.cd.detectChanges();
    });
  }

  private scheduleMarketplaceBootstrap(): void {
    if (!this.isBrowser || this.marketplaceBootstrapScheduled) {
      return;
    }

    this.marketplaceBootstrapScheduled = true;
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };

    const startBootstrap = () => {
      if (this.marketplaceBootstrapStarted) {
        return;
      }

      this.marketplaceBootstrapStarted = true;
      this.ngZone.run(() => {
        this.fetchBrands();
        this.fetchInfluencers();
      });
    };

    if (browserWindow.requestIdleCallback) {
      browserWindow.requestIdleCallback(startBootstrap, { timeout: 4000 });
      return;
    }

    if (document.readyState === 'complete') {
      setTimeout(startBootstrap, 0);
      return;
    }

    browserWindow.addEventListener(
      'load',
      () => {
        setTimeout(startBootstrap, 0);
      },
      { once: true },
    );
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
    this.brands = [];
    this.brandCampaignStatusMap = {};
    this.config.getBrands().subscribe({
      next: (data) => {
        const brandArray = Array.isArray(data)
          ? data
          : (data && Array.isArray((data as any).data) ? (data as any).data : []);
        this.brands = brandArray;
        if (this.showBrandCampaignMetaOnWelcome) {
          this.populateWelcomeBrandCampaignStatus(brandArray);
        }
        this.brandsLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        this.brandsLoading = false;
        console.error('Brand fetch error:', err);
        this.cd.detectChanges();
      }
    });
  }

  private getBrandMapKey(brand: any): string {
    return String(brand?._id || brand?.brandName || '').trim();
  }

  getWelcomeBrandCampaignStatus(brand: any): string {
    const fallback = '0 Live';
    const key = this.getBrandMapKey(brand);
    return this.brandCampaignStatusMap[key] || fallback;
  }

  private populateWelcomeBrandCampaignStatus(brands: any[]): void {
    const visibleBrands = (Array.isArray(brands) ? brands : []).slice(0, 8);
    if (!visibleBrands.length) {
      this.brandCampaignStatusMap = {};
      return;
    }

    forkJoin(
      visibleBrands.map((brand: any) => {
        const brandName = String(brand?.brandName || '').trim();
        const key = this.getBrandMapKey(brand);

        if (!brandName) {
          return of({ key, status: '0 Live' });
        }

        return this.config.getCampaignsByBrandName(brandName).pipe(
          switchMap((campaigns: any[]) => {
            const rows = Array.isArray(campaigns) ? campaigns.filter((campaign: any) => !!campaign?._id) : [];
            if (!rows.length) {
              return of({ key, status: '0 Live' });
            }

            return forkJoin(
              rows.map((campaign: any) =>
                this.config.getInvitesByCampaign(campaign._id).pipe(
                  map((invites: any[]) => ({ campaign, invites: Array.isArray(invites) ? invites : [] })),
                  catchError(() => of({ campaign, invites: [] })),
                ),
              ),
            ).pipe(
              map((campaignRows: Array<{ campaign: any; invites: any[] }>) => {
                const liveCount = campaignRows.filter(({ campaign, invites }) => {
                  const status = String(campaign?.status || '').toLowerCase();
                  const hasInvitedInfluencers = invites.length > 0;
                  return status === 'completed' || hasInvitedInfluencers;
                }).length;

                return { key, status: `${liveCount} Live` };
              }),
            );
          }),
          catchError(() => of({ key, status: '0 Live' })),
        );
      }),
    ).subscribe({
      next: (items: Array<{ key: string; status: string }>) => {
        this.brandCampaignStatusMap = items.reduce<Record<string, string>>((acc, item) => {
          acc[item.key] = item.status;
          return acc;
        }, {});
        this.cd.detectChanges();
      },
      error: () => {
        this.brandCampaignStatusMap = {};
        this.cd.detectChanges();
      },
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

}
