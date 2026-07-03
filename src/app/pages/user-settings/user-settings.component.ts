import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationPreferences, PushNotificationService } from '../../core/push-notification.service';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { buildReferralLink, copyTextToClipboard } from '../../shared/referral-link.util';

@Component({
  selector: 'app-user-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
  referralLink = '';
  referralLinkCopied = false;

  constructor(
    private readonly push: PushNotificationService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
  ) {}

  ngOnInit(): void {
    const user = this.session.getUser();
    this.lastLoginAt = user?.lastLoginAt || null;
    this.lastOpenedAt = user?.lastOpenedAt || null;
    const role = this.normalizeRole(user?.role);
    if (role !== 'admin') {
      this.referralLink = buildReferralLink(role, user?.username);
    }
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

  copyReferralLink(): void {
    if (!this.referralLink) return;
    copyTextToClipboard(this.referralLink);
    this.referralLinkCopied = true;
    setTimeout(() => { this.referralLinkCopied = false; }, 2000);
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
