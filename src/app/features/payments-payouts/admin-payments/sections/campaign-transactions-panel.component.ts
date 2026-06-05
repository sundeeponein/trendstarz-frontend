import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectorRef, Component, EventEmitter, Inject, OnInit, Output, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { PaymentsPayoutsApiService } from '../../payments-payouts-api.service';
import { CampaignTransaction, TransactionSummary } from '../../payments-payouts.models';
import { AdminPaymentsUiUtilsService } from '../admin-payments-ui-utils.service';
import { buildAdminOfferTrailText } from '../../../../shared/offer-trail.util';
import { ConfigService } from '../../../../shared/config.service';

@Component({
  selector: 'app-campaign-transactions-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-transactions-panel.component.html',
  styleUrls: ['../admin-payments.component.scss'],
})
export class CampaignTransactionsPanelComponent implements OnInit {
  payoutReleaseWaitHours = 24;

  @Output() errorMessage = new EventEmitter<string>();
  @Output() successMessage = new EventEmitter<string>();

  transactionStatus: 'all' | 'awaiting' | 'verified' | 'payout_pending' | 'paid' | 'disputes' = 'all';
  campaignTransactions: CampaignTransaction[] = [];
  transactionLoading = false;

  txSummary = {
    collected: 0,
    fees: 0,
    pendingPayouts: 0,
    paidOut: 0,
    netBalance: 0,
  } as TransactionSummary;

  showTxRejectModal = false;
  showTxPayoutModal = false;
  showProofModal = false;
  showDisputeModal = false;
  // Compatibility stubs for occasional stale Angular template diagnostics.
  markPaidConfirmOpen = false;
  markPaidConfirmMessage = '';
  selectedTx: CampaignTransaction | null = null;
  txRejectReason = '';
  disputeNotes = '';
  disputeOutcome: 'release_to_influencer' | 'refund_to_brand' = 'release_to_influencer';
  payoutForm = {
    payoutUtr: '',
    payoutUpiId: '',
    payoutProofUrl: '',
    notes: '',
  };
  payoutProofFile: File | null = null;
  payoutProofPreview: string | null = null;
  uploadingProof = false;
  proofPreviewUrl = '';

  constructor(
    private paymentsPayoutsApi: PaymentsPayoutsApiService,
    private config: ConfigService,
    public ui: AdminPaymentsUiUtilsService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    this.config.getAppSettings().subscribe({
      next: (settings: any) => {
        const hours = Number(settings?.payoutReleaseWaitHours);
        this.payoutReleaseWaitHours = Number.isFinite(hours) && hours >= 0 ? hours : 24;
        this.cdr.detectChanges();
      },
      error: () => {
        this.payoutReleaseWaitHours = 24;
      },
    });
    this.loadCampaignTransactions();
  }

  setTransactionStatus(status: 'all' | 'awaiting' | 'verified' | 'payout_pending' | 'paid' | 'disputes') {
    this.transactionStatus = status;
  }

  runAutoApproveStaleSubmissions() {
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.paymentsPayoutsApi.runAutoApproveStale(headers).subscribe({
      next: (res) => {
        const count = Number(res?.autoApprovedCount || 0);
        this.successMessage.emit(`Auto-approval run complete. ${count} submission(s) approved.`);
        this.loadCampaignTransactions();
      },
      error: (err) => {
        this.errorMessage.emit(err?.error?.message || 'Failed to run auto-approval');
      },
    });
  }

  runAutoPayoutSweep() {
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.paymentsPayoutsApi.runAutoPayoutSweep(headers).subscribe({
      next: (res) => {
        if (res?.success === false) {
          this.errorMessage.emit(res?.message || 'Auto payout is disabled.');
          return;
        }
        const processed = Number(res?.processed || 0);
        const queued = Number(res?.queued || 0);
        const skipped = Number(res?.skipped || 0);
        const failed = Number(res?.failed || 0);
        this.successMessage.emit(
          `Auto payout complete. Processed: ${processed}, Queued: ${queued}, Skipped: ${skipped}, Failed: ${failed}.`,
        );
        this.loadCampaignTransactions();
      },
      error: (err) => {
        this.errorMessage.emit(err?.error?.message || 'Failed to run auto payout sweep');
      },
    });
  }

