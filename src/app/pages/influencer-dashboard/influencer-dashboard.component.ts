import { Component, OnInit } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-influencer-dashboard',
  templateUrl: './influencer-dashboard.component.html',
  styleUrls: ['./influencer-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, JsonPipe]
})
export class InfluencerDashboardComponent implements OnInit {
  dashboard: any;
  invites: any[] = [];
  activeCampaigns: any[] = [];
  completedCampaigns: any[] = [];
  loading = true;
  error = '';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() {
    this.dashboardService.getInfluencerDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.invites = data.invites?.newInvites || [];
        this.activeCampaigns = data.activeCampaigns || [];
        this.completedCampaigns = data.completedCampaigns || [];
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

  submitContent(inviteId: string) {
    // Implement navigation to submission page or modal
  }
}
