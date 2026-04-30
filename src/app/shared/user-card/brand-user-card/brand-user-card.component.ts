import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-brand-user-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
  /** Show the "+ Campaign" button — pass true for brand users */
  @Input() showCampaignBtn = false;
  /** Whether the viewer has a Pro subscription (controls visible details) */
  @Input() isProViewer = false;
  /** Backend-driven visibility guard for contact details */
  @Input() contactRestricted = true;

  @Output() viewProfileClick = new EventEmitter<void>();
  @Output() createCampaignClick = new EventEmitter<void>();

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

  get totalFollowers(): number {
    return (this.socialMedia || []).reduce((sum: number, sm: any) => sum + (Number(sm.followersCount) || 0), 0);
  }

  /** Tier of the first social handle the user added (entry order). */
  get primaryTier(): string {
    const list = this.socialMedia || [];
    return list[0]?.tier || list.find((sm: any) => sm?.tier)?.tier || '';
  }

  platformIcon(platform: string): string {
    const p = (platform || '').toLowerCase();
    if (p === 'youtube') return 'bi-youtube';
    if (p === 'instagram') return 'bi-instagram';
    if (p === 'linkedin') return 'bi-linkedin';
    if (p === 'facebook') return 'bi-facebook';
    if (p === 'twitter' || p === 'x' || p === 'x / twitter') return 'bi-twitter-x';
    if (p === 'tiktok') return 'bi-tiktok';
    return 'bi-globe';
  }

  formatFollowers(count: number | undefined): string {
    if (!count) return '—';
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  }
}
