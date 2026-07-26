  // ...existing imports and @Component...
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { ConfigService } from '../../shared/config.service';
import { PlansService, PlanCapabilities, FREE_CAPABILITIES } from '../../shared/plans.service';
import { ToastService } from '../../shared/toast/toast.service';
import { MonetizationApiService, UsageSummary } from '../../services/monetization-api.service';
import { UsageSummaryComponent } from '../../shared/components/usage-summary/usage-summary.component';
import {
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../services/profile-verification.service';
import { ProfileReviewSummaryComponent } from '../../shared/profile-verification/profile-review-summary.component';
import { RegistrationNoticeComponent } from '../../shared/components/registration-notice/registration-notice.component';
import { FounderOfferModalComponent } from '../../shared/founder-offer/founder-offer-modal.component';
import { CollaborationScoreApiService, CollaborationAudit } from '../../services/collaboration-score-api.service';
import { CollaborationScoreCardComponent } from '../../shared/collaboration-score/collaboration-score-card.component';

@Component({
  selector: 'app-brand-dashboard',
  templateUrl: './brand-dashboard.component.html',
  styleUrls: ['./brand-dashboard.component.scss'],
  providers: [DashboardService],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, UsageSummaryComponent, ProfileReviewSummaryComponent, RegistrationNoticeComponent, FounderOfferModalComponent, CollaborationScoreCardComponent]
})

export class BrandDashboardComponent implements OnInit, OnDestroy {
  stats = {
    totalCampaigns: 0,
    invitesSent: 0,
    accepted: 0,
    completed: 0,
  };
  dashboard: any;
  recentCampaigns: any[] = [];
  recommendedInfluencers: any[] = [
    // Example placeholder, replace with real data fetching logic as needed
    // { name: 'Influencer 1', category: 'Fashion', followers: 10000 },
    // { name: 'Influencer 2', category: 'Tech', followers: 5000 },
  ];
  loading = true;
  error = '';
  filters: { category: string; state: string } = { category: '', state: '' };
  categories: string[] = [];
  states: string[] = [];
  profileIncomplete = false;
  emailVerificationError: string | null = null;
  paymentHistory: any[] = [];
  paymentSummary = {
    spentThisMonth: 0,
    platformFeesPaid: 0,
    pendingPayouts: 0,
  };
  verificationCallNumber = '';
  planCaps: PlanCapabilities = FREE_CAPABILITIES;
  showFounderOfferModal = false;
  private founderOfferAlreadySeen = true;
  private founderOfferCapsLoaded = false;
  private showingEligibilityUpgradePrompt = false;
  attentionCounts = { disputed: 0, overdue: 0, awaitingFulfillment: 0 };
  emailBannerDismissed = false;
  usageSummary: UsageSummary | null = null;
  profileVerificationDashboard: ProfileVerificationDashboard | null = null;
  profileVerificationLoading = false;
  collaborationAudit: CollaborationAudit | null = null;
  collaborationScoreLoading = false;
  collaborationScoreReAnalyzing = false;

  get firstRegisteredAtDisplay(): string | null {
    const dashboardBrand = this.dashboard?.brand || {};
    const sessionUser: any = this.session.getUser() || {};
    return (
      dashboardBrand.firstRegisteredAt ||
      dashboardBrand.createdAt ||
      sessionUser.firstRegisteredAt ||
      sessionUser.createdAt ||
      null
    );
  }

  get lastLoginAtDisplay(): string | null {
    const dashboardBrand = this.dashboard?.brand || {};
    const sessionUser: any = this.session.getUser() || {};
    return dashboardBrand.lastLoginAt || sessionUser.lastLoginAt || null;
  }

  get lastOpenedAtDisplay(): string | null {
    const dashboardBrand = this.dashboard?.brand || {};
    const sessionUser: any = this.session.getUser() || {};
    return dashboardBrand.lastOpenedAt || sessionUser.lastOpenedAt || null;
  }

  get isMobileVerified(): boolean {
    const brand = this.dashboard?.brand || {};
    return !!(brand.isMobileVerified ?? brand.mobileVerified ?? brand.phoneVerified ?? brand.isPhoneVerified);
  }