  loadCampaignTransactions() {
    this.transactionLoading = true;
    const token = this.getToken();
    if (!token) {
      // Defer emit to avoid NG0100 when called from ngOnInit
      Promise.resolve().then(() => this.errorMessage.emit('Not authenticated'));
      this.transactionLoading = false;
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.paymentsPayoutsApi.listTransactions(headers).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        this.campaignTransactions = rows;
        this.loadTransactionSummary(headers, rows);
        this.transactionLoading = false;
      },
      error: (err) => {
        this.errorMessage.emit(err?.error?.message || 'Failed to load campaign transactions');
        this.transactionLoading = false;
      },
    });
  }

  private loadTransactionSummary(headers: HttpHeaders, fallbackRows: CampaignTransaction[]) {
    this.paymentsPayoutsApi.getSummary(headers).subscribe({
      next: (res) => {
        const d = res?.data || {};
        this.txSummary = {
          collected: Number(d.collected || 0),
          fees: Number(d.fees || 0),
          pendingPayouts: Number(d.pendingPayouts || 0),
          paidOut: Number(d.paidOut || 0),
          netBalance: Number(d.netBalance || 0),
        };
      },
      error: () => this.recomputeTransactionSummary(fallbackRows),
    });
  }

  private recomputeTransactionSummary(rows: CampaignTransaction[]) {
    const verified = rows.filter((r) => r.collectionStatus === 'verified');
    const paid = rows.filter((r) => r.payoutStatus === 'paid');
    const payoutPending = rows.filter((r) => r.payoutStatus === 'pending' || r.payoutStatus === 'processing');

    const collected = verified.reduce((sum, r) => sum + (r.payerTotal || 0), 0);
    const fees = verified.reduce((sum, r) => sum + (r.platformFee || 0), 0);
    const pendingPayouts = payoutPending.reduce((sum, r) => sum + (r.recipientPayout || 0), 0);
    const paidOut = paid.reduce((sum, r) => sum + (r.recipientPayout || 0), 0);

    this.txSummary = {
      collected,
      fees,
      pendingPayouts,
      paidOut,
      netBalance: collected - paidOut - pendingPayouts,
    };
  }

  get visibleTransactions(): CampaignTransaction[] {
    if (this.transactionStatus === 'all') return this.campaignTransactions;
    if (this.transactionStatus === 'awaiting') {
      return this.campaignTransactions.filter((r) => r.collectionStatus === 'awaiting_payment' || r.collectionStatus === 'proof_submitted');
    }
    if (this.transactionStatus === 'verified') {
      return this.campaignTransactions.filter((r) => r.collectionStatus === 'verified');
    }
    if (this.transactionStatus === 'payout_pending') {
      return this.campaignTransactions.filter((r) => r.payoutStatus === 'pending' || r.payoutStatus === 'processing');
    }
    if (this.transactionStatus === 'disputes') {
      return this.campaignTransactions.filter((r) => r.disputeStatus === 'open');
    }
    return this.campaignTransactions.filter((r) => r.payoutStatus === 'paid');
  }

  get openDisputeCount(): number {
    return this.campaignTransactions.filter(r => r.disputeStatus === 'open').length;
  }

  verifyTransaction(tx: CampaignTransaction) {
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.paymentsPayoutsApi.verifyTransaction(tx._id, headers).subscribe({
      next: () => {
        this.successMessage.emit('Transaction verified');
        this.loadCampaignTransactions();
      },
      error: (err) => this.errorMessage.emit(err?.error?.message || 'Failed to verify transaction'),
    });
  }

  openRejectTxModal(tx: CampaignTransaction) {
    this.selectedTx = tx;
    this.txRejectReason = '';
    this.showTxRejectModal = true;
  }

  closeRejectTxModal() {
    this.showTxRejectModal = false;
    this.selectedTx = null;
    this.txRejectReason = '';
  }

  rejectTransaction() {
    if (!this.selectedTx || !this.txRejectReason.trim()) return;
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.paymentsPayoutsApi.rejectTransaction(this.selectedTx._id, this.txRejectReason.trim(), headers).subscribe({
      next: () => {
        this.successMessage.emit('Transaction rejected');
        this.closeRejectTxModal();
        this.loadCampaignTransactions();
      },
      error: (err) => this.errorMessage.emit(err?.error?.message || 'Failed to reject transaction'),
    });
  }

  openPayoutModal(tx: CampaignTransaction) {
    if (!this.canMarkPaid(tx)) return;
    this.selectedTx = tx;
    const recipient: any = (tx as any).recipient || {};
    this.payoutForm = {
      payoutUtr: '',
      payoutUpiId: recipient.payoutUpiId || '',
      payoutProofUrl: '',
      notes: '',
    };
    this.payoutProofFile = null;
    this.payoutProofPreview = null;
    this.uploadingProof = false;
    this.showTxPayoutModal = true;
  }

  canMarkPaid(tx: CampaignTransaction): boolean {
    const collectionOk = tx.collectionStatus === 'verified';
    const payoutPending = tx.payoutStatus === 'pending' || tx.payoutStatus === 'processing';
    const notVerifiedTab = this.transactionStatus !== 'verified';
    return collectionOk
      && payoutPending
      && notVerifiedTab
      && this.isInvitePayoutEligible(tx)
      && this.isPayoutHoldWindowOpen(tx)
      && this.isManualSettlement(tx);
  }

  markPaidDisabledReason(tx: CampaignTransaction): string {
    if (!this.isManualSettlement(tx)) return 'Auto settlement handles payout.';
    if (tx.collectionStatus !== 'verified') return 'Collection must be verified first.';
    if (!(tx.payoutStatus === 'pending' || tx.payoutStatus === 'processing')) return 'Payout is not pending.';
    if (this.transactionStatus === 'verified') return 'Switch to Pending Payout tab to release payout.';
    if (!this.isInvitePayoutEligible(tx)) {
      const status = this.inviteStatusLabel(tx);
      return `Waiting for host review completion in Campaign Review. Current stage: ${status}.`;
    }
    if (!this.isPayoutHoldWindowOpen(tx)) {
      const unlockAt = this.getPayoutUnlockAt(tx);
      if (!unlockAt) return 'Completion timestamp missing. Re-mark invite as completed, then retry payout.';
      return `Payout opens after ${this.formatHoursLabel(this.payoutReleaseWaitHours)} from completion. Eligible at: ${unlockAt.toUTCString()}.`;
    }
    return '';
  }

  settlementModeLabel(tx: CampaignTransaction): string {
    const gateway = String(tx.gateway || 'manual_upi').toLowerCase();
    if (gateway === 'razorpay') return 'Auto (Razorpay)';
    return 'Manual (UPI)';
  }

  reviewFlowStatusLabel(tx: CampaignTransaction): 'Awaiting Host Completion' | 'Payout Pending' | 'Paid Out' {
    if (tx.payoutStatus === 'paid') return 'Paid Out';
    return this.isInvitePayoutEligible(tx) ? 'Payout Pending' : 'Awaiting Host Completion';
  }

  reviewFlowStatusClass(tx: CampaignTransaction): string {
    const label = this.reviewFlowStatusLabel(tx);
    if (label === 'Paid Out') return 'bg-success-subtle text-success-emphasis';
    if (label === 'Payout Pending') return 'bg-info-subtle text-info-emphasis';
    return 'bg-warning-subtle text-warning-emphasis';
  }

  releaseActionHint(tx: CampaignTransaction): string {
    if (!this.isManualSettlement(tx)) {
      return `Auto release via ${this.settlementModeLabel(tx)}.`;
    }
    return 'Admin must release payout manually.';
  }

  payoutDestinationLabel(tx: CampaignTransaction): string {
    const r = tx.recipient;
    if (!r) return 'Recipient profile missing';
    const upi = String(r.payoutUpiId || '').trim();
    const mobile = String(r.payoutMobile || r.mobile || '').trim();
    if (upi) return `UPI: ${upi}`;
    if (mobile) return `Mobile: ${mobile}`;
    return 'No payout destination saved';
  }

  partyName(tx: CampaignTransaction, side: 'payer' | 'recipient'): string {
    const party = side === 'payer' ? tx.payer : tx.recipient;
    const role = side === 'payer' ? tx.payerRole : tx.recipientRole;
    return String(party?.name || role || '').trim();
  }

  markPaidActionLabel(tx: CampaignTransaction): string {
    const who = this.partyName(tx, 'recipient');
    return who ? `Mark Paid to ${who}` : 'Mark Paid';
  }

  offerTrailSummary(tx: CampaignTransaction): string {
    const inv = tx.inviteSnapshot;
    if (!inv) return 'Offer trail unavailable';
    return buildAdminOfferTrailText({
      ...inv,
      campaignAmountPaise: Number(
        (tx as any)?.campaign?.pricePerInfluencer
        || (tx as any)?.campaignAmountPaise
        || 0,
      ),
      campaign: (tx as any)?.campaign || null,
    });
  }

  inviteStatusLabel(tx: CampaignTransaction): string {
    const status = String(tx.inviteSnapshot?.status || '').toLowerCase();
    if (!status) return 'N/A';
    const labels: Record<string, string> = {
      accepted: 'Working',
      payment_confirmed: 'Working',
      working: 'Working',
      submitted: 'Under Review',
      completed: 'Post Approved',
      approved: 'Payout Released',
      counter_sent: 'Counter Sent',
      pending: 'Pending',
      invited: 'Invited',
      declined: 'Declined',
      disputed: 'Under Review',
    };
    return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  payoutEligibilityHint(tx: CampaignTransaction): string {
    const inv = tx.inviteSnapshot;
    if (!inv?.status) return 'Invite status unavailable';
    if (!this.isInvitePayoutEligible(tx)) {
      return `Release blocked until host approves/completes review. Current stage: ${this.inviteStatusLabel(tx)}.`;
    }
    if (!this.isPayoutHoldWindowOpen(tx)) {
      const unlockAt = this.getPayoutUnlockAt(tx);
      if (!unlockAt) return 'Release blocked: completion timestamp missing.';
      return `Release blocked until ${unlockAt.toUTCString()} (${this.formatHoursLabel(this.payoutReleaseWaitHours)} post completion).`;
    }
    const unlockText = inv.unlocked ? 'Unlocked' : 'Locked';
    return `Invite ${this.inviteStatusLabel(tx)} · ${unlockText}`;
  }

  payoutWindowSummary(tx: CampaignTransaction): string {
    const unlockAt = this.getPayoutUnlockAt(tx);
    if (!unlockAt) return 'Payout window: completion timestamp missing.';
    if (this.isPayoutHoldWindowOpen(tx)) {
      return `Payout window: open (min ${this.formatHoursLabel(this.payoutReleaseWaitHours)} hold satisfied).`;
    }
    return `Payout window: opens at ${unlockAt.toUTCString()}.`;
  }

  unlockedOfferTrailSummary(tx: CampaignTransaction): string {
    if (!tx.inviteSnapshot?.unlocked) return '';
    return this.offerTrailSummary(tx);
  }

  agreedAmountSummary(tx: CampaignTransaction): string {
    const paise = Number(tx.inviteSnapshot?.agreedAmountPaise || 0);
    const rupees = Number(tx.inviteSnapshot?.agreedAmount || 0);
    if (paise > 0) return this.ui.formatPaise(paise);
    if (rupees > 0) return `₹${rupees.toLocaleString('en-IN')}`;
    return this.ui.formatPaise(tx.recipientPayout || 0);
  }

  private isInvitePayoutEligible(tx: CampaignTransaction): boolean {
    const status = String(tx.inviteSnapshot?.status || '').toLowerCase();
    if (['approved', 'completed'].includes(status)) return true;

    const workStatus = String(tx.workStatus || '').toLowerCase();
    if (['approved', 'completed'].includes(workStatus)) return true;

    // Legacy/non-invite transactions may not have either status.
    if (!status && !workStatus) return true;
    return false;
  }

  private getInviteCompletedAt(tx: CampaignTransaction): Date | null {
    const raw = tx.inviteSnapshot?.completedAt || tx.inviteSnapshot?.updatedAt;
    if (!raw) return null;
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  private getPayoutUnlockAt(tx: CampaignTransaction): Date | null {
    const completedAt = this.getInviteCompletedAt(tx);
    if (!completedAt) return null;
    return new Date(
      completedAt.getTime() + this.payoutReleaseWaitHours * 60 * 60 * 1000,
    );
  }

  private isPayoutHoldWindowOpen(tx: CampaignTransaction): boolean {
    const unlockAt = this.getPayoutUnlockAt(tx);
    if (!unlockAt) return false;
    return Date.now() >= unlockAt.getTime();
  }

  isManualSettlement(tx: CampaignTransaction): boolean {
    const gateway = String(tx.gateway || 'manual_upi').toLowerCase();
    return gateway === '' || gateway === 'manual_upi';
  }

  private formatHoursLabel(hours: number): string {
    const value = Number(hours);
    if (!Number.isFinite(value)) return '24 hours';
    if (value === 1) return '1 hour';
    return `${value} hours`;
  }

  closePayoutModal() {
    this.showTxPayoutModal = false;
    this.markPaidConfirmOpen = false;
    this.selectedTx = null;
    this.payoutProofFile = null;
    this.payoutProofPreview = null;
  }

  requestMarkTransactionPaid() {
    if (!this.selectedTx || !this.payoutForm.payoutUtr.trim() || this.uploadingProof) return;
    const payoutAmount = this.ui.formatPaise(this.selectedTx.recipientPayout || 0);
    this.markPaidConfirmMessage = `Confirm payout of ${payoutAmount}? Please verify UTR and recipient UPI before continuing.`;
    this.markPaidConfirmOpen = true;
  }

  onMarkPaidConfirmCancel() {
    this.markPaidConfirmOpen = false;
  }

  onMarkPaidConfirm() {
    this.markPaidConfirmOpen = false;
    this.markTransactionPaid();
  }

  onPayoutFileSelected(ev: Event) {
    const el = ev.target as HTMLInputElement;
    if (!el.files?.length) return;
    const file = el.files[0];
    this.payoutProofFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      this.payoutProofPreview = (e.target?.result as string) || null;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  clearPayoutFile() {
    this.payoutProofFile = null;
    this.payoutProofPreview = null;
  }

  /** Build a standard UPI deep-link that opens GPay / PhonePe / Paytm. */
  buildUpiPayLink(recipient: any): string {
    // Prefer explicit UPI ID; fall back to mobile number (works for GPay/PhonePe)
    const pa = recipient?.payoutUpiId || recipient?.payoutMobile || recipient?.mobile || '';
    if (!pa) return '#';
    const pn = encodeURIComponent(recipient?.payoutName || recipient?.name || 'Influencer');
    const am = this.selectedTx ? (this.selectedTx.recipientPayout / 100).toFixed(2) : '0';
    const tn = encodeURIComponent('TrendStarZ Influencer Payout');
    return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  }

  async uploadPayoutProof(): Promise<string> {
    if (!this.payoutProofFile) return '';
    try {
      const fd = new FormData();
      fd.append('file', this.payoutProofFile);
      const token = this.getToken();
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiBaseUrl}/campaign-invites/payout/upload-image`, fd, { headers })
      );
      return res?.data?.url || res?.url || '';
    } catch {
      return '';
    }
  }

  async markTransactionPaid() {
    if (!this.selectedTx || !this.payoutForm.payoutUtr.trim()) return;
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    // Upload screenshot if selected
    this.uploadingProof = true;
    let proofUrl = this.payoutForm.payoutProofUrl || '';
    if (this.payoutProofFile) {
      proofUrl = await this.uploadPayoutProof();
    }
    this.uploadingProof = false;
    this.paymentsPayoutsApi
      .markPaid(
        this.selectedTx._id,
        {
          payoutUtr: this.payoutForm.payoutUtr.trim(),
          payoutUpiId: this.payoutForm.payoutUpiId || undefined,
          payoutProofUrl: proofUrl || undefined,
          notes: this.payoutForm.notes || undefined,
        },
        headers,
      )
      .subscribe({
        next: () => {
          this.successMessage.emit('Payout marked as paid');
          this.closePayoutModal();
          this.loadCampaignTransactions();
        },
        error: (err) => this.errorMessage.emit(err?.error?.message || 'Failed to mark payout paid'),
      });
  }

  openProofPreview(url?: string) {
    if (!url) return;
    this.proofPreviewUrl = url;
    this.showProofModal = true;
  }

  closeProofPreview() {
    this.showProofModal = false;
    this.proofPreviewUrl = '';
  }

  private getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  // ── Dispute management ──────────────────────────────────────────────────────

  openDisputeModal(tx: CampaignTransaction) {
    this.selectedTx = tx;
    this.disputeNotes = '';
    this.disputeOutcome = 'release_to_influencer';
    this.showDisputeModal = true;
  }

  closeDisputeModal() {
    this.showDisputeModal = false;
    this.selectedTx = null;
    this.disputeNotes = '';
  }

  resolveDispute() {
    if (!this.selectedTx) return;
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.paymentsPayoutsApi
      .resolveDispute(this.selectedTx._id, this.disputeOutcome, this.disputeNotes, headers)
      .subscribe({
        next: (res: any) => {
          this.successMessage.emit(res?.message || 'Dispute resolved');
          this.closeDisputeModal();
          this.loadCampaignTransactions();
        },
        error: (err: any) => this.errorMessage.emit(err?.error?.message || 'Failed to resolve dispute'),
      });
  }
}
