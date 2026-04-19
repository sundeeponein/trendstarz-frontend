import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { ConfigService } from '../../shared/config.service';

@Component({
  selector: 'app-brand-dashboard',
  templateUrl: './brand-dashboard.component.html',
  styleUrls: ['./brand-dashboard.component.scss'],
  providers: [DashboardService],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class BrandDashboardComponent implements OnInit, OnDestroy {
  dashboard: any;
  recentCampaigns: any[] = [];
  recommendedInfluencers: any[] = [];
  loading = true;
  error = '';
  filters: { category: string; state: string } = { category: '', state: '' };
  categories: string[] = [];
  states: string[] = [];
  profileIncomplete = false;
  emailVerificationError: string | null = null;
  paymentHistory: any[] = [];
  paymentSummary = {
    spentThisMonth: 0,
    platformFeesPaid: 0,
    pendingPayouts: 0,
  };

  private routerSub: Subscription | undefined;
  private userSub: Subscription | undefined;
  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    private session: SessionService,
    private config: ConfigService
  ) {}

  ngOnInit(): void {
    // Check for email verification error in query params (if redirected from verification)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('emailVerificationError')) {
        this.emailVerificationError = params.get('emailVerificationError');
      }
    }
    // Always fetch latest profile before loading dashboard
    this.userSub = this.session.user$.subscribe(user => {
      if (user) {
        this.config.getBrandProfileById().subscribe((profile: any) => {
          if (profile) {
            this.session.setUser({ ...user, ...profile });
          }
          this.loadDashboard();
        });
      }
    });
    // Listen for route re-activation (e.g., clicking Dashboard again)
    this.routerSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd && event.urlAfterRedirects.includes('brand-dashboard')) {
        this.loadDashboard();
      }
    });
    // Load categories/states for filters (implement as needed)
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.userSub) this.userSub.unsubscribe();
  }

  loadDashboard() {
    this.loading = true;
    this.error = '';
    this.dashboardService.getBrandDashboard().subscribe({
      next: (data: any) => {
        this.dashboard = data;
        this.recentCampaigns = data.campaigns || [];
        const brand = data.brand || {};
        this.profileIncomplete = !brand.brandName || !brand.categories?.length || !brand.location?.state;
        this.loading = false;
        this.loadPaymentHistory();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load dashboard.';
        this.loading = false;
      }
    });
  }

  loadPaymentHistory() {
    this.config.getMyCampaignTransactions().subscribe({
      next: (rows: any[]) => {
        this.paymentHistory = rows;
        this.recomputePaymentSummary(rows);
      },
      error: () => {
        this.paymentHistory = [];
        this.recomputePaymentSummary([]);
      },
    });
  }

  private recomputePaymentSummary(rows: any[]) {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const isThisMonth = (d?: string) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt.getMonth() === month && dt.getFullYear() === year;
    };

    const spentThisMonth = rows
      .filter((r: any) => r.payerRole === 'brand' && isThisMonth(r.updatedAt || r.createdAt))
      .reduce((sum: number, r: any) => sum + Number(r.payerTotal || 0), 0);

    const platformFeesPaid = rows
      .filter((r: any) => r.payerRole === 'brand')
      .reduce((sum: number, r: any) => sum + Number(r.platformFee || 0), 0);

    const pendingPayouts = rows
      .filter((r: any) => r.recipientRole === 'brand' && (r.payoutStatus === 'pending' || r.payoutStatus === 'processing'))
      .reduce((sum: number, r: any) => sum + Number(r.recipientPayout || 0), 0);

    this.paymentSummary = { spentThisMonth, platformFeesPaid, pendingPayouts };
  }

  formatPaise(amount: number): string {
    return `₹${((amount || 0) / 100).toLocaleString('en-IN')}`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  onVerifyEmail() {
    if (typeof window !== 'undefined') {
      window.location.href = '/verify-email';
    }
  }

  onUpgrade() {
    if (typeof window !== 'undefined') {
      window.location.href = '/upgrade-premium';
    }
  }

  onCompleteProfile() {
    if (typeof window !== 'undefined') {
      window.location.href = '/brand-profile';
    }
  }

  searchInfluencers(): void {
    this.dashboardService.searchInfluencers(this.filters).subscribe((res: any[]) => {
      this.recommendedInfluencers = res;
    });
  }
}
