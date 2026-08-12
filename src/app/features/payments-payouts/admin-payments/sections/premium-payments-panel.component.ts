import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { Component, EventEmitter, OnInit, Output, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PremiumPaymentsAdminApiService } from '../../premium-payments-admin-api.service';
import { PremiumPayment } from '../../payments-payouts.models';
import { AdminPaymentsUiUtilsService } from '../admin-payments-ui-utils.service';

@Component({
  selector: 'app-premium-payments-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './premium-payments-panel.component.html',
  styleUrls: ['../admin-payments.component.scss'],
})
export class PremiumPaymentsPanelComponent implements OnInit {
  @Output() errorMessage = new EventEmitter<string>();
  @Output() successMessage = new EventEmitter<string>();

  pendingPayments: PremiumPayment[] = [];
  approvedPayments: PremiumPayment[] = [];
  rejectedPayments: PremiumPayment[] = [];
  refundedPayments: PremiumPayment[] = [];

  premiumSummary = {
    received: 0,
    pending: 0,
    rejected: 0,
    refunded: 0,
    netReceived: 0,
  };

  activeTab: 'influencer' | 'brand' | 'photographer' = 'influencer';
  statusTab: 'pending' | 'approved' | 'rejected' | 'refunded' = 'pending';
  sortOption: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' = 'date_desc';
  modeFilter: 'all' | 'manual' | 'razorpay' = 'all';
  loading = false;

  rejectionReason = '';
  rejectionReasonError = '';
  showRejectModal = false;
  selectedPaymentForReject: PremiumPayment | null = null;
  refundReason = '';
  refundReasonError = '';
  showRefundModal = false;
  selectedPaymentForRefund: PremiumPayment | null = null;

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  private platformId = inject(PLATFORM_ID);

  constructor(
    private premiumPaymentsApi: PremiumPaymentsAdminApiService,
    public ui: AdminPaymentsUiUtilsService,
  ) {}

  ngOnInit(): void {
    this.loadAllPayments();
  }

  loadAllPayments() {
    this.loadPremiumSummary();
    this.loadPendingPayments();
    this.loadApprovedPayments();
    this.loadRejectedPayments();
    this.loadRefundedPayments();
  }

  loadPremiumSummary() {
    const token = this.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.premiumPaymentsApi.getSummary(headers).subscribe({
      next: (res) => {
        const data = res?.data || {};
        this.premiumSummary = {
          received: Number(data.received || 0),
          pending: Number(data.pending || 0),
          rejected: Number(data.rejected || 0),
          refunded: Number(data.refunded || 0),
          netReceived: Number(data.netReceived || 0),
        };
      },
      error: () => {
        this.premiumSummary = {
          received: 0,
          pending: 0,
          rejected: 0,
          refunded: 0,
          netReceived: 0,
        };
      },
    });
  }

  loadPendingPayments() {
    this.loading = true;
    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      this.loading = false;
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.premiumPaymentsApi
      .listPending(this.currentPage, this.pageSize, headers)
      .subscribe({
        next: (data) => {
          this.pendingPayments = data.payments;
          this.totalPages = data.pages;
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage.emit(err?.error?.message || 'Failed to load pending payments');
          this.loading = false;
        },
      });
  }

  loadApprovedPayments() {
    const token = this.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.premiumPaymentsApi
      .listByStatus('approved', headers)
      .subscribe({
        next: (data) => {
          this.approvedPayments = Array.isArray(data?.payments) ? data.payments : [];
        },
        error: () => {
          this.approvedPayments = [];
        },
      });
  }

  loadRejectedPayments() {
    const token = this.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.premiumPaymentsApi
      .listByStatus('rejected', headers)
      .subscribe({
        next: (data) => {
          this.rejectedPayments = Array.isArray(data?.payments) ? data.payments : [];
        },
        error: () => {
          this.rejectedPayments = [];
        },
      });
  }

  loadRefundedPayments() {
    const token = this.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.premiumPaymentsApi
      .listByStatus('refunded', headers)
      .subscribe({
        next: (data) => {
          this.refundedPayments = Array.isArray(data?.payments) ? data.payments : [];
        },
        error: () => {
          this.refundedPayments = [];
        },
      });
  }

  approvePayment(payment: PremiumPayment) {
    if (!confirm(`Approve payment of ${this.ui.formatPremiumPaymentAmount(payment)} from ${this.ui.getUserDisplayName(payment)}?`)) return;

    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.premiumPaymentsApi.approvePayment(payment._id, headers).subscribe({
      next: (res) => {
        this.successMessage.emit(res.message || 'Payment approved successfully');
        this.loadAllPayments();
      },
      error: (err) => {
        this.errorMessage.emit(err?.error?.message || 'Failed to approve payment');
      },
    });
  }

