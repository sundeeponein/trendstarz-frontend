import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Inject, Input, NgZone, OnChanges, OnInit, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CollaborationAudit,
  CollaborationAuditHistoryEntry,
  CollaborationScoreApiService,
  SocialConnections,
} from '../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService, ScoreConfidence, SubScoreRow } from '../../services/collaboration-score-ui-utils.service';
import { ToastService } from '../toast/toast.service';
import { AnalyticsService } from '../../core/analytics.service';
import { ScoreRingComponent } from './score-ring.component';

@Component({
  selector: 'app-collaboration-score-card',
  standalone: true,
  imports: [CommonModule, ScoreRingComponent],
  templateUrl: './collaboration-score-card.component.html',
  styleUrls: ['./collaboration-score-card.component.scss'],
})
export class CollaborationScoreCardComponent implements OnInit, OnChanges {
  @Input() audit: CollaborationAudit | null = null;
  @Input() loading = false;
  @Input() reAnalyzing = false;
  /** TrendStarZ admin-verification flag (profile.verifiedByTrendStarz) — real data, not derived from the audit. */
  @Input() verified = false;
  /**
   * Optional — lets a parent that already fetched connections (e.g.
   * CreatorScoreCenterComponent, which needs them for its own Platform
   * Status section) pass them straight through instead of this component
   * fetching them again itself. Falls back to its own fetch when omitted,
   * so every other existing consumer is unaffected.
   */
  @Input() initialConnections?: SocialConnections | null;
  /** Emitted only for the free, first-ever audit — parent runs its existing runMyAudit() flow. */
  @Output() reAnalyze = new EventEmitter<void>();
  /** Emitted after a paid re-analysis completes — parent should replace its audit state with this. */
  @Output() auditRefreshed = new EventEmitter<CollaborationAudit>();

  history: CollaborationAuditHistoryEntry[] = [];
  payingForReanalysis = false;
  paymentError = '';
  connections: SocialConnections = { instagram: null, facebook: null };
  connectingPlatform: 'instagram' | 'facebook' | null = null;
  disconnectingPlatform: 'instagram' | 'facebook' | null = null;
  // True the moment a parent binds [initialConnections] at all — even while
  // its own fetch is still resolving to null — so ngOnInit never starts a
  // redundant self-fetch racing against the parent's.
  private parentManagesConnections = false;

  constructor(
    public ui: CollaborationScoreUiUtilsService,
    private readonly api: CollaborationScoreApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toast: ToastService,
    private readonly analytics: AnalyticsService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    if (!this.parentManagesConnections) {
      this.loadConnections();
    }

    const connectedPlatform = this.route.snapshot.queryParamMap.get('connected');
    const connectError = this.route.snapshot.queryParamMap.get('connectError');
    if (connectedPlatform) {
      this.toast.success(`${connectedPlatform === 'instagram' ? 'Instagram' : 'Facebook'} connected.`);
      this.clearConnectQueryParams();
    } else if (connectError) {
      this.toast.error('Could not connect that account. Please try again.');
      this.clearConnectQueryParams();
    }
  }

  private clearConnectQueryParams(): void {
    this.router.navigate([], { queryParams: { connected: null, connectError: null }, queryParamsHandling: 'merge' });
  }

