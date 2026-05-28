import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SessionService } from './session.service';
import { environment } from '../../environments/environment';

export interface AnalyticsEvent {
  eventType: string;
  timestamp: Date;
  userId?: string;
  userRole?: string;
  metadata?: Record<string, any>;
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    clarity?: (...args: any[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService implements OnDestroy {
  private eventBuffer: AnalyticsEvent[] = [];
  private readonly BUFFER_SIZE = 20;
  private flushTimer?: number;
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds
  private readonly ANALYTICS_ENDPOINT = `${environment.apiBaseUrl}/analytics/events`;
  private readonly GA_MEASUREMENT_ID = 'G-5912TSJYW5';

  private readonly blockedPathPrefixes = ['/admin'];
  private readonly publicExactPaths = new Set([
    '/',
    '/welcome',
    '/search',
    '/features',
    '/features/influencers',
    '/features/brands',
    '/how-it-works',
    '/how-it-works/influencers',
    '/how-it-works/brands',
    '/privacy-policy',
    '/terms-and-conditions',
    '/refund-policy',
    '/contact',
    '/register-influencer',
    '/register-brand',
    '/register-photographer',
    '/login',
    '/auth/login',
    '/auth',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  ]);

  private readonly publicPrefixPaths = [
    '/influencer/',
    '/brand/',
    '/photographer/',
    '/campaigns',
    '/campaign-pay/',
    '/campaign-payment/',
    '/campaign-submission/',
  ];

  constructor(private session: SessionService, private http: HttpClient) {
    this.initializeLifecycle();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private initializeLifecycle(): void {
    // Periodic flush every 30 seconds
    if (typeof window !== 'undefined') {
      this.flushTimer = window.setInterval(() => {
        if (this.eventBuffer.length > 0) {
          this.flush();
        }
      }, this.FLUSH_INTERVAL_MS);

      // Flush on page unload
      window.addEventListener('beforeunload', () => this.flush());
      window.addEventListener('unload', () => this.flush());
    }
  }

  private cleanup(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  /**
   * Track a smart ranking discovery event (when personalized location ranking is applied).
   * Used to measure engagement and conversion impact of personalized results.
   */
  trackSmartDiscoveryApplied(context: {
    mode: 'influencer' | 'photographer' | 'brand';
    viewerState?: string;
    viewerDistrict?: string;
    resultCount: number;
  }): void {
    const eventData = {
      mode: context.mode,
      viewerState: context.viewerState || null,
      viewerDistrict: context.viewerDistrict || null,
      resultCount: context.resultCount,
    };
    this.logEvent('smart_discovery_applied', eventData);
    this.sendToGA4('smart_discovery_applied', eventData);
    this.sendToClarity('smart_discovery_applied', eventData);
  }

  /**
   * Track a campaign invite suggestion event (when personalized invite ranking is applied).
   * Used to measure how often smart suggestions are viewed and sent.
   */
  trackCampaignInviteSuggestionsApplied(context: {
    campaignId?: string;
    targetRole: 'influencer' | 'photographer';
    campaignLocation?: string;
    categoriesMatched: number;
  }): void {
    const eventData = {
      campaignId: context.campaignId || null,
      targetRole: context.targetRole,
      campaignLocation: context.campaignLocation || null,
      categoriesMatched: context.categoriesMatched,
    };
    this.logEvent('campaign_invite_suggestions_applied', eventData);
    this.sendToGA4('campaign_invite_suggestions_applied', eventData);
    this.sendToClarity('campaign_invite_suggestions_applied', eventData);
  }

  /**
   * Track a manual location filter override (when user selects a location manually).
   * Used to measure when users override default personalization.
   */
  trackManualLocationFilterApplied(context: {
    mode: 'influencer' | 'photographer' | 'brand';
    selectedLocation: string;
  }): void {
    const eventData = {
      mode: context.mode,
      selectedLocation: context.selectedLocation,
    };
    this.logEvent('manual_location_filter_applied', eventData);
    this.sendToGA4('manual_location_filter_applied', eventData);
    this.sendToClarity('manual_location_filter_applied', eventData);
  }

  /**
   * Track profile card click behavior from Search results, including
   * whether navigation was allowed or blocked by plan restrictions.
   */
  trackSearchProfileCardClick(context: {
    targetRole: 'influencer' | 'photographer' | 'brand';
    outcome: 'allowed' | 'blocked';
    targetId?: string;
    targetUsername?: string;
  }): void {
    const viewer = this.session.getUser();
    const viewerTier = viewer ? (viewer.isPremium ? 'pro' : 'free') : 'guest';
    const eventData = {
      targetRole: context.targetRole,
      outcome: context.outcome,
      targetId: context.targetId || null,
      targetUsername: context.targetUsername || null,
      viewerTier,
      viewerRole: String(viewer?.role || '').toLowerCase() || 'guest',
    };
    this.logEvent('search_profile_card_click', eventData);
    this.sendToGA4('search_profile_card_click', eventData);
    this.sendToClarity('search_profile_card_click', eventData);
  }

  /**
   * Track campaign invite sent event (for end-to-end campaign flow metrics).
   */
  trackCampaignInviteSent(context: {
    campaignId: string;
    recipientId: string;
    recipientType: 'influencer' | 'photographer';
    recipientLocation?: string;
  }): void {
    const eventData = {
      campaignId: context.campaignId,
      recipientId: context.recipientId,
      recipientType: context.recipientType,
      recipientLocation: context.recipientLocation || null,
    };
    this.logEvent('campaign_invite_sent', eventData);
    this.sendToGA4('campaign_invite_sent', eventData);
    this.sendToClarity('campaign_invite_sent', eventData);
  }

  /**
   * Track campaign completion event (collaboration accepted/concluded).
   */
  trackCampaignCompleted(context: {
    campaignId: string;
    creatorCount: number;
    completionStage: 'invitation_accepted' | 'content_delivered' | 'payment_settled';
    inviteId?: string;
  }): void {
    const eventData = {
      campaignId: context.campaignId,
      creatorCount: context.creatorCount,
      completionStage: context.completionStage,
      inviteId: context.inviteId || null,
    };
    this.logEvent('campaign_completed', eventData);
    this.sendToGA4('campaign_completed', eventData);
    this.sendToClarity('campaign_completed', eventData);
  }

  /**
   * Track SPA page views for public/user-facing pages only.
   */
  trackPageView(rawUrl: string, pageTitle?: string): void {
    const path = this.normalizePath(rawUrl);
    this.updateGlobalAnalyticsDisableFlag(path);
    if (!this.shouldTrackPath(path)) return;
    if (!this.shouldTrackPublicPageView(path)) return;

    const eventData = {
      page_path: path,
      page_location: this.getAbsoluteUrl(path),
      page_title: pageTitle || (typeof document !== 'undefined' ? document.title : undefined),
    };

    this.logEvent('page_view', { pagePath: path });
    this.sendToGA4('page_view', eventData);
  }

  /**
   * Send event to Google Analytics 4 (gtag).
   */
  private sendToGA4(eventName: string, eventData: Record<string, any>): void {
    if (!this.shouldTrackCurrentPath()) return;

    if (typeof window !== 'undefined' && window.gtag) {
      try {
        window.gtag('event', eventName, {
          ...eventData,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if ((window as any).__DEVELOPMENT__) {
          console.warn('[Analytics] GA4 error:', error);
        }
      }
    }
  }

  /**
   * Send event to Microsoft Clarity.
   */
  private sendToClarity(eventName: string, eventData: Record<string, any>): void {
    if (!this.shouldTrackCurrentPath()) return;

    if (typeof window !== 'undefined' && window.clarity) {
      try {
        window.clarity('set', eventName, JSON.stringify(eventData));
      } catch (error) {
        if ((window as any).__DEVELOPMENT__) {
          console.warn('[Analytics] Clarity error:', error);
        }
      }
    }
  }

  /**
   * Internal method: log an event with user context and buffer for batch reporting.
   */
  private logEvent(eventType: string, metadata?: Record<string, any>): void {
    const user = this.session.getUser();
    const event: AnalyticsEvent = {
      eventType,
      timestamp: new Date(),
      userId: user?.id || user?._id || undefined,
      userRole: user?.role || undefined,
      metadata: metadata || {},
    };

    this.eventBuffer.push(event);

    // Log to console in dev mode for debugging
    if (typeof window !== 'undefined' && (window as any).__DEVELOPMENT__) {
      console.debug('[Analytics]', event);
    }

    // Flush buffer if it reaches size limit
    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      this.flush();
    }
  }

  /**
   * Flush buffered events to custom backend for campaign funnel correlation.
   * GA4/Clarity receive events immediately via sendToGA4/sendToClarity.
   * Custom backend batches campaign metrics (invite_sent, campaign_completed) for funnel analysis.
   */
  flush(): void {
    if (this.eventBuffer.length === 0) return;

    const toFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    if (typeof window !== 'undefined' && (window as any).__DEVELOPMENT__) {
      console.debug('[Analytics] Flushed events:', toFlush);
    }

    // Send campaign funnel metrics to custom backend for correlation analysis
    const campaignMetrics = toFlush.filter(e => 
      ['campaign_invite_sent', 'campaign_completed'].includes(e.eventType)
    );

    if (campaignMetrics.length > 0) {
      this.http.post(
        this.ANALYTICS_ENDPOINT,
        { events: campaignMetrics },
        { 
          keepalive: true,
          headers: { 'X-Analytics-Batch': 'true' }
        }
      ).subscribe({
        next: () => {
          if ((window as any).__DEVELOPMENT__) {
            console.debug('[Analytics] Backend flushed:', campaignMetrics.length, 'campaign metrics');
          }
        },
        error: (err: any) => {
          if ((window as any).__DEVELOPMENT__) {
            console.warn('[Analytics] Backend flush failed (retried on next batch):', err.message);
          }
          // Requeue failed events for retry
          this.eventBuffer.push(...campaignMetrics);
        }
      });
    }
  }

  private shouldTrackCurrentPath(): boolean {
    if (typeof window === 'undefined') return true;
    return this.shouldTrackPath(this.normalizePath(window.location.pathname || '/'));
  }

  private shouldTrackPath(path: string): boolean {
    return !this.blockedPathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  private shouldTrackPublicPageView(path: string): boolean {
    if (this.publicExactPaths.has(path)) return true;
    return this.publicPrefixPaths.some((prefix) => path === prefix || path.startsWith(prefix));
  }

  private normalizePath(url: string): string {
    const withoutQuery = String(url || '/').split('?')[0].split('#')[0] || '/';
    if (withoutQuery === '/') return '/';
    return withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
  }

  private getAbsoluteUrl(path: string): string {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  }

  private updateGlobalAnalyticsDisableFlag(path: string): void {
    if (typeof window === 'undefined') return;

    const isInternalPath = !this.shouldTrackPath(path);
    (window as any)[`ga-disable-${this.GA_MEASUREMENT_ID}`] = isInternalPath;
  }
}
