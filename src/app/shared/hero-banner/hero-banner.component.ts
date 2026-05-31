import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, NgOptimizedImage],
  templateUrl: './hero-banner.component.html',
  styleUrls: ['./hero-banner.component.scss']
})
export class HeroBannerComponent {
  @Input() badge = 'Next-Gen Influencer';
  @Input() titleMain = 'Connect Brands with India\'s';
  @Input() titleHighlight = 'Top Creators';
  @Input() subtitle = 'TrendStarz helps brands discover creators, launch campaigns, and manage collaborations efficiently.';
  @Input() primaryLabel = 'Register as Brand';
  @Input() secondaryLabel = 'Join as Influencer';
  @Input() thirdLabel = '';
  @Input() imageUrl = 'assets/banner-trendstarz-1600.jpg';
  @Input() liveMetricText = '';
  @Input() primaryRoute = '/register-brand';
  @Input() secondaryRoute = '/register-influencer';
  @Input() thirdRoute = '/features';
  @Input() imageAlt = 'TrendStarz hero image';

  // simple cache buster so changed images appear immediately during development
  cacheBuster = Date.now();

  constructor(private router: Router) {}

  go(route: string) {
    if (!route) return;
    this.router.navigate([route]);
  }
}
