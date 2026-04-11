import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { Campaign } from '../../shared/campaigns/campaign.model';
import { CampaignFormComponent } from '../../shared/campaigns/campaign-form/campaign-form.component';

type TabStatus = 'active' | 'pending' | 'completed' | 'draft';

@Component({
  selector: 'app-campaign-management',
  standalone: true,
  imports: [CommonModule, FormsModule, CampaignFormComponent],
  templateUrl: './campaign-management.component.html',
  styleUrls: ['./campaign-management.component.scss']
})
export class CampaignManagementComponent implements OnInit {
  campaigns: Campaign[] = [];
  brandId = '';
  brandName = '';
  loading = true;

  /** True when an influencer is viewing — switches to read-only open-campaigns mode */
  isInfluencerView = false;

  activeTab: TabStatus = 'active';
  pageSize = 10;
  currentPage = 1;

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingCampaign: Campaign | null = null;

  // ── Invite panel (brand view) ─────────────────────────────────
  invitePanelOpen = false;
  invitePanelCampaign: Campaign | null = null;
  invites: any[] = [];
  invitesLoading = false;
  inviteTab: 'invited' | 'search' = 'invited';
  influencerSearch = '';
  allInfluencersForInvite: any[] = [];
  influencersForInviteLoading = false;
  sendingInviteIds = new Set<string>();
  selectedInfluencerIds = new Set<string>();
  bulkSending = false;
  inviteError = '';

  // ── Expand panel (brand view) ──────────────────────────────────
  expandedCampaignId: string | null = null;
  campaignInvitesMap = new Map<string, any[]>();
  expandInvitesLoading = new Set<string>();

  get invitedIds(): Set<string> {
    return new Set(this.invites.map(i => String(i.influencerId?._id || i.influencerId)));
  }

  get selectableInfluencers(): any[] {
    return this.filteredInfluencersForInvite.filter(inf => !this.invitedIds.has(inf._id));
  }

  get allSelectableSelected(): boolean {
    const sel = this.selectableInfluencers;
    return sel.length > 0 && sel.every(inf => this.selectedInfluencerIds.has(inf._id));
  }

  toggleInfluencerSelect(id: string) {
    if (this.selectedInfluencerIds.has(id)) {
      this.selectedInfluencerIds.delete(id);
    } else {
      this.selectedInfluencerIds.add(id);
    }
  }

  toggleSelectAll() {
    if (this.allSelectableSelected) {
      this.selectableInfluencers.forEach(inf => this.selectedInfluencerIds.delete(inf._id));
    } else {
      this.selectableInfluencers.forEach(inf => this.selectedInfluencerIds.add(inf._id));
    }
  }

  sendSelectedInvites() {
    if (!this.invitePanelCampaign?._id || this.selectedInfluencerIds.size === 0) return;
    this.inviteError = '';
    this.bulkSending = true;
    this.cd.detectChanges();
    const ids = Array.from(this.selectedInfluencerIds);
    // Filter out null/undefined influencers and those without _id
    const influencers = this.allInfluencersForInvite.filter(
      inf => inf && inf._id && ids.includes(inf._id)
    );
    let completed = 0;
    let failed = 0;
    const finish = () => {
      completed++;
      if (completed === influencers.length) {
        this.bulkSending = false;
        this.selectedInfluencerIds.clear();
        if (failed > 0) this.inviteError = `${failed} invite(s) failed. The rest were sent.`;
        this.config.getInvitesByCampaign(this.invitePanelCampaign!._id!).subscribe({
          next: (invites: any[]) => { this.invites = invites; this.cd.detectChanges(); }
        });
        this.cd.detectChanges();
      }
    };
    influencers.forEach(inf => {
      if (!inf || !inf._id) return; // Guard
      this.config.createCampaignInvite({
        campaignId: this.invitePanelCampaign!._id!,
        influencerId: inf._id
      }).subscribe({
        next: () => finish(),
        error: () => { failed++; finish(); this.loadAllInvites(); }
      });
    });
  }

  get filteredInfluencersForInvite(): any[] {
    const kw = this.influencerSearch.trim().toLowerCase();
    return this.allInfluencersForInvite.filter(inf => {
      if (!kw) return true;
      return (inf.name || inf.fullname || '').toLowerCase().includes(kw);
    });
  }

