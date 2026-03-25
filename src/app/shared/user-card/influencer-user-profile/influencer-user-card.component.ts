import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-influencer-user-card',
  standalone: true,
  imports: [CommonModule],
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
  @Input() isPremium = false;
  @Input() promotionalPrice?: number;
  @Input() engagementRate?: number | string;
  /** Show the "+ Campaign" button — pass true for brand users */
  @Input() showCampaignBtn = false;
  /** Enables selection mode (shows checkbox corner) */
  @Input() selectable = false;
  /** Whether this card is currently selected */
  @Input() selected = false;

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

  formatFollowers(count: number | undefined): string {
    if (!count) return '—';
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  }
}
