import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { CommonModule, DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignDetailModalComponent } from '../../shared/campaign-detail-modal/campaign-detail-modal.component';
import { CampaignInviteCardComponent, InviteAcceptPayload, InviteDeclinePayload } from '../../shared/campaign-invite-card/campaign-invite-card.component';
import { DashboardService } from '../../services/dashboard.service';
import { ConfigService } from '../../shared/config.service';
import { PlansService, PlanCapabilities, FREE_CAPABILITIES } from '../../shared/plans.service';

@Component({
  selector: 'app-influencer-dashboard',
  templateUrl: './influencer-dashboard.component.html',
  styleUrls: ['./influencer-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, DecimalPipe, SlicePipe, FormsModule, CampaignDetailModalComponent, CampaignInviteCardComponent]
})
export class InfluencerDashboardComponent implements OnInit, OnDestroy {
  dashboard: any;
  invites: any[] = [];
  activeCampaigns: any[] = [];
  completedCampaigns: any[] = [];
  loading = true;
  error = '';
  profileIncomplete = false;
  emailVerificationError: string | null = null;

  // detail modal state
  selectedInvite: any = null;
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
  paymentHistory: any[] = [];
  paymentSummary = {
    earnedThisMonth: 0,
    pending: 0,
    paidInPayToJoin: 0,
  };
  planCaps: PlanCapabilities = FREE_CAPABILITIES;

  private routerSub: Subscription | undefined;
  private userSub: Subscription | undefined;

  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    private session: SessionService,
    private config: ConfigService,
    private plansService: PlansService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.plansService.getMyCapabilities().subscribe((caps) => {
      this.planCaps = caps;
    });

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('emailVerificationError')) {
        this.emailVerificationError = params.get('emailVerificationError');
      }
    }

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
          // debug: dashboard invites
          this.invites = data.invites?.newInvites || [];
          this.activeCampaigns = data.activeCampaigns || [];
          this.completedCampaigns = data.completedCampaigns || [];
          const user = data.user || {};
          this.profileIncomplete = !user.name || !user.categories?.length || !user.socialMedia?.length || !user.location?.state;
          this.loading = false;
          this.loadPaymentHistory();
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

    const paidInPayToJoin = rows
      .filter((r: any) => r.payerRole === 'influencer')
      .reduce((sum: number, r: any) => sum + Number(r.payerTotal || 0), 0);

    this.paymentSummary = { earnedThisMonth, pending, paidInPayToJoin };
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

  respondToInvite(inviteId: string, status: 'accepted' | 'declined') {
    const selectedPostDate = status === 'accepted' ? this.selectedPostDates[inviteId] : undefined;
    if (status === 'accepted' && !selectedPostDate) {
      this.error = 'Please choose a posting date before accepting invite.';
      return;
    }
    const invite = this.invites.find(i => i._id === inviteId);
    if (status === 'accepted' && invite && !this.isPostDateWithinCampaign(invite, selectedPostDate!)) {
      this.error = 'Posting date must be within campaign start and end dates.';
      return;
    }
    const options = this.getInviteContentTypeOptions(invite);
    const chosen = this.selectedContentTypes[inviteId];
    if (status === 'accepted' && options.length > 0 && !chosen) {
      this.error = 'Please select what you will create for this campaign.';
      return;
    }
    const [selPlatform, selContentType] = chosen ? chosen.split('::') : [undefined, undefined];
    this.dashboardService.respondToInvite(inviteId, status, selectedPostDate, selPlatform, selContentType).subscribe(() => {
      this.ngOnInit();
    });
  }

  respond(inviteId: string, status: 'accepted' | 'declined') {
    if (this.responding) return;
    const selectedPostDate = status === 'accepted' ? this.selectedPostDates[inviteId] : undefined;
    if (status === 'accepted' && !selectedPostDate) {
      this.error = 'Please choose a posting date before accepting invite.';
      return;
    }
    const invite = this.invites.find(i => i._id === inviteId) || this.selectedInvite;
    if (status === 'accepted' && invite && !this.isPostDateWithinCampaign(invite, selectedPostDate!)) {
      this.error = 'Posting date must be within campaign start and end dates.';
      return;
    }
    const options = this.getInviteContentTypeOptions(invite);
    const chosen = this.selectedContentTypes[inviteId];
    if (status === 'accepted' && options.length > 0 && !chosen) {
      this.error = 'Please select what you will create for this campaign.';
      return;
    }
    const [selPlatform, selContentType] = chosen ? chosen.split('::') : [undefined, undefined];
    const payout = status === 'accepted' ? this.selectedPayouts[inviteId] : undefined;
    this.responding = inviteId;
    this.dashboardService.respondToInvite(inviteId, status, selectedPostDate, selPlatform, selContentType, payout).subscribe({
      next: () => {
        // update in-place — no full reload
        this.invites = this.invites.filter(i => i._id !== inviteId);
        if (this.selectedInvite?._id === inviteId) {
          this.selectedInvite = null;
        }
        this.responding = null;
        this.cdr.markForCheck();
      },
      error: () => { this.responding = null; }
    });
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
    this.selectedInvite = invite;
    this.cdr.markForCheck();
  }

  closeDetail() {
    this.selectedInvite = null;
    this.cdr.markForCheck();
  }

  onModalAccept(payload: { inviteId: string; postDate?: string; platform?: string; contentType?: string }) {
    if (payload.postDate) this.selectedPostDates[payload.inviteId] = payload.postDate;
    if (payload.platform && payload.contentType) {
      this.selectedContentTypes[payload.inviteId] = `${payload.platform}::${payload.contentType}`;
    }
    this.respond(payload.inviteId, 'accepted');
  }

  onModalDecline(payload: { inviteId: string }) {
    this.respond(payload.inviteId, 'declined');
  }

  onModalValidationError(message: string) {
    this.error = message;
    this.cdr.markForCheck();
  }

  // ── Reusable invite-card events ─────────────────────────────
  onCardAccept(payload: InviteAcceptPayload) {
    if (payload.postDate) this.selectedPostDates[payload.inviteId] = payload.postDate;
    if (payload.platform && payload.contentType) {
      this.selectedContentTypes[payload.inviteId] = `${payload.platform}::${payload.contentType}`;
    }    if (payload.payout) {
      this.selectedPayouts[payload.inviteId] = {
        upiId: payload.payout.upiId || '',
        mobile: payload.payout.mobile || '',
        accountHolderName: payload.payout.accountHolderName || '',
      };
    }    this.respond(payload.inviteId, 'accepted');
  }

  onCardDecline(payload: InviteDeclinePayload) {
    this.respond(payload.inviteId, 'declined');
  }

  onCardPostDateChange(inviteId: string, value: string) {
    this.selectedPostDates[inviteId] = value;
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
    const logo = b?.logoUrl || b?.profileImage || b?.logo;
    return logo || null;
  }

  getCampaignTitle(inv: any): string {
    const c = this.getCampaign(inv);
    return c?.title || c?.campaignTitle || '(untitled)';
  }

  getCampaignDesc(inv: any): string {
    return this.getCampaign(inv)?.description || '';
  }

  getCampaignCategories(inv: any): string[] {
    const c = this.getCampaign(inv);
    if (Array.isArray(c?.categories) && c.categories.length) return c.categories;
    if (c?.category) return [c.category];
    return [];
  }

  getCampaignBudget(inv: any): { min: number; max: number } | null {
    const c = this.getCampaign(inv);
    if (c?.budgetMin != null || c?.budgetMax != null) return { min: c.budgetMin || 0, max: c.budgetMax || 0 };
    if (c?.budget) return { min: c.budget, max: c.budget };
    return null;
  }

  formatCampaignBudget(inv: any): string {
    const b = this.getCampaignBudget(inv);
    if (!b) return '—';
    if (b.min === b.max || !b.max) return `₹${b.min.toLocaleString('en-IN')}`;
    return `₹${b.min.toLocaleString('en-IN')} – ₹${b.max.toLocaleString('en-IN')}`;
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

  getDaysLeft(inv: any): string {
    const t = this.getCampaignTimeline(inv);
    if (!t?.end) return '';
    const diff = Math.ceil((new Date(t.end).getTime() - Date.now()) / 86400000);
    if (diff < 0) return 'Ended';
    if (diff === 0) return 'Ends today';
    return `${diff} days left`;
  }

  getCampaignPlatform(inv: any): string {
    const c = this.getCampaign(inv);
    return c?.platformPreference || c?.platform || '';
  }

  getMinFollowers(inv: any): string {
    const c = this.getCampaign(inv);
    const v = c?.minFollowerCount || c?.minFollowers;
    return v ? v.toLocaleString('en-IN') : '';
  }

  getCampaignDeliverables(inv: any): string[] {
    const c = this.getCampaign(inv);
    if (Array.isArray(c?.deliverables)) return c.deliverables;
    return [];
  }

  getSpecialInstructions(inv: any): string {
    const c = this.getCampaign(inv);
    return c?.specialInstructions || c?.instructions || '';
  }

  /** Returns array of { platform, handle, contentTypes:[{name,enabled,price}] }
   *  Falls back to a single entry built from the campaign's platformPreference field */
  getDetailSocialMedia(inv: any): any[] {
    const c = this.getCampaign(inv);
    if (Array.isArray(c?.socialMedia) && c.socialMedia.length) return c.socialMedia;
    // Fallback: build a single row from platform + influencer's own social media handle
    const platform = c?.platformPreference || c?.platform;
    if (!platform) return [];
    const b = this.getBrand(inv);
    const matching = (b?.socialMedia || []).find((s: any) =>
      (s.platform || '').toLowerCase() === platform.toLowerCase()
    );
    return [{ platform, handle: matching?.handle || '', contentTypes: [] }];
  }

  getPlatformIcon(platform: string): string {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) return 'bi bi-instagram';
    if (p.includes('youtube')) return 'bi bi-youtube';
    if (p.includes('twitter') || p.includes('x')) return 'bi bi-twitter-x';
    if (p.includes('facebook')) return 'bi bi-facebook';
    if (p.includes('linkedin')) return 'bi bi-linkedin';
    if (p.includes('tiktok')) return 'bi bi-tiktok';
    return 'bi bi-share';
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
    // Navigate to verify email page
    window.location.href = '/verify-email';
  }

  onUpgrade() {
    // Navigate to upgrade premium page
    window.location.href = '/upgrade-premium';
  }

  onCompleteProfile() {
    // Navigate to influencer profile page
    window.location.href = '/influencer-profile';
  }

  submitContent(inviteId: string) {
    // Implement navigation to submission page or modal
  }

  goToSubmit(campaign: any) {
    this.router.navigate(['/campaign-submission', campaign.inviteId], {
      queryParams: {
        campaignTitle: campaign.title || '',
        inviteStatus: campaign.inviteStatus || 'working'
      }
    });
  }

  get stats() {
    return [
      { label: 'Invited', value: this.dashboard?.invites?.invited || 0 },
      { label: 'Accepted', value: this.dashboard?.invites?.accepted || 0 },
      { label: 'Submitted', value: this.dashboard?.invites?.submitted || 0 },
      { label: 'Completed', value: this.dashboard?.invites?.completed || 0 },
    ];
  }

  goToStats(campaign: any) {
    this.router.navigate(['/campaign-submission', campaign.inviteId], {
      queryParams: {
        campaignTitle: campaign.title || '',
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

  get canViewProfileTraffic(): boolean {
    return this.plansService.getFeatureValue(this.planCaps, 'analyticsDashboard');
  }
}
