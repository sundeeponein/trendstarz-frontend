import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
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

type TabStatus = 'active' | 'pending' | 'completed' | 'draft';

@Component({
  selector: 'app-campaign-management',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterModule, CampaignFormComponent, CampaignDetailModalComponent, CampaignInviteCardComponent, UpgradeBannerComponent, SupportBannerComponent, CampaignPaymentComponent],
  templateUrl: './campaign-management.component.html',
  styleUrls: ['./campaign-management.component.scss']
})
export class CampaignManagementComponent implements OnInit {
      maxActiveCampaigns: number = 1;
      planCapabilities: any = null;
    // Reload campaigns from backend (used after create/update)
    loadCampaigns() {
      this.loading = true;
      const request$ = this.isInfluencerView
        ? this.config.getAllCampaigns('active')
        : this.config.getCampaignsByBrandId(this.brandId);
      request$.subscribe({
        next: (campaigns: Campaign[]) => {
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
    showTierInfoPopup = false;
    tierInfoLoading = false;
    tierInfoItems: string[] = [];

    // Payment modal state
    paymentModalVisible = false;
    paymentCampaignId: string | null = null;

    openPayment(campaignId?: string | null) {
      if (!campaignId) return;
      this.paymentCampaignId = campaignId;
      this.paymentModalVisible = true;
      this.cd.detectChanges();
    }

    onPaymentVisibleChange(v: boolean) {
      this.paymentModalVisible = v;
      if (!v) this.paymentCampaignId = null;
    }


  get invitedIds(): Set<string> {
    return new Set(this.invites.map(i => String(i.influencerId?._id || i.influencerId)));
  }

  get selectableInfluencers(): any[] {
    return this.filteredInfluencersForInvite.filter(inf => !this.invitedIds.has(inf._id));
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
    const sel = this.selectableInfluencers;
    return sel.length > 0 && sel.every(inf => this.selectedInfluencerIds.has(inf._id));
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
              this.toast.success('Invites sent successfully!');
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
  openingCampaignIds = new Set<string>();

  tabs: { key: TabStatus; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
  ];

  constructor(
    private config: ConfigService,
    private session: SessionService,
    private cd: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const user = this.session.getUser();
    this.isInfluencerView = user?.role === 'influencer';

    if (this.isInfluencerView) {
      // Influencer: load invites + open active campaigns
      this.myInvitesLoading = true;
      this.loading = true;
      // Seed default payout details from the influencer's profile so the
      // accept card can prefill UPI / mobile / account holder name.
      this.config.getInfluencerProfileById().subscribe({
        next: (profile: any) => {
          this.defaultPayout = {
            upiId: profile?.payout?.upiId || '',
            mobile: profile?.payout?.mobile || profile?.phoneNumber || '',
            accountHolderName: profile?.payout?.accountHolderName || profile?.name || '',
          };
          this.cd.detectChanges();
        },
        error: () => { /* non-fatal */ },
      });
      this.config.getMyInvites().subscribe({
        next: (invites: any[]) => {
          this.myInvites = invites;
          this.myInvitesLoading = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.myInvitesLoading = false;
          this.cd.detectChanges();
        }
      });

      this.config.getAllCampaigns('active').subscribe({
        next: (campaigns: Campaign[]) => {
          this.campaigns = campaigns || [];
          this.campaignLoadError = '';
          this.loading = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.campaigns = [];
          this.campaignLoadError = 'Failed to load open campaigns.';
          this.loading = false;
          this.cd.detectChanges();
        }
      });
    } else {
      // Brand: fetch brand profile first, then load campaigns with brandId and set plan capabilities
      this.loading = true;
      this.config.getBrandProfileById().subscribe({
        next: (profile: any) => {
          // debug: raw brand profile response
          const brand = profile?.data?.brand || profile?.brand || profile;
          this.brandId = brand?._id || brand?.id || '';
          this.brandName = brand?.brandName || brand?.name || '';
          // Set plan capabilities and maxActiveCampaigns here
          if (brand?.planCapabilities) {
            this.planCapabilities = brand.planCapabilities;
            this.maxActiveCampaigns = brand.planCapabilities.limits?.find((l: any) => l.key === 'maxActiveCampaigns')?.value ?? 1;
          }
          this.cd.detectChanges();
          // Now load campaigns for this brand
          // debug: using brandId
          if (!this.brandId) {
            console.error('[ERROR] No brandId found after fetching brand profile. Campaigns API will not be called.');
            this.campaignLoadError = 'No brand profile found or you are not logged in as a brand. Please check your account.';
            this.loading = false;
            this.cd.detectChanges();
            return;
          }
          this.config.getCampaignsByBrandId(this.brandId).subscribe({
            next: (campaigns: Campaign[]) => {
              // debug: getCampaignsByBrandId response
              this.campaigns = campaigns || [];
              this.campaignLoadError = '';
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
                      this.toast.success('Invites sent successfully!');
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
      // debug: creating campaign payload
      // Basic required fields check
      if (!payload.title || !payload.timelineStart || !payload.timelineEnd || !payload.brandId) {
        alert('Please fill all required fields (title, timeline, brand).');
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
            // debug: inviting influencers after campaign creation
            if (validIds.length === 0) {
              this.loadAllInvitesForce();
              this.cd.detectChanges();
              this.toastMessage = 'Campaign created successfully!';
              this.toast.success('Campaign created successfully!');
              this.showSuccessToast = true;
              setTimeout(() => { this.showSuccessToast = false; }, 4000);
              this.closeForm();
            } else {
              this.config.inviteInfluencers(created._id, validIds).subscribe({
                next: (resp) => {
                  // debug: invite API response
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
                      this.toast.success('Campaign created and invites sent!');
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
                  console.error('[Invite API error]', err);
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
            this.toast.success('Campaign created successfully!');
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
          this.toast.error(toastMsg);
          this.showErrorToast = true;
          // debug: showing error toast message (hidden for CI cleanliness)
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

  openTierInfoPopup() {
    this.showTierInfoPopup = true;
    if (this.tierInfoItems.length > 0 || this.tierInfoLoading) {
      this.cd.detectChanges();
      return;
    }
    this.tierInfoLoading = true;
    this.config.getTiers().subscribe({
      next: (rows: any[]) => {
        const tiers = (Array.isArray(rows) ? rows : [])
          .map((r: any) => String(r?.tier || r?.name || '').trim())
          .filter((v: string) => !!v);
        this.tierInfoItems = Array.from(new Set(tiers));
        this.tierInfoLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.tierInfoItems = ['Nano', 'Micro', 'Mid', 'Macro', 'Mega'];
        this.tierInfoLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  closeTierInfoPopup() {
    this.showTierInfoPopup = false;
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
              this.toast.success('Invite sent successfully!');
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

  isInfluencerPremium(inf: any): boolean {
    if (!inf) return false;
    if (inf.isPremium === true) return true;
    if (!inf.premiumEnd) return false;
    const end = new Date(inf.premiumEnd);
    return !Number.isNaN(end.getTime()) && end >= new Date();
  }

  getInfluencerTier(inf: any): string {
    if (!Array.isArray(inf?.socialMedia) || !inf.socialMedia.length) return '';
    const topByFollowers = [...inf.socialMedia]
      .sort((a: any, b: any) => Number(b?.followersCount || 0) - Number(a?.followersCount || 0))[0];
    return String(topByFollowers?.tier || '').trim();
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

  /** Returns brand info from an open campaign (populated by findPublic on backend) */
  getCampaignBrand(c: any): { name: string; logo: string | null; username: string } {
    const b = (c as any).brand;
    if (!b) return { name: '', logo: null, username: '' };
    return { name: b.name || '', logo: b.logo || null, username: b.username || '' };
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
  // Per-invite payout details captured at accept time
  selectedInvitePayouts: Record<string, { upiId: string; mobile: string; accountHolderName: string }> = {};
  // Default payout details from the current influencer profile (if any)
  defaultPayout: { upiId: string; mobile: string; accountHolderName: string } = {
    upiId: '',
    mobile: '',
    accountHolderName: '',
  };

  openInvitePreview(inv: any) {
    this.invitePreview = inv;
  }

  openOpenCampaign(campaign: Campaign, event?: Event) {
    event?.stopPropagation();
    if (!this.isInfluencerView || !campaign?._id) return;
    const campaignId = String(campaign._id);
    if (this.openingCampaignIds.has(campaignId)) return;

    const existing = this.myInvites.find((inv: any) => {
      const invCampaignId = String(inv?.campaignId?._id || inv?.campaignId || '');
      return invCampaignId === campaignId && (inv.status === 'pending' || inv.status === 'invited');
    });
    if (existing) {
      this.openInvitePreview(existing);
      return;
    }

    this.openingCampaignIds.add(campaignId);
    this.cd.detectChanges();

    this.config.applyToOpenCampaign(campaignId).subscribe({
      next: (invite: any) => {
        if (invite) {
          if (!this.myInvites.some((i: any) => String(i?._id || '') === String(invite?._id || ''))) {
            this.myInvites = [invite, ...this.myInvites];
          }
          this.openInvitePreview(invite);
        } else {
          this.showError('Unable to open this campaign right now. Please try again.');
        }
        this.openingCampaignIds.delete(campaignId);
        this.cd.detectChanges();
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Unable to open this campaign right now. Please try again.';
        this.showError(msg);
        this.openingCampaignIds.delete(campaignId);
        this.cd.detectChanges();
      }
    });
  }

  isOpeningCampaign(campaign: Campaign): boolean {
    return !!campaign?._id && this.openingCampaignIds.has(String(campaign._id));
  }

  closeInvitePreview() {
    this.invitePreview = null;
  }

  onModalAccept(payload: CampaignAcceptPayload) {
    if (payload.postDate) this.selectedInvitePostDates[payload.inviteId] = payload.postDate;
    if (payload.platform && payload.contentType) {
      this.selectedInviteContentType[payload.inviteId] = `${payload.platform}::${payload.contentType}`;
    }
    this.respondToMyInvite(payload.inviteId, 'accepted');
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
    this.respondToMyInvite(payload.inviteId, 'accepted');
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
    const payout = status === 'accepted' ? this.selectedInvitePayouts[inviteId] : undefined;
    this.config.respondToInvite(inviteId, status, selectedPostDate, selPlatform, selContentType, payout).subscribe({
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

  campaignTypeLabel(type: string): string {
    const m: Record<string, string> = {
      paid_collab: 'Paid Collab',
      product: 'Product / Barter',
      invite_location: 'Invite to Location',
      pay_to_join: 'Pay to Join',
    };
    return m[(type || '').toLowerCase()] || type;
  }

  getBrandProfileLink(inv: any): any[] | null {
    const b = inv?.brandId;
    if (!b) return null;
    const slug = b.brandUsername || b.brandName;
    if (!slug) return null;
    return ['/brand', slug];
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
      if (c.budgetMin && c.budgetMax && c.budgetMin !== c.budgetMax) return `${fmt(c.budgetMin)}–${fmt(c.budgetMax)}`;
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
