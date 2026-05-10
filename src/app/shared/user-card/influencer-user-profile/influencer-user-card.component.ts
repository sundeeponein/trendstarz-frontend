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
  @Input() location: any = {};
  @Input() socialMedia: any[] = [];
  @Input() adminTags: string[] = [];
  @Input() isPremium = false;
  @Input() promotionalPrice?: number;
  @Input() engagementRate?: number | string;
  /** Show the "+ Campaign" button — pass true for brand users */
  @Input() showCampaignBtn = false;
  /** Enables selection mode (shows checkbox corner) */
  @Input() selectable = false;
  /** Whether this card is currently selected */
  @Input() selected = false;

  /** Whether the viewer has a Pro subscription (controls visible details) */
  @Input() isProViewer = false;
  /** Backend-driven visibility guard for contact details */
  @Input() contactRestricted = true;

  @Output() viewProfileClick = new EventEmitter<void>();
  @Output() createCampaignClick = new EventEmitter<void>();
  /** Emitted when the card's selection checkbox is toggled */
  @Output() toggleSelect = new EventEmitter<void>();

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayImage(): string {
    return this.profileImage || this.profileImages?.[0]?.url || 'assets/default-profile.png';
  }

  get platforms(): string[] {
    return (this.socialMedia || []).map((sm: any) => (sm.platform || '').toLowerCase());
  }

  get totalFollowers(): number {
    return (this.socialMedia || []).reduce((sum: number, sm: any) => sum + (Number(sm.followersCount) || 0), 0);
  }

  get displayTags(): string[] {
    return Array.isArray(this.adminTags) ? this.adminTags.filter((tag) => !!String(tag || '').trim()) : [];
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
}
