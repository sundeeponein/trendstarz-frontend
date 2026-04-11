import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { CommonModule, DecimalPipe, TitleCasePipe, SlicePipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { ConfigService } from '../../shared/config.service';

@Component({
  selector: 'app-influencer-dashboard',
  templateUrl: './influencer-dashboard.component.html',
  styleUrls: ['./influencer-dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, DecimalPipe, TitleCasePipe, SlicePipe]
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

  private routerSub: Subscription | undefined;
  private userSub: Subscription | undefined;

  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    private session: SessionService,
    private config: ConfigService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Check for email verification error in query params (if redirected from verification)
    const params = new URLSearchParams(window.location.search);
    if (params.get('emailVerificationError')) {
      this.emailVerificationError = params.get('emailVerificationError');
    }
    // Always fetch latest profile before loading dashboard
    this.userSub = this.session.user$.subscribe(user => {
      if (user) {
        this.config.getInfluencerProfileById().subscribe((profile: any) => {
          if (profile) {
            this.session.setUser({ ...user, ...profile });
          }
          this.loadDashboard();
        });
      }
    });
    // Listen for route re-activation (e.g., clicking Dashboard again)
    this.routerSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd && event.urlAfterRedirects.includes('influencer-dashboard')) {
        this.loadDashboard();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routerSub) this.routerSub.unsubscribe();
    if (this.userSub) this.userSub.unsubscribe();
  }

  loadDashboard() {
    this.loading = true;
    this.error = '';
    this.dashboardService.getInfluencerDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.invites = data.invites?.newInvites || [];
        this.activeCampaigns = data.activeCampaigns || [];
        this.completedCampaigns = data.completedCampaigns || [];
        // Profile completeness logic: check for missing required fields
        const user = data.user || {};
        this.profileIncomplete = !user.name || !user.categories?.length || !user.socialMedia?.length || !user.location?.state;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load dashboard.';
        this.loading = false;
      }
    });
  }

  respondToInvite(inviteId: string, status: 'accepted' | 'declined') {
    this.dashboardService.respondToInvite(inviteId, status).subscribe(() => {
      this.ngOnInit();
    });
  }

  respond(inviteId: string, status: 'accepted' | 'declined') {
    if (this.responding) return;
    this.responding = inviteId;
    this.dashboardService.respondToInvite(inviteId, status).subscribe({
      next: () => {
        // update in-place — no full reload
        this.invites = this.invites.filter(i => i._id !== inviteId);
        if (this.selectedInvite?._id === inviteId) {
          this.selectedInvite = { ...this.selectedInvite, status };
        }
        this.responding = null;
        this.cdr.markForCheck();
      },
      error: () => { this.responding = null; }
    });
  }

  openDetail(invite: any) {
    this.selectedInvite = invite;
    this.cdr.markForCheck();
  }

  closeDetail() {
    this.selectedInvite = null;
    this.cdr.markForCheck();
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
}
