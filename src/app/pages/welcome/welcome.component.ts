import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NavbarLayoutComponent } from '../../layout/navbar-layout/navbar-layout.component';
import { CommonModule } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ConfigService } from '../../shared/config.service';
import { Router, NavigationEnd } from '@angular/router';
import { InfluencerUserCardComponent } from '../../shared/user-card/influencer-user-profile/influencer-user-card.component';
import { BrandUserCardComponent } from '../../shared/user-card/brand-user-card/brand-user-card.component';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [NavbarLayoutComponent, CommonModule, InfluencerUserCardComponent, BrandUserCardComponent],
  templateUrl: './welcome.component.html'
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private routerSubscription: any;
  influencers: any[] = [];
  brands: any[] = [];
  influencersLoading = false;
  brandsLoading = false;
  influencersError: string = '';
  brandsError: string = '';

  constructor(
    private meta: Meta,
    private title: Title,
    private config: ConfigService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchBrands();
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
    this.fetchInfluencers();
    // Listen for navigation events to re-fetch data on back/forward
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
    this.config.getInfluencers('').subscribe({
      next: (data) => {
        this.influencers = data || [];
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
    if (influencer && influencer.username) {
      this.router.navigate(['/influencer', influencer.username]);
    }
  }

  fetchBrands() {
    this.brandsLoading = true;
    this.brandsError = '';
    this.brands = [];
    this.config.getBrands('').subscribe({
      next: (data) => {
        this.brands = data || [];
        this.brandsLoading = false;
        this.cd.detectChanges();
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
      this.router.navigate(['/brand', this.slugify(brand.brandName)]);
    }
  }
  
}
