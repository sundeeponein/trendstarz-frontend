import { Component, OnInit, OnDestroy, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ConfigService } from '../../shared/config.service';
import { Router, NavigationEnd } from '@angular/router';
// import { NavbarLayoutComponent } from '../../layout/navbar-layout/navbar-layout.component';
// import { FooterComponent } from '../../shared/footer/footer.component';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
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

  constructor(
    private meta: Meta,
    private title: Title,
    private config: ConfigService,
    public router: Router,
    private cd: ChangeDetectorRef
  ) {
    afterNextRender(() => {
      this.fetchBrands();
      this.fetchInfluencers();
      this.routerSubscription = this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          const url = event.urlAfterRedirects || event.url;
          if (url === '/welcome' || url === '/' || url.startsWith('/welcome?')) {
            this.fetchInfluencers();
            this.fetchBrands();
          }
        }
      });
    });
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
        // Filter for accepted status only (defensive, in case backend ever returns others)
        this.allInfluencers = (data || []).filter((u: any) => u.status === 'accepted');
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
      this.router.navigate(['/influencer', urlUsername]);
    }
  }

  fetchBrands() {
    this.brandsLoading = true;
    this.brandsError = '';
    this.brands = [];
    this.config.getBrands('').subscribe({
      next: (data) => {
        // Filter for accepted status only (defensive, in case backend ever returns others)
        this.brands = (data || []).filter((u: any) => u.status === 'accepted');
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