  private routerSub: Subscription | undefined;
  private userSub: Subscription | undefined;
  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    private session: SessionService,
    private config: ConfigService,
    private plansService: PlansService,
    private monetizationApi: MonetizationApiService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private profileVerification: ProfileVerificationService,
    private collaborationScoreApi: CollaborationScoreApiService,
  ) {}

  ngOnInit(): void {
        this.loadProfileVerificationDashboard();
        this.loadCollaborationScore();
        this.plansService.getMyCapabilities().subscribe((caps) => {
          this.planCaps = caps;
          this.founderOfferCapsLoaded = true;
          this.maybeShowFounderOfferModal();
          this.maybeShowUpgradeEligibilityModal();
        });
        this.monetizationApi.getMyUsage().subscribe({
          next: (res) => {
            this.usageSummary = res?.usage || null;
            this.cdr.detectChanges();
          },
          error: () => {
            this.usageSummary = null;
          },
        });

        // Ensure user is loaded from storage on direct load/refresh
        if (!this.session.getUser()) {
          this.session.loadUserFromStorage();
        }
    // Check for email verification error in query params (if redirected from verification)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('emailVerificationError')) {
        this.emailVerificationError = params.get('emailVerificationError');
      }
    }

    this.config.getSupportContact().subscribe({
      next: (support: any) => {
        this.verificationCallNumber = support?.verificationCallNumber || '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.verificationCallNumber = '';
      },
    });
    // Only fetch profile and load dashboard once per user
    this.userSub = this.session.user$.subscribe(user => {
      if (user) {
        this.config.getBrandProfileById().subscribe((profile: any) => {
          this.founderOfferAlreadySeen = !!profile?.founderOfferSeenAt;
          this.maybeShowFounderOfferModal();
          const merged = { ...user, ...profile };
          const isSame = JSON.stringify(user) === JSON.stringify(merged);
          if (profile && !isSame) {
            this.session.setUser(merged);
          } else {
            this.loadDashboard();
          }
        }, err => {
          console.error('[BrandDashboard] Brand profile fetch error:', err);
          this.loadDashboard();
        });
        // Unsubscribe after first load to prevent repeated calls
        if (this.userSub) {
          this.userSub.unsubscribe();
        }
      }
    });
    // Removed router event subscription to prevent infinite reloads
    // Load categories/states for filters (implement as needed)
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
    const completedIds = new Set<string>();

    for (const campaign of this.recentCampaigns) {
      const status = String(campaign?.status || '').toLowerCase();
      const completedCount = Number(campaign?.completed || 0);
      const isClosed = completedCount > 0 || status === 'completed' || status === 'approved';
      if (!isClosed) continue;
      if (!this.isInCurrentMonth(campaign?.completedAt || campaign?.updatedAt || campaign?.createdAt)) continue;
      completedIds.add(String(campaign?._id || campaign?.id || completedIds.size));
    }

    for (const tx of this.paymentHistory) {
      if (tx?.payerRole !== 'brand') continue;
      const stage = String(tx?.inviteSnapshot?.status || tx?.inviteStatus || tx?.workStatus || '').toLowerCase();
      if (!['completed', 'approved'].includes(stage)) continue;
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
    const brand = this.dashboard?.brand || this.session.getUser() || {};
    const id = brand?._id || brand?.id || brand?.email || 'current';
    return `trendstarz:upgrade-eligibility-prompt:brand:${id}:${this.currentMonthKey()}`;
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
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.userSub) this.userSub.unsubscribe();
  }

  loadDashboard() {
    this.loading = true;
    this.error = '';
    this.dashboardService.getBrandDashboard().subscribe({
      next: (data: any) => {
        // Handle both direct and wrapped responses
        const dashboardData = data?.data || data;
        this.dashboard = dashboardData;
        // debug: received dashboard campaigns
        this.recentCampaigns = Array.isArray(dashboardData.campaigns) ? dashboardData.campaigns : [];
        this.recommendedInfluencers = dashboardData.recommendedInfluencers || [];
        // Calculate stats from campaigns
        this.stats.totalCampaigns = this.recentCampaigns.length;
        this.stats.invitesSent = this.recentCampaigns.reduce((sum, c) => sum + (c.invitesSent || 0), 0);
        this.stats.accepted = this.recentCampaigns.reduce((sum, c) => sum + (c.accepted || 0), 0);
        this.stats.completed = this.recentCampaigns.reduce((sum, c) => sum + (c.completed || 0), 0);
        const brand = dashboardData.brand || {};
        this.profileIncomplete = !brand.brandName || !brand.categories?.length || !brand.location?.state;
        this.loading = false;
        this.loadPaymentHistory();
        this.loadAttentionCounts();
        this.maybeShowUpgradeEligibilityModal();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load dashboard.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadPaymentHistory() {
    this.config.getMyCampaignTransactions().subscribe({
      next: (rows: any[]) => {
        this.paymentHistory = rows;
        this.recomputePaymentSummary(rows);
        this.maybeShowUpgradeEligibilityModal();
      },
      error: () => {
        this.paymentHistory = [];
        this.recomputePaymentSummary([]);
      },
    });
  }

  loadAttentionCounts() {
    this.config.getBrandAttentionCounts().subscribe({
      next: (res: any) => {
        const data = res?.data || res;
        this.attentionCounts = {
          disputed: Number(data?.disputed || 0),
          overdue: Number(data?.overdue || 0),
          awaitingFulfillment: Number(data?.awaitingFulfillment || 0),
        };
        this.cdr.detectChanges();
      },
      error: () => {
        // silent
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

    const spentThisMonth = rows
      .filter((r: any) => r.payerRole === 'brand' && isThisMonth(r.updatedAt || r.createdAt))
      .reduce((sum: number, r: any) => sum + Number(r.payerTotal || 0), 0);

    const platformFeesPaid = rows
      .filter((r: any) => r.payerRole === 'brand')
      .reduce((sum: number, r: any) => sum + Number(r.platformFee || 0), 0);

    const pendingPayouts = rows
      .filter((r: any) => r.recipientRole === 'brand' && (r.payoutStatus === 'pending' || r.payoutStatus === 'processing'))
      .reduce((sum: number, r: any) => sum + Number(r.recipientPayout || 0), 0);

    this.paymentSummary = { spentThisMonth, platformFeesPaid, pendingPayouts };
  }

  formatPaise(amount: number): string {
    return `₹${((amount || 0) / 100).toLocaleString('en-IN')}`;
  }

  get activeCampaignList(): any[] {
    return this.recentCampaigns.filter(c => c.status === 'active');
  }

  /** Only unverified brand payments for the dashboard snapshot */
  get pendingPaymentHistory(): any[] {
    return this.paymentHistory.filter(tx =>
      tx.collectionStatus === 'awaiting_payment' || tx.collectionStatus === 'proof_submitted'
    );
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  onVerifyEmail() {
    if (typeof window !== 'undefined') {
      window.location.href = '/verify-email?returnUrl=/brand-dashboard';
    }
  }

  dismissEmailBanner() {
    this.emailBannerDismissed = true;
  }

  onMobileVerificationHelp() {
    const numberText = this.verificationCallNumber ? ` Team calls come from ${this.verificationCallNumber}.` : '';
    this.toast.info(`Mobile verification is handled by admin support call for now.${numberText} OTP/SMS flow will be added soon.`);
  }

  onUpgrade() {
    if (typeof window !== 'undefined') {
      window.location.href = '/upgrade-premium';
    }
  }

  onCompleteProfile() {
    if (typeof window !== 'undefined') {
      window.location.href = '/brand-profile';
    }
  }

  searchInfluencers(): void {
    this.dashboardService.searchInfluencers(this.filters).subscribe((res: any[]) => {
      this.recommendedInfluencers = res;
    });
  }

  get profileTraffic() {
    const traffic = this.dashboard?.brand?.profileTraffic || {};
    return {
      impressions: Number(traffic.impressions || 0),
      clicks: Number(traffic.clicks || 0),
      lastImpressionAt: traffic.lastImpressionAt || null,
      lastClickAt: traffic.lastClickAt || null,
    };
  }

  get isPremiumUser(): boolean {
    return !!this.dashboard?.brand?.isPremium;
  }

  get canViewProfileTraffic(): boolean {
    return this.plansService.getFeatureValue(this.planCaps, 'campaignAnalyticsDashboard');
  }
}
