import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { VerificationFunnelComponent, FunnelStage } from '../../../shared/components/verification-funnel/verification-funnel.component';

const FUNNEL_STAGE_LABELS: Array<{ key: string; label: string }> = [
  { key: 'registered', label: 'Registered' },
  { key: 'active', label: 'Active' },
  { key: 'emailVerified', label: 'Email Verified' },
  { key: 'mobileVerified', label: 'Mobile Verified' },
  { key: 'searchEligible', label: 'Search Eligible' },
  { key: 'adminApproved', label: 'Admin Approved' },
  { key: 'featuredEligible', label: 'Featured Eligible' },
  { key: 'campaignEligible', label: 'Campaign Eligible' },
];

interface RecentReg {
  type: 'influencer' | 'brand' | 'photographer';
  name: string;
  email: string;
  status: string;
  createdAt: string;
  avatar: string | null;
}

interface ModerationItem {
  tag: string;
  tagClass: string;
  timeAgo: string;
  title: string;
  subtitle: string;
  primaryAction: string;
  primaryClass: string;
  secondaryAction?: string;
  routerLink: string;
}

interface ActivityBar {
  day: string;
  count: number;
  highlighted: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, VerificationFunnelComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  funnelStages: FunnelStage[] = [];
  funnelLoading = false;
  selectedRoleTab: 'all' | 'influencer' | 'brand' = 'all';

  influencerCount = 0;
  influencerActivated = 0;
  influencerPending = 0;
  influencerPremium = 0;

  brandCount = 0;
  brandActivated = 0;
  brandPending = 0;
  brandPremium = 0;

  photographerCount = 0;
  photographerActivated = 0;
  photographerPending = 0;
  photographerPremium = 0;

  totalPending = 0;
  totalVerified = 0;
  suspiciousFlaggedTotal = 0;
  suspiciousFlaggedInfluencers = 0;
  suspiciousFlaggedBrands = 0;
  suspiciousFlaggedPhotographers = 0;

