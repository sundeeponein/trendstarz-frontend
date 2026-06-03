import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { CommonModule, DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, timeout } from 'rxjs/operators';
import { CampaignDetailModalComponent } from '../../shared/campaign-detail-modal/campaign-detail-modal.component';
import { InviteAcceptPayload, InviteDeclinePayload } from '../../shared/campaign-invite-card/campaign-invite-card.component';
import { DashboardService } from '../../services/dashboard.service';
import { ConfigService } from '../../shared/config.service';
import { PlansService, PlanCapabilities, FREE_CAPABILITIES } from '../../shared/plans.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ShippingAddressModalComponent } from '../../shared/components/shipping-address-modal/shipping-address-modal.component';
import { ShippingAddressModalService, ShippingAddress } from '../../shared/components/shipping-address-modal/shipping-address-modal.service';
import { MonetizationApiService, UsageSummary } from '../../services/monetization-api.service';
import { UsageSummaryComponent } from '../../shared/components/usage-summary/usage-summary.component';

@Component({
  selector: 'app-influencer-dashboard',
  templateUrl: './influencer-dashboard.component.html',
  styleUrls: ['./influencer-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, DecimalPipe, SlicePipe, FormsModule, CampaignDetailModalComponent, RouterModule, ShippingAddressModalComponent, UsageSummaryComponent]
})
export class InfluencerDashboardComponent implements OnInit, OnDestroy {
  dashboard: any;
  invites: any[] = [];
  collaborationRequests: any[] = [];
  activeCampaigns: any[] = [];
  completedCampaigns: any[] = [];
  loading = true;
  error = '';
  profileIncomplete = false;
  emailVerificationError: string | null = null;

  // detail modal state
  selectedInvite: any = null;
  selectedInviteManual = false;
  responding: string | null = null;
  selectedPostDates: Record<string, string> = {};
  // Content type selection: key = inviteId, value = "platform::contentType"
  selectedContentTypes: Record<string, string> = {};
  // Per-invite payout details (UPI, mobile, name) confirmed at accept time
  selectedPayouts: Record<string, { upiId: string; mobile: string; accountHolderName: string }> = {};
  // Default payout details from current influencer profile
  defaultPayout: { upiId: string; mobile: string; accountHolderName: string } = {
    upiId: '',
    mobile: '',
    accountHolderName: '',
  };
  selectedInviteQualifyingPlatform: string | null = null;
  selectedInviteQualifyingTier: string | null = null;
  myInfluencerSocialMedia: Array<{ platform: string; tier: string }> = [];
  paymentHistory: any[] = [];
  paymentSummary = {
    earnedThisMonth: 0,
    pending: 0,
    frozen: 0,
    paidInPayToJoin: 0,
  };
  planCaps: PlanCapabilities = FREE_CAPABILITIES;
  attentionCounts = { pendingInvites: 0, overdueDeliverables: 0, disputedAgainstMe: 0 };
  emailBannerDismissed = false;
  verificationCallNumber = '';
  usageSummary: UsageSummary | null = null;

  get firstRegisteredAtDisplay(): string | null {
    const dashboardUser = this.dashboard?.user || {};
    const sessionUser: any = this.session.getUser() || {};
    return (
      dashboardUser.firstRegisteredAt ||
      dashboardUser.createdAt ||
      sessionUser.firstRegisteredAt ||
      sessionUser.createdAt ||
      null
    );
  }

  get lastLoginAtDisplay(): string | null {
    const dashboardUser = this.dashboard?.user || {};
    const sessionUser: any = this.session.getUser() || {};
    return dashboardUser.lastLoginAt || sessionUser.lastLoginAt || null;
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
    private shippingModal: ShippingAddressModalService,
  ) {}

  ngOnInit() {
    this.plansService.getMyCapabilities().subscribe((caps) => {
      this.planCaps = caps;
    });
    this.monetizationApi.getMyUsage().subscribe({
      next: (res) => {
        this.usageSummary = res?.usage || null;
        this.cdr.markForCheck();
      },
      error: () => {
        this.usageSummary = null;
      },
    });

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('emailVerificationError')) {
        this.emailVerificationError = params.get('emailVerificationError');
      }
      if (sessionStorage.getItem('emailVerifDismissed') === '1') {
        this.emailBannerDismissed = true;
      }
    }

    this.config.getSupportContact().subscribe({
      next: (support: any) => {
        this.verificationCallNumber = support?.verificationCallNumber || '';
        this.cdr.markForCheck();
      },
      error: () => {
        this.verificationCallNumber = '';
      },
    });

    // Only fetch profile and load dashboard once per user
    this.userSub = this.session.user$.subscribe(user => {
      if (user) {
        this.config.getInfluencerProfileById().subscribe((profile: any) => {
          if (profile) {
            // Seed default payout details from the influencer profile so the
            // accept card can prefill UPI / mobile / account holder name.
            this.defaultPayout = {
              upiId: profile?.payout?.upiId || '',
              mobile: profile?.payout?.mobile || profile?.phoneNumber || '',
              accountHolderName: profile?.payout?.accountHolderName || profile?.name || '',
            };
            this.myInfluencerSocialMedia = (profile?.socialMedia || []).map((sm: any) => ({ platform: sm.platform || '', tier: sm.tier || '' }));
            // Only call setUser if profile data is different
            const merged = { ...user, ...profile };
            const isSame = JSON.stringify(user) === JSON.stringify(merged);
            if (!isSame) {
              this.session.setUser(merged);
            } else {
              this.loadDashboard();
            }
          } else {
            this.loadDashboard();
          }
        });
        // Unsubscribe after first load to prevent repeated calls
        if (this.userSub) {
          this.userSub.unsubscribe();
        }
      }
    });
    // Removed router event subscription to prevent infinite reloads
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.userSub) this.userSub.unsubscribe();
  }

  loadDashboard() {
    this.loading = true;
    this.error = '';
    this.dashboardService.getInfluencerDashboard().subscribe({
      next: (res) => {
        setTimeout(() => {
          const data = res.data || {};
          this.dashboard = data;
          // Always load scoped inbox/open lists so campaigns and collaborations stay separated.
          this.loadCampaignInvites();
          this.loadCollaborationRequests();
          this.activeCampaigns = data.activeCampaigns || [];
          this.completedCampaigns = data.completedCampaigns || [];
          const user = data.user || {};
          this.profileIncomplete = !user.name || !user.categories?.length || !user.socialMedia?.length || !user.location?.state;
          this.loading = false;
          this.loadPaymentHistory();
          this.loadAttentionCounts();

          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        setTimeout(() => {
          this.error = err?.error?.message || 'Failed to load dashboard.';
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  private isCollabInvite(inv: any): boolean {
    const ownerRole = String(
      inv?.campaignId?.ownerType || inv?.campaignId?.createdByRole || inv?.brandId?.role || '',
    ).trim().toLowerCase();
    const requestKind = String(inv?.campaignId?.requestKind || '').trim().toLowerCase();
    return ownerRole === 'photographer'
      || ownerRole === 'videographer'
      || requestKind === 'photographer_collaboration'
      || requestKind === 'videographer_collaboration';
  }

  private mapInviteToDashboardStatus(inviteStatus: string): string {
    const status = String(inviteStatus || '').toLowerCase();
    if (status === 'pending' || status === 'invited' || status === 'counter_sent') return 'pending_review';
    if (status === 'accepted' || status === 'payment_confirmed' || status === 'working' || status === 'submitted') return 'active';
    if (status === 'completed' || status === 'approved') return 'completed';
    if (status === 'declined' || status === 'withdrawn') return 'rejected';
    return status || 'pending_review';
  }

  private normalizeCollaborationRequest(inv: any): any {
    const campaign = inv?.campaignId || {};
    return {
      _id: campaign?._id || inv?._id,
      title: campaign?.title || '(untitled)',
      description: campaign?.description || '',
      categories: Array.isArray(campaign?.categories) ? campaign.categories : [],
      timelineStart: campaign?.timelineStart || campaign?.startDate || null,
      timelineEnd: campaign?.timelineEnd || campaign?.endDate || null,
      pricePerInfluencer: campaign?.pricePerInfluencer || 0,
      maxInfluencers: campaign?.maxInfluencers || 0,
      status: this.mapInviteToDashboardStatus(inv?.status),
      updatedAt: inv?.updatedAt || campaign?.updatedAt || inv?.createdAt || campaign?.createdAt || null,
      createdAt: inv?.createdAt || campaign?.createdAt || null,
    };
  }

  loadCampaignInvites() {
    this.config.getMyInvites('campaign').subscribe({
      next: (rows: any[]) => {
        this.invites = (rows || []).filter((i: any) => {
          const status = String(i?.status || '').toLowerCase();
          return (status === 'pending' || status === 'invited' || status === 'counter_sent') && !this.isCollabInvite(i);
        });
        this.cdr.markForCheck();
      },
      error: () => {
        this.invites = [];
        this.cdr.markForCheck();
      },
    });
  }

  loadCollaborationRequests() {
    this.config.getMyInvites('collaboration').subscribe({
      next: (rows: any[]) => {
        const all = Array.isArray(rows) ? rows : [];
        this.collaborationRequests = all
          .filter((inv: any) => {
            const status = String(inv?.status || '').toLowerCase();
            return status !== 'completed' && status !== 'approved' && status !== 'declined' && status !== 'withdrawn';
          })
          .map((inv: any) => this.normalizeCollaborationRequest(inv))
          .sort((a: any, b: any) => {
            const at = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
            const bt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
            return bt - at;
          })
          .slice(0, 5);
        this.cdr.markForCheck();
      },
      error: () => {
        this.collaborationRequests = [];
        this.cdr.markForCheck();
      },
    });
  }

  openCampaignManagement(tab: 'campaigns' | 'collaborations' = 'campaigns') {
    this.router.navigate(['/campaigns'], { queryParams: { tab } });
  }

  loadAttentionCounts() {
    this.config.getInfluencerAttentionCounts().subscribe({
      next: (res: any) => {
        const data = res?.data || res;
        this.attentionCounts = {
          pendingInvites: Number(data?.pendingInvites || 0),
          overdueDeliverables: Number(data?.overdueDeliverables || 0),
          disputedAgainstMe: Number(data?.disputedAgainstMe || 0),
        };
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  loadPaymentHistory() {
    this.config.getMyCampaignTransactions().subscribe({
      next: (rows: any[]) => {
        this.paymentHistory = rows;
        this.recomputePaymentSummary(rows);
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
      .filter((r: any) => r.recipientRole === 'influencer' && r.payoutStatus === 'paid' && isThisMonth(r.paidOutAt || r.updatedAt || r.createdAt))
      .reduce((sum: number, r: any) => sum + Number(r.recipientPayout || 0), 0);

    const pending = rows
      .filter((r: any) => r.recipientRole === 'influencer' && (r.payoutStatus === 'pending' || r.payoutStatus === 'processing'))
      .reduce((sum: number, r: any) => sum + Number(r.recipientPayout || 0), 0);

    const frozen = rows
      .filter((r: any) => r.recipientRole === 'influencer' && r.payoutStatus === 'frozen')
      .reduce((sum: number, r: any) => sum + Number(r.recipientPayout || 0), 0);

    const paidInPayToJoin = rows
      .filter((r: any) => r.payerRole === 'influencer')
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
      tx.recipientRole === 'influencer' && tx.payoutStatus === 'frozen'
    );
  }

  formatPaise(amount: number): string {
    return `₹${((amount || 0) / 100).toLocaleString('en-IN')}`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  respond(
    inviteId: string,
    status: 'accepted' | 'declined' | 'counter_sent',
    counterAmount?: number,
    counterMessage?: string,
  ) {
    if (this.responding) return;
    const selectedPostDate = status === 'accepted' || status === 'counter_sent'
      ? this.selectedPostDates[inviteId]
      : undefined;
    if ((status === 'accepted' || status === 'counter_sent') && !selectedPostDate) {
      this.error = 'Please choose a posting date before accepting invite.';
      return;
    }
    const invite = this.invites.find(i => i._id === inviteId) || this.selectedInvite;
    if ((status === 'accepted' || status === 'counter_sent') && invite && !this.isPostDateWithinCampaign(invite, selectedPostDate!)) {
      this.error = 'Posting date must be within campaign start and end dates.';
      return;
    }
    const options = this.getInviteContentTypeOptions(invite);
    let chosen = this.selectedContentTypes[inviteId];
    if ((status === 'accepted' || status === 'counter_sent') && options.length === 1 && !chosen) {
      chosen = options[0].key;
      this.selectedContentTypes[inviteId] = chosen;
    }
    if ((status === 'accepted' || status === 'counter_sent') && options.length > 0 && !chosen) {
      this.error = 'Please select what you will create for this campaign.';
      return;
    }
    const [selPlatform, selContentType] = chosen ? chosen.split('::') : [undefined, undefined];
    const payout = status === 'accepted' || status === 'counter_sent'
      ? this.selectedPayouts[inviteId]
      : undefined;

    const finish = (shippingAddress?: ShippingAddress) => {
      this.responding = inviteId;
      this.dashboardService.respondToInvite(
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
          this.responding = null;
          this.cdr.markForCheck();
        }),
      ).subscribe({
        next: () => {
          // update in-place — no full reload
          this.invites = this.invites.filter(i => i._id !== inviteId);
          if (this.selectedInvite?._id === inviteId) {
            this.selectedInvite = null;
          }
          this.toast.success(
            status === 'accepted'
              ? 'Invite accepted!'
              : status === 'counter_sent'
                ? 'Price flow updated: counter sent.'
                : 'Invite declined.',
          );
          this.loadAttentionCounts();
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to respond to invite.');
        }
      });
    };

    if ((status === 'accepted' || status === 'counter_sent') && this.inviteRequiresShippingAddress(invite)) {
      const campaign = invite?.campaignId || {};
      this.shippingModal.prompt({
        campaignTitle: campaign?.title || campaign?.name || 'Product collab',
        productLabel: campaign?.productDescription
          || (campaign?.productValue ? `Product value ₹${campaign.productValue}` : undefined),
      }).then((address) => {
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

  /** Returns true when invite is a brand product collab requiring shipping. */
  private inviteRequiresShippingAddress(invite: any): boolean {
    const campaign = invite?.campaignId;
    if (!campaign || typeof campaign !== 'object') return false;
    return campaign.campaignType === 'product' && campaign.productShippingRequired === true;
  }

  /** Returns enabled content type options for an invite's campaign */
  getInviteContentTypeOptions(inv: any): { key: string; label: string; platform: string; contentType: string; price: number }[] {
    const socialMedia = inv?.campaignId?.socialMedia;
    if (!Array.isArray(socialMedia) || !socialMedia.length) return [];
    const options: { key: string; label: string; platform: string; contentType: string; price: number }[] = [];
    for (const sm of socialMedia) {
      const platform = sm.platform || '';
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

  private isPostDateWithinCampaign(inv: any, selectedPostDate: string): boolean {
    const t = this.getCampaignTimeline(inv);
    if (!t?.start || !t?.end) return true;
    const selected = new Date(selectedPostDate);
    if (Number.isNaN(selected.getTime())) return false;
    const start = new Date(t.start);
    const end = new Date(t.end);
    return selected >= start && selected <= end;
  }

  openDetail(invite: any) {
    this.error = '';
    this.selectedInvite = invite;
    this.selectedInviteManual = true;
    // compute qualifying platform/tier for this invite's campaign (treat minInfluencerTier as tier-filtered)
    const campaign = invite?.campaign || invite?.campaignId || null;
    const isTierFiltered = !!campaign && (String(campaign?.campaignMode || '').toLowerCase() === 'tier_filtered_open' || !!campaign?.minInfluencerTier);
    if (campaign && isTierFiltered) {
      const qual = this.computeQualifyingPlatformAndTierForCampaign(campaign);
      this.selectedInviteQualifyingPlatform = qual?.platform || null;
      this.selectedInviteQualifyingTier = qual?.tier || null;
    } else {
      this.selectedInviteQualifyingPlatform = null;
      this.selectedInviteQualifyingTier = null;
    }
    this.cdr.markForCheck();
  }

  closeDetail() {
    this.selectedInvite = null;
    this.selectedInviteManual = false;
    this.selectedInviteQualifyingPlatform = null;
    this.selectedInviteQualifyingTier = null;
    this.cdr.markForCheck();
  }

  onModalAccept(payload: InviteAcceptPayload) {
    if (payload.postDate) this.selectedPostDates[payload.inviteId] = payload.postDate;
    if (payload.platform && payload.contentType) {
      this.selectedContentTypes[payload.inviteId] = `${payload.platform}::${payload.contentType}`;
    }
    if (payload.payout) {
      this.selectedPayouts[payload.inviteId] = {
        upiId: payload.payout.upiId || '',
        mobile: payload.payout.mobile || '',
        accountHolderName: payload.payout.accountHolderName || '',
      };
    }
    this.respond(
      payload.inviteId,
      payload.responseType === 'counter' ? 'counter_sent' : 'accepted',
      payload.counterAmount,
      payload.counterMessage,
    );
  }

  onModalDecline(payload: { inviteId: string }) {
    this.respond(payload.inviteId, 'declined');
  }

  onModalValidationError(_message: string) {
    // validation errors are shown inline inside the modal; no global banner needed
  }

  // ── Reusable invite-card events ─────────────────────────────
  onCardAccept(payload: InviteAcceptPayload) {
    if (payload.postDate) this.selectedPostDates[payload.inviteId] = payload.postDate;
    if (payload.platform && payload.contentType) {
      this.selectedContentTypes[payload.inviteId] = `${payload.platform}::${payload.contentType}`;
    }
    if (payload.payout) {
      this.selectedPayouts[payload.inviteId] = {
        upiId: payload.payout.upiId || '',
        mobile: payload.payout.mobile || '',
        accountHolderName: payload.payout.accountHolderName || '',
      };
    }
    this.respond(
      payload.inviteId,
      payload.responseType === 'counter' ? 'counter_sent' : 'accepted',
      payload.counterAmount,
      payload.counterMessage,
    );
  }

  onCardDecline(payload: InviteDeclinePayload) {
    this.respond(payload.inviteId, 'declined');
  }

  onCardPostDateChange(inviteId: string, value: string) {
    this.selectedPostDates[inviteId] = value;
  }

  private computeQualifyingPlatformAndTierForCampaign(campaign: any): { platform?: string; tier?: string } | null {
    const TIER_ORDER = ['Starter', 'Nano', 'Micro', 'Mid-Tier', 'Macro', 'Mega / Celebrity'];
    const normalized = (s: string) => (s || '').toLowerCase().trim();
    const mySm = this.myInfluencerSocialMedia || [];
    if (!mySm.length) return null;

    let candidates = mySm;
    const campaignPlatforms: string[] = (campaign as any)?.platforms || [];
    if (campaignPlatforms.length > 0) {
      candidates = candidates.filter(smEntry => campaignPlatforms.some(p => normalized(p) === normalized(smEntry.platform)));
    }
    if (!candidates.length) return null;

    const minTier: string = (campaign as any)?.minInfluencerTier || '';
    const minIdx = TIER_ORDER.indexOf(minTier);
    if (minIdx !== -1) {
      candidates = candidates.filter(smEntry => {
        const idx = TIER_ORDER.indexOf(smEntry.tier || '');
        return idx !== -1 && idx === minIdx;
      });
    }
    if (!candidates.length) return null;

    // pick highest tier among candidates (safe in case multiple match)
    let best = candidates[0];
    let bestIdx = TIER_ORDER.indexOf(best.tier || '');
    for (const c of candidates) {
      const idx = TIER_ORDER.indexOf(c.tier || '');
      if (idx > bestIdx) { bestIdx = idx; best = c; }
    }
    return { platform: best.platform, tier: best.tier };
  }

  onCardContentTypeChange(inviteId: string, key: string) {
    this.selectedContentTypes[inviteId] = key;
  }

  // ─── helper: extract the campaign object wherever it lives ───────────────
  private getCampaign(inv: any): any {
    return inv?.campaign || inv?.campaignId || {};
  }

  private getBrand(inv: any): any {
    return inv?.brand || inv?.brandId || {};
  }

  getBrandName(inv: any): string {
    const b = this.getBrand(inv);
    return b?.brandName || b?.businessName || b?.name || '—';
  }

  getBrandInitial(inv: any): string {
    return (this.getBrandName(inv) || '?')[0].toUpperCase();
  }

  getBrandLogo(inv: any): string | null {
    const b = this.getBrand(inv);
    // brandLogo is an array of Cloudinary objects { url, public_id }
    if (Array.isArray(b?.brandLogo) && b.brandLogo.length) {
      return b.brandLogo[0]?.url || null;
    }
    return b?.logoUrl || b?.profileImage || b?.logo || null;
  }

  getCampaignTitle(inv: any): string {
    const c = this.getCampaign(inv);
    return c?.title || c?.campaignTitle || '(untitled)';
  }

  getCampaignCategories(inv: any): string[] {
    const c = this.getCampaign(inv);
    if (Array.isArray(c?.categories) && c.categories.length) return c.categories;
    if (c?.category) return [c.category];
    return [];
  }

  getCampaignTimeline(inv: any): { start: string; end: string } | null {
    const c = this.getCampaign(inv);
    if (c?.timelineStart || c?.timelineEnd) return { start: c.timelineStart, end: c.timelineEnd };
    if (c?.startDate || c?.endDate) return { start: c.startDate, end: c.endDate };
    return null;
  }

  formatCampaignTimeline(inv: any): string {
    const t = this.getCampaignTimeline(inv);
    if (!t) return '—';
    const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '?';
    return `${fmt(t.start)} – ${fmt(t.end)}`;
  }

  formatDateRange(start: string, end: string): string {
    const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '?';
    return `${fmt(start)} – ${fmt(end)}`;
  }

  formatBudget(min: number, max: number): string {
    if (!min && !max) return '';
    if (!max || min === max) return `₹${min.toLocaleString('en-IN')}`;
    return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')}`;
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  onVerifyEmail() {
    // Navigate to verify email page, passing returnUrl so user can go back
    window.location.href = '/verify-email?returnUrl=/influencer-dashboard';
  }

  onMobileVerificationHelp() {
    const numberText = this.verificationCallNumber ? ` Team calls come from ${this.verificationCallNumber}.` : '';
    this.toast.info(`Mobile verification is handled by admin support call for now.${numberText} OTP/SMS flow will be added soon.`);
  }

  dismissEmailBanner() {
    this.emailBannerDismissed = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('emailVerifDismissed', '1');
    }
    this.cdr.markForCheck();
  }

  onUpgrade() {
    // Navigate to upgrade premium page
    window.location.href = '/upgrade-premium';
  }

  onCompleteProfile() {
    // Navigate to influencer profile page
    window.location.href = '/influencer-profile';
  }

  private slugify(title: string): string {
    return String(title || 'campaign')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'campaign';
  }

  private campaignSubmissionRoute(inviteId: string, title: string): string[] {
    return ['/campaign-submission', inviteId, this.slugify(title)];
  }

  goToSubmit(campaign: any) {
    const title = campaign.title || '';
    this.router.navigate(this.campaignSubmissionRoute(campaign.inviteId, title), {
      queryParams: {
        inviteStatus: campaign.inviteStatus || 'working'
      }
    });
  }

  get stats() {
    return [
      { label: 'Invited', value: this.dashboard?.invites?.invited || 0 },
      { label: 'Working', value: this.dashboard?.invites?.accepted || 0 },
      { label: 'Under Review', value: this.dashboard?.invites?.submitted || 0 },
      { label: 'Completed', value: this.dashboard?.invites?.completed || 0 },
    ];
  }

  goToStats(campaign: any) {
    const title = campaign.title || '';
    this.router.navigate(this.campaignSubmissionRoute(campaign.inviteId, title), {
      queryParams: {
        inviteStatus: campaign.inviteStatus || 'completed',
        statsOnly: 'true'
      }
    });
  }

  get profileTraffic() {
    const traffic = this.dashboard?.user?.profileTraffic || {};
    return {
      impressions: Number(traffic.impressions || 0),
      clicks: Number(traffic.clicks || 0),
      lastImpressionAt: traffic.lastImpressionAt || null,
      lastClickAt: traffic.lastClickAt || null,
    };
  }

  get isPremiumUser(): boolean {
    return !!this.dashboard?.user?.isPremium;
  }

  get incomingInvitesCount(): number {
    return Array.isArray(this.invites) ? this.invites.length : 0;
  }

  get collaborationRequestsCount(): number {
    return Array.isArray(this.collaborationRequests) ? this.collaborationRequests.length : 0;
  }

  get collaborationRequestsPendingReviewCount(): number {
    return (this.collaborationRequests || []).filter((c: any) => {
      const status = String(c?.status || '').toLowerCase();
      return status === 'pending' || status === 'pending_review';
    }).length;
  }

  get collaborationRequestsActiveCount(): number {
    return (this.collaborationRequests || []).filter((c: any) => String(c?.status || '').toLowerCase() === 'active').length;
  }

  get canViewProfileTraffic(): boolean {
    return this.plansService.getFeatureValue(this.planCaps, 'analyticsDashboard');
  }
}
