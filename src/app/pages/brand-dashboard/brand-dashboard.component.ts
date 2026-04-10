import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardAlertBannerComponent } from '../../shared/dashboard-alert-banner/dashboard-alert-banner.component';

@Component({
  selector: 'app-brand-dashboard',
  templateUrl: './brand-dashboard.component.html',
  styleUrls: ['./brand-dashboard.component.css'],
  providers: [DashboardService],
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardAlertBannerComponent]
})
export class BrandDashboardComponent implements OnInit {
  dashboard: any;
  recentCampaigns: any[] = [];
  recommendedInfluencers: any[] = [];
  loading = true;
  error = '';
  filters: { category: string; state: string } = { category: '', state: '' };
  categories: string[] = [];
  states: string[] = [];
  profileIncomplete = false;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.getBrandDashboard().subscribe({
      next: (data: any) => {
        this.dashboard = data;
        this.recentCampaigns = data.campaigns || [];
        // Profile completeness logic: check for missing required fields
        const brand = data.brand || {};
        this.profileIncomplete = !brand.brandName || !brand.categories?.length || !brand.location?.state;
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load dashboard.';
        this.loading = false;
      }
    });
    // Load categories/states for filters (implement as needed)
  }
  onVerifyEmail() {
    window.location.href = '/verify-email';
  }

  onUpgrade() {
    window.location.href = '/upgrade-premium';
  }

  onCompleteProfile() {
    window.location.href = '/brand-profile';
  }

  searchInfluencers(): void {
    this.dashboardService.searchInfluencers(this.filters).subscribe((res: any[]) => {
      this.recommendedInfluencers = res;
    });
  }
}
