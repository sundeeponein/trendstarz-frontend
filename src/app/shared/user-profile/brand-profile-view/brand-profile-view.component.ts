import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ConfigService } from '../../config.service';
import { SessionService } from '../../../core/session.service';
import { Campaign } from '../../campaigns/campaign.model';
import { CampaignListComponent } from '../../campaigns/campaign-list/campaign-list.component';
import { CampaignCardComponent } from '../../campaigns/campaign-card/campaign-card.component';
import { CampaignDetailModalComponent } from '../../campaign-detail-modal/campaign-detail-modal.component';
import { WriteReviewComponent } from '../../write-review/write-review.component';
import { ReviewListComponent } from '../../review-list/review-list.component';
import { SocialClickTrackerService } from '../../../services/social-click-tracker.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-brand-profile-view',
  standalone: true,
  imports: [CommonModule, CampaignListComponent, CampaignCardComponent, CampaignDetailModalComponent, WriteReviewComponent, ReviewListComponent],
  templateUrl: './brand-profile-view.component.html',
  styleUrls: ['./brand-profile-view.component.scss']
})
export class BrandProfileViewComponent implements OnInit {
  brand: any = null;
  loading = true;
  error = '';
  showContact = false;
  activeTab: 'overview' | 'campaigns' | 'analytics' = 'overview';
  campaigns: Campaign[] = [];
  selectedCampaign: Campaign | null = null;
  isOwner = false;

  // Review state
  showWriteReview = false;
  completedInviteId: string | null = null;

  get isInfluencerViewer(): boolean {
    const user = this.session.getUser();
    return user?.role === 'INFLUENCER' || user?.role === 'influencer';
  }

  get isProViewer(): boolean {
    return !!this.session.getUser()?.isPremium;
  }

  /** Whether any user is logged in (used to gate contact details for guests) */
  get isLoggedIn(): boolean {
    return !!this.session.getUser();
  }

  get canViewContactDetails(): boolean {
    return !!this.brand && this.brand.contactRestricted !== true;
  }

  onContactClick(): void {
    this.showContact = !this.showContact;
  }

