import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

export interface HeroSliderBannerSlide {
  heading: string;
  highlightText: string;
  description: string;
  primaryLabel: string;
  primaryRoute: string;
  secondaryLabel: string;
  secondaryRoute: string;
  textLinkLabel?: string;
  textLinkRoute?: string;
  imageUrl: string;
  imageAlt: string;
  imagePrompt?: string;
  imagePosition?: string;
}

@Component({
  selector: 'app-hero-slider-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero-slider-banner.component.html',
  styleUrls: ['./hero-slider-banner.component.scss']
})
export class HeroSliderBannerComponent implements OnInit, OnDestroy {
  @Input() badge = 'Next-Gen Influencer';
  @Input() ariaLabel = 'TrendStarz Hero Slides';
  @Input() showTextLink = false;
  @Input() autoplayIntervalMs = 5500;
  @Input() slides: HeroSliderBannerSlide[] = [];

  activeSlideIndex = 0;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isBrowser: boolean;

  constructor(
    private router: Router,
    private cd: ChangeDetectorRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser || this.slides.length <= 1) return;

    this.ngZone.run(() => {
      this.startAutoplay();
    });
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  get activeSlide(): HeroSliderBannerSlide | null {
    return this.slides[this.activeSlideIndex] || null;
  }

  get activeImageLoading(): 'eager' | 'lazy' {
    return this.activeSlideIndex === 0 ? 'eager' : 'lazy';
  }

  get activeImageFetchPriority(): 'high' | 'auto' {
    return this.activeSlideIndex === 0 ? 'high' : 'auto';
  }

  previousSlide(): void {
    if (!this.slides.length) return;
    this.activeSlideIndex = (this.activeSlideIndex - 1 + this.slides.length) % this.slides.length;
  }

  nextSlide(): void {
    if (!this.slides.length) return;
    this.activeSlideIndex = (this.activeSlideIndex + 1) % this.slides.length;
  }

  setSlide(index: number): void {
    if (index < 0 || index >= this.slides.length) return;
    this.activeSlideIndex = index;
  }

  navigate(direction: 'next' | 'prev'): void {
    if (direction === 'next') {
      this.nextSlide();
    } else {
      this.previousSlide();
    }
    this.restartAutoplay();
  }

  goToSlide(index: number): void {
    this.setSlide(index);
    this.restartAutoplay();
  }

  go(route?: string): void {
    if (!route) return;
    this.router.navigateByUrl(route);
  }

  private startAutoplay(): void {
    if (this.intervalId || this.slides.length <= 1) return;

    this.intervalId = setInterval(() => {
      this.nextSlide();
      this.cd.detectChanges();
    }, this.autoplayIntervalMs);
  }

  private stopAutoplay(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private restartAutoplay(): void {
    this.stopAutoplay();
    this.startAutoplay();
  }
}
