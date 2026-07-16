import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NotificationPreferences, PushNotificationService } from '../../core/push-notification.service';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { ReferralTargetRole } from '../../shared/tracking-links/tracking-links-api.service';
import { ReferralLinkCardComponent } from '../../shared/referral-link-card/referral-link-card.component';
import { HomepageFeatureToggleComponent } from '../../shared/components/homepage-feature-toggle/homepage-feature-toggle.component';

@Component({
  selector: 'app-user-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReferralLinkCardComponent, HomepageFeatureToggleComponent],
  templateUrl: './user-settings.component.html',
  styleUrls: ['./user-settings.component.scss'],
})
export class UserSettingsComponent implements OnInit {
  pushSupported = false;
  pushActive = false;
  pushBusy = false;
  pushPermission: NotificationPermission | 'unsupported' = 'unsupported';
  pushPreference: 'enabled' | 'disabled' | 'unset' = 'unset';
  webEnabled = true;
  mobileEnabled = true;
  campaignEnabled = true;
  paymentEnabled = true;
  preferencesBusy = false;
  unreadCount = 0;
  lastLoginAt: string | null = null;
  lastOpenedAt: string | null = null;
  referralRole: ReferralTargetRole | null = null;
  featuredInMarketing = false;
  marketingConsentBusy = false;
  showDeleteConfirm = false;
  deletePassword = '';
  deleteBusy = false;
  deleteError = '';
  private userId: string | null = null;

  constructor(
    private readonly push: PushNotificationService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const user = this.session.getUser();
    this.lastLoginAt = user?.lastLoginAt || null;
    this.lastOpenedAt = user?.lastOpenedAt || null;
    const role = this.normalizeRole(user?.role);
    this.referralRole = role !== 'admin' ? (role as ReferralTargetRole) : null;
    this.userId = user?.id || null;
    this.refreshPushState();
    this.config.getUnreadNotificationsCount().subscribe((count) => {
      this.unreadCount = Number(count || 0);
    });
    this.push.getPreferences().subscribe((prefs) => {
      this.webEnabled = prefs.webEnabled;
      this.mobileEnabled = prefs.mobileEnabled;
      this.campaignEnabled = prefs.campaignEnabled;
      this.paymentEnabled = prefs.paymentEnabled;
    });
    if (this.userId && role !== 'admin') {
      this.config.getMarketingConsent(this.userId).subscribe((res) => {
        this.featuredInMarketing = !!res?.featuredInMarketing;
      });
    }
  }

  onFeaturedInMarketingChange(next: boolean): void {
    if (this.marketingConsentBusy || !this.userId) return;
    this.marketingConsentBusy = true;
    this.config.updateMarketingConsent(this.userId, next).subscribe({
      next: () => {
        this.featuredInMarketing = next;
        this.marketingConsentBusy = false;
      },
      error: () => {
        this.marketingConsentBusy = false;
      },
    });
  }

  openDeleteConfirm(): void {
    this.showDeleteConfirm = true;
    this.deletePassword = '';
    this.deleteError = '';
  }

  cancelDeleteConfirm(): void {
    if (this.deleteBusy) return;
    this.showDeleteConfirm = false;
    this.deletePassword = '';
    this.deleteError = '';
  }

  confirmDeleteAccount(): void {
    if (this.deleteBusy || !this.userId || !this.deletePassword) return;
    this.deleteBusy = true;
    this.deleteError = '';
    this.config.selfDeleteAccount(this.userId, this.deletePassword).subscribe({
      next: () => {
        this.deleteBusy = false;
        this.session.clearSession();
        this.router.navigate(['/login'], { queryParams: { accountDeleted: '1' } });
      },
      error: (err) => {
        this.deleteBusy = false;
        this.deleteError = err?.error?.message || 'Incorrect password. Please try again.';
      },
    });
  }

  toggleWebEnabled(): void {
    if (this.preferencesBusy) return;
    this.setPreference({ webEnabled: !this.webEnabled });
  }

  toggleMobileEnabled(): void {
    if (this.preferencesBusy) return;
    this.setPreference({ mobileEnabled: !this.mobileEnabled });
  }

  toggleCampaignEnabled(): void {
    if (this.preferencesBusy) return;
    this.setPreference({ campaignEnabled: !this.campaignEnabled });
  }

  togglePaymentEnabled(): void {
    if (this.preferencesBusy) return;
    this.setPreference({ paymentEnabled: !this.paymentEnabled });
  }

  resetPreferencesToDefaults(): void {
    if (this.preferencesBusy) return;
    this.setPreference({
      webEnabled: true,
      mobileEnabled: true,
      campaignEnabled: true,
      paymentEnabled: true,
    });
  }

  private setPreference(updates: Partial<NotificationPreferences>): void {
    this.preferencesBusy = true;
    this.push.updatePreferences(updates).subscribe((result) => {
      this.preferencesBusy = false;
      if (!result) return;
      this.webEnabled = result.webEnabled;
      this.mobileEnabled = result.mobileEnabled;
      this.campaignEnabled = result.campaignEnabled;
      this.paymentEnabled = result.paymentEnabled;
    });
  }

  get notificationStatusLabel(): string {
    if (!this.pushSupported) return 'Not supported on this browser';
    if (this.pushPermission === 'denied') return 'Blocked in browser settings';
    if (this.pushActive) return 'Enabled on this device';
    if (this.pushPreference === 'disabled') return 'Disabled for this device';
    return 'Not enabled yet';
  }

  async enablePush(): Promise<void> {
    if (this.pushBusy) return;
    this.pushBusy = true;
    const user = this.session.getUser();
    const role = this.normalizeRole(user?.role);
    await this.push.requestSubscription(role);
    await this.refreshPushState();
    this.pushBusy = false;
  }

  async disablePush(): Promise<void> {
    if (this.pushBusy) return;
    this.pushBusy = true;
    await this.push.cancelSubscription();
    await this.refreshPushState();
    this.pushBusy = false;
  }

  private async refreshPushState(): Promise<void> {
    this.pushSupported = this.push.isEnabled;
    this.pushPermission = this.push.browserPermission;
    this.pushPreference = this.push.localPreference;
    this.pushActive = await this.push.hasActiveSubscription();
  }

  private normalizeRole(role: any): 'brand' | 'influencer' | 'photographer' | 'admin' {
    const value = String(role || '').toLowerCase().trim();
    if (value === 'brand') return 'brand';
    if (value === 'admin') return 'admin';
    if (value === 'photographer' || value === 'videographer' || value === 'photovideographer') {
      return 'photographer';
    }
    return 'influencer';
  }
}
