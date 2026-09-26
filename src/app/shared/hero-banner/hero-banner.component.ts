import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, Inject, PLATFORM_ID, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
  platform?: string;
  location?: string;
  trendScore?: number | null;
}

export interface HeroPhotographerCard extends HeroCardBase {
  type: 'photographer';
  name: string;
  specialties?: string;
  location?: string;
  imageUrl?: string;
  trendScore?: number | null;
}

export interface HeroCampaignCard extends HeroCardBase {
  type: 'campaign';
  title: string;
  imageUrl?: string;
  lookingFor?: string;
  locations?: string;
}

/**
 * Right-side marketplace card — TrendStarz's own marketing images and copy
 * only (see DEFAULT_HERO_CARDS), never real users' data. Empty fields aren't rendered.
 */
export type HeroShowcaseCard = HeroCreatorCard | HeroPhotographerCard | HeroCampaignCard;

/**
 * Rendered immediately (SSR/prerender) and kept when no live profiles are
 * available. Generic marketplace copy only — no invented names or numbers.
 * Replace with real images/content when ready.
 */
export const DEFAULT_HERO_CARDS: HeroShowcaseCard[] = [
  {
    type: 'creator',
    name: 'Fashion & Beauty Creators',
    category: 'Instagram • YouTube • Reels',
    imageUrl: 'assets/banner-trendstarz-1600.jpg',
    ctaLabel: 'Discover Creators',
    ctaRoute: '/search',
  },
  {
    type: 'photographer',
    name: 'Product & Lifestyle Shoots',
    specialties: 'Fashion • Product • Lifestyle',
    imageUrl: 'assets/banner-videoproduction.jpg',
    ctaLabel: 'Find Photo/Videographers',
    ctaRoute: '/search?tab=photographers',
  },
  {
    type: 'campaign',
    title: 'Launch your next campaign',
    imageUrl: 'assets/banner-brands-creators-campaign.png',
    lookingFor: 'Creators & photo/videographers across India',
    ctaLabel: 'How Campaigns Work',
    ctaRoute: '/how-it-works',
  },
];

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
  /** True while stats are loading — placeholder tiles hold the row's space so nothing jumps. */
  @Input() statsLoading = false;
  @Input() cards: HeroShowcaseCard[] = DEFAULT_HERO_CARDS;
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
