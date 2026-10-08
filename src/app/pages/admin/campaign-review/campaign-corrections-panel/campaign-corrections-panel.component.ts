import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { environment } from '../../../../../environments/environment';

/**
 * Admin campaign corrections — guided fixes a host asks support for (restore an
 * automatic withdrawal, extend a deadline or the end date, submit a post link,
 * cancel one creator). The server decides which actions are allowed for each
 * invite (GET admin/campaign-corrections/campaigns/:id) and re-checks on every
 * action; this panel only shows those answers and sends what the admin typed.
 */

export interface ActionCheck {
  allowed: boolean;
  why?: string;
}
export interface CorrectionInvite {
  inviteId: string;
  creatorName: string;
  recipientRole: 'influencer' | 'photographer';
  status: string;
  selectedPostDate: string | null;
  paymentConfirmedAt: string | null;
  submissionClosesAt: string | null;
  submissionDeadlineExtendedTo: string | null;
  withdrawnAt: string | null;
  withdrawal: { reason: string | null; previousStatus: string | null } | null;
  payment: {
    amountPaise: number;
    collectionStatus: string | null;
    payoutStatus: string | null;
    resolveOutcome: string | null;
  } | null;
  corrections: Array<{ action: string; reason: string; by: string; at: string }>;
  actions: {
    restore: ActionCheck;
    extendDeadline: ActionCheck;
    submitOnBehalf: ActionCheck;
    cancel: ActionCheck;
  };
}
export interface CorrectionsView {
  campaign: {
    id: string;
    campaignNumber: number | null;
    title: string;
    status: string;
    endDate: string | null;
    timelineEnd: string | null;
    endsAt: string | null;
    completedBy: string | null;
    completedAt: string | null;
    adminOverrideAction: string | null;
    adminOverrideReason: string;
    adminOverrideAt: string | null;
  };
  actions: { extendEndDate: ActionCheck };
  rules: { graceHours: number; maxExtensionDays: number };
  invites: CorrectionInvite[];
}

export type CorrectionAction = 'endDate' | 'restore' | 'extendDeadline' | 'submitOnBehalf' | 'cancel';

const ACTION_LABELS: Record<CorrectionAction, string> = {
  endDate: 'Extend campaign end date',
  restore: 'Restore participation',
  extendDeadline: 'Extend submission deadline',
  submitOnBehalf: 'Submit post link for the creator',
  cancel: 'Cancel participation (refund to host)',
};

const WITHDRAWAL_LABELS: Record<string, string> = {
  expired_unsubmitted: 'Closed automatically (no submission)',
  admin_cancel: 'Cancelled by admin',
  owner: 'Withdrawn by the host',
  auto_close: 'Closed — slots filled',
  expired_never_accepted: 'Closed — never accepted',
  dispute_refund: 'Dispute decided for the host',
};

const LOG_LABELS: Record<string, string> = {
  restore_participation: 'Restored',
  extend_submission_deadline: 'Deadline extended',
  submit_on_behalf: 'Post submitted by admin',
  cancel_participation: 'Cancelled by admin',
};

type ApiEnvelope<T> = { success?: boolean; data?: T } & Partial<T>;
function unwrap<T>(res: ApiEnvelope<T> | null | undefined): T | undefined {
  if (!res) return undefined;
  return (res.data ?? (res as T)) || undefined;
}

@Component({
  selector: 'app-campaign-corrections-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-corrections-panel.component.html',
  styleUrls: ['./campaign-corrections-panel.component.scss'],
})
export class CampaignCorrectionsPanelComponent implements OnInit, OnDestroy {
  @Input({ required: true }) campaignId = '';
  @Input() campaignTitle = '';
  @Output() close = new EventEmitter<void>();
  /** Emitted after any successful correction (the list can refresh). */
  @Output() changed = new EventEmitter<void>();

  data: CorrectionsView | null = null;
  loading = false;
  error = '';

  // The open action form (one at a time).
  action: CorrectionAction | null = null;
  target: CorrectionInvite | null = null;
  reason = '';
  endDate = '';
  until = '';
  postUrl = '';
  hostNotRefunded = false;
  submitting = false;
  actionError = '';
  lastResult = '';

  private request: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  private get base(): string {
    return `${environment.apiBaseUrl}/admin/campaign-corrections`;
  }

