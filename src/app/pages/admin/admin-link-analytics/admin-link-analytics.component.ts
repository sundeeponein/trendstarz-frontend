import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrackingLinksApiService, TrackingLinksAdminAnalytics } from '../../../shared/tracking-links/tracking-links-api.service';
import { campaignIdLabel } from '../../../shared/referral-link.util';

@Component({
  selector: 'app-admin-link-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-link-analytics.component.html',
  styleUrls: ['./admin-link-analytics.component.scss'],
})
export class AdminLinkAnalyticsComponent implements OnInit {
  loading = true;
  error = '';
  data: TrackingLinksAdminAnalytics | null = null;
  activeTab: 'top' | 'byCampaign' | 'zero' = 'top';

  /** Populated from the first (unfiltered) load and kept stable across filtered reloads. */
  campaignOptions: { id: string; label: string; title?: string }[] = [];
  selectedCampaignId = '';

  campaignSearchTerm = '';
  campaignDropdownOpen = false;

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
    const params: { campaignId?: string; limit: number } = { limit: 25 };
    if (this.selectedCampaignId) params.campaignId = this.selectedCampaignId;

    this.trackingLinksApi.getAdminAnalytics(params).subscribe({
      next: (res) => {
        this.data = res;
        if (!this.selectedCampaignId) {
          this.campaignOptions = res.perCampaign
            .map((row) => ({
              id: row.campaignId,
              label: campaignIdLabel({ campaignNumber: row.campaignNumber, _id: row.campaignId }),
              title: row.campaignTitle,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
        }
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

  campaignIdLabel(row: { campaignNumber?: number; campaignId: string }): string {
    return campaignIdLabel({ campaignNumber: row.campaignNumber, _id: row.campaignId });
  }

  campaignDisplayText(opt: { label: string; title?: string }): string {
    return opt.title ? `${opt.label} — ${opt.title}` : opt.label;
  }

  get filteredCampaignOptions(): { id: string; label: string; title?: string }[] {
    const q = this.campaignSearchTerm.trim().toLowerCase();
    if (!q) return this.campaignOptions;
    return this.campaignOptions.filter(
      (opt) => opt.label.toLowerCase().includes(q) || (opt.title || '').toLowerCase().includes(q),
    );
  }

  openCampaignDropdown(): void {
    this.campaignDropdownOpen = true;
  }

  closeCampaignDropdown(): void {
    this.campaignDropdownOpen = false;
  }

  selectCampaign(opt: { id: string; label: string; title?: string } | null): void {
    this.selectedCampaignId = opt?.id || '';
    this.campaignSearchTerm = opt ? this.campaignDisplayText(opt) : '';
    this.campaignDropdownOpen = false;
    this.load();
  }
}