  openRejectModal(payment: PremiumPayment) {
    this.selectedPaymentForReject = payment;
    this.rejectionReason = '';
    this.rejectionReasonError = '';
    this.showRejectModal = true;
  }

  closeRejectModal() {
    this.showRejectModal = false;
    this.selectedPaymentForReject = null;
    this.rejectionReason = '';
    this.rejectionReasonError = '';
  }

  rejectPayment() {
    if (!this.selectedPaymentForReject) return;
    this.rejectionReasonError = '';
    if (!this.rejectionReason.trim()) {
      this.rejectionReasonError = 'Please provide a rejection reason';
      return;
    }

    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.premiumPaymentsApi
      .rejectPayment(this.selectedPaymentForReject._id, this.rejectionReason, headers)
      .subscribe({
        next: (res) => {
          this.successMessage.emit(res.message || 'Payment rejected');
          this.closeRejectModal();
          this.loadAllPayments();
        },
        error: (err) => {
          this.errorMessage.emit(err?.error?.message || 'Failed to reject payment');
        },
      });
  }

  openRefundModal(payment: PremiumPayment) {
    this.selectedPaymentForRefund = payment;
    this.refundReason = '';
    this.refundReasonError = '';
    this.showRefundModal = true;
  }

  closeRefundModal() {
    this.showRefundModal = false;
    this.selectedPaymentForRefund = null;
    this.refundReason = '';
    this.refundReasonError = '';
  }

  refundPayment() {
    if (!this.selectedPaymentForRefund) return;
    this.refundReasonError = '';
    if (!this.refundReason.trim()) {
      this.refundReasonError = 'Please provide a refund reason';
      return;
    }

    const token = this.getToken();
    if (!token) {
      this.errorMessage.emit('Not authenticated');
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.premiumPaymentsApi
      .refundPayment(this.selectedPaymentForRefund._id, this.refundReason.trim(), headers)
      .subscribe({
        next: (res) => {
          this.successMessage.emit(res.message || 'Payment refunded');
          this.closeRefundModal();
          this.loadAllPayments();
        },
        error: (err) => {
          this.errorMessage.emit(err?.error?.message || 'Failed to refund payment');
        },
      });
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadPendingPayments();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadPendingPayments();
    }
  }

  private getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  setTab(tab: 'influencer' | 'brand' | 'photographer') {
    this.activeTab = tab;
    this.statusTab = 'pending';
  }

  private get currentUserType(): 'Influencer' | 'Brand' | 'Photographer' {
    if (this.activeTab === 'brand') return 'Brand';
    if (this.activeTab === 'photographer') return 'Photographer';
    return 'Influencer';
  }

  get filteredPayments(): PremiumPayment[] {
    const type = this.currentUserType;
    let rows: PremiumPayment[];
    if (this.statusTab === 'pending') rows = this.pendingPayments.filter((p) => p.userType === type);
    else if (this.statusTab === 'approved') rows = this.approvedPayments.filter((p) => p.userType === type);
    else if (this.statusTab === 'rejected') rows = this.rejectedPayments.filter((p) => p.userType === type);
    else rows = this.refundedPayments.filter((p) => p.userType === type);
    return this.sortPayments(this.filterByMode(rows));
  }

  private filterByMode(rows: PremiumPayment[]): PremiumPayment[] {
    if (this.modeFilter === 'all') return rows;
    return rows.filter((p) => {
      const gateway = String(p.gatewayProvider || 'manual_upi').toLowerCase();
      return this.modeFilter === 'razorpay' ? gateway === 'razorpay' : gateway !== 'razorpay';
    });
  }

  private sortPayments(rows: PremiumPayment[]): PremiumPayment[] {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (this.sortOption === 'amount_desc') return (b.amount || 0) - (a.amount || 0);
      if (this.sortOption === 'amount_asc') return (a.amount || 0) - (b.amount || 0);
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return this.sortOption === 'date_asc' ? aTime - bTime : bTime - aTime;
    });
    return sorted;
  }

  get pendingCount(): number {
    return this.pendingPayments.filter((p) => p.userType === this.currentUserType).length;
  }

  get approvedCount(): number {
    return this.approvedPayments.filter((p) => p.userType === this.currentUserType).length;
  }

  get rejectedCount(): number {
    return this.rejectedPayments.filter((p) => p.userType === this.currentUserType).length;
  }

  get refundedCount(): number {
    return this.refundedPayments.filter((p) => p.userType === this.currentUserType).length;
  }
}
