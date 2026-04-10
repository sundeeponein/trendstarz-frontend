import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-brand-dashboard',
  templateUrl: './brand-dashboard.component.html',
  styleUrls: ['./brand-dashboard.component.css'],
  providers: [DashboardService],
  standalone: true,
  imports: [CommonModule, FormsModule]
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

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.getBrandDashboard().subscribe({
      next: (data: any) => {
        this.dashboard = data;
        this.recentCampaigns = data.campaigns || [];
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load dashboard.';
        this.loading = false;
      }
    });
    // Load categories/states for filters (implement as needed)
  }

  searchInfluencers(): void {
    this.dashboardService.searchInfluencers(this.filters).subscribe((res: any[]) => {
      this.recommendedInfluencers = res;
    });
  }
}