  // HttpClient is configured with withFetch() (app.config.ts) — fetch()
  // promise continuations aren't always reliably re-entered into Angular's
  // zone, so state set in a plain .subscribe() callback can sit unrendered
  // until an unrelated zone-patched event (e.g. a click) forces a CD cycle.
  // Same workaround used elsewhere in this app — see
  // score-preview.component.ts.
  private loadConnections(): void {
    this.api.getConnections().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.connections = res;
          this.cdr.detectChanges();
        });
      },
      error: () => {},
    });
  }

  connectPlatform(platform: 'instagram' | 'facebook'): void {
    if (this.connectingPlatform) return;
    this.connectingPlatform = platform;
    this.api.getConnectUrl(platform).subscribe({
      next: (res) => {
        if (isPlatformBrowser(this.platformId) && res?.authorizationUrl) {
          window.location.href = res.authorizationUrl;
        } else {
          this.ngZone.run(() => {
            this.connectingPlatform = null;
            this.cdr.detectChanges();
          });
        }
      },
      error: () => {
        this.ngZone.run(() => {
          this.toast.error(`Could not start the ${platform === 'instagram' ? 'Instagram' : 'Facebook'} connection.`);
          this.connectingPlatform = null;
          this.cdr.detectChanges();
        });
      },
    });
  }

  isConnected(platform: string): boolean {
    const key = platform.toLowerCase();
    return key === 'instagram' ? !!this.connections.instagram : key === 'facebook' ? !!this.connections.facebook : false;
  }

  onDisconnectPlatform(platform: 'instagram' | 'facebook'): void {
    if (this.disconnectingPlatform) return;
    const label = platform === 'instagram' ? 'Instagram' : 'Facebook';
    if (!confirm(`Disconnect ${label}? Future audits will use self-reported stats for this platform until you reconnect.`)) {
      return;
    }
    this.disconnectingPlatform = platform;
    this.api.disconnectPlatform(platform).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.connections = { ...this.connections, [platform]: null };
          this.disconnectingPlatform = null;
          this.toast.success(`${label} disconnected.`);
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.disconnectingPlatform = null;
          this.toast.error(`Could not disconnect ${label}. Please try again.`);
          this.cdr.detectChanges();
        });
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialConnections']) {
      this.parentManagesConnections = true;
      if (this.initialConnections) {
        this.connections = this.initialConnections;
      }
    }
    if (changes['audit'] && this.audit?.userId) {
      this.loadHistory(this.audit.userId);
    }
  }

  private loadHistory(userId: string): void {
    this.api.getAuditHistory(userId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.history = res?.history || [];
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.history = [];
          this.cdr.detectChanges();
        });
      },
    });
  }

  // Delegated to CollaborationScoreUiUtilsService — single source of truth
  // shared with the admin detail page, so both always show identical
  // Score Breakdown numbers.
  get subScores(): SubScoreRow[] {
    return this.ui.subScores(this.audit);
  }

  get subScoresTotal(): number {
    return this.ui.subScoresTotal(this.subScores);
  }

  get hasSubScoreBreakdown(): boolean {
    return this.subScores.length > 0;
  }

  // Split so the template can show "based on your TrendStarZ profile" vs.
  // "based on your connected platforms" as two clearly separate groups,
  // instead of one flat list a reader has to mentally sort themselves.
  get profileSubScores(): SubScoreRow[] {
    return this.subScores.filter((s) => s.group === 'Profile');
  }

  get platformSubScores(): SubScoreRow[] {
    return this.subScores.filter((s) => s.group === 'Platform');
  }

  get profileScoreSummary(): { earned: number; max: number } {
    return this.ui.subScoreGroupSummary(this.subScores, 'Profile');
  }

  get platformScoreSummary(): { earned: number; max: number } {
    return this.ui.subScoreGroupSummary(this.subScores, 'Platform');
  }

  get scoreConfidence(): ScoreConfidence | null {
    return this.ui.scoreConfidence(this.audit);
  }

  get lastAnalysisDateTime(): string {
    return this.ui.lastAnalysisDateTime(this.audit);
  }

  /** Points still needed to cross the TrendStarz Recommended threshold; null once recommended or unknown. */
  get pointsToRecommended(): number | null {
    if (!this.audit || this.audit.trendstarzRecommended) return null;
    const min = this.audit.trendstarzRecommendedMinScore;
    if (min == null) return null;
    const gap = min - this.audit.collaborationScore;
    return gap > 0 ? gap : null;
  }

  get lastAnalysisLabel(): string {
    return this.audit?.createdAt ? this.formatRelativeDay(this.audit.createdAt) : '';
  }

  /** The audit run before the current one — history[0] is the current run itself. */
  get previousEntry(): CollaborationAuditHistoryEntry | null {
    return this.history.length > 1 ? this.history[1] : null;
  }

  get previousAnalysisLabel(): string | null {
    return this.previousEntry ? this.formatRelativeDay(this.previousEntry.createdAt) : null;
  }

  get scoreDelta(): number | null {
    return this.history.length > 0 ? this.history[0].scoreDelta : null;
  }

  private formatRelativeDay(iso: string): string {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  get reanalyzeDisabled(): boolean {
    return this.loading || this.reAnalyzing || this.payingForReanalysis || this.audit?.canReanalyze === false;
  }

  /** True once a first audit already exists — the next click is the paid flow, not the free one. */
  get isPaidReanalysis(): boolean {
    return this.audit != null;
  }

  get reanalyzeLabel(): string {
    if (this.payingForReanalysis) return 'Processing payment…';
    if (this.reAnalyzing) return 'Analyzing…';
    if (this.isPaidReanalysis && this.audit?.reanalysisFeeRupees != null) {
      return `Re-Analyze — ₹${this.audit.reanalysisFeeRupees}`;
    }
    return 'Re-Analyze';
  }

  get reanalyzeTooltip(): string {
    if (this.audit?.canReanalyze === false && this.audit.reanalysisAvailableAt) {
      const date = new Date(this.audit.reanalysisAvailableAt).toLocaleDateString();
      return `Available ${date}`;
    }
    if (this.audit?.canReanalyze === false && this.audit.hasChanges === false) {
      return 'Your score already reflects the latest synced profile.';
    }
    return '';
  }

  /**
   * Message line shown under the Re-Analyze button once the cooldown has
   * already elapsed — distinguishes "nothing changed" from "changes found"
   * so the creator knows whether syncing again is worth it. Not shown at
   * all while the cooldown itself is still the blocker (that has its own
   * date-specific note above).
   */
  get reanalyzeSyncMessage(): string {
    if (!this.audit || this.audit.canReanalyze !== false) return '';
    if (this.audit.reanalysisAvailableAt) return ''; // cooldown note already covers this case
    if (this.audit.hasChanges === false) return 'Your score already reflects the latest synced profile.';
    return '';
  }

  get reanalyzeChangesDetectedMessage(): string {
    if (!this.audit || !this.audit.hasChanges) return '';
    return 'Changes detected on your connected platforms.';
  }

  platformIcon(platform: string): string {
    const key = platform.toLowerCase();
    if (key === 'instagram') return 'bi-instagram';
    if (key === 'youtube') return 'bi-youtube';
    if (key === 'facebook') return 'bi-facebook';
    if (key === 'linkedin') return 'bi-linkedin';
    return 'bi-globe';
  }

  onReAnalyzeClick(): void {
    if (this.reanalyzeDisabled) return;
    if (!this.audit) {
      // First-ever audit is free — unchanged, parent-owned flow.
      this.reAnalyze.emit();
      return;
    }
    this.analytics.trackCollabReanalyzeClicked();
    this.startPaidReanalysis();
  }

  private async ensureRazorpayLoaded(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;
    if ((window as any).Razorpay) return true;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
      document.body.appendChild(script);
    });
    return !!(window as any).Razorpay;
  }

  private async startPaidReanalysis(): Promise<void> {
    this.payingForReanalysis = true;
    this.paymentError = '';
    try {
      const orderRes = await firstValueFrom(this.api.createReanalysisOrder());
      const order = orderRes?.order;
      if (!order?.orderId || !order?.keyId) {
        this.ngZone.run(() => {
          this.paymentError = 'Failed to initialize payment. Please try again.';
          this.cdr.detectChanges();
        });
        return;
      }

      const loaded = await this.ensureRazorpayLoaded();
      if (!loaded) {
        this.ngZone.run(() => {
          this.paymentError = 'Failed to load Razorpay checkout.';
          this.cdr.detectChanges();
        });
        return;
      }

      this.analytics.trackCollabPaymentStarted();
      await new Promise<void>((resolve, reject) => {
        const rz = new (window as any).Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'TrendStarZ',
          description: 'Collaboration Score re-analysis',
          order_id: order.orderId,
          handler: async (resp: any) => {
            try {
              const updated = await firstValueFrom(
                this.api.verifyReanalysisPayment({
                  orderId: resp?.razorpay_order_id,
                  paymentId: resp?.razorpay_payment_id,
                  signature: resp?.razorpay_signature,
                }),
              );
              this.analytics.trackCollabPaymentSuccess();
              this.ngZone.run(() => {
                this.auditRefreshed.emit(updated);
                this.cdr.detectChanges();
              });
              resolve();
            } catch (e: any) {
              reject(new Error(e?.error?.message || 'Payment verification failed'));
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
          theme: { color: '#4338ca' },
        });
        rz.open();
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.paymentError = err?.message || err?.error?.message || 'Payment failed. Please try again.';
        this.analytics.trackCollabPaymentFailed({ reason: this.paymentError });
        this.cdr.detectChanges();
      });
    } finally {
      this.ngZone.run(() => {
        this.payingForReanalysis = false;
        this.cdr.detectChanges();
      });
    }
  }
}
