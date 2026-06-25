import { Component, Input, Output, EventEmitter } from '@angular/core';
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
  @Input() subtitle = 'TrendStarz helps brands discover creators, launch campaigns, and manage collaborations efficiently. Scale your reach with data-driven creative precision.';
  @Input() primaryLabel = 'Register as Brand';
  @Input() secondaryLabel = 'Join as Influencer';
  @Input() thirdLabel = '';
  @Input() imageUrl = 'assets/banner-trendstarz-1600.jpg';
  @Input() liveMetricText = '';
  @Input() primaryRoute = '/register-brand';
  @Input() secondaryRoute = '/register-influencer';
  @Input() thirdRoute = '/features';
  @Input() imageAlt = 'TrendStarz hero image';
  @Output() primaryClick = new EventEmitter<void>();
  @Output() secondaryClick = new EventEmitter<void>();

  cacheBuster = Date.now();

  constructor(private router: Router) {}

  goPrimary() {
    if (this.primaryClick.observed) { this.primaryClick.emit(); return; }
    if (this.primaryRoute) this.router.navigate([this.primaryRoute]);
  }

  goSecondary() {
    if (this.secondaryClick.observed) { this.secondaryClick.emit(); return; }
    if (this.secondaryRoute) this.router.navigate([this.secondaryRoute]);
  }

  go(route: string) {
    if (!route) return;
    this.router.navigate([route]);
  }
}
