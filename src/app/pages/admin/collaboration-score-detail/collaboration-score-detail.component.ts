import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  CollaborationAudit,
  CollaborationAuditHistoryEntry,
  CollaborationReanalysisPayment,
  CollaborationScoreApiService,
} from '../../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService, ScoreConfidence, SubScoreRow } from '../../../services/collaboration-score-ui-utils.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { ScoreRingComponent } from '../../../shared/collaboration-score/score-ring.component';

@Component({
  selector: 'app-collaboration-score-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ScoreRingComponent],
  templateUrl: './collaboration-score-detail.component.html',
  styleUrls: ['./collaboration-score-detail.component.scss'],
})
export class CollaborationScoreDetailComponent implements OnInit {
  userId = '';
  role = 'influencer';
  /** TrendStarZ admin-verification flag — passed through from the admin user table's link (selectedUser.verifiedByTrendStarz), not re-fetched here. */
  verified = false;
  /** Passed through from the admin user table's link (selectedUser.username) — same identifier the public profile view uses. */
  username = '';

  loading = false;
  running = false;
  notFound = false;

  audit: CollaborationAudit | null = null;
  history: CollaborationAuditHistoryEntry[] = [];
  payments: CollaborationReanalysisPayment[] = [];
  showFullAuditHistory = false;

  // Only the current audit shows by default — a long history list buried the
  // one thing an admin actually opens this page to see. Toggled by a button
  // below the list, only rendered when there's more than one entry to reveal.
  get visibleHistory(): CollaborationAuditHistoryEntry[] {
    return this.showFullAuditHistory ? this.history : this.history.slice(0, 1);
  }

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
    this.verified = this.route.snapshot.queryParamMap.get('verified') === 'true';
    this.username = String(this.route.snapshot.queryParamMap.get('username') || '');
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

  /** Same route the public profile view itself uses (app.routes.ts: photographer/:username, influencer/:username) — Collaboration Score is never available for Brand accounts. */
  get publicProfileUrl(): string | null {
    if (!this.username) return null;
    const segment = this.role === 'photographer' ? 'photographer' : 'influencer';
    return `/${segment}/${this.username}`;
  }

  get pointsToRecommended(): number | null {
    if (!this.audit || this.audit.trendstarzRecommended) return null;
    const min = this.audit.trendstarzRecommendedMinScore;
    if (min == null) return null;
    const gap = min - this.audit.collaborationScore;
    return gap > 0 ? gap : null;
  }

  // Delegated to CollaborationScoreUiUtilsService — single source of truth
  // shared with the creator's own Score Center card, so both always show
  // identical numbers, not just identical styling.
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

  platformIcon(platform: string): string {
    const key = platform.toLowerCase();
    if (key === 'instagram') return 'bi-instagram';
    if (key === 'youtube') return 'bi-youtube';
    if (key === 'facebook') return 'bi-facebook';
    if (key === 'linkedin') return 'bi-linkedin';
    return 'bi-globe';
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