  stripProtocol(url: string): string {
    return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayImage(): string {
    const firstLogo = this.brand?.brandLogo?.[0]?.url
      || (typeof this.brand?.brandLogo === 'string' ? this.brand.brandLogo : null);
    return this.normalizeImageUrl(firstLogo) || 'assets/default-profile.png';
  }

  private normalizeImageUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('/assets/') || url.startsWith('/assets')) {
      const api = environment.apiBaseUrl || '';
      const backend = api.replace(/\/api\/?$/, '') || api.replace(/\/api$/, '');
      return backend ? backend + url : url;
    }
    return url;
  }

  private campaignStatus(status: unknown): string {
    return String(status || '').trim().toLowerCase();
  }

  get activePublicCampaigns(): Campaign[] {
    return (this.campaigns || []).filter((campaign) => this.campaignStatus(campaign?.status) === 'active');
  }

  get campaignCardsForProfile(): Campaign[] {
    return (this.campaigns || []).map((campaign) => this.toOverviewCampaign(campaign));
  }

  get productImages(): string[] {
    const source = Array.isArray(this.brand?.products)
      ? this.brand.products
      : (Array.isArray(this.brand?.productImages) ? this.brand.productImages : []);
    return source
      .map((entry: any) => this.normalizeImageUrl(typeof entry === 'string' ? entry : entry?.url))
      .filter((url: string) => !!url);
  }

  getCampaignImage(campaign: Campaign): string {
    const campaignImage = this.normalizeImageUrl(campaign?.image?.url || '');
    if (campaignImage) return campaignImage;
    if (this.productImages.length) return this.productImages[0];
    return 'assets/default-profile.png';
  }

  toOverviewCampaign(campaign: Campaign): Campaign {
    const fallbackImage = this.getCampaignImage(campaign);
    return {
      ...campaign,
      image: campaign.image?.url ? campaign.image : { url: fallbackImage, public_id: '' },
      applicants: undefined,
    };
  }

  onCampaignViewDetails(campaign: Campaign): void {
    this.selectedCampaign = campaign;
  }

  closeCampaignDetails(): void {
    this.selectedCampaign = null;
  }

  get selectedCampaignInvite(): any | null {
    if (!this.selectedCampaign) return null;
    return {
      _id: this.selectedCampaign._id || 'campaign-preview',
      status: 'accepted',
      campaign: this.selectedCampaign,
      brandId: {
        brandName: this.brand?.brandName || this.brand?.name || '',
        brandUsername: this.brand?.brandUsername || '',
      },
    };
  }

  getCampaignBudget(campaign: Campaign): string {
    const min = Number(campaign?.budgetMin || 0);
    const max = Number(campaign?.budgetMax || 0);
    if (!min && !max) return '';
    if (min && max) {
      if (min === max) return `₹${min.toLocaleString('en-IN')}`;
      return `₹${min.toLocaleString('en-IN')} - ₹${max.toLocaleString('en-IN')}`;
    }
    return `₹${(min || max).toLocaleString('en-IN')}`;
  }

  getTotalFollowers(): number {
    return (this.brand?.socialMedia || []).reduce((sum: number, sm: any) => sum + (sm.followersCount || 0), 0);
  }

  get displayTags(): string[] {
    const hiddenCommissionTags = new Set(['early access', 'partner', 'internal/test', 'internal test']);
    return Array.isArray(this.brand?.adminTags)
      ? this.brand.adminTags
          .filter((tag: any) => !!String(tag || '').trim())
          .filter((tag: any) => !hiddenCommissionTags.has(String(tag || '').trim().toLowerCase()))
      : [];
  }

  formatFollowers(count: number): string {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  }

  getFollowerPercent(sm: any): number {
    const total = this.getTotalFollowers();
    if (!total) return 0;
    return Math.round(((sm.followersCount || 0) / total) * 100);
  }

  getSocialIcon(sm: any): string {
    const p = (sm?.platform || '').toLowerCase();
    if (p.includes('insta')) return 'bi bi-instagram';
    if (p.includes('youtube')) return 'bi bi-youtube';
    if (p.includes('face')) return 'bi bi-facebook';
    if (p.includes('twitter') || p.includes('x')) return 'bi bi-twitter-x';
    if (p.includes('tiktok')) return 'bi bi-tiktok';
    if (p.includes('linkedin')) return 'bi bi-linkedin';
    return 'bi bi-globe';
  }

  getSocialLabel(sm: any): string {
    const p = (sm?.platform || '').toLowerCase();
    if (p.includes('insta')) return 'Instagram';
    if (p.includes('youtube')) return 'YouTube';
    if (p.includes('face')) return 'Facebook';
    if (p.includes('twitter') || p.includes('x')) return 'Twitter';
    if (p.includes('tiktok')) return 'TikTok';
    if (p.includes('linkedin')) return 'LinkedIn';
    return sm?.platform || 'Website';
  }

  getSocialUrl(sm: any): string {
    const p = (sm?.platform || '').toLowerCase();
    const handle = sm?.handle || '';
    if (p.includes('insta')) return 'https://instagram.com/' + handle;
    if (p.includes('youtube')) return 'https://youtube.com/' + handle;
    if (p.includes('face')) return 'https://facebook.com/' + handle;
    if (p.includes('twitter') || p.includes('x')) return 'https://x.com/' + handle;
    if (p.includes('tiktok')) return 'https://tiktok.com/@' + handle;
    if (p.includes('linkedin')) return 'https://linkedin.com/in/' + handle;
    return sm?.url || '#';
  }

  tagBadgeClass(tag: string): string {
    const normalized = String(tag || '').toLowerCase();
    if (normalized.includes('founder')) return 'tag-badge--founder';
    if (normalized.includes('verified')) return 'tag-badge--verified';
    if (normalized.includes('internal')) return 'tag-badge--internal';
    return 'tag-badge--neutral';
  }

  getMainSocialLink(): string {
    if (!this.canOpenSocialProfiles) return '#';
    if (this.brand?.socialMedia?.length) {
      return this.getSocialUrl(this.brand.socialMedia[0]);
    }
    const website = String(this.brand?.website || '').trim();
    if (website) return website;
    return '#';
  }

  get hasFollowLink(): boolean {
    return this.getMainSocialLink() !== '#';
  }

  get canOpenSocialProfiles(): boolean {
    return !!this.brand && this.brand.socialMediaRestricted !== true;
  }

  onFollowClick(): void {
    const first = this.brand?.socialMedia?.[0] || null;
    this.trackSocialClick(first, this.getMainSocialLink(), 'brand_profile_follow');
  }

  onPlatformClick(sm: any): void {
    this.trackSocialClick(sm, this.getSocialUrl(sm), 'brand_profile_platform');
  }

  private trackSocialClick(sm: any, url: string, source: string): void {
    if (!this.isLoggedIn || !this.canOpenSocialProfiles || !this.brand?._id) return;
    if (!url || url === '#') return;
    const platform = String(sm?.platform || 'website').trim() || 'website';
    this.socialClickTracker.track({
      targetUserId: String(this.brand._id),
      targetRole: 'brand',
      platform,
      url,
      source,
    });
  }

  get displayCompanySize(): string {
    const raw = String(this.brand?.companySize || '').trim();
    if (!raw) return '';
    const labels: Record<string, string> = {
      '1-10': 'Small team',
      '11-50': 'Growing team',
      '51-200': 'Mid-size company',
      '201-500': 'Large company',
      '500+': 'Enterprise',
    };
    return labels[raw] ? `${labels[raw]} (${raw})` : raw;
  }

  constructor(
    private route: ActivatedRoute,
    private config: ConfigService,
    private socialClickTracker: SocialClickTrackerService,
    private session: SessionService,
    private cd: ChangeDetectorRef,
    private titleService: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    this.route.data.subscribe(({ brand }) => {
      const routeBrandName = this.route.snapshot.paramMap.get('brandName') || this.route.parent?.snapshot.paramMap.get('brandName');
      this.brand = null;
      this.error = '';
      this.loading = true;

      if (!routeBrandName) {
        this.error = 'No brand specified';
        this.setDefaultMetadata();
        this.loading = false;
        this.cd.detectChanges();
        return;
      }

      const data = brand || null;
      if (!data) {
        this.error = 'Brand not found.';
        this.brand = null;
        this.setDefaultMetadata();
      } else {
        this.brand = data;
        this.updateMetadata(data);
        this.config.trackBrandProfileImpression(routeBrandName).subscribe({
          next: () => {},
          error: () => {}
        });
        this.checkOwnership(data);
        // Fetch campaigns for this brand
        const brandName = data.brandName || data.brandUsername || data.name;
        if (brandName) {
          this.config.getCampaignsByBrandName(brandName).subscribe({
            next: (campaigns: any[]) => {
              this.campaigns = campaigns;
              this.cd.detectChanges();
            }
          });
        }
        // Influencer premium: find their completed invite with this brand
        if (this.isInfluencerViewer && this.isProViewer) {
          this.config.getMyInvites().subscribe({
            next: (invites: any[]) => {
              const done = invites.find(
                (inv: any) => inv.status === 'completed'
                  && (String(inv.brandId?._id || inv.brandId) === String(data._id)
                    || String(inv.brandId?._id || inv.brandId) === (data.brandUsername || ''))
              );
              this.completedInviteId = done?._id || null;
              this.cd.detectChanges();
            },
            error: () => {}
          });
        }
      }

      this.loading = false;
      this.cd.detectChanges();
    });
  }

  private checkOwnership(brand: any) {
    const user = this.session.getUser();
    if (!user) { this.isOwner = false; return; }
    this.isOwner = user.id === brand._id || user.id === brand.userId || user.email === brand.email;
  }

  private updateMetadata(brand: any): void {
    const name = String(brand?.brandName || '').trim() || 'Brand';
    const followers = this.formatFollowers(this.getTotalFollowers());
    const campaignCount = (this.activePublicCampaigns || []).length;
    const title = `${name} | Brand | TrendStarz`;
    const description = `Discover ${name} on TrendStarz. ${followers} followers. ${campaignCount} active campaigns. Contact for influencer collaborations and brand partnerships.`;
    const canonical = `https://trendstarz.in/brand/${brand?.brandUsername || brand?.brandName || ''}`;

    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ property: 'og:type', content: 'business.business' });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.updateCanonical(canonical);

    if (isPlatformBrowser(this.platformId)) {
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).gtag?.('config', 'G-5912TSJYW5', {
        send_page_view: false,
        page_title: title,
        page_path: `/brand/${brand?.brandUsername || brand?.brandName}`,
        brand_name: name,
        brand_followers: followers,
        active_campaigns: campaignCount,
      });
    }
  }

  private setDefaultMetadata(): void {
    const title = 'Brand Profile | TrendStarz';
    const description = 'View brand profile and campaign collaboration details on TrendStarz.';
    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  private updateCanonical(href: string): void {
    let canonical = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', href);
  }

  onCreateCampaign(data: Partial<Campaign> & {
    inviteInfluencerIds?: string[];
    inviteRecipientIds?: string[];
    inviteRecipientRole?: 'influencer' | 'photographer';
  }) {
    const brandId = this.brand?._id;
    if (!brandId) return;
    const { inviteInfluencerIds, inviteRecipientIds, inviteRecipientRole, ...campaignData } = data as any;
    const recipientRole: 'influencer' | 'photographer' = inviteRecipientRole === 'photographer' ? 'photographer' : 'influencer';
    const inviteIds = (Array.isArray(inviteRecipientIds) && inviteRecipientIds.length > 0)
      ? inviteRecipientIds
      : (Array.isArray(inviteInfluencerIds) ? inviteInfluencerIds : []);
    const payload: any = {
      ...campaignData,
      brandId,
      inviteRecipientRole: recipientRole,
    };
    this.config.createCampaign(payload).subscribe({
      next: (created: Campaign) => {
        const applyLocalUpdate = () => {
          this.campaigns = [...this.campaigns, created];
          this.cd.detectChanges();
        };

        const validIds = inviteIds.filter((id: string) => !!id);
        if (!created?._id || validIds.length === 0) {
          applyLocalUpdate();
          return;
        }

        const request$ = recipientRole === 'photographer'
          ? this.config.invitePhotographers(created._id, validIds)
          : this.config.inviteInfluencers(created._id, validIds);
        request$.subscribe({
          next: () => applyLocalUpdate(),
          error: () => applyLocalUpdate(),
        });
      }
    });
  }

  onEditCampaign(event: { id: string; data: Partial<Campaign> & {
    inviteInfluencerIds?: string[];
    inviteRecipientIds?: string[];
    inviteRecipientRole?: 'influencer' | 'photographer';
  } }) {
    const { inviteInfluencerIds, inviteRecipientIds, inviteRecipientRole, ...campaignData } = (event?.data || {}) as any;
    const recipientRole: 'influencer' | 'photographer' = inviteRecipientRole === 'photographer' ? 'photographer' : 'influencer';
    const inviteIds = (Array.isArray(inviteRecipientIds) && inviteRecipientIds.length > 0)
      ? inviteRecipientIds
      : (Array.isArray(inviteInfluencerIds) ? inviteInfluencerIds : []);
    const updatePayload: any = {
      ...campaignData,
      inviteRecipientRole: recipientRole,
    };

    this.config.updateCampaign(event.id, updatePayload).subscribe({
      next: (updated: Campaign) => {
        const applyLocalUpdate = () => {
          this.campaigns = this.campaigns.map(c => c._id === event.id ? { ...c, ...updated } : c);
          this.cd.detectChanges();
        };

        const validIds = inviteIds.filter((id: string) => !!id);
        if (!event?.id || validIds.length === 0) {
          applyLocalUpdate();
          return;
        }

        const request$ = recipientRole === 'photographer'
          ? this.config.invitePhotographers(event.id, validIds)
          : this.config.inviteInfluencers(event.id, validIds);
        request$.subscribe({
          next: () => applyLocalUpdate(),
          error: () => applyLocalUpdate(),
        });
      }
    });
  }

  onDeleteCampaign(id: string) {
    this.config.deleteCampaign(id).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter(c => c._id !== id);
        this.cd.detectChanges();
      }
    });
  }
}