  load(): void {
    if (!this.campaignId) return;
    this.request?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.request = this.http
      .get<ApiEnvelope<CorrectionsView>>(
        `${this.base}/campaigns/${encodeURIComponent(this.campaignId)}`
      )
      .subscribe({
        next: (res) => {
          this.data = unwrap(res) ?? null;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not load campaign corrections.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /* ── labels ── */

  actionLabel(a: CorrectionAction): string {
    return ACTION_LABELS[a];
  }

  withdrawalLabel(inv: CorrectionInvite): string {
    const r = inv.withdrawal?.reason;
    return r ? WITHDRAWAL_LABELS[r] || r : '';
  }

  logLabel(action: string): string {
    return LOG_LABELS[action] || action;
  }

  rupees(paise: number | null | undefined): string {
    return `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
  }

  /** Payment line for a row, in plain words. */
  paymentText(inv: CorrectionInvite): string {
    const p = inv.payment;
    if (!p) return 'No payment';
    const parts = [this.rupees(p.amountPaise)];
    if (p.collectionStatus === 'verified') parts.push('collected');
    if (p.payoutStatus) parts.push(`payout ${p.payoutStatus}`);
    if (p.resolveOutcome === 'refund_to_brand') parts.push('marked refund to host');
    return parts.join(' · ');
  }

  get isRefundMarked(): boolean {
    const p = this.target?.payment;
    return !!p && (p.payoutStatus === 'skipped' || p.resolveOutcome === 'refund_to_brand');
  }

  /* ── action form ── */

  open(action: CorrectionAction, target: CorrectionInvite | null = null): void {
    this.action = action;
    this.target = target;
    this.reason = '';
    this.endDate = '';
    this.until = '';
    this.postUrl = '';
    this.hostNotRefunded = false;
    this.actionError = '';
    this.cdr.markForCheck();
  }

  cancelForm(): void {
    this.action = null;
    this.target = null;
    this.actionError = '';
    this.cdr.markForCheck();
  }

  get reasonValid(): boolean {
    return this.reason.trim().length >= 10;
  }

  get canSubmit(): boolean {
    if (!this.action || this.submitting || !this.reasonValid) return false;
    switch (this.action) {
      case 'endDate':
        return /^\d{4}-\d{2}-\d{2}$/.test(this.endDate);
      case 'extendDeadline':
        return !!this.until;
      case 'submitOnBehalf':
        return /^https?:\/\/\S+$/i.test(this.postUrl.trim());
      case 'restore':
        return !this.isRefundMarked || this.hostNotRefunded;
      default:
        return true;
    }
  }

  private requestFor(): { url: string; body: Record<string, unknown> } | null {
    const reason = this.reason.trim();
    const inviteUrl = (path: string) =>
      `${this.base}/invites/${encodeURIComponent(this.target?.inviteId || '')}/${path}`;
    switch (this.action) {
      case 'endDate':
        return {
          url: `${this.base}/campaigns/${encodeURIComponent(this.campaignId)}/extend-end-date`,
          body: { endDate: this.endDate, reason },
        };
      case 'restore':
        return { url: inviteUrl('restore'), body: { reason, hostNotRefunded: this.hostNotRefunded } };
      case 'extendDeadline':
        // <input type="datetime-local"> is the admin's local time.
        return {
          url: inviteUrl('extend-deadline'),
          body: { until: new Date(this.until).toISOString(), reason },
        };
      case 'submitOnBehalf':
        return { url: inviteUrl('submit-on-behalf'), body: { postUrl: this.postUrl.trim(), reason } };
      case 'cancel':
        return { url: inviteUrl('cancel'), body: { reason } };
      default:
        return null;
    }
  }

  submit(): void {
    if (!this.canSubmit) return;
    const req = this.requestFor();
    if (!req) return;
    const label = this.action ? ACTION_LABELS[this.action] : '';
    this.submitting = true;
    this.actionError = '';
    this.http.post<any>(req.url, req.body).subscribe({
      next: () => {
        this.submitting = false;
        this.lastResult = `${label}: done.`;
        this.cancelForm();
        this.changed.emit();
        this.load();
      },
      error: (err) => {
        this.submitting = false;
        this.actionError = err?.error?.message || 'This correction could not be applied.';
        this.cdr.markForCheck();
      },
    });
  }

  trackInvite(_: number, inv: CorrectionInvite): string {
    return inv.inviteId;
  }
}
