import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResolvePlatformPipe } from '../../pipes/resolve-platform.pipe';

@Component({
  selector: 'app-brand-user-card',
  standalone: true,
  imports: [CommonModule, ResolvePlatformPipe],
  templateUrl: './brand-user-card.component.html',
  styleUrls: ['./brand-user-card.component.scss']
})
export class BrandUserCardComponent {
  @Input() promotionalPrice: number | string | undefined;
  @Input() brandLogoUrl = '';
  @Input() brandLogo: any;
  @Input() brandName = '';
  @Input() email = '';
  @Input() phoneNumber = '';
  @Input() categories: string[] = [];
  @Input() location: any = {};
  @Input() products: any[] = [];
  @Input() website = '';
  @Input() isPremium = false;

  @Input() productImages: any[] = [];
  @Input() socialMedia: any[] = [];

  resolvePlatform(sm: any): string {
    if (!sm || !sm.platform) return '';
    const p = sm.platform.toLowerCase();
    if (p.includes('insta')) return 'instagram';
    if (p.includes('face')) return 'facebook';
    if (p.includes('youtube')) return 'youtube';
    return p;
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayBrandLogo(): string {
    if (this.brandLogoUrl) return this.brandLogoUrl;
    if (Array.isArray(this.brandLogo) && this.brandLogo.length > 0) {
      if (typeof this.brandLogo[0] === 'string') return this.brandLogo[0];
      if (this.brandLogo[0]?.url) return this.brandLogo[0].url;
    }
    if (typeof this.brandLogo === 'string') return this.brandLogo;
    return 'assets/default-profile.png';
  }
}