  // ── My Invites (influencer view) ──────────────────────────────
  myInvites: any[] = [];
  myInvitesLoading = false;

  tabs: { key: TabStatus; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
  ];

  constructor(
    private config: ConfigService,
    private session: SessionService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const user = this.session.getUser();
    this.isInfluencerView = user?.role === 'influencer';

    if (this.isInfluencerView) {
      // Influencer: only load invites and open campaigns
      this.myInvitesLoading = true;
      this.config.getMyInvites().subscribe({
        next: (invites: any[]) => {
          this.myInvites = invites;
          this.myInvitesLoading = false;
          this.cd.detectChanges();
        },
        error: () => { this.myInvitesLoading = false; this.cd.detectChanges(); }
      });
      this.config.getAllCampaigns('active').subscribe({
        next: (campaigns: any[]) => {
          this.campaigns = campaigns;
          this.loading = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.cd.detectChanges();
        }
      });
      return;
    }
    // Brand user: fetch brand profile and campaigns
    if (token) {
      this.config.getBrandProfileById().subscribe({
        next: (profile: any) => {
          console.log('Brand profile response:', profile);
          // Robustly handle both { brand: ... } and { data: { brand: ... } } structures
          const brand = profile?.data?.brand || profile?.brand || profile;
          console.log('Parsed brand:', brand);
          // Use brand's MongoDB ObjectId for dashboard sync, fallback to brandUsername if missing
          this.brandId = brand?._id || brand?.id || brand?.brandUsername || '';
          this.brandName = brand?.brandName || brand?.name || '';
          const name = brand?.brandName || brand?.brandUsername || brand?.name;
          if (this.brandId && name) {
            this.config.getCampaignsByBrandName(name).subscribe({
              next: (campaigns: any[]) => {
                this.campaigns = campaigns;
                this.loading = false;
                this.loadAllInvites();
                this.cd.detectChanges();
              }
            });
          } else {
            this.loading = false;
            console.warn('No valid brand identifier found. New Campaign button will remain disabled.');
          }
          this.cd.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.cd.detectChanges();
        }
      });
    }
  }

  getCount(status: TabStatus): number {
    return this.campaigns.filter(c => c.status === status).length;
  }

  get filtered(): Campaign[] {
    return this.campaigns.filter(c => c.status === this.activeTab);
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
    this.editingCampaign = null;
    this.formMode = 'create';
    this.showForm = true;
  }

  onManage(campaign: Campaign) {
    this.editingCampaign = campaign;
    this.formMode = 'edit';
    this.showForm = true;
  }

  onFormSave(data: Partial<Campaign> & { inviteInfluencerIds?: string[] }) {
    const { inviteInfluencerIds, ...campaignData } = data;

    // Guard: Only proceed if brandId is present and valid ObjectId
    let validBrandId = '';
    if (this.brandId && typeof this.brandId === 'string' && this.brandId.length === 24 && /^[a-fA-F0-9]{24}$/.test(this.brandId)) {
      validBrandId = this.brandId;
    }
    if (!validBrandId) {
      alert('Brand profile not loaded or invalid. Please wait and try again.');
      return;
    }

    if (this.formMode === 'edit' && this.editingCampaign?._id) {
      this.config.updateCampaign(this.editingCampaign._id, { ...campaignData, brandId: validBrandId }).subscribe({
        next: (updated: Campaign | null) => {
          this.campaigns = this.campaigns.map(c => {
            if (!c || !c._id) return c; // Guard against null/undefined campaign
            if (c._id !== this.editingCampaign!._id) return c;
            if (updated && updated._id) {
              return { ...c, ...updated };
            } else {
              console.warn('Update returned null or missing _id, keeping original campaign:', updated);
              return c;
            }
          });
          this.cd.detectChanges();
          this.loadAllInvites(); // Always refresh dashboard stats after update
        }
      });
    } else {
      const payload: any = { ...campaignData, brandId: validBrandId };
      console.log('Creating campaign with payload:', payload);
      // Basic required fields check (customize as needed)
      if (!payload.title || !payload.timelineStart || !payload.timelineEnd || !payload.brandId || !payload.categories || payload.categories.length === 0) {
        alert('Please fill all required fields (title, timeline, categories, brand).');
        return;
      }
      this.config.createCampaign(payload).subscribe({
        next: (created: Campaign) => {
          this.campaigns = [...this.campaigns, created];
          // Send invites to selected influencers if any
          if (inviteInfluencerIds?.length && created._id) {
            // Only send invites for valid influencer IDs (non-null, non-empty)
            inviteInfluencerIds.filter(id => !!id).forEach(influencerId => {
              this.config.createCampaignInvite({ campaignId: created._id!, influencerId }).subscribe();
            });
          }
          this.loadAllInvites(); // Always refresh dashboard stats after create
          this.cd.detectChanges();
        },
        error: (err) => {
          console.error('Failed to create campaign:', err);
          alert('Failed to create campaign. Please check your input and try again.');
        }
      });
    }
    this.closeForm();
  }

