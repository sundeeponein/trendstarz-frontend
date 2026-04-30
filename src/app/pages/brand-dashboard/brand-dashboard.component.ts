  // ...existing imports and @Component...
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { ConfigService } from '../../shared/config.service';
import { PlansService, PlanCapabilities, FREE_CAPABILITIES } from '../../shared/plans.service';

@Component({
  selector: 'app-brand-dashboard',
  templateUrl: './brand-dashboard.component.html',
  styleUrls: ['./brand-dashboard.component.scss'],
  providers: [DashboardService],
  standalone: true,
  imports: [CommonModule, FormsModule]
})

export class BrandDashboardComponent implements OnInit, OnDestroy {
  stats = {
    totalCampaigns: 0,
    invitesSent: 0,
    accepted: 0,
    completed: 0,
  };
  dashboard: any;
  recentCampaigns: any[] = [];
  recommendedInfluencers: any[] = [
    // Example placeholder, replace with real data fetching logic as needed
    // { name: 'Influencer 1', category: 'Fashion', followers: 10000 },
    // { name: 'Influencer 2', category: 'Tech', followers: 5000 },
  ];
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
  planCaps: PlanCapabilities = FREE_CAPABILITIES;

  private routerSub: Subscription | undefined;
  private userSub: Subscription | undefined;
  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    private session: SessionService,
    private config: ConfigService,
    private plansService: PlansService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
        this.plansService.getMyCapabilities().subscribe((caps) => {
          this.planCaps = caps;
        });

        // Ensure user is loaded from storage on direct load/refresh
        if (!this.session.getUser()) {
          this.session.loadUserFromStorage();
        }
    // Check for email verification error in query params (if redirected from verification)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('emailVerificationError')) {
        this.emailVerificationError = params.get('emailVerificationError');
      }
    }
    // Only fetch profile and load dashboard once per user
    this.userSub = this.session.user$.subscribe(user => {
      if (user) {
        this.config.getBrandProfileById().subscribe((profile: any) => {
          const merged = { ...user, ...profile };
          const isSame = JSON.stringify(user) === JSON.stringify(merged);
          if (profile && !isSame) {
            this.session.setUser(merged);
          } else {
            this.loadDashboard();
          }
        }, err => {
          console.error('[BrandDashboard] Brand profile fetch error:', err);
          this.loadDashboard();
        });
        // Unsubscribe after first load to prevent repeated calls
        if (this.userSub) {
          this.userSub.unsubscribe();
        }
      }
    });
    // Removed router event subscription to prevent infinite reloads
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
        // Handle both direct and wrapped responses
        const dashboardData = data?.data || data;
        this.dashboard = dashboardData;
        // debug: received dashboard campaigns
        this.recentCampaigns = Array.isArray(dashboardData.campaigns) ? dashboardData.campaigns : [];
        this.recommendedInfluencers = dashboardData.recommendedInfluencers || [];
        // Calculate stats from campaigns
        this.stats.totalCampaigns = this.recentCampaigns.length;
        this.stats.invitesSent = this.recentCampaigns.reduce((sum, c) => sum + (c.invitesSent || 0), 0);
        this.stats.accepted = this.recentCampaigns.reduce((sum, c) => sum + (c.accepted || 0), 0);
        this.stats.completed = this.recentCampaigns.reduce((sum, c) => sum + (c.completed || 0), 0);
        const brand = dashboardData.brand || {};
        this.profileIncomplete = !brand.brandName || !brand.categories?.length || !brand.location?.state;
        this.loading = false;
        this.loadPaymentHistory();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load dashboard.';
        this.loading = false;
        this.cdr.detectChanges();
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

  get profileTraffic() {
    const traffic = this.dashboard?.brand?.profileTraffic || {};
    return {
      impressions: Number(traffic.impressions || 0),
      clicks: Number(traffic.clicks || 0),
      lastImpressionAt: traffic.lastImpressionAt || null,
      lastClickAt: traffic.lastClickAt || null,
    };
  }

  get isPremiumUser(): boolean {
    return !!this.dashboard?.brand?.isPremium;
  }

  get canViewProfileTraffic(): boolean {
    return this.plansService.getFeatureValue(this.planCaps, 'campaignAnalyticsDashboard');
  }
}
