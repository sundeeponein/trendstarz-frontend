import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  ) {}

  ngOnInit(): void {
    this.userId = String(this.route.snapshot.paramMap.get('userId') || '');
    this.role = String(this.route.snapshot.queryParamMap.get('role') || 'influencer');
    this.creatorName = String(this.route.snapshot.queryParamMap.get('name') || '');
    this.load();
  }

  private load(): void {
    if (!this.userId) return;
    this.loading = true;
    this.notFound = false;
    this.api.getAudit(this.userId).subscribe({
      next: (audit) => {
        this.audit = audit;
        this.loading = false;
        this.loadHistory();
        this.loadPayments();
      },
      error: () => {
        this.audit = null;
        this.notFound = true;
        this.loading = false;
        this.loadPayments();
      },
    });
  }

  private loadHistory(): void {
    this.api.getAuditHistory(this.userId, 20).subscribe({
      next: (res) => (this.history = res?.history || []),
      error: () => (this.history = []),
    });
  }

  private loadPayments(): void {
    this.api.getReanalysisPayments(this.userId).subscribe({
      next: (res) => (this.payments = res?.payments || []),
      error: () => (this.payments = []),
    });
  }

  get pointsToRecommended(): number | null {
    if (!this.audit || this.audit.trendstarzRecommended) return null;
    const min = this.audit.trendstarzRecommendedMinScore;
    if (min == null) return null;
    const gap = min - this.audit.collaborationScore;
    return gap > 0 ? gap : null;
  }

  runAudit(): void {
    if (this.running) return;
    this.running = true;
    this.api.runAuditFor(this.userId, this.role).subscribe({
      next: () => {
        this.running = false;
        this.toast.success('Audit complete.');
        this.load();
      },
      error: (err) => {
        this.running = false;
        this.toast.error(err?.error?.message || 'Could not run the audit.');
      },
    });
  }
}
