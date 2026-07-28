import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize, timeout } from 'rxjs/operators';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { PlansService, PlanCapabilities, FREE_CAPABILITIES } from '../../shared/plans.service';
import { MonetizationApiService, UsageSummary } from '../../services/monetization-api.service';
import { CampaignDetailModalComponent, CampaignAcceptPayload } from '../../shared/campaign-detail-modal/campaign-detail-modal.component';
import { InviteAcceptPayload } from '../../shared/campaign-invite-card/campaign-invite-card.component';
import { DashboardService } from '../../services/dashboard.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ShippingAddressModalComponent } from '../../shared/components/shipping-address-modal/shipping-address-modal.component';
import { ShippingAddressModalService, ShippingAddress } from '../../shared/components/shipping-address-modal/shipping-address-modal.service';
import { UsageSummaryComponent } from '../../shared/components/usage-summary/usage-summary.component';
import {
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../services/profile-verification.service';
import { ProfileReviewSummaryComponent } from '../../shared/profile-verification/profile-review-summary.component';
import { WhatsappCommunityCardComponent } from '../../shared/whatsapp-community-card/whatsapp-community-card.component';
import { RegistrationNoticeComponent } from '../../shared/components/registration-notice/registration-notice.component';
import { FounderOfferModalComponent } from '../../shared/founder-offer/founder-offer-modal.component';
import { CollaborationScoreApiService, CollaborationAudit } from '../../services/collaboration-score-api.service';
import { CollaborationScoreSummaryWidgetComponent } from '../../shared/collaboration-score/collaboration-score-summary-widget.component';

@Component({
  selector: 'app-photographer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, CampaignDetailModalComponent, ShippingAddressModalComponent, UsageSummaryComponent, ProfileReviewSummaryComponent, WhatsappCommunityCardComponent, RegistrationNoticeComponent, FounderOfferModalComponent, CollaborationScoreSummaryWidgetComponent],
  templateUrl: './photographer-dashboard.component.html',
  styleUrls: ['./photographer-dashboard.component.scss'],
})
export class PhotographerDashboardComponent implements OnInit, OnDestroy {
  photographer: any = null;
  brandCampaigns: any[] = [];
  brandCampaignsLoading = false;
  brandInvites: any[] = [];
  brandInvitesLoading = false;
  paymentHistory: any[] = [];
  paymentSummary = {
    earnedThisMonth: 0,
    pending: 0,
    frozen: 0,
    paidInPayToJoin: 0,
  };
  loading = true;
  error = '';
  profileIncomplete = false;
  profileTraffic = {
    impressions: 0,
    clicks: 0,
    lastImpressionAt: '',
    lastClickAt: '',
  };
  usageSummary: UsageSummary | null = null;
  verificationCallNumber = '';
  profileVerificationDashboard: ProfileVerificationDashboard | null = null;
  profileVerificationLoading = false;
  collaborationAudit: CollaborationAudit | null = null;
  collaborationScoreLoading = false;
  collaborationScoreReAnalyzing = false;
  private loadedOnce = false;
  planCaps: PlanCapabilities = FREE_CAPABILITIES;
  showFounderOfferModal = false;
  private founderOfferAlreadySeen = true;
  private founderOfferCapsLoaded = false;
  private showingEligibilityUpgradePrompt = false;

  selectedInvite: any = null;
  selectedInviteManual = false;
  responding: string | null = null;
  defaultPayout: { upiId: string; mobile: string; accountHolderName: string } = {
    upiId: '',
    mobile: '',
    accountHolderName: '',
  };

  private readonly userSub = new Subscription();

  constructor(
    private readonly session: SessionService,
    private readonly config: ConfigService,
    private readonly plansService: PlansService,
    private readonly monetizationApi: MonetizationApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly dashboardService: DashboardService,
    private readonly toast: ToastService,
    private readonly shippingModal: ShippingAddressModalService,
    private readonly profileVerification: ProfileVerificationService,
    private readonly collaborationScoreApi: CollaborationScoreApiService,
  ) {}

  ngOnInit(): void {
    if (!this.session.getUser()) {
      this.session.loadUserFromStorage();
    }

    this.monetizationApi.getMyUsage().subscribe({
      next: (res) => {
        this.usageSummary = res?.usage || null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.usageSummary = null;
      },
    });

    this.plansService.getMyCapabilities().subscribe((caps) => {
      this.planCaps = caps;
      this.founderOfferCapsLoaded = true;
      this.maybeShowFounderOfferModal();
      this.maybeShowUpgradeEligibilityModal();
    });

    this.loadProfileVerificationDashboard();
    this.loadCollaborationScore();

    this.config.getSupportContact().subscribe({
      next: (support) => {
        this.verificationCallNumber = support?.verificationCallNumber || '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.verificationCallNumber = '';
      },
    });

    this.userSub.add(
      this.session.user$.subscribe((user) => {
        if (!user || String(user.role || '').toLowerCase() !== 'photographer') {
          return;
        }
        if (this.loadedOnce) {
          return;
        }
        this.loadedOnce = true;
        this.loadDashboard();
      }),
    );
  }

  private maybeShowFounderOfferModal(): void {
    if (!this.founderOfferCapsLoaded) return;
    if (this.founderOfferAlreadySeen) return;
    if (this.planCaps?.hasPremium) return;
    this.showFounderOfferModal = true;
  }

  onFounderOfferModalClosed(): void {
    if (this.showingEligibilityUpgradePrompt) {
      this.markEligibilityUpgradePromptSeen();
      this.showingEligibilityUpgradePrompt = false;
    }
    this.showFounderOfferModal = false;
  }

  private maybeShowUpgradeEligibilityModal(): void {
    if (!this.founderOfferCapsLoaded) return;
    if (this.showFounderOfferModal) return;
    if (!this.founderOfferAlreadySeen) return;
    if (this.planCaps?.hasPremium) return;
    if (!this.hasStarterEligibilityClosed()) return;
    if (this.hasSeenEligibilityUpgradePrompt()) return;

    this.showingEligibilityUpgradePrompt = true;
    this.showFounderOfferModal = true;
  }

  private hasStarterEligibilityClosed(): boolean {
    const cap = this.starterCampaignEligibilityCap();
    if (cap <= 0) return false;
    return this.completedStarterCampaignCountThisMonth() >= cap;
  }

  private starterCampaignEligibilityCap(): number {
    const limits = Array.isArray(this.planCaps?.limits) ? this.planCaps.limits : [];
    const values = ['maxActiveCampaigns', 'maxInvitesPerMonth', 'maxInvitesPerCampaign', 'maxCampaignPosts']
      .map(key => Number(limits.find((limit: any) => limit?.key === key)?.value))
      .filter(value => Number.isFinite(value) && value > 0);
    return values.length ? Math.min(...values) : 1;
  }

  private completedStarterCampaignCountThisMonth(): number {
    const completedStatuses = new Set(['completed', 'approved']);
    const completedIds = new Set<string>();

    for (const invite of this.brandInvites) {
      if (!completedStatuses.has(String(invite?.status || '').toLowerCase())) continue;
      if (!this.isInCurrentMonth(invite?.completedAt || invite?.updatedAt || invite?.createdAt)) continue;
      completedIds.add(String(invite?._id || invite?.inviteId || invite?.campaignId?._id || completedIds.size));
    }

    for (const tx of this.paymentHistory) {
      if (tx?.recipientRole !== 'photographer') continue;
      if (!this.isPayoutProcessingStage(tx)) continue;
      if (!this.isInCurrentMonth(tx?.completedAt || tx?.paidOutAt || tx?.updatedAt || tx?.createdAt)) continue;
      completedIds.add(String(tx?.inviteId || tx?.campaignId || tx?._id || completedIds.size));
    }

    return completedIds.size;
  }

  private isInCurrentMonth(value?: string | Date | null): boolean {
    if (!value) return false;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return false;
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  private eligibilityUpgradePromptKey(): string {
    const user = this.photographer || this.session.getUser() || {};
    const id = user?._id || user?.id || user?.email || 'current';
    return `trendstarz:upgrade-eligibility-prompt:photographer:${id}:${this.currentMonthKey()}`;
  }

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private hasSeenEligibilityUpgradePrompt(): boolean {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(this.eligibilityUpgradePromptKey()) === '1';
  }

  private markEligibilityUpgradePromptSeen(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.eligibilityUpgradePromptKey(), '1');
  }

  private loadProfileVerificationDashboard(): void {
    this.profileVerificationLoading = true;
    this.profileVerification.getMyDashboard().subscribe({
      next: (dashboard) => {
        this.profileVerificationDashboard = dashboard;
        this.profileVerificationLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.profileVerificationDashboard = null;
        this.profileVerificationLoading = false;
      },
    });
  }

  private loadCollaborationScore(): void {
    const user: any = this.session.getUser() || {};
    const userId = String(user?._id || user?.id || '');
    if (!userId) return;
    this.collaborationScoreLoading = true;
    this.collaborationScoreApi.getAudit(userId).subscribe({
      next: (audit) => {
        this.collaborationAudit = audit;
        this.collaborationScoreLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.collaborationAudit = null;
        this.collaborationScoreLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onReAnalyzeCollaborationScore(): void {
    this.collaborationScoreReAnalyzing = true;
    this.collaborationScoreApi.runMyAudit().subscribe({
      next: (audit) => {
        this.collaborationAudit = audit;
        this.collaborationScoreReAnalyzing = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.collaborationScoreReAnalyzing = false;
        this.toast.error('Could not refresh your Collaboration Score. Please try again.');
        this.cdr.detectChanges();
      },
    });
  }

  ngOnDestroy(): void {
    this.userSub.unsubscribe();
  }

  get skillsCount(): number {
    return Array.isArray(this.photographer?.skills) ? this.photographer.skills.length : 0;
  }

  get pricingCount(): number {
    return Array.isArray(this.photographer?.pricing)
      ? this.photographer.pricing.filter((item: any) => item?.enabled).length
      : 0;
  }

  get platformsCount(): number {
    return Array.isArray(this.photographer?.socialMedia) ? this.photographer.socialMedia.length : 0;
  }

  get equipmentCount(): number {
    return Array.isArray(this.photographer?.equipment) ? this.photographer.equipment.length : 0;
  }

  get trafficCardTitle(): string {
    return this.photographer?.status === 'accepted' ? 'Profile traffic' : 'Profile traffic pending';
  }

  get isEmailVerified(): boolean {
    const photographer = this.photographer || {};
    return !!photographer.isEmailVerified;
  }

  get isMobileVerified(): boolean {
    const photographer = this.photographer || {};
    return !!(photographer.isMobileVerified ?? photographer.mobileVerified ?? photographer.phoneVerified ?? photographer.isPhoneVerified);
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = '';
    this.config.getPhotographerProfileById().subscribe({
      next: (profile: any) => {
        if (!profile) {
          this.photographer = null;
          this.error = 'Could not load photographer dashboard.';
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        this.photographer = profile;
        this.founderOfferAlreadySeen = !!profile?.founderOfferSeenAt;
        this.maybeShowFounderOfferModal();
        this.defaultPayout = {
          upiId: profile?.payout?.upiId || '',
          mobile: profile?.payout?.mobile || profile?.phoneNumber || '',
          accountHolderName: profile?.payout?.accountHolderName || profile?.name || '',
        };
        this.profileTraffic = {
          impressions: Number(profile?.profileTraffic?.impressions || 0),
          clicks: Number(profile?.profileTraffic?.clicks || 0),
          lastImpressionAt: profile?.profileTraffic?.lastImpressionAt || '',
          lastClickAt: profile?.profileTraffic?.lastClickAt || '',
        };
        this.profileIncomplete = !profile?.name || !profile?.location?.state || !Array.isArray(profile?.skills) || profile.skills.length === 0 || !Array.isArray(profile?.socialMedia) || profile.socialMedia.length === 0;
        this.loading = false;
        this.loadBrandInvites();
        this.loadBrandCampaigns();
        this.loadPaymentHistory();
        this.maybeShowUpgradeEligibilityModal();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Could not load photographer dashboard.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadBrandCampaigns(): void {
    this.brandCampaignsLoading = true;
    this.config.getAllCampaigns('active').subscribe({
      next: (rows: any[]) => {
        const all = Array.isArray(rows) ? rows : [];
        // Show latest active campaigns from brands for quick discovery.
        this.brandCampaigns = all
          .filter((c: any) => String(c?.status || '').toLowerCase() === 'active')
          .sort((a: any, b: any) => {
            const at = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
            const bt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
            return bt - at;
          })
          .slice(0, 6);
        this.brandCampaignsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.brandCampaigns = [];
        this.brandCampaignsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadBrandInvites(): void {
    this.brandInvitesLoading = true;
    this.config.getMyPhotographerInvites().subscribe({
      next: (rows: any[]) => {
        this.brandInvites = Array.isArray(rows) ? rows : [];
        this.brandInvitesLoading = false;
        this.maybeShowUpgradeEligibilityModal();
        this.cdr.detectChanges();
      },
      error: () => {
        this.brandInvites = [];
        this.brandInvitesLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadPaymentHistory(): void {
    this.config.getMyCampaignTransactions().subscribe({
      next: (rows: any[]) => {
        this.paymentHistory = rows;
        this.recomputePaymentSummary(rows);
        this.maybeShowUpgradeEligibilityModal();
        this.cdr.detectChanges();
      },
      error: () => {
        this.paymentHistory = [];
        this.recomputePaymentSummary([]);
        this.cdr.detectChanges();
      },
    });
  }

  private recomputePaymentSummary(rows: any[]) {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const isThisMonth = (d?: string) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt.getMonth() === month && dt.getFullYear() === year;
    };

    const earnedThisMonth = rows
      .filter((r: any) => r.recipientRole === 'photographer' && r.payoutStatus === 'paid' && isThisMonth(r.paidOutAt || r.updatedAt || r.createdAt))
      .reduce((sum: number, r: any) => sum + Number(r.recipientPayout || 0), 0);

    const pending = rows
      .filter((r: any) =>
        r.recipientRole === 'photographer' &&
        (r.payoutStatus === 'pending' || r.payoutStatus === 'processing') &&
        this.isPayoutProcessingStage(r)
      )
      .reduce((sum: number, r: any) => sum + Number(r.recipientPayout || 0), 0);

    const frozen = rows
      .filter((r: any) => r.recipientRole === 'photographer' && r.payoutStatus === 'frozen')
      .reduce((sum: number, r: any) => sum + Number(r.recipientPayout || 0), 0);

    const paidInPayToJoin = rows
      .filter((r: any) => r.payerRole === 'photographer')
      .reduce((sum: number, r: any) => sum + Number(r.payerTotal || 0), 0);

    this.paymentSummary = { earnedThisMonth, pending, frozen, paidInPayToJoin };
  }

  /** Only non-paid / non-skipped transactions for the dashboard snapshot */
  get pendingPaymentHistory(): any[] {
    return this.paymentHistory.filter(tx =>
      tx.payoutStatus !== 'paid' && tx.payoutStatus !== 'skipped'
    );
  }

  get frozenPayouts(): any[] {
    return this.paymentHistory.filter(tx =>
      tx.recipientRole === 'photographer' && tx.payoutStatus === 'frozen'
    );
  }

  private inviteStage(tx: any): string {
    return String(tx?.inviteSnapshot?.status || tx?.inviteStatus || '').trim().toLowerCase();
  }

  private isPayoutProcessingStage(tx: any): boolean {
    const stage = this.inviteStage(tx);
    const workStatus = String(tx?.workStatus || '').trim().toLowerCase();
    return ['completed', 'approved'].includes(stage) || workStatus === 'approved';
  }

  paymentFlowStatusLabel(tx: any): string {
    const stage = this.inviteStage(tx);
    const collectionStatus = String(tx?.collectionStatus || '').trim().toLowerCase();
    const payoutStatus = String(tx?.payoutStatus || '').trim().toLowerCase();

    if (payoutStatus === 'frozen') return 'Dispute open';
    if (payoutStatus === 'paid') return `Paid ${this.formatPaise(tx?.recipientPayout || 0)}`;
    if (payoutStatus === 'processing' || this.isPayoutProcessingStage(tx)) return 'Payout Processing (4-6 hrs)';
    if (stage === 'submitted') return 'Under Review (24 hrs)';
    if (stage === 'working') return 'Complete your Reel/Post';
    if (stage === 'payment_confirmed') return 'Ready to Start';
    if (stage === 'accepted') return 'Waiting for Host Confirmation';
    if (collectionStatus === 'proof_submitted') return 'Payment verifying';
    if (collectionStatus === 'failed') return 'Payment rejected';
    if (collectionStatus === 'verified') return 'Ready to Start';
    return 'Waiting for Host Confirmation';
  }

  paymentFlowStatusClass(tx: any): Record<string, boolean> {
    const label = this.paymentFlowStatusLabel(tx).toLowerCase();
    return {
      'idb-status--frozen': label.includes('dispute') || String(tx?.payoutStatus || '') === 'frozen',
      'idb-status--processing': label.includes('processing') || label.includes('under review') || label.includes('ready'),
      'idb-status--pending': label.includes('waiting') || label.includes('complete your') || label.includes('verifying'),
      'idb-status--rejected': label.includes('rejected'),
    };
  }

  formatPaise(paise: number): string {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;
  }

  /** Invites still awaiting the photographer's own response */
  get pendingBrandInvites(): any[] {
    const pendingStatuses = new Set(['pending', 'invited', 'counter_sent']);
    return this.brandInvites.filter((inv: any) => pendingStatuses.has(String(inv?.status || '').toLowerCase()));
  }

  /** Accepted invites that are in progress — accepted through submitted, not yet completed */
  get activeCollaborations(): any[] {
    const activeStatuses = new Set(['accepted', 'payment_confirmed', 'working', 'submitted']);
    return this.brandInvites.filter((inv: any) => activeStatuses.has(String(inv?.status || '').toLowerCase()));
  }

  activeCollabBadgeLabel(inv: any): string {
    const status = String(inv?.status || '').toLowerCase();
    const campaignType = String(inv?.campaignId?.campaignType || '').toLowerCase();
    if (status === 'accepted' && campaignType === 'paid_collab') return 'Confirmation Pending';
    if (status === 'accepted') return 'Working';
    if (status === 'payment_confirmed') return 'Ready to Start';
    if (status === 'working') return 'Working';
    if (status === 'submitted') return 'Under Review';
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
  }

  getBrandName(campaign: any): string {
    const b = campaign?.brandId;
    if (typeof b === 'object' && b) {
      return b.brandName || b.businessName || b.name || 'Brand';
    }
    return 'Brand';
  }

  formatTimeline(start?: string, end?: string): string {
    const fmt = (d?: string) => d
      ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : '?';
    return `${fmt(start)} – ${fmt(end)}`;
  }

  formatDate(value: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  onCompleteProfile(): void {
    this.router.navigate(['/photographer-profile']);
  }

  onViewPublicProfile(): void {
    const username = String(this.photographer?.username || '').trim();
    const id = this.photographer?._id;
    if (username) {
      this.router.navigate(['/photographer', username]);
      return;
    }
    if (id) {
      this.router.navigate(['/photographer', id]);
    }
  }

  onSearch(): void {
    this.router.navigate(['/search']);
  }

  onVerifyEmail(): void {
    if (typeof window !== 'undefined') {
      window.location.href = '/verify-email?returnUrl=/photographer-dashboard';
    }
  }

  onMobileVerificationHelp(): void {
    const numberText = this.verificationCallNumber ? ` Team calls come from ${this.verificationCallNumber}.` : '';
    this.toast.info(`Mobile verification is handled by admin support call for now.${numberText} OTP/SMS flow will be added soon.`);
  }

  onOpenCampaigns(): void {
    this.router.navigate(['/campaigns']);
  }

  openDetail(invite: any): void {
    this.selectedInvite = invite;
    this.selectedInviteManual = true;
    this.cdr.detectChanges();
  }

  closeDetail(): void {
    this.selectedInvite = null;
    this.selectedInviteManual = false;
    this.cdr.detectChanges();
  }

  onModalAccept(payload: CampaignAcceptPayload): void {
    this.respond(
      payload.inviteId,
      payload.responseType === 'counter' ? 'counter_sent' : 'accepted',
      payload.postDate,
      payload.counterAmount,
      payload.counterMessage,
      payload.payout,
    );
  }

  onModalDecline(payload: { inviteId: string }): void {
    this.respond(payload.inviteId, 'declined');
  }

  onModalValidationError(_message: string): void {}

  private respond(
    inviteId: string,
    status: 'accepted' | 'declined' | 'counter_sent',
    selectedPostDate?: string,
    counterAmount?: number,
    counterMessage?: string,
    payout?: { upiId?: string; mobile?: string; accountHolderName?: string },
  ): void {
    if (this.responding) return;

    const finish = (shippingAddress?: ShippingAddress) => {
      this.responding = inviteId;
      this.dashboardService.respondToInvite(
        inviteId,
        status,
        selectedPostDate,
        undefined,
        undefined,
        counterAmount,
        counterMessage,
        payout,
        shippingAddress,
      ).pipe(
        timeout(20000),
        finalize(() => {
          this.responding = null;
          this.cdr.detectChanges();
        }),
      ).subscribe({
        next: () => {
          // Declined invites have nothing further to track; accepted/counter_sent
          // ones need to stay in brandInvites so they surface in
          // activeCollaborations/pendingBrandInvites with their new status.
          if (status === 'declined') {
            this.brandInvites = this.brandInvites.filter(i => i._id !== inviteId);
          } else {
            this.brandInvites = this.brandInvites.map(i => i._id === inviteId ? { ...i, status } : i);
          }
          if (this.selectedInvite?._id === inviteId) {
            this.selectedInvite = null;
            this.selectedInviteManual = false;
          }
          this.toast.success(
            status === 'accepted' ? 'Invite accepted!' :
            status === 'counter_sent' ? 'Price flow updated: counter sent.' : 'Invite declined.',
          );
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to respond to invite.');
          this.cdr.detectChanges();
        },
      });
    };

    const invite = this.brandInvites.find(i => i._id === inviteId) || this.selectedInvite;
    const campaignType = invite?.campaignId?.campaignType || invite?.campaignType || '';
    const needsShipping = status === 'accepted' && campaignType === 'product_gifting';

    if (needsShipping) {
      this.shippingModal.prompt({
        campaignTitle: invite?.campaignId?.title || invite?.title || '',
      }).then(
        (addr: ShippingAddress | null) => finish(addr ?? undefined),
        () => { this.responding = null; },
      );
    } else {
      finish();
    }
  }
}
