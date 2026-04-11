import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { ConfigService } from '../../shared/config.service';

@Component({
  selector: 'app-influencer-dashboard',
  templateUrl: './influencer-dashboard.component.html',
  styleUrls: ['./influencer-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class InfluencerDashboardComponent implements OnInit, OnDestroy {
  dashboard: any;
  invites: any[] = [];
  activeCampaigns: any[] = [];
  completedCampaigns: any[] = [];
  loading = true;
  error = '';
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

  ngOnInit() {
    // Check for email verification error in query params (if redirected from verification)
    const params = new URLSearchParams(window.location.search);
    if (params.get('emailVerificationError')) {
      this.emailVerificationError = params.get('emailVerificationError');
    }
    // Always fetch latest profile before loading dashboard
    this.userSub = this.session.user$.subscribe(user => {
      if (user) {
        this.config.getInfluencerProfileById().subscribe((profile: any) => {
          if (profile) {
            this.session.setUser({ ...user, ...profile });
          }
          this.loadDashboard();
        });
      }
    });
    // Listen for route re-activation (e.g., clicking Dashboard again)
    this.routerSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd && event.urlAfterRedirects.includes('influencer-dashboard')) {
        this.loadDashboard();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.userSub) this.userSub.unsubscribe();
  }

  loadDashboard() {
    this.loading = true;
    this.error = '';
    this.dashboardService.getInfluencerDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.invites = data.invites?.newInvites || [];
        this.activeCampaigns = data.activeCampaigns || [];
        this.completedCampaigns = data.completedCampaigns || [];
        // Profile completeness logic: check for missing required fields
        const user = data.user || {};
        this.profileIncomplete = !user.name || !user.categories?.length || !user.socialMedia?.length || !user.location?.state;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load dashboard.';
        this.loading = false;
      }
    });
  }

  respondToInvite(inviteId: string, status: 'accepted' | 'declined') {
    this.dashboardService.respondToInvite(inviteId, status).subscribe(() => {
      this.ngOnInit();
    });
  }

  onVerifyEmail() {
    // Navigate to verify email page
    window.location.href = '/verify-email';
  }

  onUpgrade() {
    // Navigate to upgrade premium page
    window.location.href = '/upgrade-premium';
  }

  onCompleteProfile() {
    // Navigate to influencer profile page
    window.location.href = '/influencer-profile';
  }

  submitContent(inviteId: string) {
    // Implement navigation to submission page or modal
  }
}
