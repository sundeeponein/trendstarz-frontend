import { Component, signal, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { SessionService } from './core/session.service';
import { WarmupService } from './core/warmup.service';
import { PushNotificationService } from './core/push-notification.service';
import { ToastHostComponent } from './shared/toast/toast-host.component';
import { TierInfoModalComponent } from './shared/components/tier-info-modal/tier-info-modal.component';
import { FlowHelpModalComponent } from './shared/components/flow-help-modal/flow-help-modal.component';
import { PwaInstallBannerComponent } from './shared/pwa-install-banner/pwa-install-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, TierInfoModalComponent, FlowHelpModalComponent, PwaInstallBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('Trend Starz');

  constructor(
    private session: SessionService,
    private router: Router,
    private warmup: WarmupService,
    private pushService: PushNotificationService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    this.session.loadUserFromStorage();

    if (isPlatformBrowser(this.platformId)) {
      // Request push permission once after the user is settled (non-blocking)
      setTimeout(() => this._initPush(), 5000);
    }
  }

  private async _initPush(): Promise<void> {
    try {
      const user = this.session.getUser();
      if (!user) return; // only subscribe logged-in users
      const role = (user as any).role ?? 'influencer';
      await this.pushService.requestSubscription(role);
    } catch { /* silent — push is optional */ }
  }
}
