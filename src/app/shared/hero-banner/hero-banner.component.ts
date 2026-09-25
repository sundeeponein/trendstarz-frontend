import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, Inject, PLATFORM_ID, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

export type HeroAudience = 'brand' | 'influencer' | 'photographer';

export interface HeroAudienceCta {
  key: HeroAudience;
  label: string;
  sub: string;
  icon: string;
}

/** Shown instead of the audience CTAs for logged-in users. */
export interface HeroAction {
  label: string;
  route: string;
  primary?: boolean;
  icon?: string;
}

export interface HeroStat {
  value: string;
  label: string;
  /** Rupee-style emphasis colour (used for money). */
  accent?: boolean;
  /** Trailing star icon (used for ratings). */
  star?: boolean;
}

interface HeroCardBase {
  /** Sample content until real marketplace data loads — labelled so it never passes as a real profile. */
  example?: boolean;
  verified?: boolean;
  ctaLabel: string;
  ctaRoute: string;
}

export interface HeroCreatorCard extends HeroCardBase {
  type: 'creator';
  name: string;
  category?: string;
  imageUrl?: string;
  followers?: string;
  engagement?: string;
  trendScore?: number;
}

export interface HeroPhotographerCard extends HeroCardBase {
  type: 'photographer';
  name: string;
  specialties?: string;
  location?: string;
  imageUrl?: string;
  trendScore?: number;
}

export interface HeroCampaignCard extends HeroCardBase {
  type: 'campaign';
  title: string;
  lookingFor?: string;
  locations?: string;
}

/**
 * Right-side marketplace card. Only real stored fields go in here — an empty
 * field is simply not rendered. No private deal amounts or brand-confidential data.
 */
export type HeroShowcaseCard = HeroCreatorCard | HeroPhotographerCard | HeroCampaignCard;

/** Rendered immediately (SSR/prerender) and kept if live data is unavailable. */
export const EXAMPLE_HERO_CARDS: HeroShowcaseCard[] = [
  {
    type: 'creator',
    example: true,
    name: 'Fashion & Beauty Creator',
    category: 'Instagram • Reels',
    imageUrl: 'assets/banner-trendstarz-1600.jpg',
    followers: '128K',
    engagement: '6.4%',
    trendScore: 92,
    verified: true,
    ctaLabel: 'Discover Creators',
    ctaRoute: '/search',
  },
  {
    type: 'photographer',
    example: true,
    name: 'Product & Lifestyle Shoots',
    specialties: 'Fashion • Product • Lifestyle',
    location: 'Hyderabad, Telangana',
    verified: true,
    ctaLabel: 'Find Photo/Videographers',
    ctaRoute: '/search',
  },
  {
    type: 'campaign',
    example: true,
    title: 'Skincare Launch Campaign',
    lookingFor: 'Beauty creators & product photographers',
    locations: 'Mumbai • Delhi • Bengaluru',
    ctaLabel: 'How Campaigns Work',
    ctaRoute: '/how-it-works',
  },
];

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, NgOptimizedImage],
  templateUrl: './hero-banner.component.html',
  styleUrls: ['./hero-banner.component.scss']
})
export class HeroBannerComponent implements OnChanges, OnDestroy {
  private static readonly ROTATE_MS = 6000;

  @Input() badge = 'The Creator Collaboration Platform';
  @Input() titleMain = 'Where Brands Meet';
  @Input() titleHighlight = 'Creators & Photographers';
  @Input() subtitle = 'Brands find talent. Creators get discovered. Photographers get hired.';
  @Input() audiences: HeroAudienceCta[] = [
    { key: 'brand', label: 'I\'m a Brand', sub: 'Find creators & photographers', icon: 'bi-briefcase' },
    { key: 'influencer', label: 'I\'m an Influencer', sub: 'Get discovered & earn', icon: 'bi-person-video3' },
    { key: 'photographer', label: 'I\'m a Photo/Videographer', sub: 'Get hired for campaigns', icon: 'bi-camera' },
  ];
  /** When non-empty (logged-in users), replaces the audience CTAs. */
  @Input() actions: HeroAction[] = [];
  @Input() trustItems: string[] = ['Verified profiles', 'Direct collaboration', 'Secure payments'];
  /** Live platform counts; the strip is hidden until at least one is available. */
  @Input() stats: HeroStat[] = [];
  @Input() cards: HeroShowcaseCard[] = EXAMPLE_HERO_CARDS;
  @Output() audienceClick = new EventEmitter<HeroAudience>();

  activeIndex = 0;
  private rotateTimer?: ReturnType<typeof setInterval>;
  private paused = false;
  private readonly isBrowser: boolean;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private cd: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  get activeCard(): HeroShowcaseCard | null {
    return this.cards[this.activeIndex] || this.cards[0] || null;
  }

  ngOnChanges(): void {
    if (this.activeIndex >= this.cards.length) this.activeIndex = 0;
    this.startRotation();
  }

  ngOnDestroy(): void {
    this.stopRotation();
  }

  selectAudience(key: HeroAudience): void {
    this.audienceClick.emit(key);
  }

  go(route: string): void {
    if (route) this.router.navigateByUrl(route);
  }

  showCard(index: number): void {
    this.activeIndex = index;
    this.startRotation();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  private startRotation(): void {
    this.stopRotation();
    if (!this.isBrowser || this.cards.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Outside the zone so the interval doesn't keep the app "unstable" for hydration.
    this.ngZone.runOutsideAngular(() => {
      this.rotateTimer = setInterval(() => {
        if (this.paused) return;
        this.ngZone.run(() => {
          this.activeIndex = (this.activeIndex + 1) % this.cards.length;
          this.cd.markForCheck();
        });
      }, HeroBannerComponent.ROTATE_MS);
    });
  }

  private stopRotation(): void {
    if (this.rotateTimer) clearInterval(this.rotateTimer);
    this.rotateTimer = undefined;
  }
}
