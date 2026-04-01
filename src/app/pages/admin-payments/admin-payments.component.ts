import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';

interface Payment {
  _id: string;
  userId: any;
  userType: 'Influencer' | 'Brand';
  transactionId: string;
  amount: number;
  premiumDuration: '1m' | '3m' | '1y';
  paymentMethod: 'upi' | 'qr';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  approvalNotes?: string;
}

interface PendingPaymentsResponse {
  payments: Payment[];
  total: number;
  page: number;
  pages: number;
}

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-payments.component.html',
  styleUrls: ['./admin-payments.component.scss'],
})
export class AdminPaymentsComponent implements OnInit {
  pendingPayments: Payment[] = [];
  approvedPayments: Payment[] = [];
  rejectedPayments: Payment[] = [];

  currentTab: 'pending' | 'approved' | 'rejected' = 'pending';
  loading = false;
  error = '';
  successMessage = '';

  rejectionReason = '';
  showRejectModal = false;
  selectedPaymentForReject: Payment | null = null;

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    this.loadPendingPayments();
  }

  loadPendingPayments() {
    this.loading = true;
    this.error = '';
    const token = this.getToken();
    if (!token) {
      this.error = 'Not authenticated';
      this.loading = false;
      return;
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http
      .get<PendingPaymentsResponse>(
        `${environment.apiBaseUrl}/payment/pending?page=${this.currentPage}&limit=${this.pageSize}`,
        { headers },
      )
      .subscribe({
        next: (data) => {
          this.pendingPayments = data.payments;
          this.totalPages = data.pages;
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.message || 'Failed to load pending payments';
          this.loading = false;
        },
      });
  }

  approvePayment(payment: Payment) {
    if (!confirm(`Approve payment of ₹${payment.amount} from ${payment.userId?.username}?`)) return;

    const token = this.getToken();
    if (!token) { this.error = 'Not authenticated'; return; }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http
      .patch(
        `${environment.apiBaseUrl}/payment/${payment._id}/approve`,
        {},
        { headers },
      )
      .subscribe({
        next: (res: any) => {
          this.successMessage = res.message || 'Payment approved successfully';
          this.loadPendingPayments();
          setTimeout(() => (this.successMessage = ''), 3000);
        },
        error: (err) => {
          this.error = err?.error?.message || 'Failed to approve payment';
        },
      });
  }

  openRejectModal(payment: Payment) {
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
      this.error = 'Please provide a rejection reason';
      return;
    }

    const token = this.getToken();
    if (!token) { this.error = 'Not authenticated'; return; }
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http
      .patch(
        `${environment.apiBaseUrl}/payment/${this.selectedPaymentForReject._id}/reject`,
        { reason: this.rejectionReason },
        { headers },
      )
      .subscribe({
        next: (res: any) => {
          this.successMessage = res.message || 'Payment rejected';
          this.closeRejectModal();
          this.loadPendingPayments();
          setTimeout(() => (this.successMessage = ''), 3000);
        },
        error: (err) => {
          this.error = err?.error?.message || 'Failed to reject payment';
        },
      });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
}
