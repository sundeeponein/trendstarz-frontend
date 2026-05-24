import { Component, signal, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, RouterOutlet, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { filter } from 'rxjs';
import { SessionService } from './core/session.service';
import { WarmupService } from './core/warmup.service';
import { PushNotificationService } from './core/push-notification.service';
import { AnalyticsService } from './core/analytics.service';
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
  private lastPushSubscriptionKey: string | null = null;

  constructor(
    private session: SessionService,
    private router: Router,
    private warmup: WarmupService,
    private pushService: PushNotificationService,
    private analytics: AnalyticsService,
    private titleService: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    this.session.loadUserFromStorage();
    this.setupSeo();
    this.setupAnalyticsTracking();

    if (isPlatformBrowser(this.platformId)) {
      this.session.user$.subscribe((user) => {
        if (!user) {
          this.lastPushSubscriptionKey = null;
          return;
        }

        const role = this.normalizeRole((user as any).role);
        const identity = String((user as any).id || (user as any)._id || (user as any).email || role);
        const key = `${role}:${identity}`;
        if (this.lastPushSubscriptionKey === key) return;
        this.lastPushSubscriptionKey = key;

        // Defer slightly so login/navigation settles before asking notification permission.
        setTimeout(() => this._initPush(role), 1200);
      });
    }
  }

  private setupAnalyticsTracking(): void {
    const getCurrentPath = () => this.router.url || '/';

    // Track initial app load pageview.
    this.analytics.trackPageView(getCurrentPath());

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.analytics.trackPageView(getCurrentPath());
      });
  }

  private setupSeo(): void {
    this.applySeoForUrl(this.router.url || '/');
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.applySeoForUrl(this.router.url || '/'));
  }

  private applySeoForUrl(url: string): void {
    const normalizedPath = this.normalizePath(url);
    const seo = this.getSeoForPath(normalizedPath);
    const canonicalUrl = `https://trendstarz.in${normalizedPath}`;

    this.titleService.setTitle(seo.title);
    this.meta.updateTag({ name: 'description', content: seo.description });
    this.meta.updateTag({ name: 'robots', content: seo.robots || 'index, follow' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'TrendStarz' });
    this.meta.updateTag({ property: 'og:title', content: seo.ogTitle || seo.title });
    this.meta.updateTag({ property: 'og:description', content: seo.ogDescription || seo.description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: seo.ogTitle || seo.title });
    this.meta.updateTag({ name: 'twitter:description', content: seo.ogDescription || seo.description });
    this.updateCanonical(canonicalUrl);
  }

  private normalizePath(url: string): string {
    const withoutQuery = String(url || '/').split('?')[0].split('#')[0] || '/';
    if (withoutQuery === '/') return '/';
    return withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
  }

  private updateCanonical(href: string): void {
    let canonical = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', href);
  }

  private getSeoForPath(path: string): {
    title: string;
    description: string;
    ogTitle?: string;
    ogDescription?: string;
    robots?: string;
  } {
    const map: Record<string, { title: string; description: string; robots?: string }> = {
      '/': {
        title: 'TrendStarz - Connect Brands & Influencers in India',
        description: 'TrendStarz helps brands collaborate with influencers across Instagram, YouTube and more in India.',
      },
      '/welcome': {
        title: 'TrendStarz - Connect Brands & Influencers in India',
        description: 'TrendStarz helps brands collaborate with influencers across Instagram, YouTube and more in India.',
      },
      '/search': {
        title: 'Search Influencers & Brands | TrendStarz',
        description: 'Discover influencers and brands on TrendStarz by category, platform, and audience fit.',
      },
      '/faqs': {
        title: 'Frequently Asked Questions | TrendStarz',
        description: 'Search answers about TrendStarz accounts, collaborations, campaigns, payments, and future features.',
      },
      '/features': {
        title: 'How TrendStarz Works for Brands & Influencers',
        description: 'See how TrendStarz helps influencers and brands collaborate with transparent workflows.',
      },
      '/how-it-works': {
        title: 'How TrendStarz Works for Brands & Influencers',
        description: 'See how TrendStarz helps influencers and brands collaborate with transparent workflows.',
      },
      '/how-it-works/influencers': {
        title: 'How TrendStarz Works for Influencers',
        description: 'Learn how influencers can build profiles, set rates, and get discovered by brands.',
      },
      '/how-it-works/brands': {
        title: 'How TrendStarz Works for Brands',
        description: 'Learn how brands can find verified creators and run campaigns with confidence.',
      },
      '/features/influencers': {
        title: 'How TrendStarz Works for Influencers',
        description: 'Learn how influencers can build profiles, set rates, and get discovered by brands.',
      },
      '/features/brands': {
        title: 'How TrendStarz Works for Brands',
        description: 'Learn how brands can find verified creators and run campaigns with confidence.',
      },
      '/register-influencer': {
        title: 'Influencer Registration | TrendStarz',
        description: 'Join TrendStarz as an influencer and create your profile to collaborate with brands.',
      },
      '/register-brand': {
        title: 'Brand Registration | TrendStarz',
        description: 'Join TrendStarz as a brand and discover verified influencers for your campaigns.',
      },
      '/auth/login': {
        title: 'Login | TrendStarz',
        description: 'Login to your TrendStarz account to manage profile, campaigns, and collaborations.',
        robots: 'noindex, nofollow',
      },
      '/login': {
        title: 'Login | TrendStarz',
        description: 'Login to your TrendStarz account to manage profile, campaigns, and collaborations.',
        robots: 'noindex, nofollow',
      },
      '/verify-email': {
        title: 'Verify Email | TrendStarz',
        description: 'Verify your email to activate your TrendStarz account.',
        robots: 'noindex, nofollow',
      },
      '/forgot-password': {
        title: 'Forgot Password | TrendStarz',
        description: 'Reset your TrendStarz account password securely.',
        robots: 'noindex, nofollow',
      },
      '/reset-password': {
        title: 'Reset Password | TrendStarz',
        description: 'Set a new password for your TrendStarz account.',
        robots: 'noindex, nofollow',
      },
      '/privacy-policy': {
        title: 'Privacy Policy | TrendStarz',
        description: 'Read the Privacy Policy for TrendStarz platform usage and data practices.',
      },
      '/terms-and-conditions': {
        title: 'Terms & Conditions | TrendStarz',
        description: 'Read the terms governing use of TrendStarz platform.',
      },
      '/refund-policy': {
        title: 'Refund Policy | TrendStarz',
        description: 'Read the refund policy for TrendStarz subscriptions and payments.',
      },
      '/contact': {
        title: 'Contact Us | TrendStarz',
        description: 'Contact the TrendStarz team for support, partnerships, and account queries.',
      },
    };

    const exact = map[path];
    if (exact) return exact;

    if (path.startsWith('/influencer/')) {
      return {
        title: 'Influencer Profile | TrendStarz',
        description: 'View influencer profile details and collaboration highlights on TrendStarz.',
      };
    }

    if (path.startsWith('/brand/')) {
      return {
        title: 'Brand Profile | TrendStarz',
        description: 'View brand profile and campaign collaboration details on TrendStarz.',
      };
    }

    const humanPath = path
      .replace(/^\//, '')
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.replace(/-/g, ' '))
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' | ');

    return {
      title: humanPath ? `${humanPath} | TrendStarz` : 'TrendStarz',
      description: 'TrendStarz helps brands and influencers collaborate across campaigns in India.',
      robots: 'noindex, nofollow',
    };
  }

  private normalizeRole(role: any): 'brand' | 'influencer' | 'photographer' | 'admin' {
    const value = String(role || '').toLowerCase().trim();
    if (value === 'brand') return 'brand';
    if (value === 'admin') return 'admin';
    if (value === 'photographer' || value === 'videographer' || value === 'photovideographer') return 'photographer';
    return 'influencer';
  }

  private async _initPush(role?: 'brand' | 'influencer' | 'photographer' | 'admin'): Promise<void> {
    try {
      const user = this.session.getUser();
      if (!user) return; // only subscribe logged-in users
      const resolvedRole = role ?? this.normalizeRole((user as any).role);
      await this.pushService.requestSubscription(resolvedRole);
    } catch { /* silent — push is optional */ }
  }
}
