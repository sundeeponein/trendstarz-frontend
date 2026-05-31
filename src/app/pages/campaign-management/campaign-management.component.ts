import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs/operators';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { PlansService } from '../../shared/plans.service';
import { AnalyticsService } from '../../core/analytics.service';
import { ToastService } from '../../shared/toast/toast.service';
import { UpgradeBannerComponent } from '../../shared/upgrade-banner/upgrade-banner.component';
import { SupportBannerComponent } from '../../shared/support-banner/support-banner.component';
import { CampaignPaymentComponent } from '../campaign-payment/campaign-payment.component';
import { SessionService } from '../../core/session.service';
import { Campaign } from '../../shared/campaigns/campaign.model';
import { CampaignFormComponent } from '../../shared/campaigns/campaign-form/campaign-form.component';

import { CampaignDetailModalComponent, CampaignAcceptPayload, CampaignDeclinePayload } from '../../shared/campaign-detail-modal/campaign-detail-modal.component';
import { CampaignInviteCardComponent, InviteAcceptPayload, InviteDeclinePayload } from '../../shared/campaign-invite-card/campaign-invite-card.component';
import { environment } from '../../../environments/environment';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { TierInfoService } from '../../shared/components/tier-info-modal/tier-info.service';
import { FlowHelpModalService } from '../../shared/components/flow-help-modal/flow-help-modal.service';
import { normalizeTierLabel, getInfluencerPrimaryTier } from '../../shared/tiers.constants';
import { ShippingAddressModalComponent } from '../../shared/components/shipping-address-modal/shipping-address-modal.component';
import { ShippingAddressModalService, ShippingAddress } from '../../shared/components/shipping-address-modal/shipping-address-modal.service';
import { OfferTrailComponent } from '../../shared/offer-trail/offer-trail.component';
import { buildAdminOfferTrailText } from '../../shared/offer-trail.util';

type TabStatus = 'active' | 'pending' | 'completed' | 'draft';
type InviteActionReasonModalMode = 'withdraw' | 'decline_accepted' | 'report';
type PhotographerWorkspaceView = 'campaign_requests' | 'collaborations';
type InfluencerWorkspaceTab = 'campaigns' | 'collaborations';
type CollaborationSubview = 'invited' | 'created';

@Component({
  selector: 'app-campaign-management',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterModule, CampaignFormComponent, CampaignDetailModalComponent, CampaignInviteCardComponent, UpgradeBannerComponent, SupportBannerComponent, CampaignPaymentComponent, UserAvatarComponent, ShippingAddressModalComponent, OfferTrailComponent],
  templateUrl: './campaign-management.component.html',
  styleUrls: ['./campaign-management.component.scss']
})
export class CampaignManagementComponent implements OnInit, OnDestroy {
  private static readonly SUBMISSION_APPROVAL_WAIT_MS = 24 * 60 * 60 * 1000;
  private static readonly REFRESH_TIMEOUT_MS = 10000;
      maxActiveCampaigns: number = 1;
      planCapabilities: any = null;
  private completionEventsTracked = new Set<string>();
    // Reload campaigns from backend (used after create/update)
    loadCampaigns() {
      this.loading = true;
      const shouldUseOwnerScope = this.isInfluencerView
        ? (this.isInfluencerCollaborationsView && this.influencerCollabSubview === 'created')
        : true;
      const ownerQueryId = this.getOwnerCampaignQueryId();

      if (shouldUseOwnerScope && !ownerQueryId) {
        this.campaigns = [];
        this.loading = false;
        this.campaignLoadError = '';
        this.cd.detectChanges();
        return;
      }

      const request$ = shouldUseOwnerScope
        ? this.config.getCampaignsByBrandId(ownerQueryId)
        : this.config.getAllCampaigns('active', this.getInfluencerApiScope());
      request$.pipe(timeout(12000)).subscribe({
        next: (campaigns: Campaign[]) => {
          this.campaigns = campaigns;
          this.ensureInviteRecipientDirectoriesLoaded();
          this.loading = false;
          this.cd.detectChanges();
          this.refreshCampaignPaymentStatuses();
          this.loadAllInvites();
          this.consumeSearchPrefillIfReady();
        },
        error: () => {
          this.campaigns = [];
          this.loading = false;
          this.campaignLoadError = 'Loading timed out. Please refresh and try again.';
          this.cd.detectChanges();
        }
      });
    }
  // ── Toast messages ─────────────────────────────────────────────
  showSuccessToast = false;
  showErrorToast = false;
  toastMessage = '';
  campaigns: Campaign[] = [];
  campaignLoadError: string = '';
  brandId = '';
  brandName = '';
  loading = true;

  /** True when an influencer is viewing — switches to read-only open-campaigns mode */
  isInfluencerView = false;
  isPhotographerView = false;
  influencerWorkspaceTab: InfluencerWorkspaceTab = 'campaigns';
  influencerCollabSubview: CollaborationSubview = 'invited';
  photographerWorkspaceView: PhotographerWorkspaceView = 'campaign_requests';
  photographerCollabSubview: CollaborationSubview = 'created';
  photographerBrandInvites: any[] = [];
  photographerBrandInvitesLoading = false;
  photographerInvitePostDates: Record<string, string> = {};
  photographerRespondingInviteIds = new Set<string>();
  photographerInviteTab: 'pending' | 'missed' | 'accepted' | 'declined' | 'completed' = 'pending';

  activeTab: TabStatus = 'active';
  pageSize = 10;
  currentPage = 1;

  showForm = false;
  formSaving = false;
  formMode: 'create' | 'edit' = 'create';
  editingCampaign: Campaign | null = null;

  // ── Invite panel (brand view) ─────────────────────────────────
  invitePanelOpen = false;
  invitePanelCampaign: Campaign | null = null;
  invites: any[] = [];
  invitesLoading = false;
  inviteTab: 'invited' | 'search' = 'invited';
  inviteTargetRole: 'influencer' | 'photographer' = 'influencer';
  influencerSearch = '';
  allInfluencersForInvite: any[] = [];
  allPhotographersForInvite: any[] = [];
  influencersForInviteLoading = false;
  photographersForInviteLoading = false;
  sendingInviteIds = new Set<string>();
  selectedInfluencerIds = new Set<string>();
  bulkSending = false;
  inviteError = '';
  unlockingInviteIds = new Set<string>();
  searchPrefilledRecipients: { id: string; name: string; username?: string }[] = [];
  searchPrefilledRecipientRole: 'influencer' | 'photographer' = 'influencer';
  private pendingSearchPrefill = false;

  // ── Slice D/E: brand actions + fulfillment state ─────────────
  actioningInviteIds = new Set<string>();
  inviteActionModalOpen = false;
  inviteActionModalInvite: any = null;
  inviteActionModalMode: InviteActionReasonModalMode = 'withdraw';
  inviteActionReasonInput = '';
  inviteActionModalError = '';
  revisedCounterModalOpen = false;
  revisedCounterModalInvite: any = null;
  revisedCounterModalCampaign: any = null;
  revisedCounterAmountInput = '';
  revisedCounterModalError = '';
  visitConfirmModalOpen = false;
  visitConfirmInvite: any = null;
  visitConfirmCampaign: Campaign | null = null;
  fulfillModalOpen = false;
  fulfillInvite: any = null;
  fulfillForm: {
    courier?: string;
    trackingId?: string;
    trackingUrl?: string;
    shippedAt?: string;
    deliveredAt?: string;
    scheduledAt?: string;
    checkedInAt?: string;
    status?: string;
    note?: string;
  } = {};
  savingFulfillment = false;

  // ── Expand panel (brand view) ──────────────────────────────────
  expandedCampaignId: string | null = null;
  campaignInvitesMap = new Map<string, any[]>();
  expandInvitesLoading = new Set<string>();
  campaignSubmissionsMap = new Map<string, any[]>();
  submissionFeedback: { [inviteId: string]: string } = {};
  submissionDisputeReason: { [inviteId: string]: string } = {};
  reviewLoading = new Set<string>();
  expandedSubmissionIds = new Set<string>();
  private submissionApprovalTicker: ReturnType<typeof setInterval> | null = null;
  showUpgradeBanner: boolean = false;
  planLimitError: string = '';
  upgradeBannerMessage: string = '';
    invitePanelSuccessMessage: string = '';
    protected tierInfo = inject(TierInfoService);
    protected flowHelp = inject(FlowHelpModalService);
    private shippingModal = inject(ShippingAddressModalService);

    // Payment modal state
    paymentModalVisible = false;
    paymentCampaignId: string | null = null;
    paymentInitialTab: 'summary' | 'pay' | 'status' = 'summary';
    campaignCollectionStatusById = new Map<string, string>();

    private deriveCampaignCollectionStatus(rows: any[]): string {
      const statuses = (Array.isArray(rows) ? rows : [])
        .map((row: any) => String(row?.collectionStatus || '').toLowerCase())
        .filter(Boolean);

      if (statuses.includes('verified')) return 'verified';
      if (statuses.includes('proof_submitted')) return 'proof_submitted';
      if (statuses.includes('awaiting_payment')) return 'awaiting_payment';
      if (statuses.includes('failed')) return 'failed';
      return 'awaiting_payment';
    }

    private refreshCampaignPaymentStatuses(): void {
      const paidCampaignIds = (this.campaigns || [])
        .filter((c: any) => String(c?.campaignType || '').toLowerCase() === 'paid_collab')
        .map((c: any) => String(c?._id || ''))
        .filter(Boolean);

      paidCampaignIds.forEach((campaignId) => {
        this.config.getCampaignTransactionStatus(campaignId).subscribe({
          next: (rows: any[]) => {
            const status = this.deriveCampaignCollectionStatus(rows);
            this.campaignCollectionStatusById.set(campaignId, status);
            this.cd.detectChanges();
          },
          error: () => {
            this.campaignCollectionStatusById.set(campaignId, 'awaiting_payment');
            this.cd.detectChanges();
          }
        });
      });
    }

    isCampaignPaymentVerificationPending(campaign: Campaign | null | undefined): boolean {
      const id = String(campaign?._id || '');
      if (!id) return false;
      const status = String(this.campaignCollectionStatusById.get(id) || '').toLowerCase();
      return status === 'proof_submitted';
    }

    canOpenPaymentForCampaign(campaign: Campaign | null | undefined): boolean {
      if (!campaign) return false;
      if (String((campaign as any).campaignType || '').toLowerCase() !== 'paid_collab') return false;
      if (this.isCampaignPaymentVerificationPending(campaign)) return false;
      return this.getExpandInvitesByStatus(campaign, 'accepted') > 0;
    }

    openPayment(
      campaignId?: string | null,
      allowWhenVerificationPending = false,
      openTab: 'summary' | 'pay' | 'status' = 'summary',
    ) {
      if (!campaignId) return;
      const status = String(this.campaignCollectionStatusById.get(String(campaignId)) || '').toLowerCase();
      if (status === 'proof_submitted' && !allowWhenVerificationPending) {
        this.toast.success('Payment verification is already in progress.');
        return;
      }
      this.paymentInitialTab = openTab;
      this.paymentCampaignId = campaignId;
      this.paymentModalVisible = true;
      this.cd.detectChanges();
    }

    onPaymentVisibleChange(v: boolean) {
      this.paymentModalVisible = v;
      if (!v) {
        const campaignId = this.paymentCampaignId;
        this.paymentCampaignId = null;
        this.paymentInitialTab = 'summary';
        this.refreshCampaignPaymentStatuses();
        if (campaignId) {
          this.config.getInvitesByCampaign(campaignId).subscribe({
            next: (invites: any[]) => {
              const rows = Array.isArray(invites) ? invites : [];
              this.campaignInvitesMap.set(campaignId, rows);
              if (this.invitePanelCampaign?._id === campaignId) {
                this.invites = rows;
              }
              this.cd.detectChanges();
            },
            error: () => {
              this.cd.detectChanges();
            },
          });
        }
      }
    }

    private consumeSearchPrefillIfReady(): void {
      if (!this.pendingSearchPrefill || this.isInfluencerView) return;
      this.pendingSearchPrefill = false;
      this.openCreateForm();
    }


  get invitedIds(): Set<string> {
    if (this.inviteTargetRole === 'photographer') {
      return new Set(
        this.filteredInvitesByRole
          .map((i: any) => String(i?.photographerId?._id || i?.photographerId || i?.influencerId?._id || i?.influencerId || ''))
          .filter(Boolean),
      );
    }
    return new Set(
      this.filteredInvitesByRole
        .map((i: any) => String(i?.influencerId?._id || i?.influencerId || ''))
        .filter(Boolean),
    );
  }

  get inviteTargetSingularLabel(): string {
    return this.inviteTargetRole === 'photographer' ? 'Photographer' : 'Influencer';
  }

  get inviteTargetPluralLabel(): string {
    return this.inviteTargetRole === 'photographer' ? 'Photographers' : 'Influencers';
  }

  get inviteTargetSearchPlaceholder(): string {
    return this.inviteTargetRole === 'photographer'
      ? 'Search photographers by name...'
      : 'Search influencers by name...';
  }

  get pageTitle(): string {
    if (this.isInfluencerView) {
      return this.isInfluencerCollaborationsView ? 'Collaborations' : 'Campaign Requests';
    }
    if (this.isPhotographerView) {
      return this.isPhotographerCampaignRequestsView
        ? 'Campaign Requests'
        : 'Collaborations';
    }
    return 'Campaign Requests';
  }

  get pageSubtitle(): string {
    if (this.isInfluencerView) {
      return this.isInfluencerCollaborationsView
        ? 'Browse active collaboration requests from photographers and videographers.'
        : 'Browse active campaign requests from brands.';
    }
    if (this.isPhotographerView) {
      return this.isPhotographerCampaignRequestsView
        ? 'View and respond to campaign requests sent by brands.'
        : 'Create and manage collaborations you send to influencers.';
    }
    return 'Create campaign requests for influencers or creative requirements for photographers.';
  }

  get createButtonLabel(): string {
    if (this.summaryActiveCampaigns >= this.maxActiveCampaigns) return 'Quota full';
    if (this.isInfluencerCollaborationsView) return 'Create Collaboration';
    if (this.isPhotographerView) return 'Create Collaboration';
    return 'Create Campaign Request';
  }

  get isPhotographerCampaignRequestsView(): boolean {
    return this.isPhotographerView && this.photographerWorkspaceView === 'campaign_requests';
  }

  get isInfluencerCampaignsView(): boolean {
    return this.isInfluencerView && this.influencerWorkspaceTab === 'campaigns';
  }

  get isInfluencerCollaborationsView(): boolean {
    return this.isInfluencerView && this.influencerWorkspaceTab === 'collaborations';
  }

  get isPhotographerCollaborationsView(): boolean {
    return this.isPhotographerView && this.photographerWorkspaceView === 'collaborations';
  }

  get showCollaborationsWorkspace(): boolean {
    if (!this.isPhotographerView) return true;
    return this.isPhotographerCollaborationsView;
  }

  get canCreateCollaborations(): boolean {
    if (!this.showCollaborationsWorkspace) return false;
    if (this.isInfluencerCollaborationsView) return this.influencerCollabSubview === 'created';
    if (this.isPhotographerCollaborationsView) return this.photographerCollabSubview === 'created';
    if (!this.isInfluencerView) return true;
    return this.isInfluencerCollaborationsView;
  }

  get showInfluencerInboxSection(): boolean {
    if (!this.isInfluencerView) return false;
    if (!this.isInfluencerCollaborationsView) return true;
    return this.influencerCollabSubview === 'invited';
  }

  get isInfluencerBrowseMode(): boolean {
    return this.isInfluencerView && !(
      this.isInfluencerCollaborationsView && this.influencerCollabSubview === 'created'
    );
  }

  get showOwnerWorkspaceBoard(): boolean {
    if (this.isPhotographerCollaborationsView && this.photographerCollabSubview === 'invited') {
      return false;
    }
    if (this.isInfluencerCollaborationsView && this.influencerCollabSubview === 'invited') {
      return false;
    }
    return !this.isInfluencerBrowseMode;
  }

  get showActiveQuotaChip(): boolean {
    if (this.maxActiveCampaigns <= 0) return false;
    if (this.isInfluencerCollaborationsView) return true;
    return !this.isInfluencerBrowseMode;
  }

  get quotaEntityPluralLabel(): string {
    return (this.isPhotographerView || this.isInfluencerCollaborationsView) ? 'collaborations' : 'campaigns';
  }

  get quotaEntitySingularLabel(): string {
    return (this.isPhotographerView || this.isInfluencerCollaborationsView) ? 'collaboration' : 'campaign';
  }

  get quotaChipTitle(): string {
    return `Active ${this.quotaEntityPluralLabel} used`;
  }

  private isApprovalPendingInviteReason(reason: string): boolean {
    const normalized = String(reason || '').trim().toLowerCase();
    return normalized.includes('awaiting admin approval')
      || normalized.includes('invite after it is approved')
      || normalized.includes('still under admin review');
  }

  private areAllInviteFailuresApprovalPending(
    failures: { influencerId?: string; photographerId?: string; reason: string }[],
  ): boolean {
    return failures.length > 0 && failures.every((f) => this.isApprovalPendingInviteReason(f.reason));
  }

