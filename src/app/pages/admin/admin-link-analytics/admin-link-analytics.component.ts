import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrackingLinksApiService, TrackingLinksAdminAnalytics } from '../../../shared/tracking-links/tracking-links-api.service';
import { campaignIdLabel } from '../../../shared/referral-link.util';
import { AppPaginatorComponent } from '../../../shared/components/app-paginator/app-paginator.component';

/** Rows fetched per list; the tables page through them (the server caps at 1000). */
const ROWS_PER_LIST = 1000;

type CampaignOption = { id: string; label: string; title?: string };

@Component({
  selector: 'app-admin-link-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, AppPaginatorComponent],
  templateUrl: './admin-link-analytics.component.html',
  styleUrls: ['./admin-link-analytics.component.scss'],
})
export class AdminLinkAnalyticsComponent implements OnInit {
  loading = true;
  error = '';
  data: TrackingLinksAdminAnalytics | null = null;
  activeTab: 'top' | 'byCampaign' | 'zero' | 'referral' = 'top';
  referralSubTab: 'campaign' | 'user' = 'campaign';

  /** Populated from the first (unfiltered) load and kept stable across filtered reloads. */
  campaignOptions: CampaignOption[] = [];
  selectedCampaignId = '';
  /** Display text of the applied filter ('' = all campaigns). */
  selectedCampaignText = '';
  /** Shown next to the filter when the typed text didn't match a campaign. */
  filterNotice = '';

  campaignSearchTerm = '';
  campaignDropdownOpen = false;

  readonly pageSizeOptions = [10, 25, 50, 100];
  pageSize = 25;
  private pages: Record<string, number> = {};

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
    this.pages = {};
    const params: { campaignId?: string; limit: number } = { limit: ROWS_PER_LIST };
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

  /** Amounts are stored in paise. */
  formatRevenue(paise: number | null | undefined): string {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  formatPercent(rate: number | null | undefined): string {
    return `${((rate || 0) * 100).toFixed(1)}%`;
  }

  campaignIdLabel(row: { campaignNumber?: number; campaignId: string }): string {
    return campaignIdLabel({ campaignNumber: row.campaignNumber, _id: row.campaignId });
  }

  campaignDisplayText(opt: { label: string; title?: string }): string {
    return opt.title ? `${opt.label} — ${opt.title}` : opt.label;
  }

  // ── Pagination (client-side, per list) ──

  pageOf(key: string): number {
    return this.pages[key] || 1;
  }

  pageRows<T>(rows: T[], key: string): T[] {
    const start = (this.pageOf(key) - 1) * this.pageSize;
    return rows.slice(start, start + this.pageSize);
  }

  setPage(key: string, page: number): void {
    this.pages = { ...this.pages, [key]: page };
    this.cd.detectChanges();
  }

  setPageSize(size: number): void {
    this.pageSize = size;
    this.pages = {};
    this.cd.detectChanges();
  }

  get filteredCampaignOptions(): CampaignOption[] {
    const q = this.campaignSearchTerm.trim().toLowerCase();
    if (!q) return this.campaignOptions;
    return this.campaignOptions.filter(
      (opt) => opt.label.toLowerCase().includes(q) || (opt.title || '').toLowerCase().includes(q),
    );
  }

  openCampaignDropdown(): void {
    this.campaignDropdownOpen = true;
  }

  /**
   * Leaving the box without picking a campaign: typed text is not a filter, so put
   * the box back to what is actually applied and say why nothing changed.
   */
  closeCampaignDropdown(): void {
    this.campaignDropdownOpen = false;
    const typed = this.campaignSearchTerm.trim();
    if (typed && typed !== this.selectedCampaignText) {
      this.filterNotice = this.filteredCampaignOptions.length
        ? `"${typed}" wasn't selected — pick it from the list.`
        : `No campaign with tracked links matches "${typed}".`;
    } else {
      this.filterNotice = '';
    }
    this.campaignSearchTerm = this.selectedCampaignText;
  }

  /** Enter in the box applies the first matching campaign. */
  selectFirstMatch(): void {
    const typed = this.campaignSearchTerm.trim();
    if (!typed) {
      this.selectCampaign(null);
      return;
    }
    const [first] = this.filteredCampaignOptions;
    if (first) this.selectCampaign(first);
    else this.closeCampaignDropdown();
  }

  selectCampaign(opt: CampaignOption | null): void {
    this.selectedCampaignId = opt?.id || '';
    this.selectedCampaignText = opt ? this.campaignDisplayText(opt) : '';
    this.campaignSearchTerm = this.selectedCampaignText;
    this.campaignDropdownOpen = false;
    this.filterNotice = '';
    this.load();
  }
}
