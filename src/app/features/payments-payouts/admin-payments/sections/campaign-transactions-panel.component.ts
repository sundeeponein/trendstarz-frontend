import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { Component, EventEmitter, Inject, OnInit, Output, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaymentsPayoutsApiService } from '../../payments-payouts-api.service';
import { CampaignTransaction, TransactionSummary } from '../../payments-payouts.models';
import { AdminPaymentsUiUtilsService } from '../admin-payments-ui-utils.service';

@Component({
  selector: 'app-campaign-transactions-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-transactions-panel.component.html',
  styleUrls: ['../admin-payments.component.scss'],
})
export class CampaignTransactionsPanelComponent implements OnInit {
  @Output() errorMessage = new EventEmitter<string>();
  @Output() successMessage = new EventEmitter<string>();

  transactionStatus: 'all' | 'awaiting' | 'verified' | 'payout_pending' | 'paid' = 'all';
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
  selectedTx: CampaignTransaction | null = null;
  txRejectReason = '';
  payoutForm = {
    payoutUtr: '',
    payoutUpiId: '',
    payoutProofUrl: '',
    notes: '',
  };
  proofPreviewUrl = '';

  constructor(
    private paymentsPayoutsApi: PaymentsPayoutsApiService,
    public ui: AdminPaymentsUiUtilsService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    this.loadCampaignTransactions();
  }

  setTransactionStatus(status: 'all' | 'awaiting' | 'verified' | 'payout_pending' | 'paid') {
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

  loadCampaignTransactions() {
    this.transactionLoading = true;
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
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
    const payoutPending = rows.filter((r) => r.payoutStatus === 'pending');

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
    return this.campaignTransactions.filter((r) => r.payoutStatus === 'paid');
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
    this.selectedTx = tx;
    // Prefill UPI from the recipient's saved payout details (set by the
    // influencer either in profile or at the time of accepting the campaign).
    const recipient: any = (tx as any).recipient || {};
    this.payoutForm = {
      payoutUtr: '',
      payoutUpiId: recipient.payoutUpiId || '',
      payoutProofUrl: '',
      notes: '',
    };
    this.showTxPayoutModal = true;
  }

  closePayoutModal() {
    this.showTxPayoutModal = false;
    this.selectedTx = null;
  }

  markTransactionPaid() {
    if (!this.selectedTx || !this.payoutForm.payoutUtr.trim()) return;
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.paymentsPayoutsApi
      .markPaid(
        this.selectedTx._id,
        {
          payoutUtr: this.payoutForm.payoutUtr.trim(),
          payoutUpiId: this.payoutForm.payoutUpiId || undefined,
          payoutProofUrl: this.payoutForm.payoutProofUrl || undefined,
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
    return isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : null;
  }
}
