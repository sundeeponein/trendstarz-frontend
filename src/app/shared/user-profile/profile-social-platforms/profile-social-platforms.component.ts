import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { buildSocialProfileUrl, normalizeSocialHandle } from '../../social-handle.util';

export type ProfileSocialPlatformsVariant = 'brand' | 'photographer' | 'influencer';

@Component({
  selector: 'app-profile-social-platforms',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-social-platforms.component.html',
  styleUrls: ['./profile-social-platforms.component.scss'],
})
export class ProfileSocialPlatformsComponent {
  @Input() title = 'SOCIAL PLATFORMS';
  @Input() variant: ProfileSocialPlatformsVariant = 'brand';
  @Input() platforms: any[] = [];
  @Input() locked = false;
  @Input() lockedMessage = '';
  @Input() canOpen = true;
  @Input() isProViewer = false;
  @Input() showEngagement = false;
  @Input() showContentTypes = false;

  @Output() platformClick = new EventEmitter<any>();

  get hasPlatforms(): boolean {
    return Array.isArray(this.platforms) && this.platforms.length > 0;
  }

  getSocialIcon(platform: string): string {
    const p = String(platform || '').toLowerCase();
    if (p.includes('youtube')) return 'bi-youtube';
    if (p.includes('instagram')) return 'bi-instagram';
    if (p.includes('facebook')) return 'bi-facebook';
    if (p.includes('twitter') || p.includes('x')) return 'bi-twitter-x';
    if (p.includes('tiktok')) return 'bi-tiktok';
    if (p.includes('linkedin')) return 'bi-linkedin';
    return 'bi-globe';
  }

  getSocialLabel(sm: any): string {
    const p = String(sm?.platform || '').toLowerCase();
    if (p.includes('youtube')) return 'YouTube';
    if (p.includes('instagram')) return 'Instagram';
    if (p.includes('facebook')) return 'Facebook';
    if (p.includes('twitter') || p.includes('x')) return 'Twitter';
    if (p.includes('tiktok')) return 'TikTok';
    if (p.includes('linkedin')) return 'LinkedIn';
    return sm?.platform || 'Website';
  }

  getSocialUrl(sm: any): string {
    return buildSocialProfileUrl(sm?.platform || '', sm?.handle) || sm?.url || '#';
  }

  getSocialHandle(sm: any): string {
    return normalizeSocialHandle(sm?.handle, sm?.platform || '') || normalizeSocialHandle(sm?.url, sm?.platform || '');
  }

  getContentTypes(sm: any): any[] {
    if (!Array.isArray(sm?.contentTypes)) return [];
    return sm.contentTypes.filter((ct: any) => {
      const price = Number(ct?.price);
      if (!Number.isFinite(price) || price <= 0) return false;
      if ('enabled' in ct) return ct.enabled === true;
      if ('selected' in ct) return ct.selected === true;
      return true;
    });
  }

  getSmTotal(sm: any): number {
    return this.getContentTypes(sm).reduce((sum: number, ct: any) => sum + (Number(ct?.price) || 0), 0);
  }

  emitPlatformClick(sm: any, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.platformClick.emit(sm);
  }
}