  campaignDateFilter: 'today' | '7days' | '30days' = '7days';
  readonly campaignDateOptions: { value: 'today' | '7days' | '30days'; label: string }[] = [
    { value: 'today',  label: 'Today' },
    { value: '7days',  label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
  ];

  campaignReviewPendingCount = 0;
  campaignActiveLiveCount = 0;
  collaborationReviewPendingCount = 0;
  collaborationActiveLiveCount = 0;

  moderationItems: ModerationItem[] = [];
  urgentCampaign: any = null;
  latestDispute: any = null;

  private allCampaigns: any[] = [];
  private allCollaborations: any[] = [];

  recentAll: RecentReg[] = [];
  recentInfluencers: RecentReg[] = [];
  recentBrands: RecentReg[] = [];

  activityBars: ActivityBar[] = [];
  activityGrowthPct = 0;

  private allInfluencers: any[] = [];
  private allBrands: any[] = [];
  private allPhotographers: any[] = [];
  private fetchedCount = 0;

  get totalRegistered() { return this.influencerCount + this.brandCount + this.photographerCount; }

  get visibleRecentRegistrations(): RecentReg[] {
    if (this.selectedRoleTab === 'influencer') return this.recentInfluencers;
    if (this.selectedRoleTab === 'brand') return this.recentBrands;
    return this.recentAll;
  }

  getAuthHeaders() {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('token') || sessionStorage.getItem('token'))
      : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchInfluencers();
      this.fetchBrands();
      this.fetchPhotographers();
      this.fetchCampaigns();
      this.fetchOpenDisputes();
      this.fetchVerificationFunnel();
    }
  }

  fetchVerificationFunnel(): void {
    this.funnelLoading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/verification-funnel`, this.getAuthHeaders()).subscribe({
      next: (res) => {
        const combined = (res?.data ?? res)?.combined;
        this.funnelStages = combined
          ? FUNNEL_STAGE_LABELS.map(({ key, label }) => ({ key, label, count: Number(combined[key] || 0) }))
          : [];
        this.funnelLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.funnelLoading = false;
        this.cd.detectChanges();
      },
    });
  }

  setRoleTab(tab: 'all' | 'influencer' | 'brand') {
    this.selectedRoleTab = tab;
  }

  setCampaignDateFilter(val: 'today' | '7days' | '30days') {
    this.campaignDateFilter = val;
    this.applyCampaignFilter();
    this.cd.detectChanges();
  }

  private campaignDateCutoff(): number {
    const now = Date.now();
    if (this.campaignDateFilter === 'today') {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if (this.campaignDateFilter === '7days') return now - 7 * 86400000;
    return now - 30 * 86400000;
  }

  private applyCampaignFilter() {
    const cutoff = this.campaignDateCutoff();
    const filterByDate = (items: any[]) => items.filter(c => {
      const ts = new Date(c.createdAt || c.updatedAt || 0).getTime();
      return ts >= cutoff;
    });
    const campaigns = filterByDate(this.allCampaigns);
    const collaborations = filterByDate(this.allCollaborations);
    this.campaignReviewPendingCount = campaigns.filter(c =>
      ['pending_review', 'pending'].includes(String(c?.status || '').toLowerCase())
    ).length;
    this.campaignActiveLiveCount = campaigns.filter(c =>
      ['active', 'approved', 'live'].includes(String(c?.status || '').toLowerCase())
    ).length;
    this.collaborationReviewPendingCount = collaborations.filter(c =>
      ['pending_review', 'pending'].includes(String(c?.status || '').toLowerCase())
    ).length;
    this.collaborationActiveLiveCount = collaborations.filter(c =>
      ['active', 'approved', 'live'].includes(String(c?.status || '').toLowerCase())
    ).length;
  }

  private onFetchDone() {
    this.fetchedCount++;
    if (this.fetchedCount >= 3) {
      this.buildDerivedData();
    }
  }

  private resolveAvatar(user: any): string | null {
    const apiBase = String(environment.apiBaseUrl || '').replace(/\/api\/?$/, '');
    const candidates: string[] = [];
    if (Array.isArray(user?.profileImages) && user.profileImages.length > 0) {
      const first = user.profileImages[0];
      if (typeof first?.url === 'string') candidates.push(first.url);
      else if (typeof first === 'string') candidates.push(first);
    }
    if (typeof user?.profileImage === 'string') candidates.push(user.profileImage);
    if (typeof user?.profilePicture === 'string') candidates.push(user.profilePicture);
    if (typeof user?.avatar === 'string') candidates.push(user.avatar);
    for (const raw of candidates) {
      const v = String(raw || '').trim();
      if (!v) continue;
      if (/^https?:\/\//i.test(v)) return v;
      if (v.startsWith('/assets/')) return apiBase ? `${apiBase}${v}` : v;
      return v;
    }
    return null;
  }

  private isDeletedUser(user: any): boolean {
    const isDeleted = String(user?.isDeleted || '').toLowerCase() === 'true';
    const status = String(user?.status || '').trim().toLowerCase();
    return user?.isDeleted === true || isDeleted || status === 'deleted';
  }

  private isSuspiciousOrFlagged(user: any): boolean {
    if (!user) return false;
    if (user.isFlagged === true || user.flagged === true || user.isSuspicious === true) return true;
    const tags = Array.isArray(user.adminTags) ? user.adminTags : [];
    return tags.some((tag: any) => {
      const v = String(tag || '').toLowerCase();
      return v.includes('flagged') || v.includes('suspicious');
    });
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  private buildDerivedData() {
    const combined: RecentReg[] = [
      ...this.allInfluencers.filter(u => !this.isDeletedUser(u)).map(u => ({
        type: 'influencer' as const,
        name: u.name || u.username || 'Influencer',
        email: u.email || '',
        status: u.status || 'pending',
        createdAt: u.createdAt || '',
        avatar: this.resolveAvatar(u),
      })),
      ...this.allBrands.filter(u => !this.isDeletedUser(u)).map(u => ({
        type: 'brand' as const,
        name: u.brandName || u.brandUsername || 'Brand',
        email: u.email || '',
        status: u.status || 'pending',
        createdAt: u.createdAt || '',
        avatar: this.resolveAvatar(u),
      })),
      ...this.allPhotographers.filter(u => !this.isDeletedUser(u)).map(u => ({
        type: 'photographer' as const,
        name: u.name || u.username || 'Creator',
        email: u.email || '',
        status: u.status || 'pending',
        createdAt: u.createdAt || '',
        avatar: this.resolveAvatar(u),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    this.recentAll = combined.slice(0, 6);
    this.recentInfluencers = combined.filter(u => u.type === 'influencer').slice(0, 6);
    this.recentBrands = combined.filter(u => u.type === 'brand').slice(0, 6);

    this.totalPending = this.influencerPending + this.brandPending + this.photographerPending;
    this.totalVerified = this.influencerActivated + this.brandActivated + this.photographerActivated;

    const activeInf = this.allInfluencers.filter(u => !this.isDeletedUser(u));
    const activeBrand = this.allBrands.filter(u => !this.isDeletedUser(u));
    const activePhoto = this.allPhotographers.filter(u => !this.isDeletedUser(u));

    this.suspiciousFlaggedInfluencers = activeInf.filter(u => this.isSuspiciousOrFlagged(u)).length;
    this.suspiciousFlaggedBrands = activeBrand.filter(u => this.isSuspiciousOrFlagged(u)).length;
    this.suspiciousFlaggedPhotographers = activePhoto.filter(u => this.isSuspiciousOrFlagged(u)).length;
    this.suspiciousFlaggedTotal = this.suspiciousFlaggedInfluencers + this.suspiciousFlaggedBrands + this.suspiciousFlaggedPhotographers;

    // 7-day activity bars from registration dates
    const dayBuckets: number[] = new Array(7).fill(0);
    const now = Date.now();
    for (const u of combined) {
      if (!u.createdAt) continue;
      const dayIdx = Math.floor((now - new Date(u.createdAt).getTime()) / 86400000);
      if (dayIdx >= 0 && dayIdx < 7) dayBuckets[6 - dayIdx]++;
    }
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayDay = new Date().getDay();
    this.activityBars = dayBuckets.map((count, i) => ({
      day: days[(todayDay - (6 - i) + 7) % 7],
      count,
      highlighted: i === 6,
    }));

    const recent3 = dayBuckets.slice(4).reduce((a, b) => a + b, 0);
    const prev3 = dayBuckets.slice(1, 4).reduce((a, b) => a + b, 0);
    this.activityGrowthPct = prev3 > 0 ? Math.round(((recent3 - prev3) / prev3) * 100) : 0;

    this.buildModerationQueue();
    this.cd.detectChanges();
  }

  private buildModerationQueue() {
    const items: ModerationItem[] = [];

    if (this.urgentCampaign) {
      const c = this.urgentCampaign;
      const brandName = c.brand?.brandName || c.brand?.name || c.brandId?.brandName || 'Brand';
      const budget = this.formatBudget(c);
      items.push({
        tag: 'URGENT APPROVAL',
        tagClass: 'tag-urgent',
        timeAgo: this.timeAgo(c.updatedAt || c.createdAt),
        title: `Verify Campaign: "${c.title || c.campaignTitle || 'Untitled'}"`,
        subtitle: `Brand: ${brandName}${budget ? ' • Budget: ' + budget : ''}`,
        primaryAction: 'Review',
        primaryClass: 'btn-review',
        secondaryAction: 'Dismiss',
        routerLink: '/admin/campaign-review',
      });
    }

    if (this.suspiciousFlaggedTotal > 0) {
      items.push({
        tag: 'FLAGGED CONTENT',
        tagClass: 'tag-flagged',
        timeAgo: 'Now',
        title: `${this.suspiciousFlaggedTotal} Suspicious Profile${this.suspiciousFlaggedTotal > 1 ? 's' : ''}`,
        subtitle: `Influencers: ${this.suspiciousFlaggedInfluencers} • Brands: ${this.suspiciousFlaggedBrands} • Creators: ${this.suspiciousFlaggedPhotographers}`,
        primaryAction: 'Investigate',
        primaryClass: 'btn-investigate',
        routerLink: '/admin/admin-user-table',
      });
    }

    if (this.latestDispute) {
      const d = this.latestDispute;
      const infName = d.influencerId?.name || d.influencerId?.username || 'Influencer';
      const ticketRef = String(d._id || '').slice(-6).toUpperCase();
      items.push({
        tag: 'SUPPORT TICKET',
        tagClass: 'tag-support',
        timeAgo: this.timeAgo(d.updatedAt || d.createdAt),
        title: `Payment Dispute: #TC-${ticketRef}`,
        subtitle: `Influencer: ${infName} • Status: Open`,
        primaryAction: 'View Details',
        primaryClass: 'btn-details',
        routerLink: '/admin/disputes',
      });
    }

    this.moderationItems = items;
    this.cd.detectChanges();
  }

  private formatBudget(campaign: any): string {
    const paise = Number(campaign?.pricePerInfluencer || campaign?.estimatedBudget || campaign?.amount || 0);
    if (paise > 0) return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}`;
    const rupees = Number(campaign?.budgetMin || campaign?.budget || campaign?.agreedAmount || 0);
    if (rupees > 0) return `₹${rupees.toLocaleString('en-IN')}`;
    return '';
  }

  private loadPulseQueue(ownerType: 'brand' | 'photographer') {
    return this.http.get<any>(
      `${environment.apiBaseUrl}/admin/campaigns?status=all&ownerType=${ownerType}&page=1&limit=200`,
      this.getAuthHeaders(),
    );
  }

  fetchCampaigns() {
    this.loadPulseQueue('brand')
      .subscribe({
        next: (res) => {
          this.allCampaigns = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          this.applyCampaignFilter();
          this.urgentCampaign = this.allCampaigns.find(c =>
            ['pending_review', 'pending'].includes(String(c?.status || '').toLowerCase())
          ) || null;
          this.buildModerationQueue();
          this.cd.detectChanges();
        },
        error: () => { this.cd.detectChanges(); }
      });
    this.loadPulseQueue('photographer')
      .subscribe({
        next: (res) => {
          this.allCollaborations = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          this.applyCampaignFilter();
          this.buildModerationQueue();
          this.cd.detectChanges();
        },
        error: () => { this.cd.detectChanges(); }
      });
  }

  fetchOpenDisputes() {
    this.http.get<any>(
      `${environment.apiBaseUrl}/campaign-invites/admin/disputes?status=open`,
      this.getAuthHeaders()
    ).subscribe({
      next: (res) => {
        const payload = res?.data || res;
        const invites: any[] = payload?.invites || (Array.isArray(payload) ? payload : []);
        this.latestDispute = invites[0] || null;
        this.buildModerationQueue();
        this.cd.detectChanges();
      },
      error: () => { this.cd.detectChanges(); }
    });
  }

  fetchInfluencers() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/influencers`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          this.allInfluencers = all;
          const filtered = all.filter((u: any) => !this.isDeletedUser(u));
          this.influencerCount = filtered.length;
          this.influencerActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.influencerPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.influencerPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.onFetchDone();
        },
        error: () => this.onFetchDone()
      });
  }

  fetchBrands() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/brands`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          this.allBrands = all;
          const filtered = all.filter((u: any) => !this.isDeletedUser(u));
          this.brandCount = filtered.length;
          this.brandActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.brandPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.brandPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.onFetchDone();
        },
        error: () => this.onFetchDone()
      });
  }

  fetchPhotographers() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/photographers`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          this.allPhotographers = all;
          const filtered = all.filter((u: any) => !this.isDeletedUser(u));
          this.photographerCount = filtered.length;
          this.photographerActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.photographerPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.photographerPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.onFetchDone();
        },
        error: () => this.onFetchDone()
      });
  }

  activityBarHeight(bar: ActivityBar): string {
    const max = Math.max(...this.activityBars.map(b => b.count), 1);
    return `${Math.max(Math.round((bar.count / max) * 100), 8)}%`;
  }
}
