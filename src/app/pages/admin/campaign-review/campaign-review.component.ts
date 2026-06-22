import { ChangeDetectorRef, Component, ElementRef, HostListener, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformServer } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { catchError, map, of, forkJoin, Observable } from 'rxjs';
import { CampaignDetailModalComponent } from '../../../shared/campaign-detail-modal/campaign-detail-modal.component';
import { CampaignAlertMessageComponent } from '../../../shared/campaign-alert-message/campaign-alert-message.component';
import { AppPaginatorComponent } from '../../../shared/components/app-paginator/app-paginator.component';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'app-campaign-review',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CampaignDetailModalComponent, CampaignAlertMessageComponent, AppPaginatorComponent],
  templateUrl: './campaign-review.component.html',
  styleUrls: ['./campaign-review.component.scss'],
})
export class CampaignReviewComponent implements OnInit {
  readonly statusTabs: Array<{
    key: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'completed' | 'all';
    label: string;
  }> = [
    { key: 'pending_review', label: 'Pending Review' },
    { key: 'needs_changes', label: 'Needs Changes' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'active', label: 'Approved / Live' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ];
  campaignApprovalStatusFilter: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'completed' | 'all' = 'pending_review';
  campaignFiltersExpanded = true;
  allCampaignApprovals: any[] = [];
  campaignApprovalsLoading = false;
  campaignApprovalsError = '';
  moderatingCampaignId = '';
  isSubmittingModeration = false;
  campaignApprovalMode: 'manual' | 'auto_live' = 'manual';
  collaborationApprovalMode: 'manual' | 'auto_live' = 'manual';
  searchQuery = '';
  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions = [10, 25, 50, 100];

  // Date range filter (applies to the campaign's submitted date, i.e. createdAt/updatedAt)
  dateFilterOpen = false;
  dateFrom = '';
  dateTo = '';
  appliedDateFrom = '';
  appliedDateTo = '';

  selectedCampaign: any | null = null;
  selectedCampaignPreviewInvite: any | null = null;
  selectedCampaignInviteProgressLoading = false;
  showModerationModal = false;
  moderationTargetCampaign: any | null = null;
  moderationAction: 'approve' | 'reject' | 'needs_changes' = 'needs_changes';
  moderationNoteInput = '';
  moderationModalError = '';
  approvedCampaignAlert: any | null = null;
  alertMessageCopied = false;

  private readonly isServer: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private router: Router,
    private elRef: ElementRef<HTMLElement>,
  ) {
    this.isServer = isPlatformServer(platformId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.dateFilterOpen) return;
    const wrap = this.elRef.nativeElement.querySelector('.cm-date-filter-wrap');
    if (wrap && !wrap.contains(event.target as Node)) {
      this.closeDateFilter();
    }
  }

  ngOnInit() {
    if (this.isServer) return;
    this.campaignFiltersExpanded = window.innerWidth >= 768;
    this.loadApprovalMode();
    this.loadCampaignApprovals();
  }

  get reviewScope(): 'campaign' | 'collaboration' {
    const url = String(this.router.url || '');
    return url.includes('/admin/collaboration-review') ? 'collaboration' : 'campaign';
  }

  get isCollaborationScope(): boolean {
    return this.reviewScope === 'collaboration';
  }

  get queueTitle(): string {
    return this.isCollaborationScope ? 'Collaboration Approval Queue' : 'Campaign Approval Queue';
  }

  get pageTitle(): string {
    return this.isCollaborationScope ? 'Collaboration Review' : 'Campaign Review';
  }

