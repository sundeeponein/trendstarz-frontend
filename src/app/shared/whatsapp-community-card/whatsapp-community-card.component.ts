import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ConfigService } from '../config.service';

@Component({
  selector: 'app-whatsapp-community-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whatsapp-community-card.component.html',
  styleUrls: ['./whatsapp-community-card.component.scss'],
})
export class WhatsappCommunityCardComponent implements OnChanges {
  @Input() user: any | null = null;
  @Input() requireProfileCompletion = false;
  community: any | null = null;
  loading = false;
  joining = false;
  showQr = false;
  error = '';
  skipped = false;

  constructor(
    private readonly config: ConfigService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']) {
      this.skipped = this.readSkipPreference();
      this.loadCommunity();
    }
  }

  get emailVerified(): boolean {
    return !!(this.user?.isEmailVerified ?? this.user?.emailVerified);
  }

  get mobileVerified(): boolean {
    return !!(this.user?.isMobileVerified ?? this.user?.mobileVerified ?? this.user?.phoneVerified ?? this.user?.isPhoneVerified);
  }

  get profileCompletion(): number {
    return Number(this.user?.profileCompletion || 0);
  }

  get profileReady(): boolean {
    return !this.requireProfileCompletion || this.profileCompletion >= 80;
  }

  get isUnlocked(): boolean {
    return this.emailVerified && this.mobileVerified && this.profileReady;
  }

  get stateName(): string {
    return String(this.user?.location?.state || this.user?.state || '').trim();
  }

  get displayCommunityName(): string {
    return String(this.community?.communityName || this.user?.communityName || 'TrendStarz WhatsApp Community');
  }

  get displayCommunityState(): string {
    return String(this.community?.state || this.user?.communityState || this.stateName || '').trim();
  }

  get joinedAt(): string {
    return String(this.user?.communityJoinedAt || this.user?.communityJoinedDate || '').trim();
  }

  get joined(): boolean {
    return !!this.user?.communityJoined;
  }

  get hasActiveCommunity(): boolean {
    return !!(this.community?.communityLink && this.community?.isActive !== false);
  }

  get shouldShowCard(): boolean {
    if (!this.user || this.skipped) return false;
    if (this.joined) return true;
    if (!this.isUnlocked) return true;
    return this.hasActiveCommunity;
  }

  get statusTitle(): string {
    if (this.joined) return `Joined Community: ${this.displayCommunityName}`;
    if (!this.emailVerified) return 'Verify Email to unlock campaign alerts.';
    if (!this.mobileVerified) return 'Verify Mobile Number to unlock campaign alerts.';
    if (!this.profileReady) return 'Complete your profile to receive campaign opportunities.';
    return 'You are Ready for Campaigns';
  }

  get statusDescription(): string {
    if (this.joined) return 'You will receive community campaign alerts for your region.';
    if (!this.isUnlocked) return 'Finish the verification steps to receive instant campaign alerts.';
    return 'Join TrendStarz WhatsApp Community to receive instant campaign alerts.';
  }

  get qrCodeUrl(): string {
    const link = String(this.community?.communityLink || '').trim();
    if (!link) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`;
  }

  loadCommunity() {
    this.community = null;
    this.error = '';
    this.showQr = false;
    const state = this.stateName;
    if (!state) return;
    this.loading = true;
    this.config.getWhatsappCommunityForState(state).subscribe({
      next: (community) => {
        this.community = community?.isActive === false ? null : (community || null);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'Community details are not available right now.';
        this.cdr.detectChanges();
      },
    });
  }

  joinCommunity() {
    if (!this.hasActiveCommunity || this.joining) return;
    if (typeof window !== 'undefined') {
      window.open(this.community.communityLink, '_blank', 'noopener');
    }
    this.joining = true;
    this.config.markCommunityJoined(this.displayCommunityName, this.displayCommunityState).subscribe({
      next: (res) => {
        if (this.user) {
          this.user.communityJoined = true;
          this.user.communityState = res?.communityState || this.displayCommunityState;
          this.user.communityName = res?.communityName || this.displayCommunityName;
          this.user.communityJoinedAt = res?.communityJoinedAt || res?.communityJoinedDate || new Date().toISOString();
          this.user.communityJoinedDate = res?.communityJoinedDate || this.user.communityJoinedAt;
        }
        this.joining = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.joining = false;
        this.error = 'Could not save community joined status.';
        this.cdr.detectChanges();
      },
    });
  }

  toggleQr() {
    this.showQr = !this.showQr;
  }

  skipForNow() {
    this.skipped = true;
    const key = this.skipStorageKey();
    if (key && typeof window !== 'undefined') {
      localStorage.setItem(key, '1');
    }
  }

  private readSkipPreference(): boolean {
    const key = this.skipStorageKey();
    if (!key || typeof window === 'undefined') return false;
    return localStorage.getItem(key) === '1';
  }

  private skipStorageKey(): string {
    const identity = String(this.user?.id || this.user?._id || this.user?.email || '').trim();
    const state = this.stateName || 'unknown';
    if (!identity) return '';
    return `whatsappCommunitySkipped:${identity}:${state}`;
  }
}
