import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformServer } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { CampaignDetailModalComponent } from '../../../shared/campaign-detail-modal/campaign-detail-modal.component';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../shared/toast/toast.service';

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
  isSubmittingModeration = false;
  campaignApprovalMode: 'manual' | 'auto_live' = 'manual';
  selectedCampaign: any | null = null;
  showModerationModal = false;
  moderationTargetCampaign: any | null = null;
  moderationAction: 'approve' | 'reject' | 'needs_changes' = 'needs_changes';
  moderationNoteInput = '';
  moderationModalError = '';

  private readonly isServer: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
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

  private hasInfluencerProgress(campaign: any): boolean {
    return !!campaign?.hasInfluencerProgress;
  }

  canApproveCampaign(campaign: any): boolean {
    return this.campaignApprovalMode === 'manual' && this.isPendingCampaign(campaign);
  }

  canRequestChangesCampaign(campaign: any): boolean {
    if (this.campaignApprovalMode === 'manual') {
      return this.isPendingCampaign(campaign);
    }
    return this.isActiveCampaign(campaign) && !this.hasInfluencerProgress(campaign);
  }

  canRejectCampaign(campaign: any): boolean {
    if (this.campaignApprovalMode === 'manual') {
      return this.isPendingCampaign(campaign);
    }
    return this.isActiveCampaign(campaign) && !this.hasInfluencerProgress(campaign);
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

  private moderateCampaign(campaign: any, action: 'approve' | 'reject' | 'needs_changes', moderationNote = '') {
    if (!campaign?._id) return;
    const note = String(moderationNote || '').trim();
    this.moderatingCampaignId = String(campaign._id);
    this.isSubmittingModeration = true;
    this.cdr.detectChanges();
    this.http.patch<any>(`${environment.apiBaseUrl}/admin/campaigns/${campaign._id}/moderation`, {
      action,
      moderationNote: note,
    }, this.getAuthHeaders()).subscribe({
      next: () => {
        this.isSubmittingModeration = false;
        this.moderatingCampaignId = '';
        const labels: Record<string, string> = {
          approve: 'Campaign approved successfully.',
          needs_changes: 'Needs Changes sent to brand.',
          reject: 'Campaign rejected.',
        };
        this.closeModerationModal();
        this.closeCampaignPreview();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.toast.success(labels[action] ?? 'Campaign updated.');
          this.loadCampaignApprovals();
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        this.isSubmittingModeration = false;
        this.moderatingCampaignId = '';
        const msg = err?.error?.message || 'Failed to update campaign moderation status.';
        this.moderationModalError = msg;
        this.cdr.detectChanges();
        this.toast.error(msg);
      },
    });
  }

  openModerationModal(campaign: any, action: 'approve' | 'reject' | 'needs_changes') {
    if (!campaign?._id) return;
    this.moderationTargetCampaign = campaign;
    this.moderationAction = action;
    this.moderationModalError = '';
    const existing = String(campaign?.moderationNote || '').trim();
    this.moderationNoteInput = action === 'approve' ? '' : existing;
    this.showModerationModal = true;
  }

  closeModerationModal() {
    this.showModerationModal = false;
    this.moderationTargetCampaign = null;
    this.moderationAction = 'needs_changes';
    this.moderationNoteInput = '';
    this.moderationModalError = '';
  }

  get moderationModalTitle(): string {
    if (this.moderationAction === 'needs_changes') return 'Request Changes';
    if (this.moderationAction === 'reject') return 'Reject Campaign';
    return 'Approve Campaign';
  }

  get moderationModalPrimaryText(): string {
    if (this.moderationAction === 'needs_changes') return 'Send To Brand';
    if (this.moderationAction === 'reject') return 'Reject Campaign';
    return 'Approve Campaign';
  }

  get moderationModalNoteLabel(): string {
    if (this.moderationAction === 'needs_changes') return 'Message for brand';
    if (this.moderationAction === 'reject') return 'Reason (optional)';
    return 'Comment (optional)';
  }

  get moderationModalHelpText(): string {
    if (this.moderationAction === 'needs_changes') {
      return 'This comment is visible to the brand in Drafts so they know what to fix.';
    }
    if (this.moderationAction === 'reject') {
      return 'Share the reason so the brand understands why it was rejected.';
    }
    return 'Optional note for audit context.';
  }

  get isModerationNoteRequired(): boolean {
    return this.moderationAction === 'needs_changes';
  }

  submitModerationFromModal() {
    const campaign = this.moderationTargetCampaign;
    if (!campaign?._id || this.isSubmittingModeration) return;

    const note = String(this.moderationNoteInput || '').trim();
    if (this.isModerationNoteRequired && !note) {
      this.moderationModalError = 'Please add a message for the brand before sending Needs Changes.';
      return;
    }

    this.moderationModalError = '';
    this.moderateCampaign(campaign, this.moderationAction, note);
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