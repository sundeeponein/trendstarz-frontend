import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PushNotificationService } from '../../core/push-notification.service';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';

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
  unreadCount = 0;
  lastLoginAt: string | null = null;
  lastOpenedAt: string | null = null;

  constructor(
    private readonly push: PushNotificationService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
  ) {}

  ngOnInit(): void {
    const user = this.session.getUser();
    this.lastLoginAt = user?.lastLoginAt || null;
    this.lastOpenedAt = user?.lastOpenedAt || null;
    this.refreshPushState();
    this.config.getUnreadNotificationsCount().subscribe((count) => {
      this.unreadCount = Number(count || 0);
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
