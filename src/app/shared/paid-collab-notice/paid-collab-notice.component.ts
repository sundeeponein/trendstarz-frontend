import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../config.service';
import { OFFPLATFORM_REPORT_LABEL, PAID_COLLAB_TERMS } from '../paid-collab-terms/paid-collab-terms';

/**
 * Shown on a paid collaboration after payment (host and creator): only TrendStarZ can
 * cancel it; a one-time "I agree" for creators who haven't accepted the terms; and the
 * "Asked to skip posting / deal outside TrendStarZ" report.
 */
@Component({
  selector: 'app-paid-collab-notice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paid-collab-notice.component.html',
  styleUrls: ['./paid-collab-notice.component.scss'],
})
export class PaidCollabNoticeComponent {
  @Input({ required: true }) inviteId = '';
  @Input() role: 'creator' | 'host' = 'creator';
  /** Creator only: whether this creator already accepted the terms. */
  @Input() termsAccepted = true;
  @Input() reported = false;
  @Output() termsAcceptedChange = new EventEmitter<boolean>();

  readonly terms = PAID_COLLAB_TERMS;
  readonly reportLabel = OFFPLATFORM_REPORT_LABEL;
  showTerms = false;
  reportOpen = false;
  details = '';
  busy = false;
  error = '';

  constructor(
    private config: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  get needsAgreement(): boolean {
    return this.role === 'creator' && !this.termsAccepted;
  }

  stop(ev: Event) {
    ev.stopPropagation();
  }

  agree(ev: Event) {
    ev.stopPropagation();
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.config.acceptPaidCollabTerms(this.inviteId).subscribe({
      next: () => {
        this.busy = false;
        this.termsAccepted = true;
        this.termsAcceptedChange.emit(true);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.busy = false;
        this.error = err?.error?.message || 'Could not save. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  toggleReport(ev: Event) {
    ev.stopPropagation();
    this.reportOpen = !this.reportOpen;
    this.error = '';
  }

  sendReport(ev: Event) {
    ev.stopPropagation();
    const text = this.details.trim();
    if (text.length < 20 || this.busy) return;
    this.busy = true;
    this.error = '';
    this.config.reportOffPlatform(this.inviteId, text).subscribe({
      next: () => {
        this.busy = false;
        this.reported = true;
        this.reportOpen = false;
        this.details = '';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.busy = false;
        this.error = err?.error?.message || 'Could not send the report. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }
}
