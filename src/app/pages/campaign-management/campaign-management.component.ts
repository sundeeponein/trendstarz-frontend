import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { UpgradeBannerComponent } from '../../shared/upgrade-banner/upgrade-banner.component';
import { SessionService } from '../../core/session.service';
import { Campaign } from '../../shared/campaigns/campaign.model';
import { CampaignFormComponent } from '../../shared/campaigns/campaign-form/campaign-form.component';
import { environment } from '../../../environments/environment';

type TabStatus = 'active' | 'pending' | 'completed' | 'draft';

@Component({
  selector: 'app-campaign-management',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, CampaignFormComponent, UpgradeBannerComponent],
  templateUrl: './campaign-management.component.html',
  styleUrls: ['./campaign-management.component.scss']
})
export class CampaignManagementComponent implements OnInit {
      maxActiveCampaigns: number = 1;
      planCapabilities: any = null;
    // Reload campaigns from backend (used after create/update)
    loadCampaigns() {
      this.loading = true;
      this.config.getAllCampaigns().subscribe({
        next: (campaigns: Campaign[]) => {
          console.log('[DEBUG] getAllCampaigns response:', campaigns);
          this.campaigns = campaigns;
          this.loading = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.campaigns = [];
          this.loading = false;
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
  campaignSubmissionsMap = new Map<string, any[]>();
  submissionFeedback: { [inviteId: string]: string } = {};
  submissionDisputeReason: { [inviteId: string]: string } = {};
  reviewLoading = new Set<string>();
  expandedSubmissionIds = new Set<string>();
  showUpgradeBanner: boolean = false;
  planLimitError: string = '';
  upgradeBannerMessage: string = '';
    invitePanelSuccessMessage: string = '';


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

  getCount(status: string): number {
  if (!this.campaigns) return 0;
  return this.campaigns.filter(c => c.status === status).length;
}

  sendSelectedInvites() {
    if (!this.invitePanelCampaign?._id || this.selectedInfluencerIds.size === 0) return;
    this.inviteError = '';
    this.bulkSending = true;
    this.cd.detectChanges();
    const ids = Array.from(this.selectedInfluencerIds);
    this.config.inviteInfluencers(this.invitePanelCampaign._id, ids).subscribe({
      next: () => {
        this.config.getInvitesByCampaign(this.invitePanelCampaign!._id!).subscribe({
          next: (invites: any[]) => {
            this.bulkSending = false;
            if (invites && invites.length > 0) {
              this.invites = invites;
              if (this.invitePanelCampaign && this.invitePanelCampaign._id) {
                this.campaignInvitesMap.set(this.invitePanelCampaign._id, invites);
                // Only activate campaign if invites exist
                this.activateCampaign(this.invitePanelCampaign);
              }
              this.selectedInfluencerIds.clear();
              this.invitePanelSuccessMessage = 'Invites sent successfully!';
              setTimeout(() => this.invitePanelSuccessMessage = '', 4000);
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
          this.loading = false;
          //this.campaignLoadError = 'Campaign management is only available for brands.';
          this.cd.detectChanges();
        },
        error: () => {
          this.myInvitesLoading = false;
          this.loading = false;
          //this.campaignLoadError = 'Campaign management is only available for brands.';
          this.cd.detectChanges();
        }
      });
    } else {
      // Brand: fetch brand profile first, then load campaigns with brandId and set plan capabilities
      this.loading = true;
      this.config.getBrandProfileById().subscribe({
        next: (profile: any) => {
          console.log('[DEBUG] Raw brand profile response:', profile);
          const brand = profile?.data?.brand || profile?.brand || profile;
          console.log('[DEBUG] brand profile:', brand);
          this.brandId = brand?._id || brand?.id || '';
          this.brandName = brand?.brandName || brand?.name || '';
          // Set plan capabilities and maxActiveCampaigns here
          if (brand?.planCapabilities) {
            this.planCapabilities = brand.planCapabilities;
            this.maxActiveCampaigns = brand.planCapabilities.limits?.find((l: any) => l.key === 'maxActiveCampaigns')?.value ?? 1;
          }
          this.cd.detectChanges();
          // Now load campaigns for this brand
          console.log('[DEBUG] Using brandId:', this.brandId, typeof this.brandId);
          if (!this.brandId) {
            console.error('[ERROR] No brandId found after fetching brand profile. Campaigns API will not be called.');
            this.campaignLoadError = 'No brand profile found or you are not logged in as a brand. Please check your account.';
            this.loading = false;
            this.cd.detectChanges();
            return;
          }
          this.config.getCampaignsByBrandId(this.brandId).subscribe({
            next: (campaigns: Campaign[]) => {
              console.log('[DEBUG] getCampaignsByBrandId response:', campaigns);
              this.campaigns = campaigns || [];
              if (!campaigns || campaigns.length === 0) {
                this.campaignLoadError = 'No campaigns found.';
              } else {
                this.campaignLoadError = '';
              }
              this.loading = false;
              this.cd.detectChanges();
              // Load invites for all campaigns after campaigns are loaded
              this.loadAllInvites();
            },
            error: (err) => {
              this.campaigns = [];
              this.campaignLoadError = 'Failed to load campaigns.';
              this.loading = false;
              this.cd.detectChanges();
            }
          });
        },
        error: (err) => {
          console.error('[ERROR] Failed to fetch brand profile:', err);
          this.campaignLoadError = 'Failed to load brand profile. Please try again.';
          this.loading = false;
          this.cd.detectChanges();
        }
      });
    }
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
    if (this.summaryActiveCampaigns >= this.maxActiveCampaigns) {
      // Determine if user is premium or free
      const isPremium = this.planCapabilities?.plan === 'premium' || this.planCapabilities?.plan === 'pro';
      if (isPremium) {
        this.upgradeBannerMessage = `Premium plan: ${this.summaryActiveCampaigns} / ${this.maxActiveCampaigns} campaigns used.`;
        this.planLimitError = '';
      } else {
        this.upgradeBannerMessage = '';
        this.planLimitError = `Free plan limit reached: Only ${this.maxActiveCampaigns} active campaign(s) allowed. Upgrade for more.`;
      }
      this.showUpgradeBanner = true;
      return;
    }
    this.editingCampaign = null;
    this.formMode = 'create';
    this.showForm = true;
  }

  onManage(campaign: Campaign) {
    // Always refresh brand profile before editing
    this.config.getBrandProfileById().subscribe({
      next: (profile: any) => {
        const brand = profile?.data?.brand || profile?.brand || profile;
        console.log('[DEBUG] brand profile:', brand);
        this.brandId = brand?._id || brand?.id || brand?.brandUsername || '';
        this.brandName = brand?.brandName || brand?.name || '';
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

  onFormSave(data: Partial<Campaign> & { inviteInfluencerIds?: string[] }) {
    const { inviteInfluencerIds, ...campaignData } = data;

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
      alert('Brand profile not loaded or invalid. Please wait and try again.');
      // Attempt to reload brand profile and update state
      this.config.getBrandProfileById().subscribe({
        next: (profile: any) => {
          const brand = profile?.data?.brand || profile?.brand || profile;
          this.brandId = brand?._id || brand?.id || '';
          this.brandName = brand?.brandName || brand?.name || '';
          this.cd.detectChanges();
        }
      });
      return;
    }

    if (this.formMode === 'edit' && this.editingCampaign?._id) {
      // Capture id before closeForm() nullifies editingCampaign
      const editingId = this.editingCampaign._id;
      this.config.updateCampaign(editingId, { ...campaignData, brandId: validBrandId }).subscribe({
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
          // If there are influencers to invite, send invites and update state before closing form
          if (inviteInfluencerIds && inviteInfluencerIds.length > 0) {
            const validIds = inviteInfluencerIds.filter(id => !!id);
            if (validIds.length > 0) {
              this.config.inviteInfluencers(editingId, validIds).subscribe({
                next: () => {
                  this.config.getInvitesByCampaign(editingId).subscribe({
                    next: (invites: any[]) => {
                      this.campaignInvitesMap.set(editingId, invites);
                      this.invites = invites;
                      this.cd.detectChanges();
                      this.toastMessage = 'Invites sent successfully!';
                      this.showSuccessToast = true;
                      setTimeout(() => { this.showSuccessToast = false; this.cd.detectChanges(); }, 4000);
                      this.closeForm();
                    },
                    error: () => {
                      this.loadAllInvitesForce();
                      this.cd.detectChanges();
                      this.closeForm();
                    }
                  });
                },
                error: (err) => {
                  let msg = 'Failed to send invites.';
                  if (err?.error?.message) msg = err.error.message;
                  this.toastMessage = msg;
                  this.showErrorToast = true;
                  setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
                  this.loadAllInvitesForce();
                  this.cd.detectChanges();
                  this.closeForm();
                }
              });
              return; // Prevent double closeForm()
            }
          }
          this.loadAllInvitesForce();
          this.cd.detectChanges();
          this.config.getBrandProfileById().subscribe({
            next: (profile: any) => {
              const brand = profile?.data?.brand || profile?.brand || profile;
              this.brandId = brand?._id || brand?.id || '';
              this.brandName = brand?.brandName || brand?.name || '';
              this.cd.detectChanges();
            }
          });
          this.closeForm();
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
          // Always reload campaigns from backend after creation
          this.loadCampaigns();
          // Always refresh brand profile after creation
          this.config.getBrandProfileById().subscribe({
            next: (profile: any) => {
              const brand = profile?.data?.brand || profile?.brand || profile;
              this.brandId = brand?._id || brand?.id || brand?.brandUsername || '';
              this.brandName = brand?.brandName || brand?.name || '';
              this.cd.detectChanges();
            }
          });
          // Send invites to selected influencers if any
          if (inviteInfluencerIds?.length && created._id) {
            const validIds = inviteInfluencerIds.filter(id => !!id);
            console.log('[DEBUG] Inviting influencers after campaign creation:', validIds, 'for campaign', created._id);
            if (validIds.length === 0) {
              this.loadAllInvitesForce();
              this.cd.detectChanges();
              this.toastMessage = 'Campaign created successfully!';
              this.showSuccessToast = true;
              setTimeout(() => { this.showSuccessToast = false; }, 4000);
              this.closeForm();
            } else {
              this.config.inviteInfluencers(created._id, validIds).subscribe({
                next: (resp) => {
                  console.log('[DEBUG] Invite API response:', resp);
                  // Fetch invites for the new campaign and update state
                  if (!created._id) {
                    console.error('Campaign _id is undefined after creation.');
                    return;
                  }
                  this.config.getInvitesByCampaign(created._id).subscribe({
                    next: (invites: any[]) => {
                      if (created._id) {
                        this.campaignInvitesMap.set(created._id, invites);
                        this.invites = invites;
                        // Optionally activate campaign if invites exist
                        if (invites && invites.length > 0) {
                          this.activateCampaign(created);
                        }
                      }
                      this.cd.detectChanges();
                      this.toastMessage = 'Campaign created and invites sent!';
                      this.showSuccessToast = true;
                      setTimeout(() => { this.showSuccessToast = false; }, 4000);
                      this.closeForm();
                    },
                    error: () => {
                      this.loadAllInvitesForce();
                      this.cd.detectChanges();
                      this.toastMessage = 'Campaign created, but failed to fetch invites.';
                      this.showErrorToast = true;
                      setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
                      this.closeForm();
                    }
                  });
                },
                error: (err) => {
                  console.error('[DEBUG] Invite API error:', err);
                  this.loadAllInvitesForce();
                  this.cd.detectChanges();
                  this.toastMessage = 'Campaign created, but failed to send invites.';
                  this.showErrorToast = true;
                  setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
                  this.closeForm();
                }
              });
            }
          } else {
            this.loadAllInvitesForce();
            this.cd.detectChanges();
            this.toastMessage = 'Campaign created successfully!';
            this.showSuccessToast = true;
            setTimeout(() => { this.showSuccessToast = false; }, 4000);
            this.closeForm();
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
            const isPremium = this.planCapabilities?.plan === 'premium' || this.planCapabilities?.plan === 'pro';
            if (isPremium) {
              this.upgradeBannerMessage = `Premium plan: ${this.summaryActiveCampaigns} / ${this.maxActiveCampaigns} campaigns used.`;
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
          this.showErrorToast = true;
          console.log('Showing error toast:', toastMsg);
          this.cd.detectChanges();
          setTimeout(() => { this.showErrorToast = false; this.cd.detectChanges(); }, 5000);
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
              this.invitePanelSuccessMessage = 'Invites sent successfully!';
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
  selectedInvitePostDates: Record<string, string> = {};
  // Content type selection: key = inviteId, value = "platform::contentType"
  selectedInviteContentType: Record<string, string> = {};

  openInvitePreview(inv: any) {
    this.invitePreview = inv;
  }

  closeInvitePreview() {
    this.invitePreview = null;
  }

  private showError(message: string) {
    this.toastMessage = message;
    this.showErrorToast = true;
    this.cd.detectChanges();
    setTimeout(() => {
      this.showErrorToast = false;
      this.cd.detectChanges();
    }, 5000);
  }

  respondToMyInvite(inviteId: string, status: 'accepted' | 'declined') {
    const selectedPostDate = status === 'accepted' ? this.selectedInvitePostDates[inviteId] : undefined;
    if (status === 'accepted' && !selectedPostDate) {
      this.showError('Please select a post date before accepting this invite.');
      return;
    }
    const invite = this.myInvites.find(i => i._id === inviteId) || this.invitePreview;
    if (status === 'accepted' && invite && !this.isSelectedDateValid(invite, selectedPostDate!)) {
      this.showError('Selected post date must be between campaign start and end dates.');
      return;
    }
    // Require content type selection if campaign has options
    const options = this.getInviteContentTypeOptions(invite);
    const chosen = this.selectedInviteContentType[inviteId];
    if (status === 'accepted' && options.length > 0 && !chosen) {
      this.showError('Please select what you will create for this campaign.');
      return;
    }
    const [selPlatform, selContentType] = chosen ? chosen.split('::') : [undefined, undefined];
    this.config.respondToInvite(inviteId, status, selectedPostDate, selPlatform, selContentType).subscribe({
      next: () => {
        this.myInvites = this.myInvites.map(i =>
          i._id === inviteId ? { ...i, status } : i
        );
        if (this.invitePreview?._id === inviteId) {
          this.invitePreview = { ...this.invitePreview, status };
        }
        this.cd.detectChanges();
      },
      error: (err: any) => console.error('Failed to respond to invite', err)
    });
  }

  /** Returns flat list of enabled content type options for an invite's campaign */
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

  private isSelectedDateValid(inv: any, selectedPostDate: string): boolean {
    const c = inv?.campaignId;
    const start = c?.startDate || c?.timelineStart;
    const end = c?.endDate || c?.timelineEnd;
    if (!start || !end) return true;
    const s = new Date(selectedPostDate);
    if (Number.isNaN(s.getTime())) return false;
    return s >= new Date(start) && s <= new Date(end);
  }

  formatPreviewTimeline(inv: any): string {
    const c = inv.campaignId;
    if (!c?.timelineStart) return '—';
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return c.timelineEnd ? `${fmt(c.timelineStart)} – ${fmt(c.timelineEnd)}` : `From ${fmt(c.timelineStart)}`;
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
          alert('Failed to create campaign. Please try again.');
          console.error('Create campaign error:', err);
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

  getSubmissions(c: Campaign): any[] {
    return this.campaignSubmissionsMap.get(c._id!) || [];
  }

  getSubmissionForInvite(c: Campaign, inv: any): any | null {
    const submissions = this.campaignSubmissionsMap.get(c._id!) || [];
    return submissions.find(
      s => String(s.inviteId) === String(inv._id) ||
           String(s.influencerId?._id || s.influencerId) === String(inv.influencerId?._id || inv.influencerId)
    ) || null;
  }

  reviewSubmission(inviteId: string, campaignId: string, action: 'approve' | 'dispute') {
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