  get pageSubtitle(): string {
    return this.isCollaborationScope
      ? 'Approve, reject, or request changes for collaborations submitted by photographers.'
      : 'Approve, reject, or request changes for campaigns submitted by brands.';
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
        this.collaborationApprovalMode = data?.collaborationApprovalMode === 'auto_live' ? 'auto_live' : 'manual';
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  loadCampaignApprovals() {
    this.campaignApprovalsLoading = true;
    this.campaignApprovalsError = '';
    const ownerType = this.isCollaborationScope ? 'photographer' : 'brand';
    this.http.get<any>(`${environment.apiBaseUrl}/admin/campaigns?status=all&ownerType=${ownerType}`, this.getAuthHeaders()).subscribe({
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

  get totalCampaignCount(): number { return this.allCampaignApprovals.length; }

  get newPendingCount(): number {
    const cutoff = Date.now() - 86400000;
    return this.allCampaignApprovals.filter(c =>
      this.matchesStatusFilter(c, 'pending_review') &&
      new Date(c.createdAt || 0).getTime() > cutoff
    ).length;
  }

  get filteredCampaigns(): any[] {
    let list = this.campaignApprovalStatusFilter === 'all'
      ? this.allCampaignApprovals
      : this.allCampaignApprovals.filter(c => this.matchesStatusFilter(c, this.campaignApprovalStatusFilter));

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(c => {
        const title = String(c.title || c.campaignTitle || '').toLowerCase();
        const brand = String(c.brand?.brandName || c.brand?.name || '').toLowerCase();
        const id = this.campaignIdLabel(c).toLowerCase();
        return title.includes(q) || brand.includes(q) || id.includes(q);
      });
    }

    if (this.appliedDateFrom || this.appliedDateTo) {
      const from = this.appliedDateFrom ? new Date(`${this.appliedDateFrom}T00:00:00`) : null;
      const to = this.appliedDateTo ? new Date(`${this.appliedDateTo}T23:59:59.999`) : null;
      list = list.filter(c => {
        const submitted = this.campaignSubmittedDateValue(c);
        if (!submitted) return false;
        if (from && submitted < from) return false;
        if (to && submitted > to) return false;
        return true;
      });
    }
    return list;
  }

  get campaignApprovals(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCampaigns.slice(start, start + this.pageSize);
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredCampaigns.length / this.pageSize)); }
  get paginationStart(): number { return this.filteredCampaigns.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1; }
  get paginationEnd(): number { return Math.min(this.currentPage * this.pageSize, this.filteredCampaigns.length); }

  prevPage() { if (this.currentPage > 1) this.currentPage--; }
  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  onPageChange(page: number): void { this.currentPage = page; }
  onPageSizeChange(size: number): void { this.pageSize = size; this.currentPage = 1; }

  onSearchChange() { this.currentPage = 1; this.cdr.detectChanges(); }

  get hasDateFilter(): boolean { return !!(this.appliedDateFrom || this.appliedDateTo); }

  toggleDateFilter(): void {
    if (!this.dateFilterOpen) {
      this.dateFrom = this.appliedDateFrom;
      this.dateTo = this.appliedDateTo;
    }
    this.dateFilterOpen = !this.dateFilterOpen;
  }

  closeDateFilter(): void { this.dateFilterOpen = false; }

  applyDateFilter(): void {
    this.appliedDateFrom = this.dateFrom;
    this.appliedDateTo = this.dateTo;
    this.currentPage = 1;
    this.dateFilterOpen = false;
    this.cdr.detectChanges();
  }

  clearDateFilter(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.appliedDateFrom = '';
    this.appliedDateTo = '';
    this.currentPage = 1;
    this.dateFilterOpen = false;
    this.cdr.detectChanges();
  }

  private campaignSubmittedDateValue(c: any): Date | null {
    const d = new Date(c?.createdAt || c?.updatedAt || '');
    return isNaN(d.getTime()) ? null : d;
  }

  campaignIdLabel(c: any): string {
    // Prefer the DB-stored sequential number; fall back to last-6 of _id
    const num = Number(c?.campaignNumber);
    if (num > 0) return `CMP-${num}`;
    return `CMP-${String(c?._id || '').slice(-6).toUpperCase()}`;
  }

  campaignBudgetType(c: any): string {
    const t = String(c?.campaignType || '').toLowerCase();
    if (t === 'pay_to_join') return 'Performance Base';
    if (t === 'paid_collab') return 'Fixed Fee';
    if (t === 'product') return 'Product Deal';
    if (t === 'invite_location') return 'Location Deal';
    const mode = String(c?.pricingModel || c?.budgetType || '').toLowerCase();
    if (mode.includes('retainer')) return 'Retainer';
    if (mode.includes('performance')) return 'Performance Base';
    if (mode.includes('fixed')) return 'Fixed Fee';
    return 'Fixed Fee';
  }

  campaignSubmittedDate(c: any): string {
    const d = new Date(c?.createdAt || c?.updatedAt || '');
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  campaignSubmittedTime(c: any): string {
    const d = new Date(c?.createdAt || c?.updatedAt || '');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  campaignLogoInitial(c: any): string {
    return String(c?.title || c?.campaignTitle || '?').charAt(0).toUpperCase();
  }

  brandLogoInitial(c: any): string {
    return String(c?.brand?.brandName || c?.brand?.name || '?').charAt(0).toUpperCase();
  }

  brandLogoUrl(c: any): string | null {
    const logo = c?.brand?.logo || c?.brand?.profileImage || c?.brand?.avatar;
    return typeof logo === 'string' && logo ? logo : null;
  }

  exportData() {
    const rows = this.filteredCampaigns.map(c => ({
      id: this.campaignIdLabel(c),
      title: c.title || '',
      brand: c.brand?.brandName || '',
      status: c.status || '',
      budget: this.campaignPreviewBudget(c),
      submitted: this.campaignSubmittedDate(c),
    }));
    const csv = [
      'ID,Title,Brand,Status,Budget,Submitted',
      ...rows.map(r => `${r.id},${r.title},${r.brand},${r.status},${r.budget},${r.submitted}`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'campaigns.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  private matchesStatusFilter(
    campaign: any,
    filter: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'completed' | 'all',
  ): boolean {
    if (filter === 'all') return true;
    return this.normalizeReviewStatus(campaign?.status) === filter;
  }

  private normalizeReviewStatus(status: unknown): 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'all' | 'draft' | 'completed' | 'unknown' {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'unknown';
    if (normalized === 'pending_review' || normalized === 'pending') return 'pending_review';
    if (normalized === 'needs_changes' || normalized === 'needschange' || normalized === 'changes_requested') return 'needs_changes';
    if (normalized === 'rejected' || normalized === 'reject') return 'rejected';
    if (normalized === 'active' || normalized === 'approved' || normalized === 'live') return 'active';
    if (normalized === 'draft') return 'draft';
    if (normalized === 'completed') return 'completed';
    if (normalized === 'all') return 'all';
    return 'unknown';
  }

  private isPendingCampaign(campaign: any): boolean {
    return this.normalizeReviewStatus(campaign?.status) === 'pending_review';
  }

  private isActiveCampaign(campaign: any): boolean {
    return this.normalizeReviewStatus(campaign?.status) === 'active';
  }

  private hasInfluencerProgress(campaign: any): boolean {
    return !!campaign?.hasInfluencerProgress;
  }

  canApproveCampaign(campaign: any): boolean {
    const mode = this.isCollaborationScope ? this.collaborationApprovalMode : this.campaignApprovalMode;
    return mode === 'manual' && this.isPendingCampaign(campaign);
  }

  canRequestChangesCampaign(campaign: any): boolean {
    const mode = this.isCollaborationScope ? this.collaborationApprovalMode : this.campaignApprovalMode;
    if (mode === 'manual') {
      return this.isPendingCampaign(campaign);
    }
    return this.isActiveCampaign(campaign) && !this.hasInfluencerProgress(campaign);
  }

  canRejectCampaign(campaign: any): boolean {
    const mode = this.isCollaborationScope ? this.collaborationApprovalMode : this.campaignApprovalMode;
    if (mode === 'manual') {
      return this.isPendingCampaign(campaign);
    }
    return this.isActiveCampaign(campaign) && !this.hasInfluencerProgress(campaign);
  }

  canModerateCampaign(campaign: any): boolean {
    return this.canApproveCampaign(campaign) || this.canRequestChangesCampaign(campaign) || this.canRejectCampaign(campaign);
  }

  setStatusTab(status: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'completed' | 'all') {
    if (this.campaignApprovalStatusFilter === status) return;
    this.campaignApprovalStatusFilter = status;
    this.currentPage = 1;
  }

  getStatusCount(status: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'completed' | 'all'): number {
    if (status === 'all') return this.allCampaignApprovals.length;
    return this.allCampaignApprovals.filter((campaign) => this.matchesStatusFilter(campaign, status)).length;
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
        if (action === 'approve') {
          this.approvedCampaignAlert = {
            ...campaign,
            status: 'active',
            moderationNote: note,
            moderatedAt: new Date().toISOString(),
          };
          this.alertMessageCopied = false;
        }
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

  copyCampaignAlertMessage(message: string) {
    const text = String(message || '').trim();
    if (!text) return;
    const done = () => {
      this.alertMessageCopied = true;
      this.toast.success('Alert message copied.');
      this.cdr.detectChanges();
      setTimeout(() => {
        this.alertMessageCopied = false;
        this.cdr.detectChanges();
      }, 2500);
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopy(text, done));
      return;
    }
    this.fallbackCopy(text, done);
  }

  private fallbackCopy(text: string, done: () => void) {
    if (typeof document === 'undefined') return;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    done();
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

  private mapInviteRowsToProgress(invites: any[], campaign?: any): any[] {
    const rows = Array.isArray(invites) ? invites : [];
    return rows
      .map((invite: any) => {
        const counter = invite?.counterOffer || {};
        const campaignPricePaise = Number(
          invite?.campaignId?.pricePerInfluencer
          || campaign?.pricePerInfluencer
          || campaign?.amount
          || 0,
        );
        const campaignRecipientRole = String(
          campaign?.inviteRecipientRole || campaign?.recipientRole || campaign?.targetRole || '',
        ).trim().toLowerCase();
        const participantRole = String(
          invite?.recipientRole
            || invite?.role
            || invite?.campaignId?.inviteRecipientRole
            || invite?.campaignId?.recipientRole
            || campaignRecipientRole
            || (invite?.photographerId && !invite?.influencerId ? 'photographer' : 'influencer'),
        ).toLowerCase() === 'photographer'
          ? 'photographer'
          : 'influencer';
        const recipientCandidate = participantRole === 'photographer'
          ? (invite?.photographerId ?? invite?.influencerId ?? null)
          : (invite?.influencerId ?? invite?.photographerId ?? null);
        const recipient = recipientCandidate && typeof recipientCandidate === 'object'
          ? recipientCandidate
          : null;
        const participantIdRaw = participantRole === 'photographer'
          ? (recipient?._id || invite?.photographerId || invite?.influencerId || '')
          : (recipient?._id || invite?.influencerId || invite?.photographerId || '');
        const participantName = String(
          recipient?.name || recipient?.fullName || recipient?.fullname || recipient?.username || '',
        ).trim() || (participantRole === 'photographer' ? 'Photographer' : 'Influencer');
        return {
          inviteId: String(invite?._id || ''),
          participantId: String(participantIdRaw || ''),
          participantRole,
          participantName,
          participantAvatar: this.resolveParticipantAvatar(recipient),
          participantUsername: this.resolveParticipantUsername(recipient),
          participantEmail: String(recipient?.email || '').trim() || null,
          status: String(invite?.status || 'pending').toLowerCase(),
          selectedPlatform: String(invite?.selectedPlatform || counter?.selectedPlatform || '').trim() || null,
          selectedContentType: String(invite?.selectedContentType || counter?.selectedContentType || '').trim() || null,
          selectedPostDate: invite?.selectedPostDate || null,
          acceptedAt: invite?.acceptedAt || null,
          paymentConfirmedAt: invite?.paymentConfirmedAt || null,
          updatedAt: invite?.updatedAt || invite?.createdAt || null,
          campaignAmountPaise: campaignPricePaise,
          agreedAmount: Number(invite?.agreedAmount || 0),
          agreedAmountPaise: Number(invite?.agreedAmountPaise || 0),
          counterOfferStatus: String(counter?.status || '').toLowerCase(),
          counterOfferedAmount: Number(counter?.offeredAmount || 0),
          counterOfferedAmountPaise: Number(counter?.offeredAmountPaise || 0),
          counterRequestedAmount: Number(counter?.requestedAmount || 0),
          counterRequestedAmountPaise: Number(counter?.requestedAmountPaise || 0),
          counterOffer: invite?.counterOffer || null,
          postUrl: invite?.latestSubmission?.postUrl || invite?.postUrl || null,
          submittedAt: invite?.latestSubmission?.submittedAt || null,
          postPlatform: invite?.latestSubmission?.postPlatform || null,
        };
      })
      .sort((a: any, b: any) => {
        const ta = new Date(a?.updatedAt || 0).getTime();
        const tb = new Date(b?.updatedAt || 0).getTime();
        return tb - ta;
      });
  }

  private previewInviteProgressNeedsRefresh(campaign: any): boolean {
    const rows = Array.isArray(campaign?.inviteProgress) ? campaign.inviteProgress : [];
    if (!rows.length) return true;
    return rows.some((row: any) => {
      const role = String(row?.participantRole || '').trim().toLowerCase();
      const name = String(row?.participantName || '').trim().toLowerCase();
      const avatar = String(row?.participantAvatar || '').trim();
      const username = String(row?.participantUsername || '').trim();
      return !role
        || name === ''
        || name === 'influencer'
        || (name !== 'photographer' && !avatar)
        || !username
        || (this.isPhotographerTargetCampaign(campaign) && role !== 'photographer');
    });
  }

  private isPhotographerTargetCampaign(campaign: any): boolean {
    const explicitRole = String(
      campaign?.inviteRecipientRole || campaign?.recipientRole || campaign?.targetRole || '',
    ).trim().toLowerCase();
    if (explicitRole === 'photographer') return true;
    if (explicitRole === 'influencer') return false;

    const requestKind = String(campaign?.requestKind || '').trim().toLowerCase();
    if (requestKind === 'creative_requirement') return true;
    if (requestKind === 'photographer_collaboration') return false;

    return String(campaign?.ownerType || '').trim().toLowerCase() !== 'photographer';
  }

  private resolveParticipantAvatar(recipient: any): string | null {
    if (!recipient || typeof recipient !== 'object') return null;
    const candidates: string[] = [];
    if (Array.isArray(recipient?.profileImages) && recipient.profileImages.length > 0) {
      if (typeof recipient.profileImages[0]?.url === 'string') {
        candidates.push(recipient.profileImages[0].url);
      }
      if (typeof recipient.profileImages[0] === 'string') {
        candidates.push(recipient.profileImages[0]);
      }
    }
    if (typeof recipient?.profileImage === 'string') candidates.push(recipient.profileImage);
    if (typeof recipient?.profilePicture === 'string') candidates.push(recipient.profilePicture);
    if (typeof recipient?.avatar === 'string') candidates.push(recipient.avatar);

    const apiBase = String(environment.apiBaseUrl || '').trim();
    const backendBase = apiBase.replace(/\/api\/?$/, '');
    for (const raw of candidates) {
      const value = String(raw || '').trim();
      if (!value) continue;
      if (/^https?:\/\//i.test(value)) return value;
      if (value.startsWith('/assets/')) {
        return backendBase ? `${backendBase}${value}` : value;
      }
      return value;
    }
    return null;
  }

  private resolveParticipantUsername(recipient: any): string | null {
    if (!recipient || typeof recipient !== 'object') return null;
    const username = String(recipient?.username || recipient?.userName || '').trim();
    return username || null;
  }

  private fetchInvitesByCampaign(campaignId: string) {
    return this.http.get<any>(
      `${environment.apiBaseUrl}/campaign-invites/campaign/${encodeURIComponent(campaignId)}`,
      this.getAuthHeaders(),
    );
  }

  private unwrapParticipantProfile(role: 'influencer' | 'photographer', response: any): any | null {
    const payload = response?.data ?? response;
    if (!payload || typeof payload !== 'object') return null;
    if (role === 'photographer') {
      return payload?.photographer || payload?.data?.photographer || payload;
    }
    return payload?.influencer || payload?.data?.influencer || payload;
  }

  private fetchParticipantProfile(role: 'influencer' | 'photographer', id: string): Observable<any | null> {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return of(null);
    const path = role === 'photographer'
      ? `${environment.apiBaseUrl}/users/photographers/${encodeURIComponent(normalizedId)}`
      : `${environment.apiBaseUrl}/users/influencers/${encodeURIComponent(normalizedId)}`;
    return this.http.get<any>(path, this.getAuthHeaders()).pipe(
      map((res) => this.unwrapParticipantProfile(role, res)),
      catchError(() => of(null)),
    );
  }

  private enrichInviteRowsWithProfiles(invites: any[], campaign?: any): Observable<any[]> {
    const rows = Array.isArray(invites) ? invites : [];
    if (!rows.length) return of([]);

    const requests = rows.map((invite: any) => {
      const campaignRecipientRole = String(
        campaign?.inviteRecipientRole || campaign?.recipientRole || campaign?.targetRole || '',
      ).trim().toLowerCase();
      const participantRole: 'influencer' | 'photographer' = String(
        invite?.recipientRole
          || invite?.role
          || invite?.campaignId?.inviteRecipientRole
          || invite?.campaignId?.recipientRole
          || campaignRecipientRole
          || (invite?.photographerId && !invite?.influencerId ? 'photographer' : 'influencer'),
      ).toLowerCase() === 'photographer'
        ? 'photographer'
        : 'influencer';

      const directRecipient = participantRole === 'photographer'
        ? (invite?.photographerId ?? invite?.influencerId ?? null)
        : (invite?.influencerId ?? invite?.photographerId ?? null);
      if (directRecipient && typeof directRecipient === 'object') {
        return of(invite);
      }

      const participantId = String(directRecipient || '').trim();
      if (!participantId) return of(invite);

      return this.fetchParticipantProfile(participantRole, participantId).pipe(
        map((profile) => {
          if (!profile) return invite;
          return participantRole === 'photographer'
            ? { ...invite, photographerId: profile, recipientRole: 'photographer' }
            : { ...invite, influencerId: profile, recipientRole: 'influencer' };
        }),
      );
    });

    return forkJoin(requests);
  }

  openCampaignPreview(campaign: any) {
    this.selectedCampaign = campaign;
    this.selectedCampaignPreviewInvite = this.buildSelectedCampaignInvite(campaign);
    const campaignId = String(campaign?._id || '').trim();
    if (!campaignId || !this.previewInviteProgressNeedsRefresh(campaign)) {
      this.selectedCampaignInviteProgressLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.selectedCampaignInviteProgressLoading = true;
    this.selectedCampaign = {
      ...campaign,
      inviteProgress: [],
    };
    this.selectedCampaignPreviewInvite = this.buildSelectedCampaignInvite(this.selectedCampaign);
    this.cdr.detectChanges();

    this.fetchInvitesByCampaign(campaignId).subscribe({
      next: (res: any) => {
        if (!this.selectedCampaign || String(this.selectedCampaign?._id || '') !== campaignId) {
          return;
        }
        const payload = res?.data ?? res;
        const invites = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        this.enrichInviteRowsWithProfiles(invites, this.selectedCampaign).subscribe({
          next: (resolvedInvites: any[]) => {
            if (!this.selectedCampaign || String(this.selectedCampaign?._id || '') !== campaignId) {
              return;
            }
            const mapped = this.mapInviteRowsToProgress(resolvedInvites, this.selectedCampaign);
            this.selectedCampaign = {
              ...this.selectedCampaign,
              inviteProgress: mapped,
              inviteCount: Number(this.selectedCampaign?.inviteCount || mapped.length || 0),
            };
            this.selectedCampaignPreviewInvite = this.buildSelectedCampaignInvite(this.selectedCampaign);
            this.selectedCampaignInviteProgressLoading = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.selectedCampaignInviteProgressLoading = false;
            this.cdr.detectChanges();
          },
        });
      },
      error: () => {
        this.selectedCampaignInviteProgressLoading = false;
        // Keep existing preview state when legacy invite fetch fails.
        this.cdr.detectChanges();
      },
    });
  }

  closeCampaignPreview() {
    this.selectedCampaign = null;
    this.selectedCampaignPreviewInvite = null;
    this.selectedCampaignInviteProgressLoading = false;
  }

  private buildSelectedCampaignInvite(campaign: any): any | null {
    if (!campaign) return null;
    return {
      _id: campaign._id || 'campaign-review',
      status: campaign.status || 'pending_review',
      campaign,
      brand: campaign.brand || campaign.brandId || null,
    };
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
    if (min > 0 || max > 0) {
      if (min > 0 && max > 0 && min !== max) {
        return `₹${min.toLocaleString('en-IN')} — ₹${max.toLocaleString('en-IN')}`;
      }
      return `₹${(min || max).toLocaleString('en-IN')}`;
    }

    const paise = this.resolveCampaignBudgetPaise(campaign);
    if (paise > 0) {
      return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}`;
    }

    const rupees = this.resolveCampaignBudgetRupees(campaign);
    if (rupees > 0) {
      return `₹${rupees.toLocaleString('en-IN')}`;
    }

    return 'Not specified';
  }

  private resolveCampaignBudgetPaise(campaign: any): number {
    const candidates = [
      campaign?.pricePerInfluencer,
      campaign?.estimatedBudget,
      campaign?.amount,
      campaign?.agreedAmountPaise,
    ];
    for (const value of candidates) {
      const amount = Number(value || 0);
      if (amount > 0) return amount;
    }

    const rows = Array.isArray(campaign?.inviteProgress) ? campaign.inviteProgress : [];
    for (const row of rows) {
      const amount = Number(
        row?.agreedAmountPaise
          || row?.campaignAmountPaise
          || row?.counterOfferedAmountPaise
          || row?.counterRequestedAmountPaise
          || 0,
      );
      if (amount > 0) return amount;
    }
    return 0;
  }

  private resolveCampaignBudgetRupees(campaign: any): number {
    const candidates = [
      campaign?.agreedAmount,
      campaign?.finalAmount,
      campaign?.pricePerInfluencerRupees,
    ];
    for (const value of candidates) {
      const amount = Number(value || 0);
      if (amount > 0) return amount;
    }

    const rows = Array.isArray(campaign?.inviteProgress) ? campaign.inviteProgress : [];
    for (const row of rows) {
      const amount = Number(
        row?.agreedAmount
          || row?.counterOfferedAmount
          || row?.counterRequestedAmount
          || 0,
      );
      if (amount > 0) return amount;
    }
    return 0;
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
    const key = String(campaign?.campaignType || '').trim().toLowerCase();
    const labels: Record<string, string> = {
      paid_collab: 'Paid Collab',
      product: 'Product Collab',
      invite_location: 'Invite to Location',
      pay_to_join: 'Pay to Join',
    };
    return labels[key] || campaign?.campaignType || 'Campaign';
  }

  campaignAccessModeLabel(campaign: any): string {
    return campaign?.campaignMode === 'tier_filtered_open' ? 'Open to all' : 'Invite only';
  }

  campaignAccessDetailText(campaign: any): string {
    if (campaign?.campaignMode !== 'tier_filtered_open') return '';
    const details: string[] = [];
    const minTier = String(campaign?.minInfluencerTier || '').trim();
    if (minTier) details.push(`Tier: ${minTier}`);
    const location = [
      String(campaign?.targetDistrict || campaign?.venueDistrict || '').trim(),
      String(campaign?.targetState || campaign?.venueState || '').trim(),
    ].filter(Boolean).join(', ');
    if (location) details.push(`Location: ${location}`);
    const categories = Array.isArray(campaign?.categories)
      ? campaign.categories.map((item: any) => String(item || '').trim()).filter(Boolean)
      : [];
    if (categories.length) details.push(`Categories: ${categories.join(', ')}`);
    return details.join(' | ');
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
    const normalized = this.normalizeReviewStatus(status);
    if (normalized === 'pending_review') return 'Pending Review';
    if (normalized === 'needs_changes') return 'Needs Changes';
    if (normalized === 'active') return 'Approved / Live';
    if (normalized === 'rejected') return 'Rejected';
    if (normalized === 'all') return 'All';
    if (normalized === 'draft') return 'Draft';
    if (normalized === 'completed') return 'Completed';
    return status || 'Unknown';
  }

  getReviewTabStatusClass(
    status: 'pending_review' | 'needs_changes' | 'rejected' | 'active' | 'completed' | 'all',
  ): string {
    if (status === 'all') return 'ts-status-tab--other';
    return `ts-status-tab--${this.getCampaignStatusKey(status)}`;
  }

  getCampaignStatusBadgeClass(status: string): string {
    return `ts-status-${this.getCampaignStatusKey(status)}`;
  }

  getCampaignStatusRowClass(campaign: any): string {
    const key = this.getCampaignStatusKey(campaign?.status);
    return `ts-status-row ts-status-row--${key}`;
  }

  getParticipantStatusBadgeClass(status: string): string {
    return `ts-status-${this.getParticipantStatusKey(status)}`;
  }

  getCampaignStatusKey(status: string): 'accepted' | 'pending' | 'rejected' | 'completed' | 'other' {
    const normalized = this.normalizeReviewStatus(status);
    if (normalized === 'active') return 'accepted';
    if (normalized === 'completed') return 'completed';
    if (normalized === 'pending_review' || normalized === 'needs_changes' || normalized === 'draft') return 'pending';
    if (normalized === 'rejected') return 'rejected';
    return 'other';
  }

  private getParticipantStatusKey(status: string): 'accepted' | 'submitted' | 'working' | 'pending' | 'rejected' | 'completed' | 'other' {
    const key = String(status || '').trim().toLowerCase();
    if (key === 'accepted' || key === 'approved') return 'accepted';
    if (key === 'completed') return 'completed';
    if (key === 'submitted' || key === 'under_review' || key === 'disputed') return 'submitted';
    if (key === 'working' || key === 'payment_confirmed') return 'working';
    if (key === 'pending' || key === 'invited' || key === 'counter_sent') return 'pending';
    if (key === 'withdrawn' || key === 'declined' || key === 'rejected') return 'rejected';
    return 'other';
  }

  getAcceptedInviteCount(campaign: any): number {
    const rows = Array.isArray(campaign?.inviteProgress) ? campaign.inviteProgress : [];
    return rows.filter((row: any) => String(row?.status || '').toLowerCase() === 'accepted').length;
  }

  getProgressedInviteCount(campaign: any): number {
    const rows = Array.isArray(campaign?.inviteProgress) ? campaign.inviteProgress : [];
    const progressed = new Set([
      'accepted',
      'payment_confirmed',
      'working',
      'submitted',
      'completed',
      'approved',
      'disputed',
    ]);
    return rows.filter((row: any) => progressed.has(String(row?.status || '').toLowerCase())).length;
  }

  getParticipantStatusChips(campaign: any): Array<{ key: string; label: string; count: number }> {
    const rows = Array.isArray(campaign?.inviteProgress) ? campaign.inviteProgress : [];
    const counts = new Map<string, { key: string; label: string; count: number }>();
    for (const row of rows) {
      const rawKey = String(row?.status || 'pending').trim().toLowerCase() || 'pending';
      const chipKey = this.campaignInviteStatusChipKey(rawKey);
      const label = this.campaignInviteStatusLabel(rawKey);
      const existing = counts.get(chipKey);
      counts.set(chipKey, {
        key: chipKey,
        label,
        count: (existing?.count || 0) + 1,
      });
    }

    const order = ['working', 'under_review', 'completed', 'approved', 'pending', 'withdrawn', 'declined', 'rejected'];
    return order
      .filter((key) => counts.has(key))
      .slice(0, 4)
      .map((key) => counts.get(key)!)
      .filter((chip): chip is { key: string; label: string; count: number } => !!chip);
  }

  getCampaignWorkflowSteps(campaign: any): Array<{ label: string; doneLabel?: string; done: boolean; current: boolean }> {
    const status = String(campaign?.status || '').toLowerCase();
    const rows = Array.isArray(campaign?.inviteProgress) ? campaign.inviteProgress : [];
    const statuses = rows.map((r: any) => String(r?.status || '').toLowerCase());
    const isActive = ['active', 'completed'].includes(status);
    const isDone = status === 'completed';
    const hasAccepted = statuses.some((s: string) => ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved'].includes(s));
    const hasPaymentConfirmed = statuses.some((s: string) => ['payment_confirmed', 'working', 'submitted', 'completed', 'approved'].includes(s));
    const hasWorking = statuses.some((s: string) => ['working', 'submitted', 'completed', 'approved'].includes(s));
    return [
      { label: 'Created', done: true, current: false },
      { label: 'Awaiting Admin Approval', doneLabel: 'Admin Approved', done: isActive, current: !isDone && !isActive },
      { label: 'Awaiting Acceptance', done: hasAccepted, doneLabel: 'Accepted', current: !isDone && isActive && !hasAccepted },
      { label: 'Awaiting Payment', done: hasPaymentConfirmed, doneLabel: 'Payment Confirmed', current: !isDone && hasAccepted && !hasPaymentConfirmed },
      { label: 'Awaiting Work', done: hasWorking, doneLabel: 'Working', current: !isDone && hasPaymentConfirmed && !hasWorking },
      { label: 'Awaiting Completion', done: isDone, doneLabel: 'Completed', current: !isDone && hasWorking },
    ] as Array<{ label: string; doneLabel?: string; done: boolean; current: boolean }>;
  }

  private campaignInviteStatusChipKey(status: string): string {
    const key = String(status || '').trim().toLowerCase();
    if (key === 'accepted' || key === 'payment_confirmed' || key === 'working') return 'working';
    if (key === 'submitted' || key === 'disputed') return 'under_review';
    if (key === 'pending' || key === 'invited' || key === 'counter_sent') return 'pending';
    return key;
  }

  private campaignInviteStatusLabel(status: string): string {
    const key = String(status || '').trim().toLowerCase();
    const map: Record<string, string> = {
      pending: 'Pending',
      invited: 'Invited',
      counter_sent: 'Pending',
      accepted: 'Working',
      payment_confirmed: 'Confirmed — Start Work',
      working: 'Working',
      submitted: 'Under Review',
      completed: 'Completed',
      approved: 'Payout Released',
      withdrawn: 'Withdrawn',
      declined: 'Declined',
      rejected: 'Rejected',
      disputed: 'Under Review',
    };
    return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
