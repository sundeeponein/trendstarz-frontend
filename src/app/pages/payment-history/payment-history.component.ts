import { Component, OnInit, PLATFORM_ID, Inject, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { timeout } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SessionService } from '../../core/session.service';
import { WarmupService } from '../../core/warmup.service';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payment-history.component.html',
  styleUrls: ['./payment-history.component.scss'],
})
export class PaymentHistoryComponent implements OnInit, OnDestroy {
  /** Class-level cache — survives component re-creation across navigations */
  private static cache: any[] | null = null;

  private paymentSub?: Subscription;
  payments: any[] = [];
  loading = false;
  error = '';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object,
    public session: SessionService,
    private warmup: WarmupService
  ) {}

  ngOnInit() {
    // Show cached data immediately so returning users see results at once
    if (PaymentHistoryComponent.cache) {
      this.payments = PaymentHistoryComponent.cache;
    }
    // Wait for backend to be warm before firing the payment request
    this.warmup.ready.then(() => this.loadPayments());
  }

  loadPayments() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = localStorage.getItem('token');
    if (!token) {
      this.error = 'Please log in to view payment history.';
      return;
    }

    this.loading = true;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    if (this.paymentSub) {
      this.paymentSub.unsubscribe();
    }
    this.paymentSub = this.http
      .get<any>(`${environment.apiBaseUrl}/payment/my?limit=50`, { headers })
      .pipe(timeout(45000)) // 45s to accommodate Railway cold starts
      .subscribe({
        next: (res) => {
          const d = res?.data || res;
          this.payments = Array.isArray(d?.payments) ? d.payments : Array.isArray(d) ? d : [];
          PaymentHistoryComponent.cache = this.payments;
          this.loading = false;
        },
        error: (err) => {
          if (err.name === 'TimeoutError') {
            this.error = 'Request timed out. Please try again.';
          } else {
            this.error = 'Failed to load payment history.';
          }
          this.loading = false;
        },
      });
  }

  ngOnDestroy() {
    if (this.paymentSub) {
      this.paymentSub.unsubscribe();
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      case 'pending': return 'status-pending';
      default: return '';
    }
  }

  getDurationLabel(d: string): string {
    switch (d) {
      case '1m': return '1 Month';
      case '3m': return '3 Months';
      case '1y': return '1 Year';
      default: return d;
    }
  }
}
