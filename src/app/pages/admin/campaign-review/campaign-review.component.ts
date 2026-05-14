import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformServer } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { CampaignDetailModalComponent } from '../../../shared/campaign-detail-modal/campaign-detail-modal.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-campaign-review',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CampaignDetailModalComponent],
  templateUrl: './campaign-review.component.html',
  styleUrls: ['./campaign-review.component.scss'],
})
export class CampaignReviewComponent implements OnInit {
  readonly statusTabs: Array<{
    key: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'all';
    label: string;
  }> = [
    { key: 'pending_review', label: 'Pending Review' },
    { key: 'needs_changes', label: 'Needs Changes' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'active', label: 'Approved / Live' },
    { key: 'all', label: 'All' },
  ];
  campaignApprovalStatusFilter: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'all' = 'pending_review';
  campaignFiltersExpanded = true;
  allCampaignApprovals: any[] = [];
  campaignApprovalsLoading = false;
  campaignApprovalsError = '';
  moderatingCampaignId = '';
  campaignApprovalMode: 'manual' | 'auto_live' = 'manual';
  selectedCampaign: any | null = null;

  private readonly isServer: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object,
    private cdr: ChangeDetectorRef,
  ) {
    this.isServer = isPlatformServer(platformId);
  }

  ngOnInit() {
    if (this.isServer) return;
    this.campaignFiltersExpanded = window.innerWidth >= 768;
    this.loadApprovalMode();
    this.loadCampaignApprovals();
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  private getAuthHeaders() {
    const token = this.getToken();
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  loadApprovalMode() {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/settings`, this.getAuthHeaders()).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        this.campaignApprovalMode = data?.campaignApprovalMode === 'auto_live' ? 'auto_live' : 'manual';
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  loadCampaignApprovals() {
    this.campaignApprovalsLoading = true;
    this.campaignApprovalsError = '';
    this.http.get<any>(`${environment.apiBaseUrl}/admin/campaigns?status=all`, this.getAuthHeaders()).subscribe({
      next: (res) => {
        const data = res?.data ?? [];
        this.allCampaignApprovals = Array.isArray(data) ? data : [];
        this.campaignApprovalsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.campaignApprovalsLoading = false;
        this.campaignApprovalsError = err?.error?.message || 'Failed to load campaign approvals.';
        this.cdr.detectChanges();
      },
    });
  }

  get campaignApprovals(): any[] {
    if (this.campaignApprovalStatusFilter === 'all') {
      return this.allCampaignApprovals;
    }
    return this.allCampaignApprovals.filter((campaign) => String(campaign?.status || '').toLowerCase() === this.campaignApprovalStatusFilter);
  }

  private isPendingCampaign(campaign: any): boolean {
    const status = String(campaign?.status || '').toLowerCase();
    return status === 'pending_review' || status === 'pending';
  }

  private isActiveCampaign(campaign: any): boolean {
    const status = String(campaign?.status || '').toLowerCase();
    return status === 'active';
  }

  canApproveCampaign(campaign: any): boolean {
    return this.campaignApprovalMode === 'manual' && this.isPendingCampaign(campaign);
  }

  canRequestChangesCampaign(campaign: any): boolean {
    if (this.campaignApprovalMode === 'manual') {
      return this.isPendingCampaign(campaign);
    }
    return this.isActiveCampaign(campaign);
  }

  canRejectCampaign(campaign: any): boolean {
    if (this.campaignApprovalMode === 'manual') {
      return this.isPendingCampaign(campaign);
    }
    return this.isActiveCampaign(campaign);
  }

  canModerateCampaign(campaign: any): boolean {
    return this.canApproveCampaign(campaign) || this.canRequestChangesCampaign(campaign) || this.canRejectCampaign(campaign);
  }

  setStatusTab(status: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'all') {
    if (this.campaignApprovalStatusFilter === status) return;
    this.campaignApprovalStatusFilter = status;
  }

  getStatusCount(status: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'all'): number {
    if (status === 'all') return this.allCampaignApprovals.length;
    return this.allCampaignApprovals.filter((campaign) => String(campaign?.status || '').toLowerCase() === status).length;
  }

  onCampaignApprovalFilterChange() {
    this.cdr.detectChanges();
  }

  toggleCampaignFilters() {
    this.campaignFiltersExpanded = !this.campaignFiltersExpanded;
  }

  resetCampaignApprovalFilters() {
    this.campaignApprovalStatusFilter = 'pending_review';
    this.cdr.detectChanges();
  }

  moderateCampaign(campaign: any, action: 'approve' | 'reject' | 'needs_changes') {
    if (!campaign?._id) return;
    const note = prompt('Optional moderation note for brand (shown in campaign status):', campaign?.moderationNote || '') ?? '';
    this.moderatingCampaignId = String(campaign._id);
    this.http.patch<any>(`${environment.apiBaseUrl}/admin/campaigns/${campaign._id}/moderation`, {
      action,
      moderationNote: note,
    }, this.getAuthHeaders()).subscribe({
      next: () => {
        this.moderatingCampaignId = '';
        this.closeCampaignPreview();
        this.loadCampaignApprovals();
      },
      error: (err) => {
        this.moderatingCampaignId = '';
        alert(err?.error?.message || 'Failed to update campaign moderation status.');
        this.cdr.detectChanges();
      },
    });
  }

  openCampaignPreview(campaign: any) {
    this.selectedCampaign = campaign;
  }

  closeCampaignPreview() {
    this.selectedCampaign = null;
  }

  campaignPreviewTitle(campaign: any): string {
    return campaign?.title || campaign?.campaignTitle || 'Untitled campaign';
  }

  campaignPreviewDescription(campaign: any): string {
    return (campaign?.description || campaign?.campaignDescription || '').trim() || 'No campaign description provided.';
  }

  campaignPreviewBudget(campaign: any): string {
    const min = Number(campaign?.budgetMin ?? campaign?.budget ?? 0);
    const max = Number(campaign?.budgetMax ?? campaign?.budget ?? min);
    if (!min && !max) {
      const perInfluencer = Number(campaign?.pricePerInfluencer || 0);
      if (perInfluencer > 0) return `₹${Math.floor(perInfluencer / 100).toLocaleString('en-IN')}`;
      return 'Not specified';
    }
    if (min === max) return `₹${min.toLocaleString('en-IN')}`;
    return `₹${min.toLocaleString('en-IN')} — ₹${max.toLocaleString('en-IN')}`;
  }

  campaignPreviewUpdated(campaign: any): string {
    const updated = campaign?.updatedAt || campaign?.createdAt;
    return updated ? new Date(updated).toLocaleString() : 'Unknown';
  }

  campaignPreviewBrand(campaign: any): string {
    return campaign?.brand?.brandName || campaign?.brand?.name || campaign?.brand?.brandUsername || '-';
  }

  campaignPreviewBrandEmail(campaign: any): string {
    return campaign?.brand?.email || '-';
  }

  campaignPreviewType(campaign: any): string {
    return campaign?.campaignType || 'Campaign';
  }

  get selectedCampaignInvite(): any | null {
    if (!this.selectedCampaign) return null;
    return {
      _id: this.selectedCampaign._id || 'campaign-review',
      status: this.selectedCampaign.status || 'pending_review',
      campaign: this.selectedCampaign,
      brand: this.selectedCampaign.brand || this.selectedCampaign.brandId || null,
    };
  }

  get selectedCampaignCanModerate(): boolean {
    return this.canModerateCampaign(this.selectedCampaign);
  }

  get selectedCampaignCanApprove(): boolean {
    return this.canApproveCampaign(this.selectedCampaign);
  }

  get selectedCampaignCanRequestChanges(): boolean {
    return this.canRequestChangesCampaign(this.selectedCampaign);
  }

  get selectedCampaignCanReject(): boolean {
    return this.canRejectCampaign(this.selectedCampaign);
  }

  campaignStatusLabel(status: string): string {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'pending_review' || normalized === 'pending') return 'Pending Review';
    if (normalized === 'needs_changes') return 'Needs Changes';
    if (normalized === 'active') return 'Approved / Live';
    if (normalized === 'rejected') return 'Rejected';
    if (normalized === 'all') return 'All';
    if (normalized === 'draft') return 'Draft';
    if (normalized === 'completed') return 'Completed';
    return status || 'Unknown';
  }
}