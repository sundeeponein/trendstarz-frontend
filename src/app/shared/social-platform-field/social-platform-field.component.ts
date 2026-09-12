import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Inject, Input, OnInit, Output, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CollaborationScoreApiService, SocialConnectionDetail } from '../../services/collaboration-score-api.service';
import { TierInfoService } from '../components/tier-info-modal/tier-info.service';
import { ToastService } from '../toast/toast.service';
import { buildSocialProfileUrl, normalizeSocialHandle, socialHandleExample, validateSocialHandle } from '../social-handle.util';

export interface SocialPlatformFieldForm {
  handle: string;
  followersCount: number | string;
  tier: string;
  contentTypes: { [contentTypeName: string]: { selected: boolean; price: number | string } };
}

/**
 * One platform's username/tier/content-rate row, shared by registration and
 * profile-edit. `form` is the same plain object those pages already keep in
 * `platformForms[platform._id]` — mutated in place via ngModel, so parent
 * components keep working with zero changes to their own state shape.
 */
@Component({
  selector: 'app-social-platform-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './social-platform-field.component.html',
  styleUrls: ['./social-platform-field.component.scss'],
})
export class SocialPlatformFieldComponent implements OnInit {
  @Input({ required: true }) platform: any;
  @Input({ required: true }) form!: SocialPlatformFieldForm;
  @Input() tiers: any[] = [];
  @Input() readonly = false;
  @Input() submitted = false;
  /** Registration stays manual-only (no JWT yet to OAuth with) — profile-edit sets this true. */
  @Input() allowConnect = false;
  /** True for instagram/facebook (Meta OAuth is live); false for youtube/linkedin (no Connect button). */
  @Input() supportsOAuth = false;
  @Input() showRemove = true;

  /** Any manual field mutation — parent should call its own refreshStepCompletion(). */
  @Output() changed = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  /** Fires after a successful connect/disconnect so the parent can refresh anything depending on it. */
  @Output() connectionChanged = new EventEmitter<void>();

  protected tierInfo = inject(TierInfoService);
  private readonly api = inject(CollaborationScoreApiService);
  private readonly toast = inject(ToastService);

  connection: SocialConnectionDetail | null = null;
  connecting = false;
  disconnecting = false;
  // Optimistic default — an admin disabling this platform's collector hides
  // the Connect option (never the manual handle/tier fields, which are just
  // profile data unrelated to the collector) for at most one round-trip.
  platformCollectorEnabled = true;

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  ngOnInit(): void {
    if (this.allowConnect && this.supportsOAuth) {
      this.loadConnection();
      this.loadPlatformCollectorFlag();
    }
  }

  private get platformKey(): 'instagram' | 'facebook' {
    return String(this.platform?.name || '').toLowerCase() === 'facebook' ? 'facebook' : 'instagram';
  }

  private loadConnection(): void {
    this.api.getConnections().subscribe({
      next: (res) => (this.connection = res[this.platformKey] || null),
      error: () => {},
    });
  }

  private loadPlatformCollectorFlag(): void {
    this.api.getPlatformFlags().subscribe({
      next: (res) => (this.platformCollectorEnabled = res.platformsEnabled[this.platformKey]),
      error: () => {},
    });
  }

  onConnect(): void {
    if (this.connecting) return;
    this.connecting = true;
    this.api.getConnectUrl(this.platformKey).subscribe({
      next: (res) => {
        if (isPlatformBrowser(this.platformId) && res?.authorizationUrl) {
          window.location.href = res.authorizationUrl;
        } else {
          this.connecting = false;
        }
      },
      error: () => {
        this.toast.error(`Could not start the ${this.platform?.name || 'platform'} connection.`);
        this.connecting = false;
      },
    });
  }

  onDisconnect(): void {
    if (this.disconnecting) return;
    const name = this.platform?.name || 'this platform';
    if (!confirm(`Disconnect ${name}? Your saved username, tier, and rates stay as-is.`)) return;
    this.disconnecting = true;
    this.api.disconnectPlatform(this.platformKey).subscribe({
      next: () => {
        this.connection = null;
        this.disconnecting = false;
        this.toast.success(`${name} disconnected.`);
        this.connectionChanged.emit();
      },
      error: () => {
        this.disconnecting = false;
        this.toast.error(`Could not disconnect ${name}. Please try again.`);
      },
    });
  }

  get handleExample(): string {
    return socialHandleExample(this.platform?.name || '');
  }

  get handleError(): string {
    if (!this.form) return 'Username is required.';
    return validateSocialHandle(this.form.handle, this.platform?.name || '') || '';
  }

  get profileUrl(): string {
    if (!this.form?.handle) return '';
    return buildSocialProfileUrl(this.platform?.name || '', this.form.handle);
  }

  getTierOptionLabel(tier: any): string {
    const name = String(tier?.name || '').trim();
    const range = String(tier?.desc || '').trim();
    return range ? `${name} (${range})` : name;
  }

  onHandleBlur(): void {
    if (!this.form) return;
    this.form.handle = normalizeSocialHandle(this.form.handle, this.platform?.name || '');
    this.changed.emit();
  }

  onFieldChange(): void {
    this.changed.emit();
  }
}
