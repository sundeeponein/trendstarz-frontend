import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-photographer-user-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photographer-user-card.component.html',
  styleUrls: ['./photographer-user-card.component.scss'],
})
export class PhotographerUserCardComponent {
  @Input() profileImage = '';
  @Input() profileImages: any[] = [];
  @Input() name = '';
  @Input() username = '';
  @Input() location: any = {};
  @Input() skills: string[] = [];
  @Input() pricing: any[] = [];
  @Input() equipment: string[] = [];
  @Input() socialMedia: any[] = [];
  @Input() portfolio = '';
  @Input() adminTags: string[] = [];
  @Input() isPremium = false;
  @Input() verifiedByTrendStarz = false;
  @Input() verificationStatus = 'not_submitted';
  @Input() socialMediaRestricted = false;
  @Input() profileViewDisabled = false;

  @Output() viewProfileClick = new EventEmitter<void>();

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayImage(): string {
    // profileImages[0] is the live source of truth; profileImage is a legacy
    // field that can go stale after a re-upload/recrop, so prefer the array.
    return this.profileImages?.[0]?.url || this.profileImage || 'assets/default-profile.png';
  }

  get displayLocation(): string {
    const parts = [this.location?.district, this.location?.state].filter(Boolean);
    return parts.join(', ') || '—';
  }

  get displaySkills(): string[] {
    return (this.skills || []).slice(0, 3);
  }

  get displayCategory(): string {
    return this.displaySkills[0] || '—';
  }

  get displayTags(): string[] {
    const hiddenCommissionTags = new Set(['early access', 'partner', 'internal/test', 'internal test']);
    return Array.isArray(this.adminTags)
      ? this.adminTags
          .filter((tag) => !!String(tag || '').trim())
          .filter((tag) => !hiddenCommissionTags.has(String(tag || '').trim().toLowerCase()))
      : [];
  }

  get isTrendstarzVerified(): boolean {
    return this.verifiedByTrendStarz || this.verificationStatus === 'approved';
  }

  get startingPrice(): number | null {
    const sp = (this.pricing || []).find(p => p.name === 'Starting Price' && p.enabled);
    return sp ? sp.price : null;
  }

  get platforms(): string[] {
    return (this.socialMedia || []).map(sm => (sm.platform || '').toLowerCase());
  }

  tagBadgeClass(tag: string): string {
    const normalized = String(tag || '').toLowerCase();
    if (normalized.includes('founder')) return 'badge--founder';
    if (normalized.includes('verified')) return 'badge--verified';
    if (normalized.includes('internal')) return 'badge--internal';
    return 'badge--neutral';
  }

  onViewProfileClick(event: Event) {
    event.stopPropagation();
    if (this.profileViewDisabled) {
      return;
    }
    this.viewProfileClick.emit();
  }

  get showSocialLockHint(): boolean {
    return this.socialMediaRestricted === true;
  }
}
