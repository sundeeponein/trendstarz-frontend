import { Component, OnInit } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardAlertBannerComponent } from '../../shared/dashboard-alert-banner/dashboard-alert-banner.component';

@Component({
  selector: 'app-influencer-dashboard',
  templateUrl: './influencer-dashboard.component.html',
  styleUrls: ['./influencer-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, JsonPipe, DashboardAlertBannerComponent]
})
export class InfluencerDashboardComponent implements OnInit {
  dashboard: any;
  invites: any[] = [];
  activeCampaigns: any[] = [];
  completedCampaigns: any[] = [];
  loading = true;
  error = '';
  profileIncomplete = false;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() {
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
