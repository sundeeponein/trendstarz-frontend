import { CommonModule } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { PaymentsPayoutsApiService } from '../../payments-payouts-api.service';
import { RefundQueueItem, RefundState, TransactionSummary } from '../../payments-payouts.models';
import { AdminPaymentsUiUtilsService } from '../admin-payments-ui-utils.service';
import { buildSocialProfileUrl } from '../../../../shared/social-handle.util';

type RefundFilter = 'all' | RefundState;
type ActionMode = 'sent' | 'approve' | 'reject' | 'repaid' | 'exception';

const STATE_LABELS: Record<RefundState, string> = {
  on_hold: 'On hold',
  owed: 'Owed',
  sent: 'Sent',
  settlement: 'Settlement',
  legacy_unconfirmed: 'Legacy — unconfirmed',
};

const FLAG_LABELS: Record<string, string> = {
  repeat_pair: 'Same host & creator refunded before',
  host_repeat_refunds: 'Host: 2+ refunds in 90 days',
  creator_repeat_no_post: 'Creator: 2+ no-post closures in 90 days',
};

const HISTORY_LABELS: Record<string, string> = {
  refund_on_hold: 'Refund put on hold',
  refund_owed: 'Refund approved (owed)',
  hold_expired_refund_owed: 'Hold ended → owed',
  refund_sent: 'Refund sent',
  late_post_submitted: 'Late post submitted',
  late_post_approved: 'Late post approved',
  late_post_rejected: 'Late post rejected',
  refund_cancelled_delivery_verified: 'Refund cancelled — post verified',
  refund_cancelled_participation_restored: 'Refund cancelled — participation restored',
  settlement_opened: 'Settlement opened (host to repay)',
  settlement_host_repaid: 'Host repaid',
  settlement_exception_approved: 'Creator paid as an exception',
  offplatform_reported: 'Off-platform report',
};

/**
 * Admin → Payments → Refunds. Every money step is an explicit, recorded admin action:
 * a status change here only records a transfer that already happened (UTR + date).
 */
@Component({
  selector: 'app-refunds-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './refunds-panel.component.html',
  styleUrls: ['../admin-payments.component.scss', './refunds-panel.component.scss'],
})
export class RefundsPanelComponent implements OnInit {
  @Output() errorMessage = new EventEmitter<string>();
  @Output() successMessage = new EventEmitter<string>();

