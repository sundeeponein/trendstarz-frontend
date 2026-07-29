import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  CollaborationAudit,
  CollaborationAuditHistoryEntry,
  CollaborationReanalysisPayment,
  CollaborationScoreApiService,
} from '../../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService } from '../../../services/collaboration-score-ui-utils.service';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'app-collaboration-score-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './collaboration-score-detail.component.html',
  styleUrls: ['./collaboration-score-detail.component.scss'],
})
export class CollaborationScoreDetailComponent implements OnInit {
  userId = '';
  role = 'influencer';
  creatorName = '';

  loading = false;
  running = false;
  notFound = false;

  audit: CollaborationAudit | null = null;
  history: CollaborationAuditHistoryEntry[] = [];
  payments: CollaborationReanalysisPayment[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: CollaborationScoreApiService,
    public readonly ui: CollaborationScoreUiUtilsService,
    private readonly toast: ToastService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.userId = String(this.route.snapshot.paramMap.get('userId') || '');
    this.role = String(this.route.snapshot.queryParamMap.get('role') || 'influencer');
    this.creatorName = String(this.route.snapshot.queryParamMap.get('name') || '');
    this.load();
  }

  // HttpClient is configured with withFetch() (app.config.ts) — fetch()
  // promise continuations aren't always reliably re-entered into Angular's
  // zone, so state set in a plain .subscribe() callback can sit unrendered
  // (stuck spinner, "No history yet" even after data arrives, etc.) until
  // an unrelated zone-patched event (e.g. a click) forces a CD cycle. Same
  // workaround used elsewhere in this app — see score-preview.component.ts.
  private load(): void {
    if (!this.userId) return;
    this.loading = true;
    this.notFound = false;
    this.api.getAudit(this.userId).subscribe({
      next: (audit) => {
        this.ngZone.run(() => {
          this.audit = audit;
          this.loading = false;
          this.loadHistory();
          this.loadPayments();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.audit = null;
          this.notFound = true;
          this.loading = false;
          this.loadPayments();
          this.cdr.detectChanges();
        });
      },
    });
  }

  private loadHistory(): void {
    this.api.getAuditHistory(this.userId, 20).subscribe({
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

  private loadPayments(): void {
    this.api.getReanalysisPayments(this.userId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.payments = res?.payments || [];
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.payments = [];
          this.cdr.detectChanges();
        });
      },
    });
  }

  get pointsToRecommended(): number | null {
    if (!this.audit || this.audit.trendstarzRecommended) return null;
    const min = this.audit.trendstarzRecommendedMinScore;
    if (min == null) return null;
    const gap = min - this.audit.collaborationScore;
    return gap > 0 ? gap : null;
  }

  /**
   * Same 5-criteria breakdown the creator's own Score Center shows (see
   * CollaborationScoreCardComponent.subScores) — surfaced here so an admin
   * can see exactly which criterion is holding a score down, instead of
   * only the single blended total. Weight percentages mirror the default
   * admin-configurable scoreWeights (Collaboration Score Settings → Score
   * Weights) — not persisted per-audit, so Contribution reflects the
   * current defaults rather than whatever was actually configured at the
   * moment this specific audit ran.
   */
  get subScores(): Array<{ label: string; value: number; weight: string; contribution: number }> {
    if (!this.audit) return [];
    const rows = [
      { label: 'Profile Completeness', value: this.audit.profileCompletenessScore ?? 0, weightPercent: 15 },
      { label: 'Content Quality', value: this.audit.contentQualityScore ?? 0, weightPercent: 25 },
      { label: 'Posting Consistency', value: this.audit.postingConsistencyScore ?? 0, weightPercent: 20 },
      { label: 'Professional Branding', value: this.audit.professionalBrandingScore ?? 0, weightPercent: 20 },
      { label: 'Campaign Readiness', value: this.audit.campaignReadinessScore ?? 0, weightPercent: 20 },
    ];
    return rows.map((r) => ({
      label: r.label,
      value: r.value,
      weight: `${r.weightPercent}%`,
      contribution: Math.round(r.value * r.weightPercent) / 100,
    }));
  }

  /** Sum of each row's Contribution — the pre-rounding total; audit.collaborationScore is this, rounded server-side. */
  get subScoresTotal(): number {
    return Math.round(this.subScores.reduce((sum, s) => sum + s.contribution, 0) * 100) / 100;
  }

  get hasSubScoreBreakdown(): boolean {
    return this.audit?.profileCompletenessScore != null;
  }

  /** "Verified" = real API data; "Beta" = self-reported (capped, unverified); "Not available" = no usable data. */
  confidenceLabel(confidence: number): string {
    if (confidence >= 90) return 'Verified';
    if (confidence > 0) return 'Beta';
    return 'Not available';
  }

  runAudit(): void {
    if (this.running) return;
    this.running = true;
    this.api.runAuditFor(this.userId, this.role).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.running = false;
          this.toast.success('Audit complete.');
          this.load();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.running = false;
          this.toast.error(err?.error?.message || 'Could not run the audit.');
          this.cdr.detectChanges();
        });
      },
    });
  }
}
