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
  styleUrls: ['./brand-dashboard.component.css'],
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
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load dashboard.';
        this.loading = false;
      }
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
