import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { Component, EventEmitter, Inject, OnInit, Output, PLATFORM_ID } from '@angular/core';
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

  activeTab: 'influencer' | 'brand' = 'influencer';
  statusTab: 'pending' | 'approved' | 'rejected' = 'pending';
  loading = false;

  rejectionReason = '';
  showRejectModal = false;
  selectedPaymentForReject: PremiumPayment | null = null;

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(
    private premiumPaymentsApi: PremiumPaymentsAdminApiService,
    public ui: AdminPaymentsUiUtilsService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    this.loadAllPayments();
  }

  loadAllPayments() {
    this.loadPendingPayments();
    this.loadApprovedPayments();
    this.loadRejectedPayments();
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

  approvePayment(payment: PremiumPayment) {
    if (!confirm(`Approve payment of ₹${payment.amount} from ${this.ui.getUserDisplayName(payment)}?`)) return;

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
    this.showRejectModal = true;
  }

  closeRejectModal() {
    this.showRejectModal = false;
    this.selectedPaymentForReject = null;
    this.rejectionReason = '';
  }

  rejectPayment() {
    if (!this.selectedPaymentForReject) return;
    if (!this.rejectionReason.trim()) {
      this.errorMessage.emit('Please provide a rejection reason');
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
    return isPlatformBrowser(this.platformId) ? localStorage.getItem('token') : null;
  }

  setTab(tab: 'influencer' | 'brand') {
    this.activeTab = tab;
    this.statusTab = 'pending';
  }

  private get currentUserType(): 'Influencer' | 'Brand' {
    return this.activeTab === 'influencer' ? 'Influencer' : 'Brand';
  }

  get filteredPayments(): PremiumPayment[] {
    const type = this.currentUserType;
    if (this.statusTab === 'pending') return this.pendingPayments.filter((p) => p.userType === type);
    if (this.statusTab === 'approved') return this.approvedPayments.filter((p) => p.userType === type);
    return this.rejectedPayments.filter((p) => p.userType === type);
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
}
