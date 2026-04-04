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
    const influencers = this.allInfluencersForInvite.filter(inf => ids.includes(inf._id));
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
      this.config.createCampaignInvite({
        campaignId: this.invitePanelCampaign!._id!,
        influencerId: inf._id
      }).subscribe({
        next: () => finish(),
        error: () => { failed++; finish(); }
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
      // Load my invites in parallel
      this.myInvitesLoading = true;
      this.config.getMyInvites().subscribe({
        next: (invites: any[]) => {
          this.myInvites = invites;
          this.myInvitesLoading = false;
          this.cd.detectChanges();
        },
        error: () => { this.myInvitesLoading = false; this.cd.detectChanges(); }
      });
      // Load open campaigns
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

    if (token) {
      this.config.getBrandProfileById().subscribe({
        next: (profile: any) => {
          if (profile) {
            this.brandId = profile._id || '';
            this.brandName = profile.brandName || profile.name || '';
            const name = profile.brandName || profile.brandUsername || profile.name;
            if (name) {
              this.config.getCampaignsByBrandName(name).subscribe({
                next: (campaigns: any[]) => {
                  this.campaigns = campaigns;
                  this.loading = false;
                  this.cd.detectChanges();
                }
              });
            } else {
              this.loading = false;
            }
          } else {
            this.loading = false;
          }
          this.cd.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.cd.detectChanges();
        }
      });
    } else {
      this.loading = false;
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

    if (this.formMode === 'edit' && this.editingCampaign?._id) {
      this.config.updateCampaign(this.editingCampaign._id, campaignData).subscribe({
        next: (updated: Campaign) => {
          this.campaigns = this.campaigns.map(c => c._id === this.editingCampaign!._id ? { ...c, ...updated } : c);
          this.cd.detectChanges();
        }
      });
    } else {
      const payload: any = { ...campaignData, brandId: this.brandId };
      this.config.createCampaign(payload).subscribe({
        next: (created: Campaign) => {
          this.campaigns = [...this.campaigns, created];
          // Send invites to selected influencers if any
          if (inviteInfluencerIds?.length && created._id) {
            inviteInfluencerIds.forEach(influencerId => {
              this.config.createCampaignInvite({ campaignId: created._id!, influencerId }).subscribe();
            });
          }
          this.cd.detectChanges();
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
      },
      error: (err: any) => {
        this.sendingInviteIds.delete(influencer._id);
        this.inviteError = err?.error?.message || 'Failed to send invite. Please try again.';
        this.cd.detectChanges();
      }
    });
  }

  getInfluencerAvatar(inf: any): string {
    if (Array.isArray(inf.profileImages) && inf.profileImages.length > 0) {
      if (inf.profileImages[0]?.url) return inf.profileImages[0].url;
      if (typeof inf.profileImages[0] === 'string') return inf.profileImages[0];
    }
    return 'assets/default-profile.png';
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
    return this.myInvites.filter(i => i.status === 'pending').length;
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
}