  readonly filters: { key: RefundFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'on_hold', label: 'On hold' },
    { key: 'owed', label: 'Owed' },
    { key: 'sent', label: 'Sent' },
    { key: 'settlement', label: 'Settlement' },
    { key: 'legacy_unconfirmed', label: 'Legacy' },
  ];

  filter: RefundFilter = 'all';
  rows: RefundQueueItem[] = [];
  summary: Partial<TransactionSummary> = {};
  loading = false;
  saving = false;
  expanded = new Set<string>();

  action: { mode: ActionMode; row: RefundQueueItem } | null = null;
  form = { utr: '', amountRupees: '', date: '', note: '', postUrl: '' };

  constructor(
    private api: PaymentsPayoutsApiService,
    public ui: AdminPaymentsUiUtilsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.listRefunds().subscribe({
      next: (res) => {
        this.rows = res?.data || [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage.emit(err?.error?.message || 'Failed to load refunds');
        this.cdr.markForCheck();
      },
    });
    this.api.getSummary(new HttpHeaders()).subscribe({
      next: (res) => {
        this.summary = res?.data || {};
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  get visibleRows(): RefundQueueItem[] {
    return this.filter === 'all' ? this.rows : this.rows.filter((r) => r.state === this.filter);
  }

  countFor(key: RefundFilter): number {
    return key === 'all' ? this.rows.length : this.rows.filter((r) => r.state === key).length;
  }

  stateLabel(state: RefundState): string {
    return STATE_LABELS[state] || state;
  }

  flagLabel(flag: string): string {
    return FLAG_LABELS[flag] || flag;
  }

  historyLabel(action: string): string {
    return HISTORY_LABELS[action] || action;
  }

  socialUrl(s: { platform: string; handle: string }): string {
    return buildSocialProfileUrl(s.platform, s.handle);
  }

  toggleHistory(id: string): void {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
  }

  holdEnded(row: RefundQueueItem): boolean {
    return !!row.refundHoldUntil && new Date(row.refundHoldUntil).getTime() <= Date.now();
  }

  /** Why the money can't move yet (shown instead of buttons). */
  blockedReason(row: RefundQueueItem): string {
    if (row.openReport) return 'Open report — resolve it on the Disputes page first.';
    if (row.latePost?.status === 'pending') return '';
    if (row.state === 'on_hold') {
      return this.holdEnded(row)
        ? 'Hold ended — moves to Owed within the hour.'
        : `Under review until ${this.ui.formatDateTime(row.refundHoldUntil || '')}.`;
    }
    if (row.state === 'legacy_unconfirmed') {
      return 'Payment history not confirmed. Left unchanged until the legacy migration is approved.';
    }
    return '';
  }

  canReviewLatePost(row: RefundQueueItem): boolean {
    return !row.openReport && row.inviteStatus === 'withdrawn' && row.latePost?.status === 'pending';
  }

  /** "Posted outside platform": admin found the post themselves. */
  canRecordFoundPost(row: RefundQueueItem): boolean {
    return (
      !row.openReport &&
      row.inviteStatus === 'withdrawn' &&
      ['on_hold', 'owed', 'sent'].includes(row.state) &&
      row.latePost?.status !== 'pending'
    );
  }

  canMarkSent(row: RefundQueueItem): boolean {
    return row.state === 'owed' && !row.openReport && row.latePost?.status !== 'pending';
  }

  openAction(mode: ActionMode, row: RefundQueueItem): void {
    this.action = { mode, row };
    this.form = {
      utr: '',
      amountRupees: '',
      date: new Date().toISOString().slice(0, 10),
      note: '',
      postUrl: mode === 'approve' ? row.latePost?.url || '' : '',
    };
  }

  closeAction(): void {
    if (this.saving) return;
    this.action = null;
  }

  get actionTitle(): string {
    switch (this.action?.mode) {
      case 'sent':
        return 'Record refund sent';
      case 'approve':
        return this.action.row.latePost?.status === 'pending' ? 'Approve late post' : 'Record post found outside the platform';
      case 'reject':
        return 'Reject late post';
      case 'repaid':
        return 'Record host repayment';
      case 'exception':
        return 'Pay creator as an exception';
      default:
        return '';
    }
  }

  get actionValid(): boolean {
    const a = this.action;
    if (!a) return false;
    const note = this.form.note.trim();
    switch (a.mode) {
      case 'sent':
      case 'repaid':
        return !!this.form.utr.trim();
      case 'approve':
        return note.length >= 10 && /^https?:\/\/\S+$/i.test(this.form.postUrl.trim());
      case 'reject':
      case 'exception':
        return note.length >= 10;
    }
  }

  submitAction(): void {
    const a = this.action;
    if (!a || !this.actionValid || this.saving) return;
    const rupees = Number(this.form.amountRupees);
    const amount = Number.isFinite(rupees) && rupees > 0 ? Math.round(rupees * 100) : undefined;
    const date = this.form.date ? new Date(`${this.form.date}T12:00:00+05:30`).toISOString() : undefined;
    const note = this.form.note.trim();
    let call: Observable<any>;
    let done: string;
    switch (a.mode) {
      case 'sent':
        call = this.api.markRefundSent(a.row._id, {
          refundUtr: this.form.utr.trim(),
          refundAmount: amount,
          transferDate: date,
          notes: note || undefined,
        });
        done = 'Refund recorded as sent. The host was notified.';
        break;
      case 'repaid':
        call = this.api.recordHostRepayment(a.row._id, {
          utr: this.form.utr.trim(),
          amount,
          repaidAt: date,
          notes: note || undefined,
        });
        done = "Host repayment recorded. The creator's payout is queued.";
        break;
      case 'exception':
        call = this.api.approveSettlementException(a.row._id, note);
        done = "Exception recorded. The creator's payout is queued.";
        break;
      case 'approve':
        call = this.api.reviewLatePost(a.row.inviteId, {
          action: 'approve',
          note,
          postUrl: this.form.postUrl.trim(),
        });
        done = a.row.state === 'sent' ? 'Post verified. A settlement case was opened.' : 'Post verified. Refund cancelled, payout queued.';
        break;
      case 'reject':
        call = this.api.reviewLatePost(a.row.inviteId, { action: 'reject', note });
        done = 'Late post rejected. The refund review continues.';
        break;
    }
    this.saving = true;
    call.subscribe({
      next: () => {
        this.saving = false;
        this.action = null;
        this.successMessage.emit(done);
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage.emit(err?.error?.message || 'Action failed');
        this.cdr.markForCheck();
      },
    });
  }
}
