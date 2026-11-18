import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CollaborationAudit } from '../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService } from '../../services/collaboration-score-ui-utils.service';

/**
 * Slim dashboard widget — score + status + a link to the full report at
 * /dashboard/trendstarz-score. Intentionally has none of
 * CollaborationScoreCardComponent's own logic (no connect/disconnect, no
 * re-analyze/payment flow) — that all lives on the Score Center page now,
 * this widget is presentational only.
 */
@Component({
  selector: 'app-collaboration-score-summary-widget',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './collaboration-score-summary-widget.component.html',
  styleUrls: ['./collaboration-score-summary-widget.component.scss'],
})
export class CollaborationScoreSummaryWidgetComponent {
  @Input() audit: CollaborationAudit | null = null;
  @Input() loading = false;
  /** True while the parent's free first-audit request is in flight. */
  @Input() generating = false;
  /** Parent runs its existing runMyAudit() flow — same contract as the full card's (reAnalyze) output. */
  @Output() generateScore = new EventEmitter<void>();

  constructor(public ui: CollaborationScoreUiUtilsService) {}

  get lastCheckedLabel(): string {
    if (!this.audit?.createdAt) return '';
    return new Date(this.audit.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
