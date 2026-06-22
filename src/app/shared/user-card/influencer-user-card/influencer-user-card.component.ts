import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-influencer-user-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './influencer-user-card.component.html',
  styleUrls: ['./influencer-user-card.component.scss']
})
export class InfluencerUserCardComponent {
  @Input() profileImage: string = '';
  @Input() profileImages: any[] = [];
  @Input() name = '';
  @Input() username = '';
  @Input() email = '';
  @Input() phoneNumber = '';
  @Input() categories: string[] = [];
  @Input() influencerCategory = '';
  @Input() creatorTypes: string[] = [];
  @Input() professionalStatus = false;
  @Input() verificationStatus = 'not_submitted';
  @Input() verifiedByTrendStarz = false;
  @Input() location: any = {};
  @Input() socialMedia: any[] = [];
  @Input() adminTags: string[] = [];
  @Input() isPremium = false;
  @Input() promotionalPrice?: number;
  @Input() showWelcomeStartingPrice = true;
  @Input() engagementRate?: number | string;
  /** Show the "+ Campaign" button — pass true for brand users */
  @Input() showCampaignBtn = false;

  /** Whether the viewer has a Pro subscription (controls visible details) */
  @Input() isProViewer = false;
  /** Backend-driven visibility guard for contact details */
  @Input() contactRestricted = true;
  /** Backend-driven visibility guard for social profile links */
  @Input() socialMediaRestricted = false;
  /** Disable opening profile view (used for restricted free-plan visibility). */
  @Input() profileViewDisabled = false;

  @Output() viewProfileClick = new EventEmitter<void>();
  @Output() createCampaignClick = new EventEmitter<void>();

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayImage(): string {
    // profileImages[0] is the live source of truth; profileImage is a legacy
    // field that can go stale after a re-upload/recrop, so prefer the array.
    return this.profileImages?.[0]?.url || this.profileImage || 'assets/default-profile.png';
  }

  get platforms(): string[] {
    return (this.socialMedia || []).map((sm: any) => (sm.platform || '').toLowerCase());
  }

  get totalFollowers(): number {
    return (this.socialMedia || []).reduce((sum: number, sm: any) => sum + (Number(sm.followersCount) || 0), 0);
  }

  get displayTags(): string[] {
    const hiddenCommissionTags = new Set(['early access', 'partner', 'internal/test', 'internal test']);
    return Array.isArray(this.adminTags)
      ? this.adminTags
          .filter((tag) => !!String(tag || '').trim())
          .filter((tag) => !hiddenCommissionTags.has(String(tag || '').trim().toLowerCase()))
      : [];
  }

  get displayCategory(): string {
    if (String(this.influencerCategory || '').trim()) return this.influencerCategory;
    return this.categories?.[0] || '—';
  }

  get visibleCreatorTypes(): string[] {
    return (Array.isArray(this.creatorTypes) ? this.creatorTypes : [])
      .map((type) => String(type || '').trim())
      .filter((type) => !!type)
      .slice(0, 3);
  }

  get isTrendstarzVerified(): boolean {
    return this.verifiedByTrendStarz || this.verificationStatus === 'approved';
  }

  get showSocialLockHint(): boolean {
    return this.socialMediaRestricted === true;
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

  platformLabel(platform: string): string {
    const p = (platform || '').toLowerCase();
    if (p === 'youtube') return 'YT';
    if (p === 'instagram') return 'IG';
    if (p === 'linkedin') return 'LI';
    if (p === 'facebook') return 'FB';
    if (p === 'twitter' || p === 'x' || p === 'x / twitter') return 'X';
    if (p === 'tiktok') return 'TT';
    return platform.slice(0, 2).toUpperCase();
  }

  tagBadgeClass(tag: string): string {
    const normalized = String(tag || '').toLowerCase();
    if (normalized.includes('founder')) return 'badge--founder';
    if (normalized.includes('verified')) return 'badge--verified';
    if (normalized.includes('internal')) return 'badge--internal';
    return 'badge--neutral';
  }

  formatFollowers(count: number | undefined): string {
    if (!count) return '—';
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  }

  onViewProfileClick(event: Event): void {
    if (this.profileViewDisabled) {
      event.stopPropagation();
      return;
    }
    this.viewProfileClick.emit();
  }
}
