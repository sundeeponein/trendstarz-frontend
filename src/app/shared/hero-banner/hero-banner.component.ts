import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './hero-banner.component.html',
  styleUrls: ['./hero-banner.component.scss']
})
export class HeroBannerComponent {
  @Input() primaryRoute = '/register-brand';
  @Input() secondaryRoute = '/register-influencer';
  @Input() thirdRoute = '/how-it-works';

  // simple cache buster so changed images appear immediately during development
  cacheBuster = Date.now();

  constructor(private router: Router) {}

  go(route: string) {
    if (!route) return;
    this.router.navigate([route]);
  }
}
