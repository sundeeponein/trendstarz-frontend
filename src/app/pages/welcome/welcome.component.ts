import { Component, OnInit, OnDestroy, ChangeDetectorRef, Inject, PLATFORM_ID, NgZone, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Meta, MetaDefinition, Title } from '@angular/platform-browser';
import { ConfigService } from '../../shared/config.service';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { BuiltForAudiencesComponent, BuiltForAudienceItem } from '../../shared/components/built-for-audiences/built-for-audiences.component';
import { BrandUserCardComponent } from '../../shared/user-card/brand-user-card/brand-user-card.component';
import { InfluencerUserCardComponent } from '../../shared/user-card/influencer-user-card/influencer-user-card.component';
import { PhotographerUserCardComponent } from '../../shared/user-card/photographer-user-card/photographer-user-card.component';
import { FaqAccordionComponent, FaqAccordionItem, FaqCtaButton } from '../../shared/components/faq-accordion/faq-accordion.component';
import { HOME_FAQ_ITEMS } from '../../shared/components/faq-accordion/faq-content.constants';
import { environment } from '../../../environments/environment';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { HeroBannerComponent, HeroStat, HeroAction, HeroAudience, HeroShowcaseCard, DEFAULT_HERO_CARDS } from '../../shared/hero-banner/hero-banner.component';
import { AnalyticsService } from '../../core/analytics.service';
import { SessionService } from '../../core/session.service';
import { HeroSliderBannerComponent, HeroSliderBannerSlide } from '../../shared/hero-slider-banner/hero-slider-banner.component';
import { RegistrationConfirmModalComponent } from '../../shared/components/registration-confirm-modal/registration-confirm-modal.component';
import { RegistrationConfirmModalService } from '../../shared/components/registration-confirm-modal/registration-confirm-modal.service';
import { ActionCtaComponent } from '../../shared/components/action-cta/action-cta.component';
import { WhyTrendstarzGlanceComponent, TrendstarzGlanceCounter } from '../../shared/components/why-trendstarz-glance/why-trendstarz-glance.component';
import { PlatformStatsStripComponent, PlatformStatItem } from '../../shared/components/platform-stats-strip/platform-stats-strip.component';
import { HowItWorksStepsComponent } from '../../shared/components/how-it-works-steps/how-it-works-steps.component';
import { PlatformStats, formatBrandsStat, formatPhotographersStat, formatMilestoneCount, formatRupeeCompact } from '../../shared/utils/platform-stats.util';
import { ScorePreviewComponent } from '../../shared/score-preview/score-preview.component';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule, HeroBannerComponent, BrandUserCardComponent, InfluencerUserCardComponent, PhotographerUserCardComponent, RegistrationConfirmModalComponent, ActionCtaComponent, WhyTrendstarzGlanceComponent, PlatformStatsStripComponent, HowItWorksStepsComponent, ScorePreviewComponent],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  readonly regConfirm = inject(RegistrationConfirmModalService);

  readonly showBrandCampaignMetaOnWelcome = false;

  readonly builtForAudiencesComponent = BuiltForAudiencesComponent;
  readonly faqAccordionComponent = FaqAccordionComponent;
  readonly heroSliderBannerComponent = HeroSliderBannerComponent;

  private static readonly DEFAULT_HERO_IMAGE = 'assets/banner-trendstarz-1600.jpg';
  private readonly analytics = inject(AnalyticsService);
  private readonly session = inject(SessionService);

  /** Default marketing cards only — the showcase never shows real users' data (logged in or out). */
  readonly heroCards: HeroShowcaseCard[] = DEFAULT_HERO_CARDS;

  /** Logged-in users get role-specific actions instead of the "I'm a …" audience CTAs. */
  heroActions: HeroAction[] = [];

  onHeroAudienceClick(audience: HeroAudience): void {
    this.analytics.trackHeroAudienceClick(audience);
    this.regConfirm.open(audience);
  }

  private buildHeroActions(): HeroAction[] {
    if (!this.isLoggedIn()) return [];
    const role = String(this.session.getUser()?.role || '').toLowerCase();
    if (role === 'brand') {
      return [
        { label: 'Start a Campaign', route: '/campaigns/new', primary: true, icon: 'bi-plus-circle' },
        { label: 'Find Creators', route: '/search', icon: 'bi-search' },
      ];
    }
    if (role === 'influencer') {
      return [
        { label: 'My Dashboard', route: '/influencer-dashboard', primary: true, icon: 'bi-speedometer2' },
        { label: 'Check My TrendScore', route: '/dashboard/trendstarz-score', icon: 'bi-graph-up-arrow' },
      ];
    }
    if (role === 'photographer' || role === 'videographer') {
      return [
        { label: 'My Dashboard', route: '/photographer-dashboard', primary: true, icon: 'bi-speedometer2' },
        { label: 'Explore Campaigns', route: '/campaigns', icon: 'bi-megaphone' },
      ];
    }
    return [
      { label: 'Find Creators', route: '/search', primary: true, icon: 'bi-search' },
      { label: 'Campaigns', route: '/campaigns', icon: 'bi-megaphone' },
    ];
  }

  get heroSliderBannerInputs() {
    return {
      badge: 'TrendStarz Marketplace',
      ariaLabel: 'TrendStarz Hero Slides',
      showTextLink: false,
      autoplayIntervalMs: 5500,
      slides: this.heroSliderSlides,
      onPrimaryClick: (slide: HeroSliderBannerSlide) => this.onHeroSliderPrimaryClick(slide),
    };
  }

  // Registration CTA per slide's primaryRoute — mirrors the static
  // app-hero-banner's (primaryClick)="regConfirm.open(...)" pattern, but
  // routed through a callback @Input() since NgComponentOutlet can't bind
  // template (output) listeners.
  private readonly heroSliderRegistrationRoleByRoute: Record<string, 'brand' | 'influencer' | 'photographer'> = {
    '/register-brand': 'brand',
    '/register-influencer': 'influencer',
    '/register-photographer': 'photographer',
  };

  private onHeroSliderPrimaryClick(slide: HeroSliderBannerSlide): void {
    const role = this.heroSliderRegistrationRoleByRoute[slide.primaryRoute];
    if (!this.isLoggedIn() && role) {
      this.regConfirm.open(role);
      return;
    }
    if (slide.primaryRoute) this.router.navigateByUrl(slide.primaryRoute);
  }

  private get heroSliderSlides(): HeroSliderBannerSlide[] {
    const loggedIn = this.isLoggedIn();
    return [
      {
        heading: 'Launch Campaigns That Convert',
        highlightText: 'Built for Brands',
        description: 'Discover verified influencers, run targeted campaigns, and track results — all in one platform.',
        primaryLabel: loggedIn ? 'Start a Campaign' : 'Register as Brand',
        primaryRoute: loggedIn ? '/campaigns' : '/register-brand',
        secondaryLabel: 'Find Creators',
        secondaryRoute: '/search',
        imageUrl: WelcomeComponent.DEFAULT_HERO_IMAGE,
        imageAlt: 'Brands collaborating with influencers on TrendStarz',
      },
      {
        heading: 'Grow Your Influence, Get Paid',
        highlightText: 'Built for Creators',
        description: 'Connect with brands actively looking for creators like you and turn your content into income.',
        primaryLabel: loggedIn ? 'Explore Campaigns' : 'Register as Influencer',
        primaryRoute: loggedIn ? '/campaigns' : '/register-influencer',
        secondaryLabel: 'Explore Features',
        secondaryRoute: '/features',
        imageUrl: WelcomeComponent.DEFAULT_HERO_IMAGE,
        imageAlt: 'Influencer creating content for a brand campaign',
      },
      {
        heading: 'Showcase Your Craft to Brands',
        highlightText: 'Built for Photo & Videographers',
        description: 'Get discovered by brands and creators who need professional photo and video talent for their campaigns.',
        primaryLabel: loggedIn ? 'Explore Campaigns' : 'Register as Photographer',
        primaryRoute: loggedIn ? '/campaigns' : '/register-photographer',
        secondaryLabel: 'How It Works',
        secondaryRoute: '/how-it-works',
        imageUrl: WelcomeComponent.DEFAULT_HERO_IMAGE,
        imageAlt: 'Photographer showcasing a portfolio to brands',
      },
    ];
  }
  /** Niche cards — each `category` is an exact creator category name, so the Search link and the count match. */
  private static readonly NICHES: BuiltForAudienceItem[] = [
    { icon: 'bi-bag-heart', title: 'Fashion & Apparel', category: 'Fashion', subtitle: 'Lookbooks, styling reels, ethnic wear showcases and brand drops.' },
    { icon: 'bi-cup-hot', title: 'Food & Restaurants', category: 'Food', subtitle: 'Food walkthroughs, menu launches, dine-in reels and local footfall.' },
    { icon: 'bi-stars', title: 'Beauty & Skincare', category: 'Beauty', subtitle: 'Routines, honest product trials, before-afters and makeup tutorials.' },
    { icon: 'bi-phone', title: 'Tech & Gadgets', category: 'Tech', subtitle: 'Unboxings, hands-on reviews, app demos and launch reels.' },
    { icon: 'bi-rocket-takeoff', title: 'Business & Startups', category: 'Business', subtitle: 'Founder stories, D2C launches and explainer content.' },
    { icon: 'bi-airplane', title: 'Travel', category: 'Travel', subtitle: 'Vlogs, resort stays, road trips and cinematic storytelling.' },
    { icon: 'bi-house-heart', title: 'Lifestyle', category: 'Lifestyle', subtitle: 'Everyday routines, home, and trend-led content.' },
    { icon: 'bi-heart-pulse', title: 'Fitness & Wellness', category: 'Fitness', subtitle: 'Workouts, nutrition tips and athlete-style endorsements.' },
  ];

  /** Below this, a niche card links to Search without showing a (small-looking) number. */
  private static readonly NICHE_COUNT_MIN = 10;

  builtForAudiencesInputs: { items: BuiltForAudienceItem[] } = { items: WelcomeComponent.NICHES };

  private buildNicheItems(counts: Record<string, number> = {}): BuiltForAudienceItem[] {
    return WelcomeComponent.NICHES.map((niche) => {
      const count = counts[niche.category || ''] || 0;
      return count >= WelcomeComponent.NICHE_COUNT_MIN ? { ...niche, countLabel: formatMilestoneCount(count) } : niche;
    });
  }

  readonly minPublicInfluencers = environment.marketplacePublicMinInfluencers;
  readonly minPublicBrands = environment.marketplacePublicMinBrands;
  readonly minPublicPhotographers = environment.marketplacePublicMinPhotographers;

  /** Empty until real platform stats load — never show placeholder numbers. */
  glanceCounters: TrendstarzGlanceCounter[] = [];

  /** Hero stats strip — empty until platform stats load; zero-value items are omitted. */
  heroStats: HeroStat[] = [];
  heroStatsLoading = false;

  statsStripItems: PlatformStatItem[] = [];

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

  readonly homepageFaqs: FaqAccordionItem[] = HOME_FAQ_ITEMS;

  readonly faqCtaButtons: FaqCtaButton[] = [
    { label: 'See all FAQs', route: '/faqs', className: 'btn btn-outline-dark' },
  ];

  get faqAccordionInputs() {
    return {
      kicker: 'Got questions?',
      heading: 'Frequently Asked Questions',
      subheading: 'Everything you need to know about working with creators and hiring through TrendStarz.',
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
  photographers: any[] = [];
  platformStats: {
    totalInfluencers: number;
    verifiedInfluencers: number;
    totalPhotographers: number;
    verifiedPhotographers: number;
    totalBrands: number;
    verifiedBrands: number;
    totalCampaigns: number;
  } | null = null;
  brandCampaignStatusMap: Record<string, string> = {};
  influencersLoading = false;
  brandsLoading = false;
  photographersLoading = false;
  selectedCategory: string = '';
  creatorCategories: string[] = [];

  private isBrowser: boolean;

  get isMarketplaceReadyForPublic(): boolean {
    return this.showBrandsSection || this.showInfluencersSection || this.showPhotographersSection;
  }

  get showBrandsSection(): boolean {
    return (this.platformStats?.totalBrands || 0) >= this.minPublicBrands && this.brands.length > 0;
  }

  get showInfluencersSection(): boolean {
    return (this.platformStats?.totalInfluencers || 0) >= this.minPublicInfluencers && this.allInfluencers.length > 0;
  }

  get showPhotographersSection(): boolean {
    return (this.platformStats?.totalPhotographers || 0) >= this.minPublicPhotographers && this.photographers.length > 0;
  }

  get marketplaceLoading(): boolean {
    return this.brandsLoading || this.influencersLoading || this.photographersLoading;
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
    if (!this.isBrowser) return false;
    return !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
  }

  ngOnInit(): void {
    const pageTitle = 'TrendStarz | Where Brands Meet Creators & Photographers';
    const description = 'Brands find verified influencers and photo/videographers across India. Creators get discovered, check their free TrendScore and get hired for campaigns.';
    this.title.setTitle(pageTitle);
    // updateTag (not addTags) so returning to the home page doesn't stack duplicate tags.
    const tags: MetaDefinition[] = [
      { name: 'description', content: description },
      { name: 'keywords', content: 'influencer marketing India, hire influencers, photographers for brands, creator marketplace, TrendScore, brand collaborations' },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: description },
      { property: 'og:image', content: 'logo-trendstarz-logo-text.png' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: pageTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: 'logo-trendstarz-logo-text.png' },
    ];
    tags.forEach((tag) => this.meta.updateTag(tag));
    if (!this.isBrowser) return;
    this.heroActions = this.buildHeroActions();
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

  /**
   * Loads all three Welcome Page "Featured" sections in a single call —
   * eligible-only, weighted-random profiles, identical for every viewer type.
   */
  fetchFeaturedProfiles(): void {
    this.influencersLoading = true;
    this.brandsLoading = true;
    this.photographersLoading = true;
    this.influencers = [];
    this.brands = [];
    this.photographers = [];
    this.brandCampaignStatusMap = {};
    this.config.getFeaturedProfiles({ influencerLimit: 8, brandLimit: 4, photographerLimit: 4 }).subscribe({
      next: (res) => {
        this.allInfluencers = Array.isArray(res?.influencers) ? res.influencers : [];

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

        const brandArray = Array.isArray(res?.brands) ? res.brands : [];
        this.brands = brandArray;
        if (this.showBrandCampaignMetaOnWelcome) {
          this.populateWelcomeBrandCampaignStatus(brandArray);
        }

        this.photographers = Array.isArray(res?.photographers) ? res.photographers : [];

        this.influencersLoading = false;
        this.brandsLoading = false;
        this.photographersLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        this.influencersLoading = false;
        this.brandsLoading = false;
        this.photographersLoading = false;
        console.error('Featured profiles fetch error:', err);
        this.cd.detectChanges();
      },
    });
  }

  /**
   * Hero stat minimums — a small number ("6+ Brands") hurts more than it helps,
   * so each tile waits until it clears its threshold. Max 4 tiles, in priority order.
   */
  private static readonly HERO_STAT_MIN = {
    creators: 50,
    brands: 20,
    cities: 10,
    escrowRupees: 100000,
    campaigns: 25,
    reviews: 10,
  };
  private static readonly HERO_STAT_MAX = 4;

  private buildHeroStats(stats: PlatformStats): HeroStat[] {
    const min = WelcomeComponent.HERO_STAT_MIN;
    const verifiedCreators = (stats.verifiedInfluencers || 0) + (stats.verifiedPhotographers || 0);
    const items: HeroStat[] = [];
    if (verifiedCreators >= min.creators) items.push({ value: formatMilestoneCount(verifiedCreators), label: 'Verified Creators' });
    if (stats.totalBrands >= min.brands) items.push({ value: formatMilestoneCount(stats.totalBrands), label: 'Brands' });
    if ((stats.totalCities || 0) >= min.cities) items.push({ value: formatMilestoneCount(stats.totalCities!), label: 'Cities' });
    if ((stats.creatorEscrowTotal || 0) >= min.escrowRupees) {
      items.push({ value: formatRupeeCompact(stats.creatorEscrowTotal!), label: 'Creator Escrow', accent: true });
    }
    if (stats.totalCampaigns >= min.campaigns) items.push({ value: formatMilestoneCount(stats.totalCampaigns), label: 'Campaigns' });
    if ((stats.ratingCount || 0) >= min.reviews && stats.averageRating) {
      items.push({ value: stats.averageRating.toFixed(1), label: 'Match Rating', star: true });
    }
    return items.slice(0, WelcomeComponent.HERO_STAT_MAX);
  }

  private loadPlatformStats(): void {
    this.heroStatsLoading = true;
    this.config.getPlatformStats().subscribe((stats) => {
      this.platformStats = stats;
      this.heroStatsLoading = false;
      const hasData = (stats?.totalInfluencers || 0) > 0 || (stats?.totalPhotographers || 0) > 0;
      if (!hasData) {
        this.cd.detectChanges();
        return;
      }
      const formatCount = (count: number) => (Number.isFinite(count) ? String(count) : '0');
      const brandsStat = formatBrandsStat(stats);
      const photographersStat = formatPhotographersStat(stats);
      this.glanceCounters = [
        { label: 'Verified Influencers', value: formatCount(stats.verifiedInfluencers), emphasis: true },
        { label: 'Creator Profiles', value: formatCount(stats.totalInfluencers), emphasis: true },
        { label: brandsStat.label, value: brandsStat.value, emphasis: true },
        { label: photographersStat.label, value: photographersStat.value, emphasis: false },
      ];
      this.heroStats = this.buildHeroStats(stats);
      this.builtForAudiencesInputs = { items: this.buildNicheItems(stats.influencerCategoryCounts) };
      this.statsStripItems = [
        { icon: 'bi-people-fill', value: formatMilestoneCount(stats.verifiedInfluencers), label: 'Verified Creators' },
        { icon: 'bi-briefcase-fill', value: formatMilestoneCount(stats.totalBrands), label: 'Active Brands' },
        { icon: 'bi-camera-fill', value: formatMilestoneCount(stats.totalPhotographers), label: 'Photo/VideoGraphers' },
        { icon: 'bi-patch-check-fill', value: formatMilestoneCount(stats.totalCampaigns), label: 'Campaigns Created' },
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
        this.fetchFeaturedProfiles();
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
      // Prefer the stored username as-is — it's already the canonical URL
      // identifier and may differ from a fresh slugify() of the display name
      // (customized at registration, disambiguation suffix, etc.). Only
      // derive a slug from the display name when there's no stored username.
      const storedUsername = String(influencer.username || '').trim();
      const urlUsername = storedUsername || this.slugify(influencer.name || '');
      if (urlUsername) {
        this.config.trackInfluencerProfileClick(urlUsername).subscribe({
          next: () => {},
          error: () => {}
        });
      }
      this.router.navigate(['/influencer', urlUsername]);
    }
  }


  viewPhotographerProfile(photographer: any): void {
    const username = String(photographer?.username || '').trim();
    const id = String(photographer?._id || '').trim();
    if (username) {
      this.router.navigate(['/photographer', username]);
      return;
    }
    if (id) {
      this.router.navigate(['/photographer', id]);
    }
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
    if (!brand) return;
    // Prefer the stored brandUsername as-is — it's already the canonical URL
    // identifier and may differ from a fresh slugify() of brandName
    // (customized at registration, disambiguation suffix, apostrophes/
    // punctuation stripped differently, etc.). Only derive a slug from the
    // display name when there's no stored brandUsername.
    const storedUsername = String(brand.brandUsername || '').trim();
    const slug = storedUsername || this.slugify(brand.brandName || '');
    if (!slug) return;
    this.config.trackBrandProfileClick(slug).subscribe({
      next: () => {},
      error: () => {}
    });
    this.router.navigate(['/brand', slug]);
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
