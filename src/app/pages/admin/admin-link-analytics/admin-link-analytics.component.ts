import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrackingLinksApiService, TrackingLinksAdminAnalytics } from '../../../shared/tracking-links/tracking-links-api.service';

@Component({
  selector: 'app-admin-link-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-link-analytics.component.html',
  styleUrls: ['./admin-link-analytics.component.scss'],
})
export class AdminLinkAnalyticsComponent implements OnInit {
  loading = true;
  error = '';
  data: TrackingLinksAdminAnalytics | null = null;

  constructor(
    private trackingLinksApi: TrackingLinksApiService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.trackingLinksApi.getAdminAnalytics({ limit: 25 }).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load link analytics.';
        this.loading = false;
        this.cd.detectChanges();
      },
    });
  }

  formatDate(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleString() : '—';
  }
}