  onDelete(campaign: Campaign) {
    if (!campaign._id) return;
    this.config.deleteCampaign(campaign._id).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter(c => c._id !== campaign._id);
        this.cd.detectChanges();
      }
    });
  }

  closeForm() {
    this.showForm = false;
    this.editingCampaign = null;
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
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  // ── Invite panel ─────────────────────────────────────────────

  openInvitePanel(campaign: Campaign) {
    this.invitePanelCampaign = campaign;
    this.invitePanelOpen = true;
    this.inviteTab = 'invited';
    this.invitesLoading = true;
    this.invites = [];
    this.config.getInvitesByCampaign(campaign._id!).subscribe({
      next: (invites: any[]) => {
        this.invites = invites;
        this.invitesLoading = false;
        this.cd.detectChanges();
      },
      error: () => { this.invitesLoading = false; this.cd.detectChanges(); }
    });
    if (this.allInfluencersForInvite.length === 0) {
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
    this.config.createCampaignInvite({
      campaignId: this.invitePanelCampaign._id,
      influencerId: influencer._id
    }).subscribe({
      next: () => {
        this.sendingInviteIds.delete(influencer._id);
        this.config.getInvitesByCampaign(this.invitePanelCampaign!._id!).subscribe({
          next: (invites: any[]) => { this.invites = invites; this.cd.detectChanges(); }
        });
        this.loadAllInvites();
      },
      error: (err: any) => {
        this.sendingInviteIds.delete(influencer._id);
        this.inviteError = err?.error?.message || 'Failed to send invite. Please try again.';
        this.cd.detectChanges();
        this.loadAllInvites();
      }
    });
  }

  getInfluencerAvatar(inf: any): string {
    if (Array.isArray(inf.profileImages) && inf.profileImages.length > 0) {
      if (inf.profileImages[0]?.url) return inf.profileImages[0].url;
      if (typeof inf.profileImages[0] === 'string') return inf.profileImages[0];
    }
    return '';
  }

  getInfluencerInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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

  formatFollowers(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
    return n > 0 ? String(n) : '';
  }

  timelineProgressText(c: Campaign): string {
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

  getCardInvitedCount(c: Campaign): number {
    return this.campaignInvitesMap.get(c._id!) ? this.campaignInvitesMap.get(c._id!)!.length : 0;
  }

  getCardAcceptedCount(c: Campaign): number {
    return (this.campaignInvitesMap.get(c._id!) || []).filter((i: any) => i.status === 'accepted').length;
  }

  getCardPendingCount(c: Campaign): number {
    // Count both 'pending' and legacy 'invited' statuses
    return (this.campaignInvitesMap.get(c._id!) || []).filter((i: any) => i.status === 'pending' || i.status === 'invited').length;
  }

  getCardSubmittedCount(c: Campaign): number {
    return (this.campaignInvitesMap.get(c._id!) || []).filter((i: any) => i.status === 'submitted').length;
  }

  getCardCompletedCount(c: Campaign): number {
    return (this.campaignInvitesMap.get(c._id!) || []).filter((i: any) => i.status === 'completed').length;
  }

  getCardInvitePreview(c: Campaign): any[] {
    // Always return the first 3 invites, even if influencerId is not fully populated
    const invites = (this.campaignInvitesMap.get(c._id!) || []);
    return invites.slice(0, 3);
  }

  getBrandAvatar(invite: any): string {
    const logo = invite.brandId?.brandLogo;
    if (Array.isArray(logo) && logo.length > 0) {
      if (logo[0]?.url) return logo[0].url;
      if (typeof logo[0] === 'string') return logo[0];
    }
    return 'assets/default-profile.png';
  }

  getCampaignAvatar(invite: any): string {
    return invite.campaignId?.image?.url || 'assets/default-profile.png';
  }

  getPendingInviteCount(): number {
    return this.myInvites.filter(i => i.status === 'pending' || i.status === 'invited').length;
  }

  formatInviteBudget(inv: any): string {
    const c = inv.campaignId;
    if (!c) return '—';
    const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
    if (c.budgetMin && c.budgetMax) return `${fmt(c.budgetMin)} – ${fmt(c.budgetMax)}`;
    if (c.budgetMin) return `From ${fmt(c.budgetMin)}`;
    if (c.budgetMax) return `Up to ${fmt(c.budgetMax)}`;
    return '—';
  }

  // ── My Invites (influencer) ───────────────────────────────────

  // Preview modal — shows campaign + brand details before accept/decline
  invitePreview: any | null = null;

  openInvitePreview(inv: any) {
    this.invitePreview = inv;
  }

  closeInvitePreview() {
    this.invitePreview = null;
  }

  respondToMyInvite(inviteId: string, status: 'accepted' | 'declined') {
    this.config.respondToInvite(inviteId, status).subscribe({
      next: () => {
        this.myInvites = this.myInvites.map(i =>
          i._id === inviteId ? { ...i, status } : i
        );
        // Update preview object too so status badge refreshes
        if (this.invitePreview?._id === inviteId) {
          this.invitePreview = { ...this.invitePreview, status };
        }
        this.cd.detectChanges();
      },
      error: (err: any) => console.error('Failed to respond to invite', err)
    });
  }

  formatPreviewTimeline(inv: any): string {
    const c = inv.campaignId;
    if (!c?.timelineStart) return '—';
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return c.timelineEnd ? `${fmt(c.timelineStart)} – ${fmt(c.timelineEnd)}` : `From ${fmt(c.timelineStart)}`;
  }

  // ── Expandable row panel ──────────────────────────────────────

  loadAllInvites() {
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
        error: () => {
          this.expandInvitesLoading.delete(c._id!);
          this.cd.detectChanges();
        }
      });
    }
  }

  getExpandInvites(c: Campaign): any[] {
    // Log for debugging
    const invites = this.campaignInvitesMap.get(c._id!) || [];
    if (invites.length === 0) {
      console.warn('No invites found for campaign', c._id, c.title);
    } else {
      invites.forEach(inv => {
        if (!inv.influencerId || typeof inv.influencerId === 'string') {
          console.warn('Invite missing influencer details:', inv);
        }
      });
    }
    return invites;
  }

  getExpandInvitesByStatus(c: Campaign, status: string): number {
    return this.getExpandInvites(c).filter((i: any) => i.status === status).length;
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
    if (c.budgetMin && c.budgetMax) return `${fmt(c.budgetMin)}–${fmt(c.budgetMax)}`;
    return c.budgetMin ? fmt(c.budgetMin) : fmt(c.budgetMax!);
  }

  activateCampaign(c: Campaign) {
    if (!c._id) return;
    this.config.updateCampaign(c._id, { status: 'active' as any }).subscribe({
      next: () => {
        this.campaigns = this.campaigns.map(x => x._id === c._id ? { ...x, status: 'active' } : x);
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

  get summaryTotalCampaigns(): number { return this.campaigns.length; }
  get summaryActiveCampaigns(): number { return this.getCount('active'); }

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
    let total = 0;
    this.campaignInvitesMap.forEach(v => total += v.filter((i: any) => i.status === 'accepted').length);
    return total;
  }

  get summaryResponseRate(): string {
    const sent = this.summaryInvitesSent;
    if (sent === 0) return '—';
    let responded = 0;
    this.campaignInvitesMap.forEach(v => { responded += v.filter((i: any) => i.status !== 'pending').length; });
    return Math.round((responded / sent) * 100) + '%';
  }
}
