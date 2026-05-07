import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  Inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser, NgIf } from '@angular/common';

/** Install prompt storage key — dismissed once per session. */
const DISMISSED_KEY = 'pwa_install_dismissed';

@Component({
  selector: 'app-pwa-install-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf],
  template: `
    <div *ngIf="visible()" class="pwa-banner" role="complementary" aria-label="Install TrendStarZ app">

      <!-- iOS instruction -->
      <ng-container *ngIf="isIos; else promptBanner">
        <div class="pwa-inner">
          <img src="assets/logo-trendstarz-logo-text.png" class="pwa-icon" alt="TrendStarZ" />
          <div class="pwa-text">
            <strong>Install TrendStarZ</strong>
            <span>Tap <span class="share-icon">⎙</span> then <em>Add to Home Screen</em></span>
          </div>
          <button class="pwa-dismiss" (click)="dismiss()" aria-label="Dismiss">✕</button>
        </div>
      </ng-container>

      <!-- Chrome / Android prompt -->
      <ng-template #promptBanner>
        <div class="pwa-inner">
          <img src="assets/logo-trendstarz-logo-text.png" class="pwa-icon" alt="TrendStarZ" />
          <div class="pwa-text">
            <strong>TrendStarZ App</strong>
            <span>Install for a faster experience</span>
          </div>
          <button class="pwa-install-btn" (click)="install()">Install</button>
          <button class="pwa-dismiss" (click)="dismiss()" aria-label="Dismiss">✕</button>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .pwa-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: #fff;
      border-top: 2px solid #7c3aed;
      box-shadow: 0 -4px 20px rgba(124,58,237,.15);
      padding: .75rem 1rem;
    }
    .pwa-inner {
      display: flex;
      align-items: center;
      gap: .75rem;
      max-width: 560px;
      margin: 0 auto;
    }
    .pwa-icon {
      width: 40px;
      height: 40px;
      object-fit: contain;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .pwa-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      font-size: .875rem;
      line-height: 1.3;
      color: #1f2937;
    }
    .pwa-text strong { font-weight: 700; font-size: .9rem; color: #111827; }
    .share-icon { font-size: 1rem; }
    .pwa-install-btn {
      background: #7c3aed;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: .45rem 1.1rem;
      font-size: .85rem;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      transition: background .2s;
    }
    .pwa-install-btn:hover { background: #6d28d9; }
    .pwa-dismiss {
      background: none;
      border: none;
      font-size: 1.1rem;
      color: #6b7280;
      cursor: pointer;
      padding: .25rem;
      flex-shrink: 0;
      line-height: 1;
    }
    .pwa-dismiss:hover { color: #111827; }
  `],
})
export class PwaInstallBannerComponent implements OnInit, OnDestroy {
  visible = signal(false);
  isIos = false;

  private deferredPrompt: any = null;
  private promptHandler: ((e: Event) => void) | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Don't show if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Don't show if dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const ua = navigator.userAgent;
    const iosMobile = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(ua);
    const isMobile = iosMobile || isAndroid || window.innerWidth <= 768;

    if (!isMobile) return; // only show on mobile/tablet

    if (iosMobile) {
      // iOS Safari has no beforeinstallprompt — show manual instruction
      this.isIos = true;
      this.visible.set(true);
      return;
    }

    // Chrome/Android: wait for browser prompt
    this.promptHandler = (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.visible.set(true);
    };
    window.addEventListener('beforeinstallprompt', this.promptHandler);
  }

  async install(): Promise<void> {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.visible.set(false);
    }
    this.deferredPrompt = null;
  }

  dismiss(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    }
    this.visible.set(false);
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId) && this.promptHandler) {
      window.removeEventListener('beforeinstallprompt', this.promptHandler);
    }
  }
}
