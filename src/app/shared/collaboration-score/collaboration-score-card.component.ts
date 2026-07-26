import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Inject, Input, OnChanges, OnInit, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CollaborationAudit,
  CollaborationAuditHistoryEntry,
  CollaborationScoreApiService,
} from '../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService } from '../../services/collaboration-score-ui-utils.service';
import { ToastService } from '../toast/toast.service';

@Component({
  selector: 'app-collaboration-score-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './collaboration-score-card.component.html',
  styleUrls: ['./collaboration-score-card.component.scss'],
})
export class CollaborationScoreCardComponent implements OnInit, OnChanges {
  @Input() audit: CollaborationAudit | null = null;
  @Input() loading = false;
  @Input() reAnalyzing = false;
  /** Emitted only for the free, first-ever audit — parent runs its existing runMyAudit() flow. */
  @Output() reAnalyze = new EventEmitter<void>();
  /** Emitted after a paid re-analysis completes — parent should replace its audit state with this. */
  @Output() auditRefreshed = new EventEmitter<CollaborationAudit>();

  history: CollaborationAuditHistoryEntry[] = [];
  payingForReanalysis = false;
  paymentError = '';
  connections: { instagram: boolean; facebook: boolean } = { instagram: false, facebook: false };
  connectingPlatform: 'instagram' | 'facebook' | null = null;

  constructor(
    public ui: CollaborationScoreUiUtilsService,
    private readonly api: CollaborationScoreApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toast: ToastService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    this.loadConnections();

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

  private loadConnections(): void {
    this.api.getConnections().subscribe({
      next: (res) => (this.connections = res),
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
          this.connectingPlatform = null;
        }
      },
      error: () => {
        this.toast.error(`Could not start the ${platform === 'instagram' ? 'Instagram' : 'Facebook'} connection.`);
        this.connectingPlatform = null;
      },
    });
  }

  isConnected(platform: string): boolean {
    const key = platform.toLowerCase();
    return key === 'instagram' ? this.connections.instagram : key === 'facebook' ? this.connections.facebook : false;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['audit'] && this.audit?.userId) {
      this.loadHistory(this.audit.userId);
    }
  }

  private loadHistory(userId: string): void {
    this.api.getAuditHistory(userId).subscribe({
      next: (res) => (this.history = res?.history || []),
      error: () => (this.history = []),
    });
  }

  get subScores(): Array<{ label: string; value: number; weight: string }> {
    if (!this.audit) return [];
    return [
      { label: 'Profile Completeness', value: this.audit.profileCompletenessScore ?? 0, weight: '15%' },
      { label: 'Content Quality', value: this.audit.contentQualityScore ?? 0, weight: '25%' },
      { label: 'Posting Consistency', value: this.audit.postingConsistencyScore ?? 0, weight: '20%' },
      { label: 'Professional Branding', value: this.audit.professionalBrandingScore ?? 0, weight: '20%' },
      { label: 'Campaign Readiness', value: this.audit.campaignReadinessScore ?? 0, weight: '20%' },
    ];
  }

  get hasSubScoreBreakdown(): boolean {
    return this.audit?.profileCompletenessScore != null;
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
    return '';
  }

  confidenceLabel(confidence: number): string {
    if (confidence >= 90) return 'Verified';
    if (confidence > 0) return 'Beta';
    return 'Not available';
  }

  onReAnalyzeClick(): void {
    if (this.reanalyzeDisabled) return;
    if (!this.audit) {
      // First-ever audit is free — unchanged, parent-owned flow.
      this.reAnalyze.emit();
      return;
    }
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
        this.paymentError = 'Failed to initialize payment. Please try again.';
        return;
      }

      const loaded = await this.ensureRazorpayLoaded();
      if (!loaded) {
        this.paymentError = 'Failed to load Razorpay checkout.';
        return;
      }

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
              this.auditRefreshed.emit(updated);
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
      this.paymentError = err?.message || err?.error?.message || 'Payment failed. Please try again.';
    } finally {
      this.payingForReanalysis = false;
    }
  }
}