  private focusPendingTabIfUnderReview(status: unknown): void {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'pending' || normalized === 'pending_review') {
      this.activeTab = 'pending';
    }
  }

  private getSubmitSuccessMessage(status: unknown, invitesSent = false): string {
    const normalized = String(status || '').trim().toLowerCase();
    const noun = this.quotaEntitySingularLabel;
    const title = noun.charAt(0).toUpperCase() + noun.slice(1);
    if (normalized === 'pending' || normalized === 'pending_review') {
      return invitesSent
        ? `${title} submitted for review and invites sent. Check Pending tab.`
        : `${title} submitted for review. Check Pending tab.`;
    }
    return invitesSent
      ? `${title} created and invites sent!`
      : `${title} created successfully!`;
  }

  get influencerInboxSubtitle(): string {
    return this.isInfluencerCollaborationsView
      ? 'Received collaboration invitations'
      : 'Received campaign invitations';
  }

  get influencerInboxEmptySubtitle(): string {
    if (this.isInfluencerCollaborationsView) {
      return 'Browse open collaborations below — creators (influencers/photographers) will invite you here for collaboration.';
    }
    return 'Browse open campaigns below — brands will invite you here for campaign requests.';
  }

  get showPhotographerInboxSection(): boolean {
    if (this.isPhotographerCampaignRequestsView) return true;
    if (!this.isPhotographerCollaborationsView) return false;
    return this.photographerCollabSubview === 'invited';
  }

  get photographerInboxSubtitle(): string {
    if (this.isPhotographerCampaignRequestsView) {
      return 'Received campaign invitations from brands';
    }
    return 'Received collaboration invitations';
  }

  get photographerInboxEmptySubtitle(): string {
    if (this.isPhotographerCampaignRequestsView) {
      return 'Brands will invite you here when they want to work with you on a campaign.';
    }
    return 'Influencers will invite you here for collaboration.';
  }

  get totalRequestsLabel(): string {
    if (this.isPhotographerView) {
      return this.isPhotographerCampaignRequestsView
        ? 'Total Campaign Requests'
        : 'Total Collaborations';
    }
    return 'Total Campaigns';
  }

  get totalBudgetLabel(): string {
    if (this.isPhotographerView) {
      return this.isPhotographerCampaignRequestsView
        ? 'Campaign Request Value'
        : 'Total Project Value';
    }
    return 'Total Budget';
  }

  private normalizePhotographerWorkspaceView(value: unknown): PhotographerWorkspaceView {
    return String(value || '').trim().toLowerCase() === 'collaborations'
      ? 'collaborations'
      : 'campaign_requests';
  }

  private normalizeInfluencerWorkspaceTab(value: unknown): InfluencerWorkspaceTab {
    return String(value || '').trim().toLowerCase() === 'collaborations'
      ? 'collaborations'
      : 'campaigns';
  }

  private getInfluencerApiScope(): 'campaign' | 'collaboration' {
    return this.isInfluencerCollaborationsView ? 'collaboration' : 'campaign';
  }

  private getCampaignOwnerId(campaign: any): string {
    const owner = campaign?.brandId;
    if (owner && typeof owner === 'object') {
      return String(owner?._id || owner?.id || '').trim();
    }
    return String(owner || '').trim();
  }

  private getCampaignMapKey(campaignOrId: any): string {
    if (campaignOrId && typeof campaignOrId === 'object') {
      return String(campaignOrId?._id || campaignOrId?.id || '').trim();
    }
    return String(campaignOrId || '').trim();
  }

  isCampaignOwnedByCurrentUser(campaign: any): boolean {
    const currentUserId = String(this.brandId || '').trim();
    if (!currentUserId) return false;
    return this.getCampaignOwnerId(campaign) === currentUserId;
  }

  private loadInfluencerOwnedCampaignInvitesForAwareness() {
    if (!this.isInfluencerView) return;
    const ownedCampaigns = (this.campaigns || []).filter((campaign: any) =>
      this.isCampaignOwnedByCurrentUser(campaign) && !!campaign?._id,
    );
    for (const campaign of ownedCampaigns) {
      const campaignId = String(campaign._id || '').trim();
      if (!campaignId || this.campaignInvitesMap.has(campaignId)) continue;
      this.config.getInvitesByCampaign(campaignId).subscribe({
        next: (invites: any[]) => {
          this.campaignInvitesMap.set(campaignId, Array.isArray(invites) ? invites : []);
          this.cd.detectChanges();
        },
        error: () => {
          // non-blocking: awareness counters can still render from loaded maps
        },
      });
    }
  }

  get influencerCreatedCampaignsCount(): number {
    if (!this.isInfluencerView) return 0;
    return (this.campaigns || []).filter((campaign: any) =>
      this.isCampaignOwnedByCurrentUser(campaign),
    ).length;
  }

  get influencerReceivedInvitesCount(): number {
    if (!this.isInfluencerView) return 0;
    return this.myInvites.length;
  }

  get influencerSentInvitesCount(): number {
    if (!this.isInfluencerView) return 0;
    let total = 0;
    for (const campaign of this.campaigns || []) {
      if (!this.isCampaignOwnedByCurrentUser(campaign)) continue;
      const campaignId = String((campaign as any)?._id || '').trim();
      if (!campaignId) continue;
      total += (this.campaignInvitesMap.get(campaignId) || []).length;
    }
    return total;
  }

  private loadInfluencerWorkspaceData() {
    const scope = this.getInfluencerApiScope();
    const isCreatedCollabView = this.isInfluencerCollaborationsView && this.influencerCollabSubview === 'created';
    const ownerQueryId = this.getOwnerCampaignQueryId();
    this.myInvitesLoading = true;
    this.loading = true;

    this.config.getMyInvites(scope).pipe(
      timeout(CampaignManagementComponent.REFRESH_TIMEOUT_MS),
    ).subscribe({
      next: (invites: any[]) => {
        this.myInvites = invites;
        this.trackCompletionFromInviteStatuses(invites);
        this.myInvitesLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.myInvites = [];
        this.myInvitesLoading = false;
        this.cd.detectChanges();
      }
    });

    if (isCreatedCollabView && !ownerQueryId) {
      this.campaigns = [];
      this.campaignLoadError = '';
      this.loading = false;
      this.cd.detectChanges();
      return;
    }

    const campaignRequest$ = isCreatedCollabView
      ? this.config.getCampaignsByBrandId(ownerQueryId)
      : this.config.getAllCampaigns('active', scope);

    campaignRequest$.pipe(
      timeout(CampaignManagementComponent.REFRESH_TIMEOUT_MS),
    ).subscribe({
      next: (campaigns: Campaign[]) => {
        this.campaigns = campaigns || [];
        this.loadInfluencerOwnedCampaignInvitesForAwareness();
        this.campaignLoadError = '';
        this.loading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.campaigns = [];
        this.campaignLoadError = 'Loading timed out. Please refresh and try again.';
        this.loading = false;
        this.cd.detectChanges();
      }
    });
  }

  switchPhotographerWorkspace(view: PhotographerWorkspaceView) {
    if (!this.isPhotographerView) return;
    this.photographerWorkspaceView = view;
    this.currentPage = 1;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.cd.detectChanges();
  }

  get inviteRecipients(): any[] {
    return this.inviteTargetRole === 'photographer'
      ? this.allPhotographersForInvite
      : this.allInfluencersForInvite;
  }

  get selectableInfluencers(): any[] {
    return this.selectableInviteRecipients;
  }

  get inviteSlotsLimit(): number {
    const max = Number(this.invitePanelCampaign?.maxInfluencers || 0);
    return Number.isFinite(max) && max > 0 ? max : 0;
  }

  get inviteSlotsRemaining(): number {
    if (!this.inviteSlotsLimit) return Number.MAX_SAFE_INTEGER;
    return Math.max(this.inviteSlotsLimit - this.invites.length, 0);
  }

  canSelectInfluencerForInvite(id: string): boolean {
    if (this.selectedInfluencerIds.has(id)) return true;
    return this.inviteSlotsRemaining > this.selectedInfluencerIds.size;
  }

  get allSelectableSelected(): boolean {
    const sel = this.selectableInviteRecipients;
    return sel.length > 0 && sel.every(inf => this.selectedInfluencerIds.has(inf._id));
  }

  get selectableInviteRecipients(): any[] {
    return this.filteredInviteRecipients.filter(inf => !this.invitedIds.has(inf._id));
  }

  get filteredInviteRecipients(): any[] {
    const kw = this.influencerSearch.trim().toLowerCase();
    const filtered = this.inviteRecipients.filter(inf => {
      if (!kw) return true;
      return (inf.name || inf.fullname || inf.fullName || '').toLowerCase().includes(kw);
    });

    return [...filtered].sort((a, b) => this.getInviteSuggestionScore(b) - this.getInviteSuggestionScore(a));
  }

  private normalizeLocationValue(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private getInviteLocationContext(): { state: string; district: string } {
    const campaign: any = this.invitePanelCampaign || {};
    const user = this.session.getUser() || {};

    const district =
      campaign?.targetDistrict ||
      campaign?.venueDistrict ||
      user?.location?.district ||
      '';
    const state =
      campaign?.targetState ||
      campaign?.venueState ||
      user?.location?.state ||
      '';

    return {
      district: this.normalizeLocationValue(district),
      state: this.normalizeLocationValue(state),
    };
  }

  private getInviteCategoryHints(): string[] {
    const campaign: any = this.invitePanelCampaign || {};
    const raw = Array.isArray(campaign?.categories) ? campaign.categories : [];
    return raw
      .map((v: any) => String(v || '').trim().toLowerCase())
      .filter((v: string) => !!v);
  }

  private getInviteLocationScore(candidate: any): number {
    const context = this.getInviteLocationContext();
    if (!context.state) return 0;

    const candidateState = this.normalizeLocationValue(candidate?.location?.state);
    const candidateDistrict = this.normalizeLocationValue(candidate?.location?.district);
    if (context.district && candidateDistrict && context.district === candidateDistrict) return 100;
    if (candidateState && candidateState === context.state) return 70;
    return 30;
  }

  private getInviteRelevanceScore(candidate: any): number {
    const hints = this.getInviteCategoryHints();
    if (!hints.length) return 0;

    const corpus = this.inviteTargetRole === 'photographer'
      ? (Array.isArray(candidate?.skills) ? candidate.skills : [])
      : (Array.isArray(candidate?.categories) ? candidate.categories : []);

    const normalized = corpus
      .map((v: any) => String(v || '').trim().toLowerCase())
      .filter((v: string) => !!v);

    const hasMatch = hints.some((hint) => normalized.includes(hint));
    return hasMatch ? 25 : 0;
  }

  private getInviteTopFollowersCount(candidate: any): number {
    const socials = Array.isArray(candidate?.socialMedia) ? candidate.socialMedia : [];
    return socials.reduce((max: number, sm: any) => {
      const followers = Number(sm?.followersCount || 0);
      return followers > max ? followers : max;
    }, 0);
  }

  private getInviteSuggestionScore(candidate: any): number {
    const location = this.getInviteLocationScore(candidate);
    const relevance = this.getInviteRelevanceScore(candidate);
    const followersBoost = Math.min(this.getInviteTopFollowersCount(candidate), 1000000) / 1000000;
    return location + relevance + followersBoost;
  }

  toggleInfluencerSelect(id: string) {
    if (this.selectedInfluencerIds.has(id)) {
      this.selectedInfluencerIds.delete(id);
    } else {
      if (!this.canSelectInfluencerForInvite(id)) {
        const msg = this.inviteSlotsLimit
          ? `Invite limit reached (${this.invites.length}/${this.inviteSlotsLimit}).`
          : 'Invite limit reached for this campaign.';
        this.inviteError = msg;
        this.toast.error(msg);
        this.cd.detectChanges();
        return;
      }
      this.selectedInfluencerIds.add(id);
    }
  }

  toggleSelectAll() {
    if (this.allSelectableSelected) {
      this.selectableInfluencers.forEach(inf => this.selectedInfluencerIds.delete(inf._id));
    } else {
      for (const inf of this.selectableInfluencers) {
        if (!this.canSelectInfluencerForInvite(inf._id)) break;
        this.selectedInfluencerIds.add(inf._id);
      }
    }
  }

  getCount(status: string): number {
    if (!this.campaigns) return 0;
    return this.campaigns.filter(c => this.getCampaignTabStatus(c) === status).length;
  }

  get filteredInvitesByRole(): any[] {
    return this.invites.filter(invite => {
      if (this.inviteTargetRole === 'influencer') {
        // Some invites may have role or type field, fallback to presence of influencerId
        return (
          (invite.role && String(invite.role).toLowerCase() === 'influencer') ||
          !!invite.influencerId
        );
      } else if (this.inviteTargetRole === 'photographer') {
        return (
          (invite.role && String(invite.role).toLowerCase() === 'photographer') ||
          !!invite.photographerId
        );
      }
      return false;
    });
  }

  isPhotographerInvite(invite: any): boolean {
    const role = String(invite?.role || invite?.recipientRole || invite?.campaignId?.inviteRecipientRole || invite?.campaignId?.recipientRole || '').trim().toLowerCase();
    if (role === 'photographer') return true;
    if (role === 'influencer') return false;
    if (this.inviteTargetRole === 'photographer') return true;
    return !!invite?.photographerId && !invite?.influencerId;
  }

  isPhotographerInviteForCampaign(invite: any, campaign: any): boolean {
    const role = String(invite?.role || invite?.recipientRole || campaign?.inviteRecipientRole || campaign?.recipientRole || campaign?.targetRole || invite?.campaignId?.inviteRecipientRole || invite?.campaignId?.recipientRole || '').trim().toLowerCase();
    if (role === 'photographer') return true;
    if (role === 'influencer') return false;
    const campaignRole = this.resolveCampaignInviteTargetRole(campaign);
    if (campaignRole === 'photographer') return true;
    return this.isPhotographerInvite(invite);
  }

  getInviteRecipient(invite: any): any {
    if (!invite) return null;
    if (this.isPhotographerInvite(invite)) {
      const direct = invite?.photographerId || invite?.influencerId || null;
      if (direct && typeof direct === 'object') return direct;
      const rawId = String(direct || '').trim();
      return this.findCachedRecipientById(rawId, 'photographer') || null;
    }
    const direct = invite?.influencerId || invite?.photographerId || null;
    if (direct && typeof direct === 'object') return direct;
    const rawId = String(direct || '').trim();
    return this.findCachedRecipientById(rawId, 'influencer') || null;
  }

  getInviteRecipientName(invite: any): string {
    const recipient = this.getInviteRecipient(invite);
    return recipient?.name || recipient?.fullName || recipient?.fullname || recipient?.username
      || (this.isPhotographerInvite(invite) ? 'Photographer' : 'Influencer');
  }

  getInviteRecipientAvatar(invite: any): string {
    return this.getInfluencerAvatar(this.getInviteRecipient(invite));
  }

  getInviteRecipientUsername(invite: any): string {
    const recipient = this.getInviteRecipient(invite);
    return String(recipient?.username || '').trim();
  }

  isInviteRecipientPremium(invite: any): boolean {
    if (this.isPhotographerInvite(invite)) return false;
    return this.isInfluencerPremium(this.getInviteRecipient(invite));
  }

  getInviteRecipientTier(invite: any): string {
    if (this.isPhotographerInvite(invite)) return '';
    return this.getInfluencerTier(this.getInviteRecipient(invite));
  }

  getInviteRecipientSocialTags(invite: any, campaign: any, max: number = 3): Array<{ platform: string; tier: string }> {
    if (this.isPhotographerInvite(invite)) return [];
    const recipient = this.getInviteRecipient(invite);
    return this.getInviteRelevantSocialTags({ ...invite, influencerId: recipient }, campaign, max);
  }

  getCampaignInviteRecipient(invite: any, campaign: any): any {
    if (!invite) return null;
    if (this.isPhotographerInviteForCampaign(invite, campaign)) {
      const direct = invite?.photographerId || invite?.influencerId || null;
      if (direct && typeof direct === 'object') return direct;
      const rawId = String(direct || '').trim();
      return this.findCachedRecipientById(rawId, 'photographer') || null;
    }
    const direct = invite?.influencerId || invite?.photographerId || null;
    if (direct && typeof direct === 'object') return direct;
    const rawId = String(direct || '').trim();
    return this.findCachedRecipientById(rawId, 'influencer') || null;
  }

  private findCachedRecipientById(
    rawId: string,
    role: 'influencer' | 'photographer',
  ): any | null {
    const id = String(rawId || '').trim();
    if (!id) return null;
    const source = role === 'photographer'
      ? this.allPhotographersForInvite
      : this.allInfluencersForInvite;
    if (!Array.isArray(source) || source.length === 0) return null;
    return source.find((row: any) => {
      const rowId = String(row?._id || row?.id || '').trim();
      return rowId && rowId === id;
    }) || null;
  }

  private ensureRecipientDirectoryLoaded(role: 'influencer' | 'photographer'): void {
    if (role === 'photographer') {
      if (this.photographersForInviteLoading || this.allPhotographersForInvite.length > 0) return;
      this.photographersForInviteLoading = true;
      this.config.getPhotographers().subscribe({
        next: (arr: any[]) => {
          this.allPhotographersForInvite = Array.isArray(arr) ? arr : [];
          this.photographersForInviteLoading = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.photographersForInviteLoading = false;
          this.cd.detectChanges();
        },
      });
      return;
    }

    if (this.influencersForInviteLoading || this.allInfluencersForInvite.length > 0) return;
    this.influencersForInviteLoading = true;
    this.config.getInfluencers().subscribe({
      next: (arr: any[]) => {
        this.allInfluencersForInvite = Array.isArray(arr) ? arr : [];
        this.influencersForInviteLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.influencersForInviteLoading = false;
        this.cd.detectChanges();
      },
    });
  }

  private ensureInviteRecipientDirectoriesLoaded(): void {
    if (!Array.isArray(this.campaigns) || this.campaigns.length === 0) return;
    const targetsPhotographers = this.campaigns.some((campaign: any) =>
      this.resolveCampaignInviteTargetRole(campaign) === 'photographer',
    );
    const targetsInfluencers = this.campaigns.some((campaign: any) =>
      this.resolveCampaignInviteTargetRole(campaign) === 'influencer',
    );

    if (targetsPhotographers) this.ensureRecipientDirectoryLoaded('photographer');
    if (targetsInfluencers) this.ensureRecipientDirectoryLoaded('influencer');
  }

  getCampaignInviteRecipientName(invite: any, campaign: any): string {
    const recipient = this.getCampaignInviteRecipient(invite, campaign);
    return recipient?.name || recipient?.fullName || recipient?.fullname || recipient?.username
      || (this.isPhotographerInviteForCampaign(invite, campaign) ? 'Photographer' : 'Influencer');
  }

  getCampaignInviteRecipientAvatar(invite: any, campaign: any): string {
    return this.getInfluencerAvatar(this.getCampaignInviteRecipient(invite, campaign));
  }

  getCampaignInviteRecipientUsername(invite: any, campaign: any): string {
    const recipient = this.getCampaignInviteRecipient(invite, campaign);
    return String(recipient?.username || '').trim();
  }

  getCampaignInviteRecipientTier(invite: any, campaign: any): string {
    if (this.isPhotographerInviteForCampaign(invite, campaign)) return '';
    return this.getInfluencerTier(this.getCampaignInviteRecipient(invite, campaign));
  }

  getCampaignInviteRecipientSocialTags(invite: any, campaign: any, max: number = 3): Array<{ platform: string; tier: string }> {
    if (this.isPhotographerInviteForCampaign(invite, campaign)) return [];
    const recipient = this.getCampaignInviteRecipient(invite, campaign);
    return this.getInviteRelevantSocialTags({ ...invite, influencerId: recipient }, campaign, max);
  }

  private inferInviteTargetRoleFromInvites(invites: any[]): 'influencer' | 'photographer' | null {
    if (!Array.isArray(invites) || invites.length === 0) return null;
    const photographerRows = invites.filter((invite: any) => this.isPhotographerInvite(invite)).length;
    const influencerRows = invites.length - photographerRows;
    if (photographerRows > 0 && photographerRows >= influencerRows) return 'photographer';
    if (influencerRows > 0) return 'influencer';
    return null;
  }

  private resolveCampaignInviteTargetRole(campaign: any): 'influencer' | 'photographer' {
    const explicit = String(
      campaign?.inviteRecipientRole || campaign?.recipientRole || campaign?.targetRole || '',
    ).trim().toLowerCase();
    if (explicit === 'photographer') return 'photographer';
    if (explicit === 'influencer') return 'influencer';

    const requestKind = String(campaign?.requestKind || '').trim().toLowerCase();
    if (requestKind === 'creative_requirement') return 'photographer';
    if (requestKind === 'photographer_collaboration') return 'influencer';

    const campaignId = String(campaign?._id || '').trim();
    const mappedInvites = campaignId ? (this.campaignInvitesMap.get(campaignId) || []) : [];
    const inferredFromMappedInvites = this.inferInviteTargetRoleFromInvites(mappedInvites);
    if (inferredFromMappedInvites) return inferredFromMappedInvites;

    const inferredFromCampaignInvites = this.inferInviteTargetRoleFromInvites((campaign as any)?.invites || []);
    if (inferredFromCampaignInvites) return inferredFromCampaignInvites;

    const ownerType = String(campaign?.ownerType || '').trim().toLowerCase();
    if (ownerType === 'photographer') return 'influencer';

    const creatorRole = String(campaign?.createdByRole || '').trim().toLowerCase();
    if (creatorRole === 'photographer') return 'influencer';

    return 'influencer';
  }

  getCampaignInviteTargetSingularLabel(campaign: any): string {
    return this.resolveCampaignInviteTargetRole(campaign) === 'photographer' ? 'Photographer' : 'Influencer';
  }

  getCampaignInviteTargetPluralLabel(campaign: any): string {
    return this.resolveCampaignInviteTargetRole(campaign) === 'photographer' ? 'Photographers' : 'Influencers';
  }

  get invitePanelLockedTargetRole(): 'influencer' | 'photographer' | null {
    const campaign: any = this.invitePanelCampaign || {};
    return this.resolveCampaignInviteTargetRole(campaign);
  }

  get showInfluencerInviteTargetTab(): boolean {
    return this.invitePanelLockedTargetRole !== 'photographer';
  }

  get showPhotographerInviteTargetTab(): boolean {
    return this.invitePanelLockedTargetRole !== 'influencer';
  }

  private getCampaignTabStatus(campaign: Campaign): TabStatus {
    const status = String(campaign?.status || '').trim().toLowerCase();
    const hasStartedWork = (this.campaignInvitesMap.get(String(campaign?._id || '')) || []).some((invite: any) => {
      return ['accepted', 'payment_confirmed', 'working', 'submitted', 'approved', 'completed', 'disputed']
        .includes(String(invite?.status || '').trim().toLowerCase());
    });

    if (status === 'completed') return 'completed';
    if (status === 'active') return 'active';
    if (status === 'pending' || status === 'pending_review') {
      return hasStartedWork ? 'active' : 'pending';
    }
    if (status === 'rejected' || status === 'needs_changes' || status === 'draft') {
      if (hasStartedWork || this.isExpired(campaign)) return 'completed';
    }
    return 'draft';
  }

  getCampaignModerationNote(campaign: Campaign): string {
    return String(campaign?.moderationNote || '').trim();
  }

  shouldShowCampaignModerationNote(campaign: Campaign): boolean {
    if (!campaign || this.isInfluencerView) return false;
    const note = this.getCampaignModerationNote(campaign);
    if (!note) return false;
    const status = String(campaign?.status || '').trim().toLowerCase();
    return status === 'needs_changes' || status === 'rejected' || status === 'draft';
  }

  sendSelectedInvites() {
    if (!this.invitePanelCampaign?._id || this.selectedInfluencerIds.size === 0) return;
    this.inviteError = '';
    this.bulkSending = true;
    this.cd.detectChanges();
    const ids = Array.from(this.selectedInfluencerIds);
    const request$ = this.inviteTargetRole === 'photographer'
      ? this.config.invitePhotographers(this.invitePanelCampaign._id, ids)
      : this.config.inviteInfluencers(this.invitePanelCampaign._id, ids);
    request$.subscribe({
      next: (resp: any) => {
        const failures: { influencerId?: string; photographerId?: string; reason: string }[] = Array.isArray(resp?.failures) ? resp.failures : [];
        const sentCount: number = typeof resp?.count === 'number' ? resp.count : 0;
        this.config.getInvitesByCampaign(this.invitePanelCampaign!._id!).subscribe({
          next: (invites: any[]) => {
            this.bulkSending = false;
            if (invites && invites.length > 0 && this.invitePanelCampaign && this.invitePanelCampaign._id) {
              this.invites = invites;
              this.campaignInvitesMap.set(this.invitePanelCampaign._id, invites);
              this.activateCampaign(this.invitePanelCampaign);
            }
            if (sentCount > 0 && failures.length === 0) {
              this.selectedInfluencerIds.clear();
              this.invitePanelSuccessMessage = `${this.inviteTargetPluralLabel} invited successfully!`;
              this.toast.success(`${this.inviteTargetPluralLabel} invited successfully!`);
              setTimeout(() => this.invitePanelSuccessMessage = '', 4000);
            } else if (sentCount > 0 && failures.length > 0) {
              this.selectedInfluencerIds.clear();
              const reasons = Array.from(new Set(failures.map(f => f.reason))).join(' | ');
              const msg = `${sentCount} invite(s) sent, ${failures.length} failed: ${reasons}`;
              this.invitePanelSuccessMessage = msg;
              this.toast.success(msg);
              setTimeout(() => this.invitePanelSuccessMessage = '', 7000);
            } else if (failures.length > 0) {
              const reasons = Array.from(new Set(failures.map(f => f.reason))).join(' | ');
              this.inviteError = `No invites were sent: ${reasons}`;
            } else {
              this.inviteError = 'No invites were created. Please try again.';
            }
            this.cd.detectChanges();
          },
          error: (err: any) => {
            this.bulkSending = false;
            this.inviteError = err?.error?.message || 'Failed to fetch invites after sending.';
            this.cd.detectChanges();
          }
        });
        this.loadAllInvitesForce();
      },
      error: (err: any) => {
        this.bulkSending = false;
        this.inviteError = err?.error?.message || 'Failed to send selected invites.';
        this.cd.detectChanges();
      },
    });
    this.invitePanelSuccessMessage = '';
  }

  get filteredInfluencersForInvite(): any[] {
    return this.filteredInviteRecipients;
  }

  switchInviteTarget(role: 'influencer' | 'photographer') {
    const lockedRole = this.invitePanelLockedTargetRole;
    if (lockedRole && role !== lockedRole) return;
    if (this.inviteTargetRole === role) return;
    this.inviteTargetRole = role;
    this.influencerSearch = '';
    this.selectedInfluencerIds.clear();
    this.inviteError = '';
    this.loadInviteRecipients(true);
    this.cd.detectChanges();
  }

  // ── My Invites (influencer view) ──────────────────────────────
  myInvites: any[] = [];
  myInvitesLoading = false;
  /** Active tab in Inbox: pending | accepted | declined | completed */
  myInviteTab: 'pending' | 'missed' | 'accepted' | 'declined' | 'completed' = 'pending';
  /** Type filter in Inbox: all | brand | collab */
  myInviteTypeFilter: 'all' | 'brand' | 'collab' = 'all';

  // ── Submit-post flow (influencer Accepted tab) ────────────────
  /** Navigate to the shared campaign-submission page — same as dashboard */
  navigateToSubmit(inv: any) {
    this.router.navigate(
      ['/campaign-submission', inv._id],
      { queryParams: { campaignTitle: inv.campaignId?.title || '', inviteStatus: inv.status } }
    );
  }

  private getInviteDeadline(invite: any): Date | null {
    const raw =
      invite?.dueDate ||
      invite?.campaignId?.acceptanceDeadline ||
      invite?.campaign?.acceptanceDeadline ||
      null;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  isInviteMissed(invite: any): boolean {
    const status = String(invite?.status || '').toLowerCase();
    if (status !== 'pending' && status !== 'invited') return false;
    const deadline = this.getInviteDeadline(invite);
    if (!deadline) return false;
    return Date.now() > deadline.getTime();
  }

  get myInvitesPending(): any[] {
    return this.myInvitesTyped.filter((i) => {
      const status = String(i?.status || '').toLowerCase();
      if (status === 'counter_sent') return true;
      return (status === 'pending' || status === 'invited') && !this.isInviteMissed(i);
    });
  }
  get myInvitesMissed(): any[] {
    return this.myInvitesTyped.filter((i) => this.isInviteMissed(i));
  }
  get myInvitesAccepted(): any[] {
    return this.myInvitesTyped.filter(i =>
      ['accepted', 'payment_confirmed', 'working', 'submitted'].includes(i.status)
    );
  }
  get myInvitesDeclined(): any[] {
    return this.myInvitesTyped.filter(i => i.status === 'declined' || i.status === 'withdrawn');
  }
  get myInvitesCompleted(): any[] {
    return this.myInvitesTyped.filter(i =>
      ['completed', 'approved', 'disputed'].includes(i.status)
    );
  }
  /** Invites filtered by type chip (all / brand / collab) */
  get myInvitesTyped(): any[] {
    if (this.myInviteTypeFilter === 'brand') return this.myInvites.filter(i => !this.isCollabInvite(i));
    if (this.myInviteTypeFilter === 'collab') return this.myInvites.filter(i => this.isCollabInvite(i));
    return this.myInvites;
  }
  /** Count of collaboration invites (photographer-created campaigns) */
  get myCollabCount(): number { return this.myInvites.filter(i => this.isCollabInvite(i)).length; }
  /** Count of brand campaign invites */
  get myBrandCount(): number { return this.myInvites.filter(i => !this.isCollabInvite(i)).length; }
  /** Returns true if this invite was sent by a photographer/creator (collaboration), not a brand */
  isCollabInvite(inv: any): boolean {
    const ownerRole = String(
      inv?.campaignId?.ownerType || inv?.campaignId?.createdByRole || inv?.brandId?.role || '',
    ).trim().toLowerCase();
    const requestKind = String(inv?.campaignId?.requestKind || '').trim().toLowerCase();
    return ownerRole === 'photographer'
      || ownerRole === 'videographer'
      || requestKind === 'photographer_collaboration'
      || requestKind === 'videographer_collaboration';
  }

  private isCollaborationCampaign(campaign: any): boolean {
    const roleCandidates = [
      campaign?.createdByRole,
      campaign?.ownerType,
      campaign?.brandId?.role,
      campaign?.campaignOwnerRole,
      campaign?.creatorRole,
    ]
      .map((v: any) => String(v || '').trim().toLowerCase())
      .filter(Boolean);

    if (roleCandidates.some((role: string) => role === 'photographer' || role === 'videographer')) {
      return true;
    }

    const kind = String(campaign?.requestKind || '').trim().toLowerCase();
    if (kind === 'photographer_collaboration' || kind === 'videographer_collaboration') {
      return true;
    }

    return false;
  }

  private isBrandCampaign(campaign: any): boolean {
    return !this.isCollaborationCampaign(campaign);
  }
  /** Human-readable type label for an invite card */
  getInviteTypeLabel(inv: any): string {
    return this.isCollabInvite(inv) ? 'Collaboration' : 'Brand Campaign';
  }
  get myInvitesFiltered(): any[] {
    if (this.myInviteTab === 'missed') return this.myInvitesMissed;
    if (this.myInviteTab === 'accepted') return this.myInvitesAccepted;
    if (this.myInviteTab === 'declined') return this.myInvitesDeclined;
    if (this.myInviteTab === 'completed') return this.myInvitesCompleted;
    return this.myInvitesPending;
  }
  /** Campaign IDs where the influencer already has ANY invite — hide from Open Campaigns */
  get myInvitedCampaignIds(): Set<string> {
    return new Set(this.myInvites.map((i: any) => String(i?.campaignId?._id || i?.campaignId || '')).filter(Boolean));
  }
  /** Open campaigns list filtered to hide ones the influencer already applied to */
  get openCampaignsForInfluencer(): any[] {
    const applied = this.myInvitedCampaignIds;
    return this.campaigns.filter(c => {
      const visibleByScope = this.isInfluencerCollaborationsView
        ? this.isCollaborationCampaign(c)
        : this.isBrandCampaign(c);
      if (!visibleByScope) return false;
      if (this.isCampaignOwnedByCurrentUser(c)) return false;

      if (applied.has(String(c._id || ''))) return false;
      // Non-tier campaigns are visible to all influencers (unless applied)
      if ((c as any)?.campaignMode !== 'tier_filtered_open') return true;
      // For tier-filtered open campaigns, show only if influencer has a qualifying social entry
      return this.getTierQualifyingSocials(c).length > 0;
    });
  }
  openingCampaignIds = new Set<string>();

  tabs: { key: TabStatus; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
  ];

  constructor(
    private config: ConfigService,
    private plans: PlansService,
    private session: SessionService,
    private analytics: AnalyticsService,
    private cd: ChangeDetectorRef,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}


  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  private getCurrentRequesterId(): string {
    const user = this.session.getUser() || {};
    return String(user?.userId || user?._id || user?.id || '').trim();
  }

  private getOwnerCampaignQueryId(): string {
    const requesterId = this.getCurrentRequesterId();
    // Owner-scoped campaign APIs authorize against auth userId.
    if ((this.isInfluencerView || this.isPhotographerView) && requesterId) {
      return requesterId;
    }
    return String(this.brandId || requesterId || '').trim();
  }

  private resolveOwnerId(owner: any, fallbackId: string = ''): string {
    // Prefer authenticated user id for creator-owned workspace queries.
    return String(fallbackId || owner?._id || owner?.id || owner?.brandUsername || '').trim();
  }

  private applyPlanLimits(limits: any[]): void {
    const rows = Array.isArray(limits) ? limits : [];
    const maxActive = Number(rows.find((l: any) => String(l?.key || '') === 'maxActiveCampaigns')?.value);
    if (Number.isFinite(maxActive) && maxActive > 0) {
      this.maxActiveCampaigns = maxActive;
    }
  }

  private syncPlanCapabilities(): void {
    this.plans.getMyCapabilities().subscribe({
      next: (caps: any) => {
        if (!caps || typeof caps !== 'object') return;
        // Keep backward compatibility with places that read `plan` while
        // still exposing canonical `hasPremium` from plans API.
        this.planCapabilities = {
          ...this.planCapabilities,
          ...caps,
          plan: caps?.hasPremium ? 'premium' : 'free',
        };
        this.applyPlanLimits(caps?.limits || []);
        this.cd.detectChanges();
      },
      error: () => {
        // Non-fatal. Profile payload fallback still applies.
      },
    });
  }

  private get isPremiumPlan(): boolean {
    return !!this.planCapabilities?.hasPremium
      || this.planCapabilities?.plan === 'premium'
      || this.planCapabilities?.plan === 'pro';
  }

  ngOnInit() {
    this.submissionApprovalTicker = setInterval(() => {
      this.cd.detectChanges();
    }, 60000);

    const navigationState = typeof history !== 'undefined' ? history.state : null;
    const prefilledRecipients = Array.isArray(navigationState?.searchPrefilledRecipients)
      ? navigationState.searchPrefilledRecipients
      : [];
    if (prefilledRecipients.length > 0) {
      this.searchPrefilledRecipients = prefilledRecipients
        .map((recipient: any) => ({
          id: String(recipient?.id || ''),
          name: String(recipient?.name || recipient?.fullname || recipient?.fullName || ''),
          username: String(recipient?.username || ''),
        }))
        .filter((recipient: any) => !!recipient.id);
      this.searchPrefilledRecipientRole = navigationState?.searchPrefilledRecipientRole === 'photographer'
        ? 'photographer'
        : 'influencer';
      this.pendingSearchPrefill = true;
    }

    const token = this.getToken();
    const requesterId = this.getCurrentRequesterId();
    this.brandId = requesterId;
    const user = this.session.getUser();
    const userRole = String(user?.role || '').trim().toLowerCase();
    this.isInfluencerView = userRole === 'influencer';
    this.isPhotographerView = userRole === 'photographer' || userRole === 'videographer';
    this.syncPlanCapabilities();
    if (this.isPhotographerView) {
      this.photographerWorkspaceView = this.normalizePhotographerWorkspaceView(
        this.route.snapshot.queryParamMap.get('view'),
      );
      this.route.queryParamMap.subscribe((params) => {
        const nextView = this.normalizePhotographerWorkspaceView(params.get('view'));
        if (this.photographerWorkspaceView !== nextView) {
          this.photographerWorkspaceView = nextView;
          this.currentPage = 1;
          this.cd.detectChanges();
        }
      });
    }

    if (this.isInfluencerView) {
      this.route.queryParamMap.subscribe((params) => {
        const tab = this.normalizeInfluencerWorkspaceTab(params.get('tab'));
        this.influencerWorkspaceTab = tab;
        this.myInviteTypeFilter = tab === 'collaborations' ? 'collab' : 'all';
        this.currentPage = 1;
        this.loadInfluencerWorkspaceData();
        this.cd.detectChanges();
      });

      // Influencer: load invites + open active campaigns
      this.myInvitesLoading = true;
      this.loading = true;
      // Seed default payout details from the influencer's profile so the
      // accept card can prefill UPI / mobile / account holder name.
      this.config.getInfluencerProfileById().subscribe({
        next: (profile: any) => {
          const owner = profile?.data?.influencer || profile?.influencer || profile;
          const previousBrandId = this.brandId;
          this.brandId = this.resolveOwnerId(owner, requesterId);
          this.brandName = owner?.name || 'Influencer';
          if (owner?.planCapabilities) {
            this.planCapabilities = owner.planCapabilities;
            this.applyPlanLimits(owner.planCapabilities.limits || []);
          }
          this.defaultPayout = {
            upiId: profile?.payout?.upiId || '',
            mobile: profile?.payout?.mobile || profile?.phoneNumber || '',
            accountHolderName: profile?.payout?.accountHolderName || profile?.name || '',
          };
          this.myInfluencerSocialMedia = (profile?.socialMedia || []).map((sm: any) => ({
            platform: sm.platform || '',
            tier: sm.tier || '',
          }));
          this.cd.detectChanges();
        },
        error: () => { /* non-fatal */ },
      });
      // Data loading is handled by the query-param subscriber above,
      // so Campaigns and Collaborations always use server-side scoped data.
    } else if (this.isPhotographerView) {
      this.loadPhotographerBrandInvites();
      // Load photographer-owned requests immediately using authenticated requester id.
      this.loadCampaigns();
      this.config.getPhotographerProfileById().subscribe({
        next: (profile: any) => {
          const owner = profile?.data?.photographer || profile?.photographer || profile;
          const resolvedOwnerId = this.resolveOwnerId(owner, requesterId);
          const shouldReloadCampaigns = !!resolvedOwnerId && resolvedOwnerId !== this.brandId;
          this.brandId = resolvedOwnerId;
          this.brandName = owner?.name || 'Photographer';
          if (owner?.planCapabilities) {
            this.planCapabilities = owner.planCapabilities;
            this.applyPlanLimits(owner.planCapabilities.limits || []);
          }
          this.defaultPayout = {
            upiId: owner?.payout?.upiId || '',
            mobile: owner?.payout?.mobile || owner?.phoneNumber || '',
            accountHolderName: owner?.payout?.accountHolderName || owner?.name || '',
          };
          if (shouldReloadCampaigns) this.loadCampaigns();
          this.cd.detectChanges();
        },
        error: () => {
          // Non-fatal: campaign data is already loaded using requester id.
          this.cd.detectChanges();
        }
      });
    } else {
      // Brand: load campaigns immediately using authenticated requester id.
      this.loadCampaigns();
      this.config.getBrandProfileById().subscribe({
        next: (profile: any) => {
          const brand = profile?.data?.brand || profile?.brand || profile;
          const resolvedOwnerId = requesterId || brand?._id || brand?.id || '';
          const shouldReloadCampaigns = !!resolvedOwnerId && resolvedOwnerId !== this.brandId;
          this.brandId = resolvedOwnerId;
          this.brandName = brand?.brandName || brand?.name || '';
          if (brand?.planCapabilities) {
            this.planCapabilities = brand.planCapabilities;
            this.applyPlanLimits(brand.planCapabilities.limits || []);
          }
          if (shouldReloadCampaigns) this.loadCampaigns();
          this.cd.detectChanges();
        },
        error: () => {
          // Non-fatal: campaign data is already loaded using requester id.
          this.cd.detectChanges();
        }
      });
    }
  }

  loadPhotographerBrandInvites() {
    if (!this.isPhotographerView) return;
    this.photographerBrandInvitesLoading = true;
    this.config.getMyPhotographerInvites().pipe(
      timeout(CampaignManagementComponent.REFRESH_TIMEOUT_MS),
    ).subscribe({
      next: (invites: any[]) => {
        this.photographerBrandInvites = Array.isArray(invites) ? invites : [];
        this.photographerBrandInvitesLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.photographerBrandInvites = [];
        this.photographerBrandInvitesLoading = false;
        this.cd.detectChanges();
      },
    });
  }

  get photographerPendingBrandInvitesCount(): number {
    return this.photographerBrandInvites.filter((inv: any) => {
      const status = String(inv?.status || '').toLowerCase();
      return status === 'pending' || status === 'invited' || status === 'counter_sent';
    }).length;
  }

  get photographerBrandInvitesPending(): any[] {
    return this.photographerBrandInvites.filter((invite: any) => {
      const status = String(invite?.status || '').toLowerCase();
      if (status === 'counter_sent') return true;
      return (status === 'pending' || status === 'invited') && !this.isInviteMissed(invite);
    });
  }

  get photographerBrandInvitesMissed(): any[] {
    return this.photographerBrandInvites.filter((invite: any) => this.isInviteMissed(invite));
  }

  get photographerInboxInvites(): any[] {
    if (this.isPhotographerCollaborationsView) {
      return this.photographerBrandInvites.filter((invite: any) => this.isCollabInvite(invite));
    }
    return this.photographerBrandInvites;
  }

  get photographerInboxInvitesPending(): any[] {
    return this.photographerInboxInvites.filter((invite: any) => {
      const status = String(invite?.status || '').toLowerCase();
      if (status === 'counter_sent') return true;
      return (status === 'pending' || status === 'invited') && !this.isInviteMissed(invite);
    });
  }

  get photographerInboxInvitesMissed(): any[] {
    return this.photographerInboxInvites.filter((invite: any) => this.isInviteMissed(invite));
  }

  get photographerInboxInvitesAccepted(): any[] {
    return this.photographerInboxInvites.filter((invite: any) =>
      ['accepted', 'payment_confirmed', 'working', 'submitted'].includes(
        String(invite?.status || '').toLowerCase(),
      ),
    );
  }

  get photographerInboxInvitesDeclined(): any[] {
    return this.photographerInboxInvites.filter((invite: any) =>
      ['declined', 'withdrawn'].includes(String(invite?.status || '').toLowerCase()),
    );
  }

  get photographerInboxInvitesCompleted(): any[] {
    return this.photographerInboxInvites.filter((invite: any) =>
      ['completed', 'approved', 'disputed'].includes(String(invite?.status || '').toLowerCase()),
    );
  }

  get photographerInboxInvitesFiltered(): any[] {
    if (this.photographerInviteTab === 'missed') return this.photographerInboxInvitesMissed;
    if (this.photographerInviteTab === 'accepted') return this.photographerInboxInvitesAccepted;
    if (this.photographerInviteTab === 'declined') return this.photographerInboxInvitesDeclined;
    if (this.photographerInviteTab === 'completed') return this.photographerInboxInvitesCompleted;
    return this.photographerInboxInvitesPending;
  }

  get photographerBrandInvitesAccepted(): any[] {
    return this.photographerBrandInvites.filter((invite: any) =>
      ['accepted', 'payment_confirmed', 'working', 'submitted'].includes(
        String(invite?.status || '').toLowerCase(),
      ),
    );
  }

  get photographerBrandInvitesDeclined(): any[] {
    return this.photographerBrandInvites.filter((invite: any) =>
      ['declined', 'withdrawn'].includes(String(invite?.status || '').toLowerCase()),
    );
  }

  get photographerBrandInvitesCompleted(): any[] {
    return this.photographerBrandInvites.filter((invite: any) =>
      ['completed', 'approved', 'disputed'].includes(String(invite?.status || '').toLowerCase()),
    );
  }

  get photographerBrandInvitesFiltered(): any[] {
    if (this.photographerInviteTab === 'missed') return this.photographerBrandInvitesMissed;
    if (this.photographerInviteTab === 'accepted') return this.photographerBrandInvitesAccepted;
    if (this.photographerInviteTab === 'declined') return this.photographerBrandInvitesDeclined;
    if (this.photographerInviteTab === 'completed') return this.photographerBrandInvitesCompleted;
    return this.photographerBrandInvitesPending;
  }

  get photographerLatestBrandInvites(): any[] {
    return [...this.photographerBrandInvites]
      .sort((a: any, b: any) => {
        const at = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bt - at;
      })
      .slice(0, 4);
  }

  getBrandInviteStatusLabel(status: string): string {
    const s = String(status || '').toLowerCase();
    if (s === 'pending' || s === 'invited') return 'Pending';
    if (s === 'counter_sent') return 'Counter Sent';
    if (s === 'accepted' || s === 'payment_confirmed' || s === 'working') return 'Working';
    if (s === 'submitted' || s === 'disputed') return 'Under Review';
    if (s === 'declined') return 'Declined';
    if (s === 'withdrawn') return 'Withdrawn';
    if (s === 'completed') return 'Completed';
    if (s === 'approved') return 'Payout Released';
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Pending';
  }

  canPhotographerRespondInvite(invite: any): boolean {
    const s = String(invite?.status || '').toLowerCase();
    return s === 'pending' || s === 'invited';
  }

  respondToPhotographerBrandInvite(invite: any, status: 'accepted' | 'declined') {
    const inviteId = String(invite?._id || '');
    if (!inviteId || this.photographerRespondingInviteIds.has(inviteId)) return;

    const selectedPostDate =
      status === 'accepted' ? this.photographerInvitePostDates[inviteId] : undefined;

    if (status === 'accepted' && !selectedPostDate) {
      this.showError('Please select a post date before accepting this request.');
      return;
    }

    if (
      status === 'accepted' &&
      selectedPostDate &&
      !this.isSelectedDateValid(invite, selectedPostDate)
    ) {
      this.showError('Selected post date must be between campaign start and end dates.');
      return;
    }

    const finish = (shippingAddress?: ShippingAddress) => {
      this.photographerRespondingInviteIds.add(inviteId);
      this.cd.detectChanges();

      this.config.respondToInvite(
        inviteId,
        status,
        selectedPostDate,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        shippingAddress,
      ).pipe(
        finalize(() => {
          this.photographerRespondingInviteIds.delete(inviteId);
          this.cd.detectChanges();
        }),
      ).subscribe({
        next: () => {
          this.photographerBrandInvites = this.photographerBrandInvites.map((row: any) =>
            String(row?._id || '') === inviteId ? { ...row, status } : row,
          );
          this.toast.success(
            status === 'accepted'
              ? 'Brand request accepted.'
              : 'Brand request declined.',
          );
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to respond to request.');
        },
      });
    };

    if (status === 'accepted' && this.inviteRequiresShippingAddress(invite)) {
      this.promptShippingAddressForInvite(invite).then((address) => {
        if (!address) {
          this.toast.error('Shipping address is required to accept this product collab.');
          return;
        }
        finish(address);
      });
      return;
    }

    finish();
  }

  onPhotographerCardAccept(payload: InviteAcceptPayload) {
    if (payload.postDate) {
      this.selectedInvitePostDates[payload.inviteId] = payload.postDate;
    }
    if (payload.platform && payload.contentType) {
      this.selectedInviteContentType[payload.inviteId] = `${payload.platform}::${payload.contentType}`;
    }
    if (payload.payout) {
      this.selectedInvitePayouts[payload.inviteId] = {
        upiId: payload.payout.upiId || '',
        mobile: payload.payout.mobile || '',
        accountHolderName: payload.payout.accountHolderName || '',
      };
    }
    this.respondToPhotographerInviteById(
      payload.inviteId,
      payload.responseType === 'counter' ? 'counter_sent' : 'accepted',
      payload.counterAmount,
      payload.counterMessage,
    );
  }

  onPhotographerCardDecline(payload: InviteDeclinePayload) {
    this.respondToPhotographerInviteById(payload.inviteId, 'declined');
  }

  onPhotographerCardPostDateChange(inviteId: string, value: string) {
    this.selectedInvitePostDates[inviteId] = value;
  }

  onPhotographerCardContentTypeChange(inviteId: string, key: string) {
    this.selectedInviteContentType[inviteId] = key;
  }

  private respondToPhotographerInviteById(
    inviteId: string,
    status: 'accepted' | 'declined' | 'counter_sent',
    counterAmount?: number,
    counterMessage?: string,
  ) {
    const invite = this.photographerBrandInvites.find((item: any) => item?._id === inviteId);
    if (!invite) {
      this.showError('Invite not found. Please refresh and try again.');
      return;
    }

    const selectedPostDate = status === 'accepted' || status === 'counter_sent'
      ? this.selectedInvitePostDates[inviteId]
      : undefined;
    if ((status === 'accepted' || status === 'counter_sent') && !selectedPostDate) {
      this.showError('Please select a post date before accepting this invite.');
      return;
    }
    if ((status === 'accepted' || status === 'counter_sent') && selectedPostDate && !this.isSelectedDateValid(invite, selectedPostDate)) {
      this.showError('Selected post date must be between campaign start and end dates.');
      return;
    }

    let chosen = this.selectedInviteContentType[inviteId];
    const options = this.getInviteContentTypeOptions(invite);
    if ((status === 'accepted' || status === 'counter_sent') && options.length === 1 && !chosen) {
      chosen = options[0].key;
      this.selectedInviteContentType[inviteId] = chosen;
    }
    if ((status === 'accepted' || status === 'counter_sent') && options.length > 0 && !chosen) {
      this.showError('Please select what you will create for this campaign.');
      return;
    }

    const [selPlatform, selContentType] = chosen ? chosen.split('::') : [undefined, undefined];
    const payout = status === 'accepted' || status === 'counter_sent'
      ? this.selectedInvitePayouts[inviteId]
      : undefined;

    const finish = (shippingAddress?: ShippingAddress) => {
      this.photographerRespondingInviteIds.add(inviteId);
      this.config.respondToInvite(
        inviteId,
        status,
        selectedPostDate,
        selPlatform,
        selContentType,
        counterAmount,
        counterMessage,
        payout,
        shippingAddress,
      ).pipe(
        timeout(20000),
        finalize(() => {
          this.photographerRespondingInviteIds.delete(inviteId);
          this.cd.detectChanges();
        }),
      ).subscribe({
        next: () => {
          this.photographerBrandInvites = this.photographerBrandInvites.map((row: any) =>
            row._id === inviteId ? { ...row, status } : row,
          );
          this.toast.success(
            status === 'accepted'
              ? 'Invite accepted!'
              : status === 'counter_sent'
                ? 'Price flow updated: counter sent.'
                : 'Invite declined.',
          );
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to respond to invite.');
        },
      });
    };

    if ((status === 'accepted' || status === 'counter_sent') && this.inviteRequiresShippingAddress(invite)) {
      this.promptShippingAddressForInvite(invite).then((address) => {
        if (!address) {
          this.toast.error('Shipping address is required to accept this product collab.');
          return;
        }
        finish(address);
      });
      return;
    }

    finish();
  }

  /** True when invite is a brand product collab requiring shipping. */
  private inviteRequiresShippingAddress(invite: any): boolean {
    const campaign = invite?.campaignId;
    if (!campaign || typeof campaign !== 'object') return false;
    return campaign.campaignType === 'product' && campaign.productShippingRequired === true;
  }

  private promptShippingAddressForInvite(invite: any): Promise<ShippingAddress | null> {
    const campaign = invite?.campaignId || {};
    return this.shippingModal.prompt({
      campaignTitle: campaign?.title || campaign?.name || 'Product collab',
      productLabel: campaign?.productDescription
        || (campaign?.productValue ? `Product value ₹${campaign.productValue}` : undefined),
    });
  }

  ngOnDestroy() {
    if (this.submissionApprovalTicker) {
      clearInterval(this.submissionApprovalTicker);
      this.submissionApprovalTicker = null;
    }
  }

  reloadMyInvites() {
    if (typeof window === 'undefined') return;
    const token = this.getToken();
    if (!token) return;
    this.myInvitesLoading = true;
    this.cd.detectChanges();
    this.config.getMyInvites(this.getInfluencerApiScope()).pipe(
      timeout(CampaignManagementComponent.REFRESH_TIMEOUT_MS),
    ).subscribe({
      next: (invites: any[]) => {
        this.myInvites = invites;
        this.trackCompletionFromInviteStatuses(invites);
        this.myInvitesLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.myInvitesLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  get filtered(): Campaign[] {
    if (this.isInfluencerView) {
      if (this.isInfluencerCollaborationsView && this.influencerCollabSubview === 'created') {
        return this.campaigns.filter((campaign: any) =>
          this.isCollaborationCampaign(campaign) && this.isCampaignOwnedByCurrentUser(campaign),
        );
      }
      return this.openCampaignsForInfluencer;
    }
    if (this.isPhotographerCollaborationsView && this.photographerCollabSubview === 'invited') {
      return [];
    }
    return this.campaigns.filter(c => this.getCampaignTabStatus(c) === this.activeTab);
  }

  get totalPages(): number {
    return Math.ceil(this.filtered.length / this.pageSize) || 1;
  }

  get pagedCampaigns(): Campaign[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get showingFrom(): number {
    return this.filtered.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.currentPage * this.pageSize, this.filtered.length);
  }

  switchTab(tab: TabStatus) {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  openCreateForm() {
    if (this.summaryActiveCampaigns >= this.maxActiveCampaigns) {
      // Determine if user is premium or free
      const isPremium = this.isPremiumPlan;
      if (isPremium) {
        this.upgradeBannerMessage = `Premium plan: ${this.summaryActiveCampaigns} / ${this.maxActiveCampaigns} ${this.quotaEntityPluralLabel} used.`;
        this.planLimitError = '';
      } else {
        this.upgradeBannerMessage = '';
        this.planLimitError = `Free plan limit reached: Only ${this.maxActiveCampaigns} active ${this.quotaEntityPluralLabel} allowed. Upgrade for more.`;
      }
      this.showUpgradeBanner = true;
      return;
    }
    this.editingCampaign = null;
    this.formMode = 'create';
    this.showForm = true;
  }

  onManage(campaign: Campaign) {
    // Prefill data is only for create-from-search flow; never carry it into edit.
    this.searchPrefilledRecipients = [];
    this.searchPrefilledRecipientRole = 'influencer';
    this.pendingSearchPrefill = false;

    // Always refresh brand profile before editing
    const ownerProfile$ = this.isPhotographerView
      ? this.config.getPhotographerProfileById()
      : (this.isInfluencerView ? this.config.getInfluencerProfileById() : this.config.getBrandProfileById());
    ownerProfile$.subscribe({
        next: (profile: any) => {
        const owner = this.isPhotographerView
          ? (profile?.data?.photographer || profile?.photographer || profile)
          : (this.isInfluencerView
            ? (profile?.data?.influencer || profile?.influencer || profile)
            : (profile?.data?.brand || profile?.brand || profile));
        this.brandId = this.resolveOwnerId(owner, this.getCurrentRequesterId());
        this.brandName = owner?.brandName || owner?.name || '';
        this.editingCampaign = campaign;
        this.formMode = 'edit';
        this.showForm = true;
        this.cd.detectChanges();
      },
      error: () => {
        // Fallback: still allow edit but warn
        this.editingCampaign = campaign;
        this.formMode = 'edit';
        this.showForm = true;
        this.cd.detectChanges();
      }
    });
  }

  onFormSave(data: Partial<Campaign> & {
    inviteInfluencerIds?: string[];
    inviteRecipientIds?: string[];
    inviteRecipientRole?: 'influencer' | 'photographer';
  }) {
    const { inviteInfluencerIds, inviteRecipientIds, inviteRecipientRole, ...campaignData } = data;
    const existingCampaignRole: 'influencer' | 'photographer' =
      (this.formMode === 'edit' && this.editingCampaign)
        ? this.resolveCampaignInviteTargetRole(this.editingCampaign)
        : 'influencer';
    const recipientRole: 'influencer' | 'photographer' = this.isInfluencerCollaborationsView
      ? 'photographer'
      : (inviteRecipientRole === 'photographer'
        ? 'photographer'
        : (inviteRecipientRole === 'influencer' ? 'influencer' : existingCampaignRole));
    const campaignPayload = {
      ...campaignData,
      inviteRecipientRole: recipientRole,
    };
    const inviteIds = (Array.isArray(inviteRecipientIds) && inviteRecipientIds.length > 0)
      ? inviteRecipientIds
      : (Array.isArray(inviteInfluencerIds) ? inviteInfluencerIds : []);

    // Allow campaign creation if brandId is a non-empty string (for minimal profiles), or a valid ObjectId
    let validBrandId = '';
    if (this.brandId && typeof this.brandId === 'string') {
      if (this.brandId.length === 24 && /^[a-fA-F0-9]{24}$/.test(this.brandId)) {
        validBrandId = this.brandId; // MongoDB ObjectId
      } else if (this.brandId.length > 0) {
        validBrandId = this.brandId; // Minimal profile (username or temp string)
      }
    }
    if (!validBrandId) {
      this.showError('Brand profile not loaded or invalid. Please wait and try again.');
      // Attempt to reload brand profile and update state
      const ownerProfile$ = this.isPhotographerView
        ? this.config.getPhotographerProfileById()
        : (this.isInfluencerView ? this.config.getInfluencerProfileById() : this.config.getBrandProfileById());
      ownerProfile$.subscribe({
        next: (profile: any) => {
          const owner = this.isPhotographerView
            ? (profile?.data?.photographer || profile?.photographer || profile)
            : (this.isInfluencerView
              ? (profile?.data?.influencer || profile?.influencer || profile)
              : (profile?.data?.brand || profile?.brand || profile));
          this.brandId = this.resolveOwnerId(owner, this.getCurrentRequesterId());
          this.brandName = owner?.brandName || owner?.name || '';
          this.cd.detectChanges();
        }
      });
      return;
    }

    if (this.formMode === 'edit' && this.editingCampaign?._id) {
      this.formSaving = true;
      // Capture id before closeForm() nullifies editingCampaign
      const editingId = this.editingCampaign._id;
      this.config.updateCampaign(editingId, { ...campaignPayload, brandId: validBrandId }).subscribe({
        next: (updated: Campaign | null) => {
          this.campaigns = this.campaigns.map(c => {
            if (!c || !c._id) return c;
            if (c._id !== editingId) return c;
            if (updated && updated._id) {
              return { ...c, ...updated };
            } else {
              return c;
            }
          });
          const updatedStatus = (updated as any)?.status || campaignPayload?.status;
          // If there are recipients to invite, send invites and update state before closing form
          if (inviteIds && inviteIds.length > 0) {
            const validIds = inviteIds.filter(id => !!id);
            if (validIds.length > 0) {
              const request$ = recipientRole === 'photographer'
                ? this.config.invitePhotographers(editingId, validIds)
                : this.config.inviteInfluencers(editingId, validIds);
              request$.subscribe({
                next: (resp: any) => {
                  const failures: { influencerId?: string; photographerId?: string; reason: string }[] = Array.isArray(resp?.failures) ? resp.failures : [];
                  const sentCount: number = typeof resp?.count === 'number' ? resp.count : 0;
                  this.closeForm();
                  this.focusPendingTabIfUnderReview(updatedStatus);
                  this.loadCampaigns();

                  if (sentCount > 0 && failures.length === 0) {
                    const msg = this.getSubmitSuccessMessage(updatedStatus, true);
                    this.toastMessage = msg;
                    this.toast.success(msg);
                    this.showSuccessToast = true;
                    setTimeout(() => { this.showSuccessToast = false; this.cd.detectChanges(); }, 4000);
                  } else if (sentCount > 0 && failures.length > 0) {
                    const reasons = Array.from(new Set(failures.map(f => f.reason))).join(' | ');
                    const msg = `${sentCount} invite(s) sent, ${failures.length} failed: ${reasons}`;
                    this.toastMessage = msg;
                    this.toast.success(msg);
                    this.showSuccessToast = true;
                    setTimeout(() => { this.showSuccessToast = false; this.cd.detectChanges(); }, 7000);
                  } else if (failures.length > 0) {
                    const reasons = Array.from(new Set(failures.map(f => f.reason))).join(' | ');
                    const msg = `No invites were sent: ${reasons}`;
                    this.toastMessage = msg;
                    this.toast.error(msg);
                    this.showErrorToast = true;
                    setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 7000);
                  } else {
                    const msg = 'No invites were sent. Please select recipients and try again.';
                    this.toastMessage = msg;
                    this.toast.error(msg);
                    this.showErrorToast = true;
                    setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
                  }

                  this.config.getInvitesByCampaign(editingId).subscribe({
                    next: (invites: any[]) => {
                      this.campaignInvitesMap.set(editingId, invites);
                      this.invites = invites;
                      this.cd.detectChanges();
                    },
                    error: () => {
                      // Non-blocking: UI already refreshed.
                    }
                  });
                },
                error: (err) => {
                  let msg = 'Failed to send invites.';
                  if (err?.error?.message) msg = err.error.message;
                  this.closeForm();
                  this.focusPendingTabIfUnderReview(updatedStatus);
                  this.loadCampaigns();
                  this.toastMessage = msg;
                  this.showErrorToast = true;
                  setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
                  this.cd.detectChanges();
                }
              });
              return; // Prevent double closeForm()
            }
          }
          this.closeForm();
          this.focusPendingTabIfUnderReview(updatedStatus);
          this.loadCampaigns();
          const msg = this.getSubmitSuccessMessage(updatedStatus, false);
          this.toastMessage = msg;
          this.toast.success(msg);
          this.showSuccessToast = true;
          this.cd.detectChanges();
          setTimeout(() => { this.showSuccessToast = false; this.cd.detectChanges(); }, 4000);
        },
        error: (err: any) => {
          const msg = err?.error?.message || err?.message || 'Failed to update collaboration.';
          this.formSaving = false;
          this.toast.error(msg);
          this.cd.detectChanges();
        },
      });
    } else {
      const payload: any = { ...campaignPayload, brandId: validBrandId };
      // debug: creating campaign payload
      // Basic required fields check
      if (!payload.title || !payload.timelineStart || !payload.timelineEnd || !payload.brandId) {
        this.showError('Please fill all required fields (title, timeline, brand).');
        return;
      }
      this.formSaving = true;
      this.config.createCampaign(payload).subscribe({
        next: (created: Campaign) => {
          const createdAny: any = created && typeof created === 'object' ? created : {};
          const createdId = String(
            createdAny?._id || createdAny?.id || createdAny?.campaignId || createdAny?.campaign?._id || '',
          ).trim();
          const createdCampaign: any = createdId
            ? { ...createdAny, _id: createdId }
            : createdAny;

          // Refresh brand profile in background (non-blocking)
          const ownerProfile$ = this.isPhotographerView
            ? this.config.getPhotographerProfileById()
            : (this.isInfluencerView ? this.config.getInfluencerProfileById() : this.config.getBrandProfileById());
          ownerProfile$.subscribe({
            next: (profile: any) => {
              const owner = this.isPhotographerView
                ? (profile?.data?.photographer || profile?.photographer || profile)
                : (this.isInfluencerView
                  ? (profile?.data?.influencer || profile?.influencer || profile)
                  : (profile?.data?.brand || profile?.brand || profile));
              this.brandId = this.resolveOwnerId(owner, this.getCurrentRequesterId());
              this.brandName = owner?.brandName || owner?.name || '';
              this.cd.detectChanges();
            }
          });
          // Send invites to selected recipients if any
          if (inviteIds?.length && createdId) {
            const validIds = inviteIds.filter(id => !!id);
            // debug: inviting recipients after campaign creation
            if (validIds.length === 0) {
              this.closeForm();
              this.focusPendingTabIfUnderReview(createdCampaign?.status || payload?.status);
              this.loadCampaigns();
              const msg = this.getSubmitSuccessMessage(createdCampaign?.status || payload?.status, false);
              this.toastMessage = msg;
              this.toast.success(msg);
              this.showSuccessToast = true;
              this.cd.detectChanges();
              setTimeout(() => { this.showSuccessToast = false; this.cd.detectChanges(); }, 4000);
            } else {
              const request$ = recipientRole === 'photographer'
                ? this.config.invitePhotographers(createdId, validIds)
                : this.config.inviteInfluencers(createdId, validIds);
              request$.subscribe({
                next: (resp: any) => {
                  const failures: { influencerId?: string; photographerId?: string; reason: string }[] = Array.isArray(resp?.failures) ? resp.failures : [];
                  const sentCount: number = typeof resp?.count === 'number' ? resp.count : 0;
                  this.closeForm();
                  this.focusPendingTabIfUnderReview(createdCampaign?.status || payload?.status);
                  this.loadCampaigns();
                  if (sentCount > 0 && failures.length === 0) {
                    const msg = this.getSubmitSuccessMessage(createdCampaign?.status || payload?.status, true);
                    this.toastMessage = msg;
                    this.toast.success(msg);
                    this.showSuccessToast = true;
                    this.cd.detectChanges();
                    setTimeout(() => { this.showSuccessToast = false; this.cd.detectChanges(); }, 4000);
                  } else {
                    const reasons = Array.from(new Set(failures.map(f => f.reason))).join(' | ');
                    const approvalPendingOnly = this.areAllInviteFailuresApprovalPending(failures);
                    const msg = sentCount > 0
                      ? `Campaign created. ${sentCount} invite(s) sent, ${failures.length} failed: ${reasons}`
                      : (approvalPendingOnly
                        ? 'Campaign created successfully. Invites will be available after admin approval.'
                        : `Campaign created, but no invites were sent: ${reasons}`);
                    this.toastMessage = msg;
                    if (sentCount > 0 || approvalPendingOnly) {
                      this.toast.success(msg);
                      this.showSuccessToast = true;
                    } else {
                      this.toast.error(msg);
                      this.showErrorToast = true;
                    }
                    this.cd.detectChanges();
                    setTimeout(() => {
                      this.showSuccessToast = false;
                      this.showErrorToast = false;
                      this.cd.detectChanges();
                    }, 7000);
                  }
                  this.config.getInvitesByCampaign(createdId).subscribe({
                    next: (invites: any[]) => {
                      if (createdId) {
                        this.campaignInvitesMap.set(createdId, invites);
                        this.invites = invites;
                        if (invites && invites.length > 0) {
                          this.activateCampaign(createdCampaign);
                        }
                        this.cd.detectChanges();
                      }
                    },
                    error: () => {
                      // Non-blocking: list already refreshed.
                    }
                  });
                },
                error: (err) => {
                  console.error('[Invite API error]', err);
                  this.closeForm();
                  this.focusPendingTabIfUnderReview(createdCampaign?.status || payload?.status);
                  this.loadCampaigns();
                  this.toastMessage = 'Campaign created, but failed to send invites.';
                  this.showErrorToast = true;
                  this.cd.detectChanges();
                  setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
                }
              });
            }
          } else {
            if (inviteIds?.length && !createdId) {
              this.closeForm();
              this.loadCampaigns();
              this.toastMessage = 'Campaign created, but invite send skipped because campaign ID was missing in response.';
              this.showErrorToast = true;
              this.cd.detectChanges();
              setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
              return;
            }
            this.closeForm();
            this.focusPendingTabIfUnderReview(createdCampaign?.status || payload?.status);
            this.loadCampaigns();
            const msg = this.getSubmitSuccessMessage(createdCampaign?.status || payload?.status, false);
            this.toastMessage = msg;
            this.toast.success(msg);
            this.showSuccessToast = true;
            this.cd.detectChanges();
            setTimeout(() => { this.showSuccessToast = false; this.cd.detectChanges(); }, 4000);
          }
        },
        error: (err) => {
          console.error('Failed to create campaign:', err);
          let toastMsg = '';
          if (err?.error?.message && typeof err.error.message === 'string') {
            toastMsg = err.error.message;
          } else if (err?.message && typeof err.message === 'string') {
            toastMsg = err.message;
          } else if (typeof err === 'string') {
            toastMsg = err;
          } else {
            toastMsg = 'Failed to create campaign. Please check your input and try again.';
          }
          if (err?.error?.message && err.error.message.includes('Plan limit')) {
            const isPremium = this.isPremiumPlan;
            if (isPremium) {
              this.upgradeBannerMessage = `Premium plan: ${this.summaryActiveCampaigns} / ${this.maxActiveCampaigns} ${this.quotaEntityPluralLabel} used.`;
              this.planLimitError = '';
            } else {
              this.upgradeBannerMessage = '';
              this.planLimitError = err.error.message;
            }
            this.showUpgradeBanner = true;
          } else {
            this.planLimitError = '';
            this.upgradeBannerMessage = '';
            this.showUpgradeBanner = false;
          }
          this.toastMessage = toastMsg;
          this.toast.error(toastMsg);
          this.formSaving = false;
          this.showErrorToast = true;
          // debug: showing error toast message (hidden for CI cleanliness)
          this.cd.detectChanges();
          setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
        }
      });
    }
  }

  canDeletePendingCampaign(campaign: Campaign): boolean {
    if (!campaign?._id) return false;
    const status = String(campaign.status || '').toLowerCase();
    if (status !== 'pending' && status !== 'pending_review') return false;

    const invites = this.campaignInvitesMap.get(campaign._id) || [];
    if (!invites.length) return true;

    // Allow delete only when there is no active/accepted work in this request.
    return invites.every((invite: any) => {
      const inviteStatus = String(invite?.status || '').toLowerCase();
      return ['pending', 'invited', 'declined', 'withdrawn'].includes(inviteStatus);
    });
  }

  onDelete(campaign: Campaign) {
    if (!campaign._id) return;
    if (!this.canDeletePendingCampaign(campaign)) {
      this.toast.error('Only pending or in-review campaigns without accepted work can be deleted.');
      return;
    }

    const noun = this.isPhotographerView ? 'collaboration' : 'campaign';
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Delete this ${noun}? This action cannot be undone.`);
    if (!confirmed) return;

    this.config.deleteCampaign(campaign._id).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter(c => c._id !== campaign._id);
        this.campaignInvitesMap.delete(campaign._id!);
        if (this.expandedCampaignId === campaign._id) {
          this.expandedCampaignId = null;
        }
        this.toast.success(`${noun.charAt(0).toUpperCase() + noun.slice(1)} deleted.`);
        this.cd.detectChanges();
      },
      error: (err: any) => {
        const msg = err?.error?.message || `Failed to delete ${noun}.`;
        this.toast.error(msg);
        this.cd.detectChanges();
      },
    });
  }

  closeForm() {
    this.formSaving = false;
    this.showForm = false;
    this.editingCampaign = null;
    this.cd.detectChanges();
  }

  formatBudget(c: Campaign): string {
    if (!c.budgetMin && !c.budgetMax) return '—';
    const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (c.budgetMin && c.budgetMax) return `${fmt(c.budgetMin)} - ${fmt(c.budgetMax)}`;
    return c.budgetMin ? fmt(c.budgetMin) : fmt(c.budgetMax!);
  }

  formatTimeline(c: Campaign): string {
    if (!c.timelineStart) return '—';
    const fmt = (d: string) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    };
    const start = fmt(c.timelineStart);
    const end = c.timelineEnd ? fmt(c.timelineEnd) : '...';
    return `${start} - ${end}`;
  }

  timelineProgress(c: Campaign): number {
    if (!c.timelineStart || !c.timelineEnd) return 0;
    const start = new Date(c.timelineStart).getTime();
    const end = new Date(c.timelineEnd).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  // ── Invite panel ─────────────────────────────────────────────

  loadInviteRecipients(force = false) {
    const role = this.inviteTargetRole;
    if (role === 'photographer') {
      if (!force && this.allPhotographersForInvite.length > 0) return;
      this.photographersForInviteLoading = true;
      this.config.getPhotographers().subscribe({
        next: (arr: any[]) => {
          this.allPhotographersForInvite = Array.isArray(arr) ? arr : [];
          this.photographersForInviteLoading = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.photographersForInviteLoading = false;
          this.cd.detectChanges();
        }
      });
      return;
    }

    if (!force && this.allInfluencersForInvite.length > 0) return;
    this.influencersForInviteLoading = true;
    this.config.getInfluencers().subscribe({
      next: (arr: any[]) => {
        this.allInfluencersForInvite = Array.isArray(arr) ? arr : [];
        this.influencersForInviteLoading = false;
        this.cd.detectChanges();
      },
      error: () => { this.influencersForInviteLoading = false; this.cd.detectChanges(); }
    });
  }

  openInvitePanel(campaign: Campaign) {
    this.invitePanelCampaign = campaign;
    this.invitePanelOpen = true;
    this.inviteTab = 'invited';
    this.inviteTargetRole = this.invitePanelLockedTargetRole || 'influencer';
    this.invitesLoading = true;
    this.invites = [];
    this.config.getInvitesByCampaign(campaign._id!).subscribe({
      next: (invites: any[]) => {
        this.invites = invites;
        if (campaign._id) {
          this.campaignInvitesMap.set(campaign._id, invites);
        }
        const inferredRole = this.inferInviteTargetRoleFromInvites(invites);
        if (inferredRole) {
          this.inviteTargetRole = inferredRole;
        }
        this.invitesLoading = false;
        this.cd.detectChanges();
      },
      error: () => { this.invitesLoading = false; this.cd.detectChanges(); }
    });
    this.loadInviteRecipients();
    const hints = this.getInviteCategoryHints();
    this.analytics.trackCampaignInviteSuggestionsApplied({
      campaignId: campaign._id,
      targetRole: this.inviteTargetRole,
      campaignLocation: campaign?.targetState || campaign?.venueState,
      categoriesMatched: hints.length,
    });
  }

  closeInvitePanel() {
    this.invitePanelOpen = false;
    this.invitePanelCampaign = null;
    this.influencerSearch = '';
    this.inviteError = '';
    this.selectedInfluencerIds.clear();
  }

  sendInvite(influencer: any) {
    if (!this.invitePanelCampaign?._id) return;
    this.inviteError = '';
    this.sendingInviteIds.add(influencer._id);
    this.cd.detectChanges();
    const request$ = this.inviteTargetRole === 'photographer'
      ? this.config.createCampaignInvite({
          campaignId: this.invitePanelCampaign._id,
          influencerId: influencer._id,
          recipientRole: 'photographer',
        })
      : this.config.createCampaignInvite({
          campaignId: this.invitePanelCampaign._id,
          influencerId: influencer._id,
        });
    request$.subscribe({
      next: () => {
        this.analytics.trackCampaignInviteSent({
          campaignId: this.invitePanelCampaign!._id!,
          recipientId: influencer._id,
          recipientType: this.inviteTargetRole,
          recipientLocation: influencer?.location?.state || undefined,
        });
        this.config.getInvitesByCampaign(this.invitePanelCampaign!._id!).subscribe({
          next: (invites: any[]) => {
            this.sendingInviteIds.delete(influencer._id);
            if (invites && invites.length > 0) {
              this.invites = invites;
              if (this.invitePanelCampaign && this.invitePanelCampaign._id) {
                this.campaignInvitesMap.set(this.invitePanelCampaign._id, invites);
                // Only activate campaign if invites exist
                this.activateCampaign(this.invitePanelCampaign);
              }
              this.selectedInfluencerIds.clear();
              this.invitePanelSuccessMessage = `${this.inviteTargetSingularLabel} invited successfully!`;
              this.toast.success(`${this.inviteTargetSingularLabel} invited successfully!`);
              setTimeout(() => this.invitePanelSuccessMessage = '', 4000);
            } else {
              this.inviteError = 'No invites were created. Please try again.';
            }
            this.cd.detectChanges();
          },
          error: (err: any) => {
            this.sendingInviteIds.delete(influencer._id);
            this.inviteError = err?.error?.message || 'Failed to fetch invites after sending.';
            this.cd.detectChanges();
          }
        });
        this.loadAllInvitesForce();
      },
      error: (err: any) => {
        this.sendingInviteIds.delete(influencer._id);
        this.inviteError = err?.error?.message || 'Failed to send invite. Please try again.';
        this.cd.detectChanges();
        this.loadAllInvitesForce();
      }
    });
  }

  private isDefaultAvatarUrl(url: string): boolean {
    const u = (url || '').toLowerCase();
    return u.includes('default-profile')
      || u.includes('default-avatar')
      || u.includes('default_profile')
      || u.includes('defaultprofile')
      || u.includes('placeholder')
      || u.includes('profile-brands')
      || u.includes('trendstarz-logo')
      || u.includes('/logo')
      || u.includes('logo.')
      || u.includes('brand-logo')
      || u.includes('site-logo')
      || (u.includes('trendstarz') && u.includes('logo'));
  }

  getInfluencerAvatar(inf: any): string {
      const candidates: string[] = [];
      if (Array.isArray(inf?.profileImages) && inf.profileImages.length > 0) {
        if (typeof inf.profileImages[0]?.url === 'string') candidates.push(inf.profileImages[0].url);
        if (typeof inf.profileImages[0] === 'string') candidates.push(inf.profileImages[0]);
      }
      if (typeof inf?.profileImage === 'string') candidates.push(inf.profileImage);
      if (typeof inf?.profilePicture === 'string') candidates.push(inf.profilePicture);
      if (typeof inf?.avatar === 'string') candidates.push(inf.avatar);

      for (const candidate of candidates) {
        const trimmed = (candidate || '').trim();
        if (trimmed && !this.isDefaultAvatarUrl(trimmed)) return trimmed;
      }
      return '';
  }

  getInfluencerInitials(name: string): string {
    const n = String(name || '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase() || '?';
    const first = parts[0].charAt(0).toUpperCase() || '';
    const last = parts[parts.length - 1].charAt(0).toUpperCase() || '';
    return (first + last) || first || '?';
  }

  getInitialsColor(name: string): string {
    const colors = ['#e8612d','#2b6cb0','#22b37a','#805ad5','#d69e2e','#c53030','#2c7a7b','#b7791f'];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  getTopSocialMedia(inf: any): string {
    if (!Array.isArray(inf.socialMedia) || inf.socialMedia.length === 0) return '';
    const top = inf.socialMedia.reduce((best: any, cur: any) =>
      (cur.followersCount || 0) > (best.followersCount || 0) ? cur : best
    , inf.socialMedia[0]);
    const platform = (top.platform || '').toLowerCase();
    const label = platform === 'instagram' ? 'IG'
      : platform === 'youtube' ? 'YT'
      : platform === 'twitter' || platform === 'x' ? 'X'
      : platform.slice(0, 2).toUpperCase();
    const count = this.formatFollowers(top.followersCount || 0);
    return count ? `${label} ${count}` : label;
  }

  getInfluencerSocialTags(inf: any, max: number = 3): Array<{ platform: string; tier: string }> {
    if (!Array.isArray(inf?.socialMedia) || inf.socialMedia.length === 0) return [];
    const normalizeKey = (platformRaw: string): string => {
      const p = platformRaw.toLowerCase();
      if (p.includes('instagram')) return 'ig';
      if (p.includes('youtube')) return 'yt';
      if (p === 'x' || p.includes('twitter')) return 'x';
      if (p.includes('facebook')) return 'fb';
      if (p.includes('linkedin')) return 'in';
      if (p.includes('tiktok')) return 'tt';
      return p;
    };

    const labelByKey: Record<string, string> = {
      ig: 'IG',
      yt: 'YT',
      x: 'X',
      fb: 'FB',
      in: 'IN',
      tt: 'TT',
    };

    const order = ['ig', 'yt', 'x', 'fb', 'in', 'tt'];
    const tiers = new Map<string, string>();

    for (const sm of inf.socialMedia) {
      const key = normalizeKey(String(sm?.platform || ''));
      const tier = String(sm?.tier || '').trim();
      if (!tiers.has(key) || (!tiers.get(key) && tier)) {
        tiers.set(key, tier);
      }
    }

    const known = order
      .filter((k) => tiers.has(k))
      .map((k) => ({
        platform: labelByKey[k],
        tier: tiers.get(k) || 'Not set',
      }));

    const unknown = Array.from(tiers.entries())
      .filter(([k]) => !order.includes(k))
      .map(([k, v]) => ({
        platform: k.slice(0, 2).toUpperCase(),
        tier: v || 'Not set',
      }));

    return [...known, ...unknown].slice(0, max);
  }

  /**
   * For tier-filtered campaigns, show only the invite-selected platform tier chip
   * so brand sees the exact relevant fit (e.g. IG · Mid-Tier).
   */
  getInviteRelevantSocialTags(inv: any, campaign: any, max: number = 3): Array<{ platform: string; tier: string }> {
    const all = this.getInfluencerSocialTags(inv?.influencerId || {}, max);
    if (!all.length) return all;
    if (String(campaign?.campaignMode || '') !== 'tier_filtered_open') return all;

    const selected = String(inv?.selectedPlatform || '').trim().toLowerCase();
    if (!selected) return all;

    const toKey = (platformRaw: string): string => {
      const p = String(platformRaw || '').toLowerCase();
      if (p.includes('instagram')) return 'ig';
      if (p.includes('youtube')) return 'yt';
      if (p === 'x' || p.includes('twitter')) return 'x';
      if (p.includes('facebook')) return 'fb';
      if (p.includes('linkedin')) return 'in';
      if (p.includes('tiktok')) return 'tt';
      return p;
    };

    const key = toKey(selected);
    const filtered = all.filter((sm) => toKey(sm.platform) === key);
    return filtered.length ? filtered.slice(0, max) : all;
  }

  isInfluencerPremium(inf: any): boolean {
    if (!inf) return false;
    if (inf.isPremium === true) return true;
    if (!inf.premiumEnd) return false;
    const end = new Date(inf.premiumEnd);
    return !Number.isNaN(end.getTime()) && end >= new Date();
  }

  getInfluencerTier(inf: any): string { return getInfluencerPrimaryTier(inf); }

  formatFollowers(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
    return n > 0 ? String(n) : '';
  }

  timelineProgressText(c: Campaign): string {
    const submitted = this.getCardSubmittedCount(c);
    if (submitted > 0) {
      return submitted === 1 ? '1 under review' : `${submitted} under review`;
    }

    const completed = this.getCardCompletedCount(c);
    if (completed > 0) {
      return completed === 1 ? '1 completed' : `${completed} completed`;
    }

    const acceptedOrBeyond = this.getCardAcceptedCount(c);
    if (acceptedOrBeyond > 0) {
      return 'Working';
    }

    const pct = this.timelineProgress(c);
    if (pct === 0) return 'Not started';
    if (pct >= 100) return 'Completed';
    return `${pct}% complete`;
  }

  getCampaignSubtitle(c: Campaign): string {
    const cat = c.categories?.length ? c.categories[0] : '';
    const desc = c.description ? c.description.slice(0, 28) + (c.description.length > 28 ? '…' : '') : '';
    if (cat && desc) return `${cat} · ${desc}`;
    return cat || desc;
  }

  /** Returns brand info from an open campaign (populated by findPublic on backend) */
  getCampaignBrand(c: any): { name: string; logo: string | null; username: string } {
    const b = (c as any).brand;
    if (!b) return { name: '', logo: null, username: '' };
    // brand.logo is already resolved by the backend (brandLogo[0].url)
    // Also handle invite objects where brandId is populated with brandLogo array
    let logo = b.logo || null;
    if (!logo && Array.isArray(b.brandLogo) && b.brandLogo.length) {
      logo = b.brandLogo[0]?.url || null;
    }
    return { name: b.name || b.brandName || '', logo, username: b.username || b.brandUsername || '' };
  }

  getCardInvitedCount(c: Campaign): number {
    const key = this.getCampaignMapKey(c);
    if (!key) return 0;
    return this.campaignInvitesMap.get(key)?.length || 0;
  }

  /** Has the campaign reached its `maxInfluencers` invite quota? */
  isInviteQuotaFull(c: Campaign | null | undefined): boolean {
    if (!c) return false;
    const max = Number((c as any).maxInfluencers || 0);
    if (max <= 0) return false;
    return this.getCardInvitedCount(c) >= max;
  }

  /** Statuses where contact unlock is meaningful (i.e., influencer has accepted or beyond). */
  isUnlockableStatus(status: string): boolean {
    return ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed'].includes(String(status));
  }

  private isContactPaymentConfirmedStatus(status: string): boolean {
    return ['payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed'].includes(String(status));
  }

  private isLocationCampaign(inv: any, campaign?: any): boolean {
    const campaignType = String(
      campaign?.campaignType ||
      inv?.campaign?.campaignType ||
      inv?.campaignId?.campaignType ||
      this.invitePanelCampaign?.campaignType ||
      ''
    ).toLowerCase();
    return campaignType === 'invite_location';
  }

  canRevealInviteContact(inv: any, campaign?: any): boolean {
    const status = String(inv?.status || '');
    return this.isContactPaymentConfirmedStatus(status);
  }

  /** Build a WhatsApp deep-link from a phone number. */
  getWhatsappLink(phone: string | null | undefined): string | null {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.startsWith('91') ? digits : `91${digits}`;
    return `https://wa.me/${withCountry}`;
  }

  getInviteRecipientPhone(invite: any): string {
    const recipient = this.getInviteRecipient(invite) || {};
    const candidates = [
      recipient?.phoneNumber,
      recipient?.phone,
      recipient?.mobile,
      recipient?.mobileNumber,
      recipient?.contactNumber,
    ];
    for (const value of candidates) {
      const phone = String(value || '').trim();
      if (phone) return phone;
    }
    return '';
  }

  private asBoolean(value: any): boolean | null {
    if (value === true) return true;
    if (value === false) return false;
    if (value == null) return null;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
      return null;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    }
    return null;
  }

  private mobileVerificationState(recipient: any): boolean | null {
    if (!recipient) return null;
    const mobileFlag =
      this.asBoolean(recipient?.isMobileVerified) ??
      this.asBoolean(recipient?.mobileVerified) ??
      this.asBoolean(recipient?.phoneVerified) ??
      this.asBoolean(recipient?.isPhoneVerified);
    if (mobileFlag === true) return true;
    if (mobileFlag === false) return false;
    return null;
  }

  private emailVerificationState(recipient: any): boolean | null {
    if (!recipient) return null;
    const emailFlag =
      this.asBoolean(recipient?.isEmailVerified) ??
      this.asBoolean(recipient?.emailVerified);
    if (emailFlag === true) return true;
    if (emailFlag === false) return false;
    return null;
  }

  private contactPreference(invite: any, recipient: any, key: 'email' | 'call' | 'whatsapp'): boolean | null {
    // Photographer profiles may not explicitly capture contact channel toggles.
    // Do not suppress paid/unlocked contact visibility based on default-false snapshots.
    if (this.isPhotographerInvite(invite)) {
      return true;
    }
    // If the invite has a snapshot (captured at acceptance time), use it as the authoritative source.
    if (invite?.acceptedContactSnapshotAt) {
      return this.asBoolean(invite?.acceptedContact?.[key]);
    }
    // No snapshot means this is a pre-feature invite — default to true so all
    // verified contact methods are shown regardless of the current profile state.
    return true;
  }

  canShowRecipientEmail(invite: any): boolean {
    const recipient = this.getInviteRecipient(invite);
    if (!recipient?.email) return false;
    if (this.isPhotographerInvite(invite)) return true;
    const pref = this.contactPreference(invite, recipient, 'email');
    if (pref === false) return false;
    const verified = this.emailVerificationState(recipient);
    if (pref === true) {
      // If verification state is missing in payload, do not hide explicitly selected method.
      return verified !== false;
    }
    if (verified !== null) return verified;
    return true;
  }

  canShowRecipientCall(invite: any): boolean {
    const recipient = this.getInviteRecipient(invite);
    const phone = this.getInviteRecipientPhone(invite);
    if (!phone) return false;
    if (this.isPhotographerInvite(invite)) return true;
    const pref = this.contactPreference(invite, recipient, 'call');
    if (pref === false) return false;
    const verified = this.mobileVerificationState(recipient);
    if (pref === true) {
      return verified !== false;
    }
    return verified === true;
  }

  canShowRecipientWhatsapp(invite: any): boolean {
    const recipient = this.getInviteRecipient(invite);
    const phone = this.getInviteRecipientPhone(invite);
    if (!this.getWhatsappLink(phone)) return false;
    if (this.isPhotographerInvite(invite)) return true;
    const pref = this.contactPreference(invite, recipient, 'whatsapp');
    if (pref === false) return false;
    const verified = this.mobileVerificationState(recipient);
    if (pref === true) {
      return verified !== false;
    }
    return verified === true;
  }

  /** Brand-side: trigger contact unlock for an accepted invite. */
  unlockInviteContact(inv: any): void {
    if (!inv?._id || this.unlockingInviteIds.has(inv._id)) return;
    this.unlockingInviteIds.add(inv._id);
    this.cd.detectChanges();
    this.config.unlockInviteContact(inv._id).subscribe({
      next: (resp: any) => {
        const data = resp?.data || resp;
        // Refresh the local invite snapshot so the UI flips to "unlocked"
        inv.unlocked = true;
        inv.unlockedAt = data?.unlockedAt || new Date().toISOString();
        inv.unlockType = data?.unlockType;
        // Refetch invites for the campaign so contact fields populate from the freshly-permitted projection
        const campaignId = String(inv.campaignId || this.invitePanelCampaign?._id || '');
        if (campaignId) {
          this.config.getInvitesByCampaign(campaignId).subscribe({
            next: (invites: any[]) => {
              this.campaignInvitesMap.set(campaignId, invites);
              if (this.invitePanelCampaign?._id === campaignId) {
                this.invites = invites;
              }
              this.unlockingInviteIds.delete(inv._id);
              this.cd.detectChanges();
            },
            error: () => {
              this.unlockingInviteIds.delete(inv._id);
              this.cd.detectChanges();
            },
          });
        } else {
          this.unlockingInviteIds.delete(inv._id);
          this.cd.detectChanges();
        }
        this.toast.success('Contact unlocked.');
      },
      error: (err: any) => {
        this.unlockingInviteIds.delete(inv._id);
        const msg = err?.error?.message || err?.message || 'Failed to unlock contact.';
        this.toast.error(msg);
        this.cd.detectChanges();
      },
    });
  }

  // ── Slice E: Buckets ──────────────────────────────────────────
  /** Classify an invite into a brand-dashboard bucket. */
  getInviteBucket(
    inv: any,
  ): 'accepted_unlocked' | 'waiting_unlock' | 'pending' | 'declined' | 'disputed' | 'completed' | 'other' {
    if (!inv) return 'other';
    const s = inv.status;
    if (s === 'completed') return 'completed';
    if (s === 'disputed' || inv.locationVisit?.status === 'no_show') return 'disputed';
    if (s === 'declined' || s === 'withdrawn') return 'declined';
    if (s === 'counter_sent') return 'pending';
    if (s === 'pending') return 'pending';
    const accepted = ['accepted', 'payment_confirmed', 'working', 'submitted'];
    if (accepted.includes(s)) return inv.unlocked ? 'accepted_unlocked' : 'waiting_unlock';
    return 'other';
  }

  getBucketCount(bucket: string): number {
    return (this.invites || []).filter((i: any) => this.getInviteBucket(i) === bucket).length;
  }

  /** Is this invite past its `dueDate`? */
  isOverdue(inv: any): boolean {
    if (!inv?.dueDate) return false;
    const due = new Date(inv.dueDate).getTime();
    if (!Number.isFinite(due)) return false;
    if (['completed', 'declined', 'withdrawn'].includes(inv.status)) return false;
    return Date.now() > due;
  }

  // ── Slice E: Action gating ────────────────────────────────────
  canRemind(inv: any): boolean {
    if (!inv) return false;
    return ['pending', 'accepted', 'payment_confirmed', 'working'].includes(inv.status);
  }

  isRemindBlockedByClosure(inv: any, c: Campaign): boolean {
    return this.isInvitePendingOrInvited(inv) && this.isAcceptanceClosed(c);
  }

  isRemindBlockedInPanel(inv: any): boolean {
    return this.isInvitePendingOrInvited(inv) && this.isInvitePanelAcceptanceClosed();
  }

  canWithdraw(inv: any): boolean {
    // Allow removal of pending/invited/accepted invites.
    // Once the creator has started working (payment_confirmed, working, submitted, etc.) it is locked.
    const removableStatuses = new Set(['pending', 'invited', 'accepted']);
    return removableStatuses.has(inv?.status);
  }

  canRespondToCounter(inv: any): boolean {
    const inviteStatus = this.getHostInviteEffectiveStatus(inv);
    const counterStatus = String(inv?.counterOffer?.status || '').toLowerCase();
    const requestedAmount = Number(inv?.counterOffer?.requestedAmount || 0);
    const unresolvedLegacyCounter =
      inviteStatus === 'counter_sent' &&
      requestedAmount > 0 &&
      !inv?.counterOffer?.resolvedAt &&
      (!counterStatus || counterStatus === 'accepted');
    return !!inv?._id
      && inviteStatus === 'counter_sent'
      && (counterStatus === 'sent' || unresolvedLegacyCounter)
      && !this.actioningInviteIds.has(inv._id);
  }

  getHostInviteEffectiveStatus(inv: any): string {
    const base = String(inv?.status || '').toLowerCase();
    const counterStatus = String(inv?.counterOffer?.status || '').toLowerCase();
    const requestedAmount = Number(inv?.counterOffer?.requestedAmount || 0);
    const unresolvedLegacyCounter =
      base === 'accepted' &&
      requestedAmount > 0 &&
      !inv?.counterOffer?.resolvedAt &&
      (!counterStatus || counterStatus === 'accepted');

    if (counterStatus === 'sent' || counterStatus === 'brand_sent' || unresolvedLegacyCounter) {
      return 'counter_sent';
    }
    return base;
  }

  canShowConfirmCollaboration(inv: any, campaign?: Campaign | null): boolean {
    const campaignType = String((campaign as any)?.campaignType || '').toLowerCase();
    if (campaignType !== 'paid_collab') return false;
    if (this.getHostInviteEffectiveStatus(inv) !== 'accepted') return false;
    if (!!inv?.unlocked) return false;
    const counterStatus = String(inv?.counterOffer?.status || '').toLowerCase();
    return counterStatus !== 'sent' && counterStatus !== 'brand_sent';
  }

  getCounterOfferSummary(inv: any, campaign?: any): string {
    return buildAdminOfferTrailText({
      ...inv,
      campaign,
      campaignAmountPaise: Number(
        inv?.campaignAmountPaise
        || campaign?.pricePerInfluencer
        || campaign?.amount
        || 0,
      ),
    });
  }

  shouldShowHostCounterSummary(inv: any, campaign?: any): boolean {
    return this.getCounterOfferSummary(inv, campaign).length > 0;
  }

  respondToInviteCounter(
    inv: any,
    action: 'accept' | 'decline' | 'counter',
    campaign?: any,
    revisedCounterAmount?: number,
  ): void {
    const inviteId = String(inv?._id || '');
    if (!inviteId || this.actioningInviteIds.has(inviteId)) return;

    if (action === 'counter' && !Number.isFinite(Number(revisedCounterAmount))) {
      this.openRevisedCounterModal(inv, campaign);
      return;
    }
    const normalizedRevisedCounterAmount = Number(revisedCounterAmount);
    const hasRevisedCounterAmount = Number.isFinite(normalizedRevisedCounterAmount) && normalizedRevisedCounterAmount > 0;
    const useRevisedCounterAmount = action === 'counter' && hasRevisedCounterAmount ? Math.round(normalizedRevisedCounterAmount) : undefined;
    const isModalCounterSubmit = action === 'counter' && !!useRevisedCounterAmount;

    this.actioningInviteIds.add(inviteId);
    this.cd.detectChanges();

    this.config.respondToCounterOffer(inviteId, action, useRevisedCounterAmount).pipe(
      finalize(() => {
        this.actioningInviteIds.delete(inviteId);
        this.cd.detectChanges();
      }),
    ).subscribe({
      next: (res: any) => {
        const nextStatus = String(
          res?.invite?.status || (action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'counter_sent'),
        );
        if (campaign?.invites && Array.isArray(campaign.invites)) {
          campaign.invites = campaign.invites.map((row: any) =>
            String(row?._id || '') === inviteId
              ? { ...row, ...(res?.invite || {}), status: nextStatus }
              : row,
          );
        }
        if (this.invites && Array.isArray(this.invites)) {
          this.invites = this.invites.map((row: any) =>
            String(row?._id || '') === inviteId
              ? { ...row, ...(res?.invite || {}), status: nextStatus }
              : row,
          );
        }
        if (isModalCounterSubmit) {
          this.closeRevisedCounterModal();
        }
        this.toast.success(
          action === 'accept'
            ? 'Counter offer accepted.'
            : action === 'decline'
              ? 'Counter offer declined. Receiver can still accept initial price.'
              : 'Revised counter sent.',
        );
      },
      error: (err: any) => {
        if (isModalCounterSubmit) {
          this.revisedCounterModalError = err?.error?.message || 'Failed to send revised offer.';
          this.cd.detectChanges();
          return;
        }
        this.toast.error(err?.error?.message || 'Failed to respond to counter offer.');
      },
    });
  }

  get isRevisedCounterSubmitting(): boolean {
    return !!this.revisedCounterModalInvite?._id && this.actioningInviteIds.has(this.revisedCounterModalInvite._id);
  }

  get revisedCounterCurrentRequestedAmount(): number {
    const amount = Number(this.revisedCounterModalInvite?.counterOffer?.requestedAmount || 0);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  openRevisedCounterModal(inv: any, campaign?: any): void {
    if (!inv?._id || this.actioningInviteIds.has(inv._id)) return;
    this.revisedCounterModalInvite = inv;
    this.revisedCounterModalCampaign = campaign || null;
    this.revisedCounterAmountInput = '';
    this.revisedCounterModalError = '';
    this.revisedCounterModalOpen = true;
    this.cd.detectChanges();
  }

  closeRevisedCounterModal(): void {
    if (this.isRevisedCounterSubmitting) return;
    this.revisedCounterModalOpen = false;
    this.revisedCounterModalInvite = null;
    this.revisedCounterModalCampaign = null;
    this.revisedCounterAmountInput = '';
    this.revisedCounterModalError = '';
    this.cd.detectChanges();
  }

  submitRevisedCounterFromModal(): void {
    const inv = this.revisedCounterModalInvite;
    if (!inv?._id || this.isRevisedCounterSubmitting) return;
    const parsed = Number(String(this.revisedCounterAmountInput || '').trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.revisedCounterModalError = 'Please enter a valid revised amount in rupees.';
      this.cd.detectChanges();
      return;
    }
    this.revisedCounterModalError = '';
    this.respondToInviteCounter(inv, 'counter', this.revisedCounterModalCampaign, Math.round(parsed));
  }

  /** Returns a context-appropriate title for the withdraw/remove button. */
  getWithdrawTitle(inv: any): string {
    if (inv?.status === 'accepted') {
      return 'Remove this accepted creator (they have not started working yet)';
    }
    return 'Withdraw this pending invite';
  }

  canDeclineAccepted(inv: any, campaign?: any): boolean {
    // Covered by canWithdraw — always return false to avoid duplicate button.
    return false;
  }

  canReport(inv: any): boolean {
    if (!inv) return false;
    if (inv.status === 'pending' || inv.status === 'declined' || inv.status === 'withdrawn') return false;
    if (inv.status === 'completed' || inv.status === 'disputed') return false;
    return true;
  }

  canManageFulfillment(inv: any, campaign: any): boolean {
    if (!inv || !campaign) return false;
    const t = campaign.campaignType;
    if (t !== 'product') return false;
    // Must have a working/accepted relationship
    return ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed'].includes(inv.status);
  }

  canMarkVisited(inv: any, campaign: any): boolean {
    if (!inv || !campaign || campaign.campaignType !== 'invite_location') return false;
    const status = String(inv?.locationVisit?.status || '').toLowerCase();
    if (status === 'checked_in') return false;
    return ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed'].includes(String(inv?.status || '').toLowerCase());
  }

  hasVisitedStatus(inv: any, campaign: any): boolean {
    return !!inv && campaign?.campaignType === 'invite_location' && String(inv?.locationVisit?.status || '').toLowerCase() === 'checked_in';
  }

  getParticipantDateLabel(campaign: any): string {
    return campaign?.campaignType === 'invite_location' ? 'Visit Date' : 'Posts';
  }

  getVisitedStatusText(inv: any): string {
    const checkedInAt = inv?.locationVisit?.checkedInAt;
    if (!checkedInAt) return 'Visited';
    const time = new Date(checkedInAt).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `Visited at ${time}`;
  }

  openVisitConfirmModal(inv: any, campaign: Campaign | null | undefined): void {
    if (!inv?._id || !campaign || this.actioningInviteIds.has(inv._id)) return;
    this.visitConfirmInvite = inv;
    this.visitConfirmCampaign = campaign;
    this.visitConfirmModalOpen = true;
    this.cd.detectChanges();
  }

  closeVisitConfirmModal(): void {
    if (this.isVisitConfirmSubmitting) return;
    this.visitConfirmModalOpen = false;
    this.visitConfirmInvite = null;
    this.visitConfirmCampaign = null;
    this.cd.detectChanges();
  }

  get isVisitConfirmSubmitting(): boolean {
    return !!this.visitConfirmInvite?._id && this.actioningInviteIds.has(this.visitConfirmInvite._id);
  }

  private syncInviteLocationVisitState(inviteId: string, locationVisit: any, campaign?: Campaign | null): void {
    const applyUpdate = (row: any) =>
      String(row?._id || '') === inviteId ? { ...row, locationVisit } : row;

    if (campaign?._id) {
      const key = String(campaign._id);
      const rows = this.campaignInvitesMap.get(key);
      if (rows) this.campaignInvitesMap.set(key, rows.map(applyUpdate));
      if (Array.isArray((campaign as any).invites)) {
        (campaign as any).invites = (campaign as any).invites.map(applyUpdate);
      }
    }
    if (Array.isArray(this.invites)) {
      this.invites = this.invites.map(applyUpdate);
    }
    if (this.fulfillInvite && String(this.fulfillInvite?._id || '') === inviteId) {
      this.fulfillInvite = { ...this.fulfillInvite, locationVisit };
    }
    if (this.visitConfirmInvite && String(this.visitConfirmInvite?._id || '') === inviteId) {
      this.visitConfirmInvite = { ...this.visitConfirmInvite, locationVisit };
    }
  }

  confirmParticipantVisited(): void {
    const inv = this.visitConfirmInvite;
    const campaign = this.visitConfirmCampaign;
    if (!inv?._id || !campaign || this.isVisitConfirmSubmitting) return;
    this.actioningInviteIds.add(inv._id);
    this.cd.detectChanges();
    this.config.updateInviteCheckIn(inv._id, {
      status: 'checked_in',
      checkedInAt: new Date().toISOString(),
    }).subscribe({
      next: (data: any) => {
        const locationVisit = data?.locationVisit || { ...(inv.locationVisit || {}), status: 'checked_in', checkedInAt: new Date().toISOString() };
        this.syncInviteLocationVisitState(String(inv._id), locationVisit, campaign);
        this.actioningInviteIds.delete(inv._id);
        this.closeVisitConfirmModal();
        this.toast.success('Participant marked as visited.');
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.actioningInviteIds.delete(inv._id);
        this.toast.error(err?.error?.message || 'Failed to mark participant as visited.');
        this.cd.detectChanges();
      },
    });
  }

  getFulfillmentLabel(campaign: any): string {
    if (!campaign) return 'Manage';
    return campaign.campaignType === 'product' ? 'Shipping' : 'Check-in';
  }

  get inviteActionModalTitle(): string {
    if (this.inviteActionModalMode === 'report') return 'Report Invite Issue';
    if (this.inviteActionModalMode === 'decline_accepted') return 'Decline Accepted Influencer';
    return 'Withdraw Invite';
  }

  get inviteActionModalSubmitText(): string {
    if (this.inviteActionModalMode === 'report') return 'Report';
    if (this.inviteActionModalMode === 'decline_accepted') return 'Decline Influencer';
    return 'Withdraw Invite';
  }

  get inviteActionModalReasonLabel(): string {
    if (this.inviteActionModalMode === 'report') return 'Issue details';
    if (this.inviteActionModalMode === 'decline_accepted') return 'Reason for declining (optional)';
    return 'Reason for withdrawal (optional)';
  }

  get inviteActionModalHelpText(): string {
    if (this.inviteActionModalMode === 'report') return 'Describe the issue clearly (for example: no-show, non-delivery, dispute).';
    if (this.inviteActionModalMode === 'decline_accepted') return 'This accepted influencer will be removed from this campaign.';
    return 'The influencer will no longer see this pending invite.';
  }

  get isInviteActionReasonRequired(): boolean {
    return this.inviteActionModalMode === 'report';
  }

  get isInviteActionSubmitting(): boolean {
    return !!this.inviteActionModalInvite?._id && this.actioningInviteIds.has(this.inviteActionModalInvite._id);
  }

  openInviteActionModal(inv: any, mode: InviteActionReasonModalMode): void {
    if (!inv?._id || this.actioningInviteIds.has(inv._id)) return;
    this.inviteActionModalInvite = inv;
    this.inviteActionModalMode = mode;
    this.inviteActionReasonInput = '';
    this.inviteActionModalError = '';
    this.inviteActionModalOpen = true;
    this.cd.detectChanges();
  }

  closeInviteActionModal(): void {
    this.inviteActionModalOpen = false;
    this.inviteActionModalInvite = null;
    this.inviteActionReasonInput = '';
    this.inviteActionModalError = '';
    this.cd.detectChanges();
  }

  submitInviteActionFromModal(): void {
    const inv = this.inviteActionModalInvite;
    if (!inv?._id || this.actioningInviteIds.has(inv._id)) return;
    const reason = String(this.inviteActionReasonInput || '').trim();

    if (this.isInviteActionReasonRequired && !reason) {
      this.inviteActionModalError = 'Please provide issue details before reporting.';
      this.cd.detectChanges();
      return;
    }

    this.inviteActionModalError = '';
    this.actioningInviteIds.add(inv._id);
    this.cd.detectChanges();

    if (this.inviteActionModalMode === 'report') {
      this.config.reportInviteIssue(inv._id, reason).subscribe({
        next: (data: any) => {
          if (data?.status) inv.status = data.status;
          inv.reportedIssue = { reason, reportedAt: new Date() };
          this.actioningInviteIds.delete(inv._id);
          this.closeInviteActionModal();
          this.toast.success('Issue reported.');
          this.cd.detectChanges();
        },
        error: (err: any) => {
          this.actioningInviteIds.delete(inv._id);
          this.inviteActionModalError = err?.error?.message || 'Failed to report issue.';
          this.cd.detectChanges();
        },
      });
      return;
    }

    const isAcceptedDecline = this.inviteActionModalMode === 'decline_accepted';
    this.config.withdrawInvite(inv._id, reason || undefined).subscribe({
      next: () => {
        inv.status = 'withdrawn';
        this.actioningInviteIds.delete(inv._id);
        this.closeInviteActionModal();
        this.toast.success(isAcceptedDecline ? 'Influencer declined.' : 'Invite withdrawn.');
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.actioningInviteIds.delete(inv._id);
        this.inviteActionModalError = err?.error?.message || 'Failed to withdraw invite.';
        this.cd.detectChanges();
      },
    });
  }

  // ── Slice E: brand action handlers ────────────────────────────
  remindInvite(inv: any): void {
    if (!inv?._id || this.actioningInviteIds.has(inv._id)) return;
    this.actioningInviteIds.add(inv._id);
    this.cd.detectChanges();
    this.config.remindInvite(inv._id).subscribe({
      next: (data: any) => {
        inv.remindedAt = data?.remindedAt;
        inv.remindersSent = data?.remindersSent;
        this.actioningInviteIds.delete(inv._id);
        this.toast.success('Reminder sent.');
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.actioningInviteIds.delete(inv._id);
        this.toast.error(err?.error?.message || 'Failed to send reminder.');
        this.cd.detectChanges();
      },
    });
  }

  withdrawInvite(inv: any): void {
    if (!inv?._id || this.actioningInviteIds.has(inv._id)) return;
    const isAccepted = inv?.status === 'accepted';
    this.openInviteActionModal(inv, isAccepted ? 'decline_accepted' : 'withdraw');
  }

  reportInvite(inv: any): void {
    this.openInviteActionModal(inv, 'report');
  }

  // ── Slice D: fulfillment modal ────────────────────────────────
  private toLocalDateInput(v: any): string {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }
  private toLocalDateTimeInput(v: any): string {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    // YYYY-MM-DDTHH:mm in local time
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  }

  openFulfillment(inv: any): void {
    this.fulfillInvite = inv;
    const t = this.invitePanelCampaign?.campaignType;
    if (t === 'product') {
      const pf = inv.productFulfillment || {};
      this.fulfillForm = {
        courier: pf.courier || '',
        trackingId: pf.trackingId || '',
        trackingUrl: pf.trackingUrl || '',
        shippedAt: this.toLocalDateInput(pf.shippedAt),
        deliveredAt: this.toLocalDateInput(pf.deliveredAt),
        status: pf.status || 'pending',
        note: pf.note || '',
      };
    } else if (t === 'invite_location') {
      const lv = inv.locationVisit || {};
      this.fulfillForm = {
        scheduledAt: this.toLocalDateTimeInput(lv.scheduledAt),
        checkedInAt: this.toLocalDateTimeInput(lv.checkedInAt),
        status: lv.status || 'pending',
        note: lv.note || '',
      };
    } else {
      this.fulfillForm = {};
    }
    this.fulfillModalOpen = true;
    this.cd.detectChanges();
  }

  closeFulfillment(): void {
    this.fulfillModalOpen = false;
    this.fulfillInvite = null;
    this.fulfillForm = {};
    this.savingFulfillment = false;
    this.cd.detectChanges();
  }

  saveFulfillment(): void {
    if (!this.fulfillInvite?._id || this.savingFulfillment) return;
    this.savingFulfillment = true;
    const t = this.invitePanelCampaign?.campaignType;
    const inviteId = this.fulfillInvite._id;
    const onSuccess = (data: any) => {
      if (t === 'product') this.fulfillInvite.productFulfillment = data?.productFulfillment;
      if (t === 'invite_location') this.fulfillInvite.locationVisit = data?.locationVisit;
      this.savingFulfillment = false;
      this.toast.success('Fulfillment updated.');
      this.closeFulfillment();
    };
    const onError = (err: any) => {
      this.savingFulfillment = false;
      this.toast.error(err?.error?.message || 'Failed to save.');
      this.cd.detectChanges();
    };
    if (t === 'product') {
      this.config
        .updateInviteProductFulfillment(inviteId, {
          courier: this.fulfillForm.courier,
          trackingId: this.fulfillForm.trackingId,
          trackingUrl: this.fulfillForm.trackingUrl,
          shippedAt: this.fulfillForm.shippedAt || undefined,
          deliveredAt: this.fulfillForm.deliveredAt || undefined,
          status: this.fulfillForm.status as any,
          note: this.fulfillForm.note,
        })
        .subscribe({ next: onSuccess, error: onError });
    } else if (t === 'invite_location') {
      this.config
        .updateInviteCheckIn(inviteId, {
          scheduledAt: this.fulfillForm.scheduledAt || undefined,
          checkedInAt: this.fulfillForm.checkedInAt || undefined,
          status: this.fulfillForm.status as any,
          note: this.fulfillForm.note,
        })
        .subscribe({ next: onSuccess, error: onError });
    } else {
      this.savingFulfillment = false;
      this.closeFulfillment();
    }
  }

  getCardAcceptedCount(c: Campaign): number {
    const activeStatuses = ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed'];
    return (this.campaignInvitesMap.get(c._id!) || [])
      .filter((i: any) => activeStatuses.includes(this.getHostInviteEffectiveStatus(i))).length;
  }

  getAcceptanceCloseThreshold(c: Campaign): number {
    const max = Number((c as any)?.maxInfluencers || 0);
    return max;
  }

  getMinimumParticipantsRequired(c: Campaign): number {
    const min = Number((c as any)?.minInfluencers || 0);
    return min > 0 ? min : 1;
  }

  private getAcceptedRowsCount(rows: any[]): number {
    const acceptedStatuses = new Set([
      'accepted',
      'payment_confirmed',
      'working',
      'submitted',
      'completed',
      'approved',
      'disputed',
    ]);
    return (rows || [])
      .filter((r: any) => acceptedStatuses.has(this.getHostInviteEffectiveStatus(r))).length;
  }

  isAcceptanceClosed(c: Campaign): boolean {
    const acceptanceDeadlineRaw = (c as any)?.acceptanceDeadline;
    if (acceptanceDeadlineRaw) {
      const acceptanceDeadline = new Date(acceptanceDeadlineRaw);
      if (!Number.isNaN(acceptanceDeadline.getTime()) && acceptanceDeadline.getTime() > Date.now()) {
        return false;
      }
    }
    const threshold = this.getAcceptanceCloseThreshold(c);
    if (!threshold) return false;
    return this.getCardAcceptedCount(c) >= threshold;
  }

  isMinimumParticipantsReached(c: Campaign): boolean {
    if (!c) return false;
    const min = this.getMinimumParticipantsRequired(c);
    if (!min) return false;
    return this.getCardAcceptedCount(c) >= min && !this.isAcceptanceClosed(c);
  }

  getAcceptanceBlockedPendingCount(c: Campaign): number {
    const rows = this.campaignInvitesMap.get(c._id!) || [];
    const pendingStatuses = new Set(['pending', 'invited']);
    return rows.filter((r: any) => pendingStatuses.has(String(r?.status || ''))).length;
  }

  isInvitePanelAcceptanceClosed(): boolean {
    const c = this.invitePanelCampaign;
    if (!c) return false;
    const acceptanceDeadlineRaw = (c as any)?.acceptanceDeadline;
    if (acceptanceDeadlineRaw) {
      const acceptanceDeadline = new Date(acceptanceDeadlineRaw);
      if (!Number.isNaN(acceptanceDeadline.getTime()) && acceptanceDeadline.getTime() > Date.now()) {
        return false;
      }
    }
    const threshold = this.getAcceptanceCloseThreshold(c);
    if (!threshold) return false;
    return this.getAcceptedRowsCount(this.invites) >= threshold;
  }

  isInvitePanelMinimumReached(): boolean {
    const c = this.invitePanelCampaign;
    if (!c) return false;
    const min = this.getMinimumParticipantsRequired(c);
    if (!min) return false;
    return this.getAcceptedRowsCount(this.invites) >= min && !this.isInvitePanelAcceptanceClosed();
  }

  isPendingInviteStatus(status: string): boolean {
    return ['pending', 'invited'].includes(String(status || '').toLowerCase());
  }

  isInvitePendingOrInvited(inv: any): boolean {
    return ['pending', 'invited'].includes(String(inv?.status || ''));
  }

  getInvitePanelBlockedPendingCount(): number {
    const pendingStatuses = new Set(['pending', 'invited']);
    return (this.invites || []).filter((r: any) => pendingStatuses.has(String(r?.status || ''))).length;
  }

  getCardPendingCount(c: Campaign): number {
    // Count both 'pending' and legacy 'invited' statuses
    const key = this.getCampaignMapKey(c);
    return (this.campaignInvitesMap.get(key) || []).filter((i: any) => i.status === 'pending' || i.status === 'invited').length;
  }

  getCardSubmittedCount(c: Campaign): number {
    const key = this.getCampaignMapKey(c);
    return (this.campaignInvitesMap.get(key) || []).filter((i: any) => i.status === 'submitted').length;
  }

  getCardCompletedCount(c: Campaign): number {
    const key = this.getCampaignMapKey(c);
    return (this.campaignInvitesMap.get(key) || []).filter((i: any) => i.status === 'completed').length;
  }

  getCardInvitePreview(c: Campaign): any[] {
    // Always return the first 3 invites, even if influencerId is not fully populated
    const key = this.getCampaignMapKey(c);
    const invites = (this.campaignInvitesMap.get(key) || []);
    return invites.slice(0, 3);
  }

  /** For influencer view: find this user's own invite for a campaign (from myInvites). */
  getMyInviteForCampaign(c: Campaign): any | null {
    if (!c?._id) return null;
    const cid = String(c._id);
    return this.myInvites.find((inv: any) => {
      const invCid = String(inv?.campaignId?._id || inv?.campaignId || '');
      return invCid === cid;
    }) || null;
  }

  /** Label for an influencer's invite status on a campaign card. */
  myInviteStatusLabel(inviteOrStatus: any): string {
    const status = typeof inviteOrStatus === 'string'
      ? inviteOrStatus
      : String(inviteOrStatus?.status || '');
    const campaignType = String(inviteOrStatus?.campaignId?.campaignType || inviteOrStatus?.campaignType || '').toLowerCase();
    const map: Record<string, string> = {
      pending: 'Applied · Pending',
      invited: 'Invited',
      counter_sent: 'Confirmation Pending',
      accepted: campaignType === 'paid_collab' ? 'Confirmation Pending' : 'Working',
      payment_confirmed: 'Working',
      working: 'Working',
      submitted: 'Under Review',
      approved: 'Payout Released',
      completed: 'Completed',
      declined: 'Declined',
      withdrawn: 'Withdrawn',
      disputed: 'Under Review',
    };
    return map[status] || status;
  }

  myInviteStatusClass(status: string): string {
    if (['accepted', 'payment_confirmed', 'working', 'approved', 'completed'].includes(status)) return 'inf-status-accepted';
    if (['declined', 'withdrawn', 'disputed'].includes(status)) return 'inf-status-declined';
    if (status === 'counter_sent') return 'inf-status-pending';
    if (status === 'submitted') return 'inf-status-submitted';
    return 'inf-status-pending';
  }

  getPendingInviteCount(): number {
    return this.myInvites.filter((i) => {
      const status = String(i?.status || '').toLowerCase();
      if (status === 'counter_sent') return true;
      return (status === 'pending' || status === 'invited') && !this.isInviteMissed(i);
    }).length;
  }

  // ── My Invites (influencer) ───────────────────────────────────

  // Preview modal — shows campaign + brand details before accept/decline
  invitePreview: any | null = null;
  // Only show preview modal when opened explicitly by user action
  invitePreviewManual = false;
  invitePreviewQualifyingPlatform: string | null = null;
  invitePreviewQualifyingTier: string | null = null;
  selectedInvitePostDates: Record<string, string> = {};
  // Content type selection: key = inviteId, value = "platform::contentType"
  selectedInviteContentType: Record<string, string> = {};
  // Per-invite payout details captured at accept time
  selectedInvitePayouts: Record<string, { upiId: string; mobile: string; accountHolderName: string }> = {};
  // Default payout details from the current influencer profile (if any)
  defaultPayout: { upiId: string; mobile: string; accountHolderName: string } = {
    upiId: '',
    mobile: '',
    accountHolderName: '',
  };

  /** Social media entries from the logged-in influencer's profile (for platform-based tier checks) */
  myInfluencerSocialMedia: Array<{ platform: string; tier: string }> = [];

  /** Open campaign preview modal — shown before apply */
  openCampaignPreview: Campaign | null = null;
  openCampaignPreviewQualifyingPlatform: string | null = null;
  openCampaignPreviewQualifyingTier: string | null = null;

  getCampaignImageUrls(campaign: any): string[] {
    const c = campaign || {};
    const candidates: unknown[] = [];

    if (typeof c?.image?.url === 'string') candidates.push(c.image.url);
    if (typeof c?.image === 'string') candidates.push(c.image);
    if (Array.isArray(c?.images)) candidates.push(...c.images);
    if (Array.isArray(c?.galleryImages)) candidates.push(...c.galleryImages);

    const urls: string[] = [];
    for (const item of candidates) {
      if (typeof item === 'string' && item.trim()) {
        urls.push(item.trim());
        continue;
      }
      if (item && typeof item === 'object') {
        const maybeUrl = String((item as any)?.url || (item as any)?.src || '').trim();
        if (maybeUrl) urls.push(maybeUrl);
      }
    }
    return Array.from(new Set(urls));
  }

  getCampaignPrimaryImage(campaign: any): string | null {
    const urls = this.getCampaignImageUrls(campaign);
    return urls.length ? urls[0] : null;
  }

  openInvitePreview(inv: any) {
    this.invitePreview = inv;
    this.invitePreviewManual = true;
    const camp = inv?.campaign || inv?.campaignId || null;
    const qual = camp ? this.getQualifyingPlatformAndTier(camp) : null;
    this.invitePreviewQualifyingPlatform = qual?.platform || null;
    this.invitePreviewQualifyingTier = qual?.tier || null;
  }

  openOpenCampaign(campaign: Campaign, event?: Event) {
    event?.stopPropagation();
    if (!this.isInfluencerView || !campaign?._id) return;
    const campaignId = String(campaign._id);

    // If any invite already exists for this campaign (any status), open its preview.
    const existing = this.myInvites.find((inv: any) => {
      const invCampaignId = String(inv?.campaignId?._id || inv?.campaignId || '');
      return invCampaignId === campaignId;
    });
    if (existing) {
      this.openInvitePreview(existing);
      return;
    }

    // For tier_filtered_open campaigns — show campaign detail preview first.
    // Ensure influencer social profile is loaded so platform/tier matching is accurate.
    if ((campaign as any).campaignMode === 'tier_filtered_open') {
      const proceed = () => {
        const qual = this.getQualifyingPlatformAndTier(campaign);
        this.openCampaignPreviewQualifyingPlatform = qual?.platform || null;
        this.openCampaignPreviewQualifyingTier = qual?.tier || null;
        this.openCampaignPreview = campaign;
        this.cd.detectChanges();
      };
      if (!this.myInfluencerSocialMedia || this.myInfluencerSocialMedia.length === 0) {
        this.config.getInfluencerProfileById().subscribe({
          next: (profile: any) => {
            this.myInfluencerSocialMedia = (profile?.socialMedia || []).map((sm: any) => ({ platform: sm.platform || '', tier: sm.tier || '' }));
            proceed();
          },
          error: () => {
            // Fallback: still open preview but without qualifying hints
            this.openCampaignPreview = campaign;
            this.cd.detectChanges();
          }
        });
        return;
      }
      proceed();
      return;
    }

    this.showError('Invite only: you can respond after the brand sends you a campaign invite.');
  }

  closeOpenCampaignPreview() {
    this.openCampaignPreview = null;
    this.cd.detectChanges();
  }

  applyFromPreview() {
    const campaign = this.openCampaignPreview;
    if (!campaign?._id) return;
    const campaignId = String(campaign._id);
    const campaignPlatforms: string[] = (campaign as any).platforms || [];
    const qualifying = this.getQualifyingPlatformAndTier(campaign);

    if (!qualifying && campaignPlatforms.length > 0) {
      this.closeOpenCampaignPreview();
      const minTier: string = (campaign as any).minInfluencerTier || '';
      this.showError(`You don't have a qualifying platform for this campaign. Required: ${campaignPlatforms.join(' / ')}${minTier ? ' at ' + minTier + ' tier or above' : ''}.`);
      return;
    }

    // Apply without pre-locking platform; influencer chooses platform/content type in pending invite step.
    this.openCampaignPreview = null;
    this.openCampaignPreviewQualifyingPlatform = null;
    this.openCampaignPreviewQualifyingTier = qualifying?.tier ?? null;
    this.openingCampaignIds.add(campaignId);
    this.cd.detectChanges();
    this.config.applyToOpenCampaign(campaignId).subscribe({
      next: () => {
        this.openingCampaignIds.delete(campaignId);
        this.toastMessage = 'Application sent! The brand will review your profile.';
        this.showSuccessToast = true;
        setTimeout(() => { this.showSuccessToast = false; this.cd.detectChanges(); }, 4000);
        this.reloadMyInvites();
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.openingCampaignIds.delete(campaignId);
        const msg = err?.error?.message || err?.message || 'Failed to apply. Please try again.';
        this.showError(msg);
        this.cd.detectChanges();
      },
    });
  }

  /** Find the best qualifying platform + tier for the current influencer for a campaign */
  getQualifyingPlatformAndTier(campaign: Campaign): { platform?: string; tier?: string } | null {
    const TIER_ORDER = ['Starter', 'Nano', 'Micro', 'Mid-Tier', 'Macro', 'Mega / Celebrity'];
    const candidates = this.getTierQualifyingSocials(campaign);
    if (!candidates.length) return null;

    // Pick the highest-tier candidate
    let best = candidates[0];
    let bestIdx = TIER_ORDER.indexOf(best.tier || '');
    for (const c of candidates) {
      const idx = TIER_ORDER.indexOf(c.tier || '');
      if (idx > bestIdx) { bestIdx = idx; best = c; }
    }
    return { platform: best.platform, tier: best.tier };
  }

  private getTierQualifyingSocials(campaign: Campaign): Array<{ platform: string; tier: string }> {
    const TIER_ORDER = ['Starter', 'Nano', 'Micro', 'Mid-Tier', 'Macro', 'Mega / Celebrity'];
    const normalized = (s: string) => (s || '').toLowerCase().trim();
    const campaignPlatforms: string[] = (campaign as any)?.platforms || [];
    const minTier: string = (campaign as any)?.minInfluencerTier || '';
    const minIdx = TIER_ORDER.indexOf(minTier);
    const sm = this.myInfluencerSocialMedia || [];
    if (!sm.length) return [];

    let candidates = sm;
    if (campaignPlatforms.length > 0) {
      candidates = sm.filter(smEntry => campaignPlatforms.some(p => normalized(p) === normalized(smEntry.platform)));
    }
    if (!candidates.length) return [];

    if (minIdx !== -1) {
      candidates = candidates.filter(smEntry => {
        const idx = TIER_ORDER.indexOf(smEntry.tier || '');
        return idx !== -1 && idx === minIdx;
      });
    }
    return candidates;
  }

  getOpenCampaignPreviewPlatforms(campaign: Campaign | null): string[] {
    if (!campaign) return [];
    const platforms: string[] = Array.isArray((campaign as any)?.platforms) ? (campaign as any).platforms : [];
    // Treat campaigns as tier-filtered when either the explicit campaignMode is set
    // to 'tier_filtered_open' OR a minimum influencer tier is provided on the campaign.
    const isTierFiltered = String((campaign as any)?.campaignMode || '').toLowerCase() === 'tier_filtered_open' || !!(campaign as any)?.minInfluencerTier;
    if (!isTierFiltered) return platforms;

    const norm = (s: string) => String(s || '').trim().toLowerCase();
    const qualifying = this.getTierQualifyingSocials(campaign);
    const qualifyingSet = new Set(qualifying.map((sm) => norm(sm.platform)));
    // Only show platforms that the influencer actually qualifies for.
    const filtered = platforms.filter((p) => qualifyingSet.has(norm(p)));
    return filtered;
  }

  getOpenCampaignRelevantOutputs(campaign: Campaign | null): string[] {
    if (!campaign) return [];
    const rows = Array.isArray((campaign as any)?.socialMedia) ? (campaign as any).socialMedia : [];
    if (!rows.length) return Array.isArray((campaign as any)?.deliverables) ? (campaign as any).deliverables : [];

    const norm = (v: string) => String(v || '').toLowerCase().trim();
    const allowedPlatforms = new Set(this.getOpenCampaignPreviewPlatforms(campaign).map((p) => norm(p)));
    const outputs: string[] = [];

    for (const row of rows) {
      const platformRaw = String(row?.platform || '');
      if (allowedPlatforms.size > 0 && !allowedPlatforms.has(norm(platformRaw))) continue;
      const platformLabel = this.platformShortLabel(platformRaw);
      for (const ct of (row?.contentTypes || [])) {
        if (ct?.enabled) outputs.push(`${platformLabel} · ${ct.name}`);
      }
    }

    return outputs;
  }

  getOpenCampaignDescriptionText(description: string | null | undefined): string {
    const raw = String(description || '').trim();
    if (!raw) return '';

    const headingLabels = [
      'What we expect:',
      'Content Guidelines:',
      'Deliverables:',
      'Timeline:',
      'Payment:',
      'Important Notes:',
      "Do's:",
      "Don'ts:",
      'Must include:',
    ];

    let text = raw;
    for (const label of headingLabels) {
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`\\s*${esc}\\s*`, 'gi'), `\n${label} `);
    }

    text = text.replace(/\s*•\s*/g, '\n• ');
    return text.trim();
  }

  isOpeningCampaign(campaign: Campaign): boolean {
    return !!campaign?._id && this.openingCampaignIds.has(String(campaign._id));
  }

  closeInvitePreview() {
    this.invitePreview = null;
    this.invitePreviewManual = false;
  }

  onModalAccept(payload: CampaignAcceptPayload) {
    if (payload.postDate) this.selectedInvitePostDates[payload.inviteId] = payload.postDate;
    if (payload.platform && payload.contentType) {
      this.selectedInviteContentType[payload.inviteId] = `${payload.platform}::${payload.contentType}`;
    }
    this.respondToMyInvite(
      payload.inviteId,
      payload.responseType === 'counter' ? 'counter_sent' : 'accepted',
      payload.counterAmount,
      payload.counterMessage,
    );
    this.closeInvitePreview();
  }

  onModalDecline(payload: CampaignDeclinePayload) {
    this.respondToMyInvite(payload.inviteId, 'declined');
    this.closeInvitePreview();
  }

  // ── Reusable invite-card events ───────────────────────────────
  onCardAccept(payload: InviteAcceptPayload) {
    if (payload.postDate) this.selectedInvitePostDates[payload.inviteId] = payload.postDate;
    if (payload.platform && payload.contentType) {
      this.selectedInviteContentType[payload.inviteId] = `${payload.platform}::${payload.contentType}`;
    }
    if (payload.payout) {
      this.selectedInvitePayouts[payload.inviteId] = {
        upiId: payload.payout.upiId || '',
        mobile: payload.payout.mobile || '',
        accountHolderName: payload.payout.accountHolderName || '',
      };
    }
    this.respondToMyInvite(
      payload.inviteId,
      payload.responseType === 'counter' ? 'counter_sent' : 'accepted',
      payload.counterAmount,
      payload.counterMessage,
    );
  }

  onCardDecline(payload: InviteDeclinePayload) {
    this.respondToMyInvite(payload.inviteId, 'declined');
  }

  onCardPostDateChange(inviteId: string, value: string) {
    this.selectedInvitePostDates[inviteId] = value;
  }

  onCardContentTypeChange(inviteId: string, key: string) {
    this.selectedInviteContentType[inviteId] = key;
  }

  showError(message: string) {
    this.toastMessage = message;
    this.showErrorToast = true;
    this.cd.detectChanges();
    setTimeout(() => {
      this.showErrorToast = false;
      this.cd.detectChanges();
    }, 5000);
  }

  respondToMyInvite(
    inviteId: string,
    status: 'accepted' | 'declined' | 'counter_sent',
    counterAmount?: number,
    counterMessage?: string,
  ) {
    if (this.actioningInviteIds.has(inviteId)) return;
    const selectedPostDate = status === 'accepted' || status === 'counter_sent'
      ? this.selectedInvitePostDates[inviteId]
      : undefined;
    if ((status === 'accepted' || status === 'counter_sent') && !selectedPostDate) {
      this.showError('Please select a post date before accepting this invite.');
      return;
    }
    const invite = this.myInvites.find(i => i._id === inviteId) || this.invitePreview;
    if ((status === 'accepted' || status === 'counter_sent') && invite && !this.isSelectedDateValid(invite, selectedPostDate!)) {
      this.showError('Selected post date must be between campaign start and end dates.');
      return;
    }
    // Require content type selection if campaign has options
    const options = this.getInviteContentTypeOptions(invite);
    let chosen = this.selectedInviteContentType[inviteId];
    if ((status === 'accepted' || status === 'counter_sent') && options.length === 1 && !chosen) {
      chosen = options[0].key;
      this.selectedInviteContentType[inviteId] = chosen;
    }
    if ((status === 'accepted' || status === 'counter_sent') && options.length > 0 && !chosen) {
      this.showError('Please select what you will create for this campaign.');
      return;
    }
    const [selPlatform, selContentType] = chosen ? chosen.split('::') : [undefined, undefined];
    const payout = status === 'accepted' || status === 'counter_sent'
      ? this.selectedInvitePayouts[inviteId]
      : undefined;

    const finish = (shippingAddress?: ShippingAddress) => {
      // mark as actioning and call
      this.actioningInviteIds.add(inviteId);
      this.config.respondToInvite(
        inviteId,
        status,
        selectedPostDate,
        selPlatform,
        selContentType,
        counterAmount,
        counterMessage,
        payout,
        shippingAddress,
      ).pipe(
        timeout(20000),
        finalize(() => {
          this.actioningInviteIds.delete(inviteId);
          this.cd.detectChanges();
        }),
      ).subscribe({
        next: () => {
          this.myInvites = this.myInvites.map(i =>
            i._id === inviteId ? { ...i, status } : i
          );
          if (status === 'accepted') {
            const campaignId = String(invite?.campaignId?._id || invite?.campaignId || '');
            if (campaignId) {
              const key = `invitation_accepted:${inviteId}`;
              if (!this.completionEventsTracked.has(key)) {
                this.analytics.trackCampaignCompleted({
                  campaignId,
                  creatorCount: 1,
                  completionStage: 'invitation_accepted',
                  inviteId,
                });
                this.completionEventsTracked.add(key);
              }
            }
          }
          if (this.invitePreview?._id === inviteId) {
            this.invitePreview = { ...this.invitePreview, status };
          }
          this.toast.success(
            status === 'accepted'
              ? 'Invite accepted!'
              : status === 'counter_sent'
                ? 'Price flow updated: counter sent.'
                : 'Invite declined.',
          );
          // Reload from server so tab counts, spinner state and card data reflect reality
          this.reloadMyInvites();
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to respond to invite.');
        }
      });
    };

    if ((status === 'accepted' || status === 'counter_sent') && this.inviteRequiresShippingAddress(invite)) {
      this.promptShippingAddressForInvite(invite).then((address) => {
        if (!address) {
          this.toast.error('Shipping address is required to accept this product collab.');
          return;
        }
        finish(address);
      });
      return;
    }

    finish();
  }

  private trackCompletionFromInviteStatuses(invites: any[]): void {
    for (const inv of Array.isArray(invites) ? invites : []) {
      const inviteId = String(inv?._id || '');
      const campaignId = String(inv?.campaignId?._id || inv?.campaignId || '');
      const status = String(inv?.status || '').toLowerCase();
      if (!inviteId || !campaignId) continue;

      if (status === 'payment_confirmed' || status === 'approved' || status === 'completed') {
        const key = `payment_settled:${inviteId}`;
        if (this.completionEventsTracked.has(key)) continue;
        this.analytics.trackCampaignCompleted({
          campaignId,
          creatorCount: 1,
          completionStage: 'payment_settled',
          inviteId,
        });
        this.completionEventsTracked.add(key);
      }
    }
  }

  getInviteQualifyingPlatforms(inv: any): string[] {
    const embedded = inv?.campaign || inv?.campaignId;
    if (!embedded) return [];
    // Prefer the fully-loaded campaign from this.campaigns (has all fields incl. campaignMode, minInfluencerTier).
    // The embedded campaignId object from the invites API often omits those fields.
    const cid = embedded?._id || embedded?.id;
    const campaign: any = (cid && this.campaigns.find((c: any) => String(c._id) === String(cid))) || embedded;
    const isTierFiltered = String(campaign?.campaignMode || '').toLowerCase() === 'tier_filtered_open' || !!campaign?.minInfluencerTier;
    if (!isTierFiltered) return [];
    const normalized = (value: string) => String(value || '').trim().toLowerCase();
    const seen = new Set<string>();
    return this.getTierQualifyingSocials(campaign as Campaign)
      .map((sm) => String(sm?.platform || '').trim())
      .filter((platform) => {
        const key = normalized(platform);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  /** Returns flat list of enabled content type options for an invite's campaign */
  getInviteContentTypeOptions(inv: any): { key: string; label: string; platform: string; contentType: string; price: number }[] {
    const socialMedia = inv?.campaignId?.socialMedia;
    if (!Array.isArray(socialMedia) || !socialMedia.length) return [];
    const normalized = (v: string) => (v || '').toLowerCase().trim();
    const lockedPlatform = String(inv?.selectedPlatform || '').trim();
    const qualifyingPlatforms = new Set(this.getInviteQualifyingPlatforms(inv).map((platform) => normalized(platform)));
    const options: { key: string; label: string; platform: string; contentType: string; price: number }[] = [];
    for (const sm of socialMedia) {
      const platform = sm.platform || '';
      if (lockedPlatform && normalized(platform) !== normalized(lockedPlatform)) continue;
      if (!lockedPlatform && qualifyingPlatforms.size && !qualifyingPlatforms.has(normalized(platform))) continue;
      for (const ct of (sm.contentTypes || [])) {
        if (ct.enabled) {
          options.push({
            key: `${platform}::${ct.name}`,
            platform,
            contentType: ct.name,
            price: Number(ct.price) || 0,
            label: `${this.platformShortLabel(platform)} · ${ct.name}`
          });
        }
      }
    }
    return options;
  }

  platformShortLabel(p: string): string {
    const m: Record<string, string> = { instagram: 'Instagram', youtube: 'YouTube', twitter: 'X/Twitter', tiktok: 'TikTok', facebook: 'Facebook', linkedin: 'LinkedIn' };
    return m[(p || '').toLowerCase()] || p;
  }

  platformIcon(p: string): string {
    const m: Record<string, string> = { instagram: 'bi-instagram', youtube: 'bi-youtube', twitter: 'bi-twitter-x', tiktok: 'bi-tiktok', facebook: 'bi-facebook', linkedin: 'bi-linkedin' };
    return m[(p || '').toLowerCase()] || 'bi-camera-video';
  }

  private isSelectedDateValid(inv: any, selectedPostDate: string): boolean {
    const c = inv?.campaignId;
    const start = c?.startDate || c?.timelineStart;
    const end = c?.endDate || c?.timelineEnd;
    if (!start || !end) return true;
    const s = new Date(selectedPostDate);
    if (Number.isNaN(s.getTime())) return false;
    return s >= new Date(start) && s <= new Date(end);
  }

  // ── Expandable row panel ──────────────────────────────────────

  loadAllInvites() {
    // Only fetch for campaigns not already in map
    this.campaigns.forEach(c => {
      if (c._id && !this.campaignInvitesMap.has(c._id)) {
        this.config.getInvitesByCampaign(c._id).subscribe({
          next: (invites: any[]) => {
            this.campaignInvitesMap.set(c._id!, invites);
            this.cd.detectChanges();
          },
          error: () => {}
        });
      }
    });
  }

  // Force re-fetch invites for ALL campaigns (use after create/update/invite actions)
  loadAllInvitesForce() {
    this.campaigns.forEach(c => {
      if (!c._id) return;
      this.config.getInvitesByCampaign(c._id).subscribe({
        next: (invites: any[]) => {
          this.campaignInvitesMap.set(c._id!, invites);
          this.cd.detectChanges();
        },
        error: () => {}
      });
    });
  }

  toggleExpand(c: Campaign) {
    if (this.expandedCampaignId === c._id) {
      this.expandedCampaignId = null;
      return;
    }
    this.expandedCampaignId = c._id!;
    if (!this.campaignInvitesMap.has(c._id!)) {
      this.expandInvitesLoading.add(c._id!);
      this.cd.detectChanges();
      this.config.getInvitesByCampaign(c._id!).subscribe({
        next: (invites: any[]) => {
          this.campaignInvitesMap.set(c._id!, invites);
          this.expandInvitesLoading.delete(c._id!);
          this.cd.detectChanges();
        },
        error: (err) => {
          this.expandInvitesLoading.delete(c._id!);
          this.toast.error('Failed to load invites for this campaign. Please try again.');
          console.error('Load campaign invites error:', err);
          this.cd.detectChanges();
        }
      });
    }
    if (!this.campaignSubmissionsMap.has(c._id!)) {
      this.config.getCampaignSubmissions(c._id!).subscribe({
        next: (submissions: any[]) => {
          this.campaignSubmissionsMap.set(c._id!, Array.isArray(submissions) ? submissions : []);
          this.cd.detectChanges();
        },
        error: () => {}
      });
    }
  }

  getSubmissionForInvite(c: Campaign, inv: any): any | null {
    const submissions = this.campaignSubmissionsMap.get(c._id!) || [];
    return submissions.find(
      s => String(s.inviteId) === String(inv._id) ||
           String(s.influencerId?._id || s.influencerId) === String(inv.influencerId?._id || inv.influencerId) ||
           String(s.recipientId?._id || s.recipientId) === String(inv.influencerId?._id || inv.influencerId)
    ) || null;
  }

  reviewSubmission(inviteId: string, campaignId: string, action: 'approve' | 'dispute') {
    const submission = (this.campaignSubmissionsMap.get(campaignId) || []).find(
      (sub: any) => String(sub?.inviteId || '') === String(inviteId || ''),
    ) || null;

    if (action === 'approve' && !this.canApproveSubmission(submission)) {
      this.toast.error(this.getSubmissionApprovalLockMessage(submission));
      return;
    }

    if (this.reviewLoading.has(inviteId)) return;
    this.reviewLoading.add(inviteId);
    const payload: any = { action };
    if (action === 'approve' && this.submissionFeedback[inviteId]) {
      payload.feedback = this.submissionFeedback[inviteId];
    }
    if (action === 'dispute') {
      payload.disputeReason = this.submissionDisputeReason[inviteId] || 'Quality does not meet requirements';
      payload.feedback = this.submissionFeedback[inviteId] || '';
    }
    this.config.reviewCampaignSubmission(inviteId, payload).subscribe({
      next: () => {
        this.reviewLoading.delete(inviteId);
        this.campaignSubmissionsMap.delete(campaignId);
        this.config.getCampaignSubmissions(campaignId).subscribe({
          next: (submissions: any[]) => {
            this.campaignSubmissionsMap.set(campaignId, Array.isArray(submissions) ? submissions : []);
            this.cd.detectChanges();
          },
          error: () => {}
        });
      },
      error: () => { this.reviewLoading.delete(inviteId); }
    });
  }

  getExpandInvites(c: Campaign): any[] {
    const key = this.getCampaignMapKey(c);
    return this.campaignInvitesMap.get(key) || [];
  }

  /** In tier-filtered mode, show only accepted/relevant influencer rows in expanded list. */
  getExpandVisibleInvites(c: Campaign): any[] {
    const rows = this.getExpandInvites(c);
    if ((c as any)?.campaignMode !== 'tier_filtered_open') return rows;

    return rows.filter((inv: any) => {
      const status = String(inv?.status || '');
      const activeStatuses = new Set([
        'counter_sent',
        'accepted',
        'payment_confirmed',
        'working',
        'submitted',
        'completed',
        'approved',
        'disputed',
      ]);
      if (!activeStatuses.has(status)) return false;

      const selectedPlatform = String(inv?.selectedPlatform || '').trim().toLowerCase();

      const requiredTier = String((c as any)?.minInfluencerTier || '').trim();
      if (!requiredTier) return true;

      const ORDER = ['Starter', 'Nano', 'Micro', 'Mid-Tier', 'Macro', 'Mega / Celebrity'];
      const reqIdx = ORDER.indexOf(requiredTier);
      if (reqIdx === -1) return true;

      const smList = Array.isArray(inv?.influencerId?.socialMedia) ? inv.influencerId.socialMedia : [];
      if (!smList.length) return true;

      const campaignPlatforms = Array.isArray((c as any)?.platforms) ? (c as any).platforms : [];
      const normalized = (v: string) => String(v || '').trim().toLowerCase();
      const relevant = campaignPlatforms.length
        ? smList.filter((sm: any) => campaignPlatforms.some((p: string) => normalized(p) === normalized(sm?.platform || '')))
        : smList;

      if (selectedPlatform) {
        const matched = smList.find((sm: any) => String(sm?.platform || '').trim().toLowerCase() === selectedPlatform);
        if (matched) {
          const infIdx = ORDER.indexOf(String(matched?.tier || '').trim());
          if (infIdx !== -1 && infIdx === reqIdx) return true;
        }
      }

      if (!relevant.length) return false;
      return relevant.some((sm: any) => ORDER.indexOf(String(sm?.tier || '').trim()) === reqIdx);
    });
  }

  private isWorkedInviteStatus(status: string): boolean {
    return [
      'accepted',
      'payment_confirmed',
      'working',
      'submitted',
      'approved',
      'completed',
      'disputed',
    ].includes(String(status || '').toLowerCase());
  }

  getCompletedWorkedInvites(c: Campaign): any[] {
    return this.getExpandVisibleInvites(c).filter((inv: any) => this.isWorkedInviteStatus(inv?.status));
  }

  getExpandDisplayInvites(c: Campaign): any[] {
    if (String(c?.status || '').toLowerCase() === 'completed') {
      return this.getCompletedWorkedInvites(c);
    }
    return this.getExpandVisibleInvites(c);
  }

  getExpandInvitesByStatus(c: Campaign, status: string): number {
    const wanted = String(status || '').toLowerCase();
    return this.getExpandInvites(c)
      .filter((i: any) => this.getHostInviteEffectiveStatus(i) === wanted).length;
  }

  /** Statuses that count as "accepted or beyond" for the mini stat chip */
  getExpandAcceptedOrBeyond(c: Campaign): number {
    const activeStatuses = ['accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed'];
    return this.getExpandInvites(c)
      .filter((i: any) => activeStatuses.includes(this.getHostInviteEffectiveStatus(i))).length;
  }

  /** Returns true when the invite has moved past accepted (payment made) */
  isPaidStatus(status: string): boolean {
    return ['payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed'].includes(status);
  }

  /** Human-readable invite status label for brand's view of an influencer */
  brandInviteStatusLabel(invOrStatus: any): string {
    const status = typeof invOrStatus === 'string'
      ? String(invOrStatus || '').toLowerCase()
      : this.getHostInviteEffectiveStatus(invOrStatus);
    const map: Record<string, string> = {
      pending:           'Applied',
      invited:           'Invited',
      counter_sent:      'Counter Received',
      accepted:          'Working',
      payment_confirmed: 'Working',
      working:           'Working',
      submitted:         'Under Review',
      approved:          'Payout Released',
      completed:         'Completed',
      declined:          'Declined',
      withdrawn:         'Withdrawn',
      disputed:          'Under Review',
    };
    return map[status] || status;
  }

  private getSubmissionApprovalAnchorMs(submission: any): number | null {
    if (!submission) return null;
    const candidates = [
      submission?.submittedAt,
      submission?.updatedAt,
      submission?.createdAt,
    ];
    for (const value of candidates) {
      if (!value) continue;
      const ms = new Date(value).getTime();
      if (!Number.isNaN(ms)) return ms;
    }
    return null;
  }

  getSubmissionApprovalUnlockAt(submission: any): Date | null {
    const anchorMs = this.getSubmissionApprovalAnchorMs(submission);
    if (anchorMs == null) return null;
    return new Date(anchorMs + CampaignManagementComponent.SUBMISSION_APPROVAL_WAIT_MS);
  }

  canApproveSubmission(submission: any): boolean {
    if (!submission || String(submission?.status || '').toLowerCase() !== 'submitted') return false;
    const unlockAt = this.getSubmissionApprovalUnlockAt(submission);
    if (!unlockAt) return false;
    return Date.now() >= unlockAt.getTime();
  }

  getSubmissionApprovalWaitText(submission: any): string {
    const unlockAt = this.getSubmissionApprovalUnlockAt(submission);
    if (!unlockAt) return 'after 24 hours from submission';

    const remainingMs = unlockAt.getTime() - Date.now();
    if (remainingMs <= 0) return 'now';

    const totalMinutes = Math.max(1, Math.floor(remainingMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  getSubmissionApprovalUnlockAtText(submission: any): string {
    const unlockAt = this.getSubmissionApprovalUnlockAt(submission);
    if (!unlockAt) return 'unlock time unavailable';
    return unlockAt.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  getSubmissionApprovalLockMessage(submission: any): string {
    const unlockAt = this.getSubmissionApprovalUnlockAt(submission);
    if (!unlockAt) {
      return 'Review period active. Completion confirmation unlocks in 24 hours after influencer submission.';
    }
    const waitText = this.getSubmissionApprovalWaitText(submission);
    if (waitText === 'now') return 'Mark Completed is now available. Please try again.';
    return `Review period active. Completion confirmation unlocks in ${waitText} (at ${this.getSubmissionApprovalUnlockAtText(submission)}).`;
  }

  isExpandLoading(c: Campaign): boolean {
    return this.expandInvitesLoading.has(c._id!);
  }

  isExpired(c: Campaign): boolean {
    if (!c.timelineEnd) return false;
    return new Date(c.timelineEnd).getTime() < Date.now();
  }

  daysRemainingText(c: Campaign): string {
    if (!c.timelineEnd) return '—';
    const diff = new Date(c.timelineEnd).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days === 1 ? '1 day left' : `${days} days left`;
  }

  formatBudgetCompact(c: Campaign): string {
    if (!c.budgetMin && !c.budgetMax) return '—';
    const fmt = (n: number): string => {
      if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
      if (n >= 1000) return '₹' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
      return '₹' + n;
    };
      if (c.budgetMin && c.budgetMax && c.budgetMin !== c.budgetMax) return `${fmt(c.budgetMin)}–${fmt(c.budgetMax)}`;
    return c.budgetMin ? fmt(c.budgetMin) : fmt(c.budgetMax!);
  }

  formatPricePerInfluencer(c: Campaign): string {
    const v = Number((c as any).pricePerInfluencer || 0);
    if (!v) return '—';
    const rupees = v / 100; // stored in paise
    const fmt = (n: number): string => {
      if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
      if (n >= 1000) return '₹' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
      return '₹' + Math.round(n);
    };
    return fmt(rupees);
  }

  activateCampaign(c: Campaign) {
    if (!c._id) return;
    // Only activate if invites exist for this campaign
    const invites = this.campaignInvitesMap.get(c._id) || [];
    if (!invites.length) {
      console.warn('Cannot activate campaign without invites.');
      return;
    }
    this.config.updateCampaign(c._id, { status: 'active' as any }).subscribe({
      next: () => {
        this.campaigns = this.campaigns.map(x => x._id === c._id ? { ...x, status: 'active' } : x);
        this.cd.detectChanges();
      }
    });
  }

  submittingReviewId: string | null = null;

  submitForReview(c: Campaign) {
    if (!c._id || this.submittingReviewId) return;
    this.submittingReviewId = c._id;
    this.config.updateCampaign(c._id, { status: 'pending_review' as any }).subscribe({
      next: () => {
        this.campaigns = this.campaigns.map(x => x._id === c._id ? { ...x, status: 'pending_review' } : x);
        this.expandedCampaignId = null;
        this.submittingReviewId = null;
        this.cd.detectChanges();
      },
      error: () => {
        this.submittingReviewId = null;
        this.cd.detectChanges();
      }
    });
  }

  pauseCampaign(c: Campaign) {
    if (!c._id) return;
    this.config.updateCampaign(c._id, { status: 'pending' as any }).subscribe({
      next: () => {
        this.campaigns = this.campaigns.map(x => x._id === c._id ? { ...x, status: 'pending' } : x);
        this.expandedCampaignId = null;
        this.cd.detectChanges();
      }
    });
  }

  endCampaign(c: Campaign) {
    if (!c._id) return;
    this.config.updateCampaign(c._id, { status: 'completed' as any }).subscribe({
      next: () => {
        this.campaigns = this.campaigns.map(x => x._id === c._id ? { ...x, status: 'completed' } : x);
        this.expandedCampaignId = null;
        this.cd.detectChanges();
      }
    });
  }

  extendTimeline(c: Campaign) {
    this.editingCampaign = c;
    this.formMode = 'edit';
    this.showForm = true;
  }

  // ── Summary stats ─────────────────────────────────────────────

  private consumesQuota(campaign: Campaign): boolean {
    const status = String(campaign?.status || '').trim().toLowerCase();
    return ['active', 'pending', 'pending_review', 'draft', 'paused'].includes(status);
  }

  get summaryTotalCampaigns(): number { return this.campaigns.length; }
  get summaryActiveCampaigns(): number {
    if (!this.isInfluencerView) {
      return this.campaigns.filter((campaign) => this.consumesQuota(campaign)).length;
    }
    return this.campaigns.filter((campaign) =>
      this.isCampaignOwnedByCurrentUser(campaign) && this.consumesQuota(campaign),
    ).length;
  }

  get summaryTotalBudget(): string {
    const total = this.campaigns.reduce((sum, c) => sum + (c.budgetMax || c.budgetMin || 0), 0);
    if (total >= 100000) return '₹' + (total / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (total >= 1000) return '₹' + (total / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return total > 0 ? '₹' + total : '—';
  }

  get summaryInvitesSent(): number {
    let total = 0;
    this.campaignInvitesMap.forEach(v => total += v.length);
    return total;
  }

  get summaryAccepted(): number {
    const activeStatuses = ['accepted', 'payment_confirmed', 'working', 'submitted', 'approved', 'completed', 'disputed'];
    let total = 0;
    this.campaignInvitesMap.forEach(v => total += v.filter((i: any) => activeStatuses.includes(i.status)).length);
    return total;
  }

  get summaryResponseRate(): string {
    const sent = this.summaryInvitesSent;
    if (sent === 0) return '—';
    let responded = 0;
    this.campaignInvitesMap.forEach(v => { responded += v.filter((i: any) => i.status !== 'pending' && i.status !== 'invited').length; });
    return Math.round((responded / sent) * 100) + '%';
  }

  // Example: Show banner if plan limit error occurs
  handleCreateCampaignError(error: any) {
    if (
      error?.error?.message &&
      error.error.message.includes('Plan limit')
    ) {
      this.planLimitError = error.error.message;
      this.showUpgradeBanner = true;
    } else {
      // handle other errors
      this.planLimitError = 'Failed to create campaign. Please check your input and try again.';
      this.showUpgradeBanner = false;
    }
  }

  openScreenshot(url: string) {
    window.open(this.resolveImageUrl(url), '_blank', 'noopener');
  }

  shouldShowSubmissionToggle(c: Campaign, inv: any): boolean {
    const status = this.getHostInviteEffectiveStatus(inv);
    if (['submitted', 'approved', 'completed', 'disputed'].includes(status)) return true;
    return !!this.getSubmissionForInvite(c, inv);
  }

  toggleSubmissionForInvite(c: Campaign, inv: any) {
    const inviteId = String(inv?._id || '').trim();
    const campaignId = String(c?._id || '').trim();
    if (!inviteId || !campaignId) return;

    if (this.getSubmissionForInvite(c, inv)) {
      this.toggleSubmission(inviteId);
      return;
    }

    this.config.getCampaignSubmissions(campaignId).subscribe({
      next: (submissions: any[]) => {
        const list = Array.isArray(submissions) ? submissions : [];
        this.campaignSubmissionsMap.set(campaignId, list);
        if (this.getSubmissionForInvite(c, inv)) {
          this.toggleSubmission(inviteId);
        } else {
          this.toast.error('Submission details are still syncing. Please try again shortly.');
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.toast.error('Failed to load submitted post details. Please try again.');
      }
    });
  }

  toggleSubmission(inviteId: string) {
    if (this.expandedSubmissionIds.has(inviteId)) {
      this.expandedSubmissionIds.delete(inviteId);
    } else {
      this.expandedSubmissionIds.add(inviteId);
    }
    this.cd.detectChanges();
  }

  resolveImageUrl(url: string): string {
    if (!url) return '';
    // In dev: strip the localhost:3000 origin so the request goes through
    // the Angular proxy (/assets/local-images → proxied to localhost:3000),
    // which avoids helmet Cross-Origin-Resource-Policy blocking.
    if (!environment.production) {
      const devHost = 'http://localhost:3000';
      if (url.startsWith(devHost + '/')) {
        return url.slice(devHost.length); // returns e.g. /assets/local-images/...
      }
    }
    return url;
  }

  getPostTypeLabel(platform: string, type: string): string {
    const p = (platform || '').toLowerCase();
    const t = (type || '').toLowerCase();
    if (p === 'youtube') {
      if (t === 'short') return 'YT · Short';
      if (t === 'video') return 'YT · Video';
      return 'YouTube';
    }
    if (p === 'instagram') {
      if (t === 'reel') return 'IG · Reel';
      if (t === 'story') return 'IG · Story';
      if (t === 'photo') return 'IG · Post';
      return 'Instagram';
    }
    if (p === 'twitter') return 'X · ' + (type || 'Post');
    if (p === 'facebook') return 'FB · ' + (type || 'Post');
    if (p === 'tiktok') return 'TT · ' + (type || 'Video');
    return [platform, type].filter(Boolean).join(' · ');
  }
}
